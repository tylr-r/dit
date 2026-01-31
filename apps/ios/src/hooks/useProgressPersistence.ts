import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  parseProgress,
  type Progress,
  type ProgressPayload,
  type ProgressSnapshot,
} from '@dit/core'
import { useCallback, useEffect, useRef, useState } from 'react'

const LOCAL_PROGRESS_KEY = 'dit-progress'

type UseProgressPersistenceOptions = {
  progressSnapshot: ProgressSnapshot
  progressSaveDebounceMs: number
  applyProgress: (progress: Progress) => void
  listenWpmMin: number
  listenWpmMax: number
  levelMin: number
  levelMax: number
}

type UseProgressPersistenceResult = {
  progressUpdatedAt: number | null
  onRemoteProgress: (raw: unknown) => void
  pendingRemoteSyncTick: number
  consumePendingRemoteSync: () => ProgressPayload | null
}

type TimeoutHandle = ReturnType<typeof setTimeout>

const now = () => Date.now()

const extractUpdatedAt = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    return null
  }
  const record = value as Record<string, unknown>
  const updatedAt = record.updatedAt
  if (typeof updatedAt === 'number' && Number.isFinite(updatedAt)) {
    return updatedAt
  }
  return null
}

const mergeProgressSnapshot = (
  progress: Progress,
  base: ProgressSnapshot,
): ProgressSnapshot => ({
  listenWpm: progress.listenWpm ?? base.listenWpm,
  maxLevel: progress.maxLevel ?? base.maxLevel,
  practiceWordMode: progress.practiceWordMode ?? base.practiceWordMode,
  scores: progress.scores ?? base.scores,
  showHint: progress.showHint ?? base.showHint,
  showMnemonic: progress.showMnemonic ?? base.showMnemonic,
  wordMode: progress.wordMode ?? base.wordMode,
})

const clearTimer = (ref: { current: TimeoutHandle | null }) => {
  if (ref.current !== null) {
    clearTimeout(ref.current)
    ref.current = null
  }
}

export const useProgressPersistence = ({
  progressSnapshot,
  progressSaveDebounceMs,
  applyProgress,
  listenWpmMin,
  listenWpmMax,
  levelMin,
  levelMax,
}: UseProgressPersistenceOptions): UseProgressPersistenceResult => {
  const [progressUpdatedAt, setProgressUpdatedAt] = useState<number | null>(
    null,
  )
  const [localReady, setLocalReady] = useState(false)
  const [pendingRemoteSyncTick, setPendingRemoteSyncTick] = useState(0)
  const progressSnapshotRef = useRef(progressSnapshot)
  const localProgressRef = useRef<ProgressPayload | null>(null)
  const pendingRemoteProgressRef = useRef<unknown | null>(null)
  const pendingRemoteSyncRef = useRef(false)
  const pendingPersistUpdatedAtRef = useRef<number | null>(null)
  const localSaveTimeoutRef = useRef<TimeoutHandle | null>(null)
  const pendingLocalSnapshotRef = useRef<ProgressSnapshot | null>(null)
  const pendingLocalUpdatedAtRef = useRef<number | null>(null)
  const lastPersistedSnapshotRef = useRef<string | null>(null)

  useEffect(() => {
    progressSnapshotRef.current = progressSnapshot
  }, [progressSnapshot])

  const parseIncomingProgress = useCallback(
    (raw: unknown) => {
      const progress = parseProgress(raw, {
        listenWpmMin,
        listenWpmMax,
        levelMin,
        levelMax,
      })
      if (!progress) {
        return null
      }
      return {
        progress,
        updatedAt: extractUpdatedAt(raw),
      }
    },
    [levelMax, levelMin, listenWpmMax, listenWpmMin],
  )

  const onRemoteProgress = useCallback(
    (raw: unknown) => {
      if (!localReady) {
        pendingRemoteProgressRef.current = raw
        return
      }
      const parsed = parseIncomingProgress(raw)
      if (!parsed) {
        return
      }
      const { progress, updatedAt } = parsed
      const localUpdatedAt = localProgressRef.current?.updatedAt ?? null
      if (
        localUpdatedAt !== null &&
        (updatedAt === null || localUpdatedAt > updatedAt)
      ) {
        pendingRemoteSyncRef.current = true
        setPendingRemoteSyncTick((prev) => prev + 1)
        return
      }
      pendingPersistUpdatedAtRef.current = updatedAt
      applyProgress(progress)
      const nextSnapshot = mergeProgressSnapshot(
        progress,
        progressSnapshotRef.current,
      )
      const resolvedUpdatedAt = updatedAt ?? now()
      localProgressRef.current = {
        ...nextSnapshot,
        updatedAt: resolvedUpdatedAt,
      }
      setProgressUpdatedAt(resolvedUpdatedAt)
    },
    [applyProgress, localReady, parseIncomingProgress],
  )

  useEffect(() => {
    let isActive = true
    const loadLocalProgress = async () => {
      try {
        const stored = await AsyncStorage.getItem(LOCAL_PROGRESS_KEY)
        if (!isActive || !stored) {
          return
        }
        const parsedRaw = JSON.parse(stored) as unknown
        const parsed = parseIncomingProgress(parsedRaw)
        if (!parsed) {
          return
        }
        const { progress, updatedAt } = parsed
        pendingPersistUpdatedAtRef.current = updatedAt
        applyProgress(progress)
        const nextSnapshot = mergeProgressSnapshot(
          progress,
          progressSnapshotRef.current,
        )
        const resolvedUpdatedAt = updatedAt ?? now()
        localProgressRef.current = {
          ...nextSnapshot,
          updatedAt: resolvedUpdatedAt,
        }
        lastPersistedSnapshotRef.current = JSON.stringify(nextSnapshot)
        setProgressUpdatedAt(resolvedUpdatedAt)
      } catch (error) {
        console.error('Failed to load local progress', error)
      } finally {
        if (isActive) {
          setLocalReady(true)
        }
      }
    }
    void loadLocalProgress()
    return () => {
      isActive = false
    }
  }, [applyProgress, parseIncomingProgress])

  useEffect(() => {
    if (!localReady) {
      return
    }
    const pendingRemote = pendingRemoteProgressRef.current
    if (!pendingRemote) {
      return
    }
    pendingRemoteProgressRef.current = null
    onRemoteProgress(pendingRemote)
  }, [localReady, onRemoteProgress])

  useEffect(() => {
    if (!localReady) {
      return
    }
    const snapshotHash = JSON.stringify(progressSnapshot)
    if (snapshotHash === lastPersistedSnapshotRef.current) {
      return
    }
    pendingLocalSnapshotRef.current = progressSnapshot
    pendingLocalUpdatedAtRef.current =
      pendingPersistUpdatedAtRef.current ?? now()
    pendingPersistUpdatedAtRef.current = null
    clearTimer(localSaveTimeoutRef)
    localSaveTimeoutRef.current = setTimeout(() => {
      const snapshot = pendingLocalSnapshotRef.current
      const updatedAt = pendingLocalUpdatedAtRef.current
      if (!snapshot || updatedAt === null) {
        return
      }
      const payload: ProgressPayload = {
        ...snapshot,
        updatedAt,
      }
      lastPersistedSnapshotRef.current = JSON.stringify(snapshot)
      localProgressRef.current = payload
      setProgressUpdatedAt(updatedAt)
      void AsyncStorage.setItem(
        LOCAL_PROGRESS_KEY,
        JSON.stringify(payload),
      ).catch((error: unknown) => {
        console.error('Failed to save local progress', error)
      })
    }, progressSaveDebounceMs)

    return () => {
      clearTimer(localSaveTimeoutRef)
    }
  }, [localReady, progressSaveDebounceMs, progressSnapshot])

  const consumePendingRemoteSync = useCallback(() => {
    if (!pendingRemoteSyncRef.current) {
      return null
    }
    pendingRemoteSyncRef.current = false
    return localProgressRef.current
  }, [])

  return {
    progressUpdatedAt,
    onRemoteProgress,
    pendingRemoteSyncTick,
    consumePendingRemoteSync,
  }
}
