// @vitest-environment jsdom
import { createElement, type ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createNoopPlatform, PlatformProvider, type Platform } from '../../src/platform'
import { createGuidedLessonProgress } from '../../src/utils/beginnerCourse'
import { initializeScores } from '../../src/utils/morseUtils'
import type { ProgressSnapshot } from '../../src/types'

// Mock the Database-based progress-sync hook so tests don't touch real firebase.
const firebaseSyncMocks = {
  remoteLoaded: false,
  saveNow: vi.fn(),
  deleteRemoteProgress: vi.fn(async () => {}),
}
vi.mock('../../src/hooks/useFirebaseProgressSync', () => ({
  useFirebaseProgressSync: () => firebaseSyncMocks,
}))

// Import AFTER the mock is registered so the controller picks up the mocked hook.
import { useProgressSyncController, type Mode } from '../../src/hooks/useProgressSyncController'

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

type ControllerOptions = Parameters<typeof useProgressSyncController>[0]

const makeRef = <T>(current: T) => ({ current })

const makeState = () => ({
  setScores: vi.fn(),
  setListenTtr: vi.fn(),
  setShowHint: vi.fn(),
  setShowMnemonic: vi.fn(),
  setPracticeIfrMode: vi.fn(),
  setPracticeReviewMisses: vi.fn(),
  setLearnerProfile: vi.fn(),
  setGuidedCourseActive: vi.fn(),
  setGuidedPackIndex: vi.fn(),
  setGuidedPhase: vi.fn(),
  setGuidedProgress: vi.fn(),
  setPracticeAutoPlay: vi.fn(),
  setPracticeLearnMode: vi.fn(),
  setFreestyleWordMode: vi.fn(),
  setFreestyleResult: vi.fn(),
  setFreestyleInput: vi.fn(),
  setFreestyleWord: vi.fn(),
  setToneFrequency: vi.fn(),
  setListenWpm: vi.fn(),
  setListenEffectiveWpm: vi.fn(),
  setListenAutoTightening: vi.fn(),
  setListenAutoTighteningCorrectCount: vi.fn(),
  setMaxLevel: vi.fn(),
  setPracticeWordMode: vi.fn(),
  setPracticeWpm: vi.fn(),
  setDailyActivity: vi.fn(),
  setStreak: vi.fn(),
  setLetterAccuracy: vi.fn(),
  setBestWpm: vi.fn(),
  setReminder: vi.fn(),
})

const makeRefs = () => ({
  scoresRef: makeRef(initializeScores()),
  listenTtrRef: makeRef({}),
  dailyActivityRef: makeRef({}),
  streakRef: makeRef(undefined as ControllerOptions['refs']['streakRef']['current']),
  letterAccuracyRef: makeRef({}),
  practiceAutoPlayRef: makeRef(true),
  practiceLearnModeRef: makeRef(true),
  practiceIfrModeRef: makeRef(false),
  practiceReviewMissesRef: makeRef(false),
  practiceReviewQueueRef: makeRef([] as ControllerOptions['refs']['practiceReviewQueueRef']['current']),
  errorLockoutUntilRef: makeRef(0),
  learnerProfileRef: makeRef(null as ControllerOptions['refs']['learnerProfileRef']['current']),
  guidedCourseActiveRef: makeRef(false),
  guidedPackIndexRef: makeRef(0),
  guidedPhaseRef: makeRef('teach' as ControllerOptions['refs']['guidedPhaseRef']['current']),
  guidedProgressRef: makeRef(createGuidedLessonProgress()),
  freestyleWordModeRef: makeRef(false),
  wordSpaceTimeoutRef: makeRef(null as ReturnType<typeof setTimeout> | null),
  listenWpmRef: makeRef(20),
  listenEffectiveWpmRef: makeRef(15),
  listenAutoTighteningRef: makeRef(false),
  listenAutoTighteningCorrectCountRef: makeRef(0),
  modeRef: makeRef('practice' as Mode),
  listenStatusRef: makeRef('idle' as ControllerOptions['refs']['listenStatusRef']['current']),
  maxLevelRef: makeRef(1 as ControllerOptions['refs']['maxLevelRef']['current']),
  practiceWordModeRef: makeRef(false),
  practiceWordStartRef: makeRef(null as number | null),
  letterRef: makeRef('E' as ControllerOptions['refs']['letterRef']['current']),
})

const makeHelpers = () => ({
  syncGuidedLevel: vi.fn(),
  setNextListenLetter: vi.fn(
    (nextLetters, current) => (current ?? nextLetters[0] ?? 'E') as ControllerOptions['refs']['letterRef']['current'],
  ),
  setNextLetterForLevel: vi.fn(
    (nextLetters, current) => (current ?? nextLetters[0] ?? 'E') as ControllerOptions['refs']['letterRef']['current'],
  ),
  setPracticeWordFromList: vi.fn(),
  playListenSequenceForLetter: vi.fn(),
})

const makeOptions = (overrides: Partial<ControllerOptions> = {}): ControllerOptions => ({
  database: {} as ControllerOptions['database'],
  user: null,
  progressSnapshot: baseSnapshot,
  state: makeState(),
  refs: makeRefs(),
  helpers: makeHelpers(),
  ...overrides,
})

const platform: Platform = createNoopPlatform()

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(PlatformProvider, { value: platform }, children)

describe('useProgressSyncController', () => {
  beforeEach(() => {
    firebaseSyncMocks.remoteLoaded = false
    firebaseSyncMocks.saveNow.mockReset()
    firebaseSyncMocks.deleteRemoteProgress.mockReset()
  })

  it('invokes onProgressSnapshotChange with the current snapshot on mount and on change', () => {
    const onProgressSnapshotChange = vi.fn()
    const options = makeOptions({ onProgressSnapshotChange })

    const { rerender } = renderHook(
      (props: ControllerOptions) => useProgressSyncController(props),
      { wrapper, initialProps: options },
    )

    expect(onProgressSnapshotChange).toHaveBeenCalledTimes(1)
    expect(onProgressSnapshotChange).toHaveBeenCalledWith(baseSnapshot)

    const nextSnapshot: ProgressSnapshot = { ...baseSnapshot, listenWpm: 25 }
    rerender({ ...options, progressSnapshot: nextSnapshot })

    expect(onProgressSnapshotChange).toHaveBeenCalledTimes(2)
    expect(onProgressSnapshotChange).toHaveBeenLastCalledWith(nextSnapshot)
  })

  it('is a safe no-op (no throws, no setters invoked) when user is null', () => {
    const options = makeOptions({ user: null })

    expect(() => {
      renderHook(() => useProgressSyncController(options), { wrapper })
    }).not.toThrow()

    // No remote progress was received, so none of the state setters should have fired.
    const state = options.state as Record<string, ReturnType<typeof vi.fn>>
    for (const key of Object.keys(state)) {
      expect(state[key]).not.toHaveBeenCalled()
    }
    // And saveNow must not have been called because the guarded effect exits on !user.
    expect(firebaseSyncMocks.saveNow).not.toHaveBeenCalled()
  })

  it('omits onProgressSnapshotChange entirely when not provided (optional callback)', () => {
    const options = makeOptions()
    expect('onProgressSnapshotChange' in options).toBe(false)

    const result = renderHook(() => useProgressSyncController(options), { wrapper })
    // Returned API surface matches iOS version.
    expect(typeof result.result.current.clearLocalProgress).toBe('function')
    expect(typeof result.result.current.deleteRemoteProgress).toBe('function')
    expect(typeof result.result.current.flushPendingSave).toBe('function')

    // Avoid unused `act` lint warning; wraps a trivial effect flush.
    act(() => {})
  })
})
