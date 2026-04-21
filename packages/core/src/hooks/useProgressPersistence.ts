import { useCallback, useEffect, useRef, useState } from 'react'
import { usePlatform } from '../platform'
import { parseProgress } from '../utils/morseUtils'
import { LOCAL_PROGRESS_KEY } from '../utils/appState'
import type { Progress, ProgressSnapshot } from '../types'
import type { ProgressPayload } from '../firebase/progress'

type UseProgressPersistenceOptions = {
  progressSnapshot: ProgressSnapshot
  progressSaveDebounceMs: number
  applyProgress: (progress: Progress) => void
  listenWpmMin: number
  listenWpmMax: number
  listenEffectiveWpmMin: number
  listenEffectiveWpmMax: number
  levelMin: number
  levelMax: number
}

type UseProgressPersistenceResult = {
  progressUpdatedAt: number | null
  onRemoteProgress: (raw: unknown) => void
  pendingRemoteSyncTick: number
  consumePendingRemoteSync: () => ProgressPayload | null
  clearLocalProgress: () => Promise<void>
  flushPendingSave: () => void
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
  toneFrequency: progress.toneFrequency ?? base.toneFrequency,
  listenWpm: progress.listenWpm ?? base.listenWpm,
  listenEffectiveWpm: progress.listenEffectiveWpm ?? base.listenEffectiveWpm,
  listenAutoTightening:
    progress.listenAutoTightening ?? base.listenAutoTightening,
  listenAutoTighteningCorrectCount:
    progress.listenAutoTighteningCorrectCount ??
    base.listenAutoTighteningCorrectCount,
  listenTtr: progress.listenTtr ?? base.listenTtr,
  maxLevel: progress.maxLevel ?? base.maxLevel,
  practiceWordMode: progress.practiceWordMode ?? base.practiceWordMode,
  practiceAutoPlay: progress.practiceAutoPlay ?? base.practiceAutoPlay,
  practiceLearnMode: progress.practiceLearnMode ?? base.practiceLearnMode,
  practiceIfrMode: progress.practiceIfrMode ?? base.practiceIfrMode,
  practiceReviewMisses:
    progress.practiceReviewMisses ?? base.practiceReviewMisses,
  learnerProfile: progress.learnerProfile ?? base.learnerProfile,
  guidedCourseActive: progress.guidedCourseActive ?? base.guidedCourseActive,
  guidedPackIndex: progress.guidedPackIndex ?? base.guidedPackIndex,
  guidedPhase: progress.guidedPhase ?? base.guidedPhase,
  guidedProgress: progress.guidedProgress ?? base.guidedProgress,
  scores: progress.scores ?? base.scores,
  showHint: progress.showHint ?? base.showHint,
  showMnemonic: progress.showMnemonic ?? base.showMnemonic,
  wordMode: progress.wordMode ?? base.wordMode,
  dailyActivity: progress.dailyActivity ?? base.dailyActivity,
  streak: progress.streak ?? base.streak,
  letterAccuracy: progress.letterAccuracy ?? base.letterAccuracy,
  bestWpm: progress.bestWpm ?? base.bestWpm,
  reminder: progress.reminder ?? base.reminder,
})

const clearTimer = (ref: { current: TimeoutHandle | null }) => {
  if (ref.current !== null) {
    clearTimeout(ref.current)
    ref.current = null
  }
}

/**
 * Reads, merges, and writes the local progress payload via the platform storage
 * adapter. Owns the debounced save loop and the remote-vs-local reconciliation
 * that surfaces through `pendingRemoteSyncTick` / `consumePendingRemoteSync`.
 */
export const useProgressPersistence = ({
  progressSnapshot,
  progressSaveDebounceMs,
  applyProgress,
  listenWpmMin,
  listenWpmMax,
  listenEffectiveWpmMin,
  listenEffectiveWpmMax,
  levelMin,
  levelMax,
}: UseProgressPersistenceOptions): UseProgressPersistenceResult => {
  const platform = usePlatform()
  const [progressUpdatedAt, setProgressUpdatedAt] = useState<number | null>(
    null,
  )
  const [localReady, setLocalReady] = useState(false)
  const [pendingRemoteSyncTick, setPendingRemoteSyncTick] = useState(0)
  const progressSnapshotRef = useRef(progressSnapshot)
  const applyProgressRef = useRef(applyProgress)
  const localProgressRef = useRef<ProgressPayload | null>(null)
  const pendingRemoteProgressRef = useRef<unknown | null>(null)
  const pendingRemoteSyncRef = useRef(false)
  const pendingPersistUpdatedAtRef = useRef<number | null>(null)
  const localSaveTimeoutRef = useRef<TimeoutHandle | null>(null)
  const pendingLocalSnapshotRef = useRef<ProgressSnapshot | null>(null)
  const pendingLocalUpdatedAtRef = useRef<number | null>(null)
  const lastPersistedSnapshotRef = useRef<string | null>(null)
  const storageRef = useRef(platform.storage)

  useEffect(() => {
    progressSnapshotRef.current = progressSnapshot
  }, [progressSnapshot])

  useEffect(() => {
    applyProgressRef.current = applyProgress
  }, [applyProgress])

  useEffect(() => {
    storageRef.current = platform.storage
  }, [platform.storage])

  const parseIncomingProgress = useCallback(
    (raw: unknown) => {
      const progress = parseProgress(raw, {
        listenWpmMin,
        listenWpmMax,
        listenEffectiveWpmMin,
        listenEffectiveWpmMax,
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
    [
      levelMax,
      levelMin,
      listenEffectiveWpmMax,
      listenEffectiveWpmMin,
      listenWpmMax,
      listenWpmMin,
    ],
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
      applyProgressRef.current(progress)
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
    [localReady, parseIncomingProgress],
  )

  useEffect(() => {
    let isActive = true
    const loadLocalProgress = async () => {
      try {
        const stored = await storageRef.current.getItem(LOCAL_PROGRESS_KEY)
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
        applyProgressRef.current(progress)
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
  }, [parseIncomingProgress])

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

  const persistSnapshot = useCallback(() => {
    const snapshot = pendingLocalSnapshotRef.current
    const updatedAt = pendingLocalUpdatedAtRef.current
    if (!snapshot || updatedAt === null) {
      return
    }
    clearTimer(localSaveTimeoutRef)
    const payload: ProgressPayload = {
      ...snapshot,
      updatedAt,
    }
    pendingLocalSnapshotRef.current = null
    pendingLocalUpdatedAtRef.current = null
    lastPersistedSnapshotRef.current = JSON.stringify(snapshot)
    localProgressRef.current = payload
    setProgressUpdatedAt(updatedAt)
    void storageRef.current
      .setItem(LOCAL_PROGRESS_KEY, JSON.stringify(payload))
      .catch((error: unknown) => {
        console.error('Failed to save local progress', error)
      })
  }, [])

  const flushPendingSave = useCallback(() => {
    persistSnapshot()
  }, [persistSnapshot])

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
      persistSnapshot()
    }, progressSaveDebounceMs)

    return () => {
      clearTimer(localSaveTimeoutRef)
    }
  }, [localReady, persistSnapshot, progressSaveDebounceMs, progressSnapshot])

  const consumePendingRemoteSync = useCallback(() => {
    if (!pendingRemoteSyncRef.current) {
      return null
    }
    pendingRemoteSyncRef.current = false
    return localProgressRef.current
  }, [])

  const clearLocalProgress = useCallback(async () => {
    clearTimer(localSaveTimeoutRef)
    pendingRemoteProgressRef.current = null
    pendingRemoteSyncRef.current = false
    pendingPersistUpdatedAtRef.current = null
    pendingLocalSnapshotRef.current = null
    pendingLocalUpdatedAtRef.current = null
    localProgressRef.current = null
    lastPersistedSnapshotRef.current = null
    setProgressUpdatedAt(null)
    await storageRef.current.removeItem(LOCAL_PROGRESS_KEY)
  }, [])

  return {
    progressUpdatedAt,
    onRemoteProgress,
    pendingRemoteSyncTick,
    consumePendingRemoteSync,
    clearLocalProgress,
    flushPendingSave,
  }
}
