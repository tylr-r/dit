import React, { type ReactNode } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useProgressPersistence } from '../../src/hooks/useProgressPersistence'
import {
  createNoopPlatform,
  PlatformProvider,
  type Platform,
  type StorageAdapter,
} from '../../src/platform'
import { LOCAL_PROGRESS_KEY } from '../../src/utils/appState'
import { initializeScores } from '../../src/utils/morseUtils'
import { createGuidedLessonProgress } from '../../src/utils/beginnerCourse'
import type { Progress, ProgressSnapshot } from '../../src/types'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

const baseSnapshot: ProgressSnapshot = {
  listenWpm: 20,
  listenEffectiveWpm: 15,
  listenAutoTightening: false,
  listenAutoTighteningCorrectCount: 0,
  listenTtr: {},
  maxLevel: 1,
  practiceWordMode: false,
  practiceAutoPlay: true,
  practiceLearnMode: true,
  practiceIfrMode: false,
  practiceReviewMisses: false,
  guidedCourseActive: false,
  guidedPackIndex: 0,
  guidedPhase: 'teach',
  guidedProgress: createGuidedLessonProgress(),
  scores: initializeScores(),
  showHint: false,
  showMnemonic: false,
  wordMode: false,
}

const baseProps = {
  progressSnapshot: baseSnapshot,
  progressSaveDebounceMs: 50,
  listenWpmMin: 5,
  listenWpmMax: 60,
  listenEffectiveWpmMin: 5,
  listenEffectiveWpmMax: 60,
  levelMin: 1,
  levelMax: 4,
}

type StorageMock = {
  adapter: StorageAdapter
  getItem: ReturnType<typeof vi.fn>
  setItem: ReturnType<typeof vi.fn>
  removeItem: ReturnType<typeof vi.fn>
  store: Map<string, string>
}

const createStorageMock = (seed?: Record<string, string>): StorageMock => {
  const store = new Map<string, string>(Object.entries(seed ?? {}))
  const getItem = vi.fn(async (key: string) => store.get(key) ?? null)
  const setItem = vi.fn(async (key: string, value: string) => {
    store.set(key, value)
  })
  const removeItem = vi.fn(async (key: string) => {
    store.delete(key)
  })
  return {
    adapter: { getItem, setItem, removeItem },
    getItem,
    setItem,
    removeItem,
    store,
  }
}

const createPlatform = (storage: StorageAdapter): Platform =>
  createNoopPlatform({ storage })

const wrap = (platform: Platform, child: ReactNode): ReactNode =>
  React.createElement(
    PlatformProvider,
    { value: platform },
    child,
  )

const flushEffects = async () => {
  await vi.advanceTimersByTimeAsync(0)
  await Promise.resolve()
  await Promise.resolve()
}

describe('useProgressPersistence', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('applies and persists remote progress via platform storage', async () => {
    const storage = createStorageMock()
    const platform = createPlatform(storage.adapter)
    const applyProgress = vi.fn<(progress: Progress) => void>()

    let hookResult: ReturnType<typeof useProgressPersistence> | null = null
    const TestHarness = () => {
      hookResult = useProgressPersistence({
        ...baseProps,
        applyProgress,
      })
      return null
    }

    await act(async () => {
      create(wrap(platform, React.createElement(TestHarness)))
      await flushEffects()
    })

    // Feed a remote payload. Since local was empty, this should apply and
    // eventually schedule a debounced save.
    await act(async () => {
      hookResult!.onRemoteProgress({
        practiceAutoPlay: false,
        practiceLearnMode: false,
        showHint: true,
        updatedAt: 500,
      })
      await flushEffects()
    })

    expect(applyProgress).toHaveBeenCalledTimes(1)
    const applied = applyProgress.mock.calls[0][0]
    expect(applied.practiceAutoPlay).toBe(false)
    expect(applied.practiceLearnMode).toBe(false)
    expect(applied.showHint).toBe(true)
    expect(hookResult!.progressUpdatedAt).toBe(500)

    // Nothing has been persisted yet — persistence is driven by the
    // progressSnapshot prop changing to match applied progress.
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('flushPendingSave writes the latest snapshot to storage immediately', async () => {
    const storage = createStorageMock()
    const platform = createPlatform(storage.adapter)
    const applyProgress = vi.fn<(progress: Progress) => void>()

    let hookResult: ReturnType<typeof useProgressPersistence> | null = null
    const TestHarness = ({ showHint }: { showHint: boolean }) => {
      hookResult = useProgressPersistence({
        ...baseProps,
        progressSnapshot: { ...baseSnapshot, showHint },
        applyProgress,
      })
      return null
    }

    let renderer: ReactTestRenderer | null = null
    await act(async () => {
      renderer = create(wrap(platform, React.createElement(TestHarness, { showHint: false })))
      await flushEffects()
    })

    // Change snapshot — schedules debounced save.
    await act(async () => {
      renderer!.update(wrap(platform, React.createElement(TestHarness, { showHint: true })))
      await flushEffects()
    })

    expect(storage.setItem).not.toHaveBeenCalled()

    act(() => {
      hookResult!.flushPendingSave()
    })

    expect(storage.setItem).toHaveBeenCalledTimes(1)
    const [savedKey, savedValue] = storage.setItem.mock.calls[0]
    expect(savedKey).toBe(LOCAL_PROGRESS_KEY)
    const savedPayload = JSON.parse(savedValue) as Record<string, unknown>
    expect(savedPayload.showHint).toBe(true)
  })

  it('restores progress from storage on mount and ignores stale remotes', async () => {
    const storage = createStorageMock({
      [LOCAL_PROGRESS_KEY]: JSON.stringify({
        practiceAutoPlay: false,
        practiceLearnMode: false,
        updatedAt: 1000,
      }),
    })
    const platform = createPlatform(storage.adapter)
    const applyProgress = vi.fn<(progress: Progress) => void>()

    let hookResult: ReturnType<typeof useProgressPersistence> | null = null
    const TestHarness = () => {
      hookResult = useProgressPersistence({
        ...baseProps,
        applyProgress,
      })
      return null
    }

    await act(async () => {
      create(wrap(platform, React.createElement(TestHarness)))
      await flushEffects()
    })

    expect(storage.getItem).toHaveBeenCalledWith(LOCAL_PROGRESS_KEY)
    expect(applyProgress).toHaveBeenCalledTimes(1)
    const applied = applyProgress.mock.calls[0][0]
    expect(applied.practiceAutoPlay).toBe(false)
    expect(applied.practiceLearnMode).toBe(false)

    // An older remote payload should not re-apply; it should signal a
    // pending-remote-sync tick instead.
    const initialTick = hookResult!.pendingRemoteSyncTick
    await act(async () => {
      hookResult!.onRemoteProgress({
        practiceAutoPlay: true,
        updatedAt: 500,
      })
      await flushEffects()
    })

    expect(applyProgress).toHaveBeenCalledTimes(1)
    expect(hookResult!.pendingRemoteSyncTick).toBe(initialTick + 1)
    const pending = hookResult!.consumePendingRemoteSync()
    expect(pending?.updatedAt).toBe(1000)
  })
})
