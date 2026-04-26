// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useOnboardingActions } from '../../src/hooks/useOnboardingActions'
import { createNoopPlatform, PlatformProvider, type Platform } from '../../src/platform'
import { NUX_STATUS_KEY } from '../../src/utils/appState'
import type {
  GuidedLessonProgress,
  GuidedPhase,
  LearnerProfile,
} from '../../src/types'

type Options = Parameters<typeof useOnboardingActions>[0]

const makeRef = <T,>(initial: T) => ({ current: initial })

const buildOptions = (overrides: Partial<Options> = {}): Options => {
  const learnerProfileRef = makeRef<LearnerProfile | null>(null)
  const guidedCourseActiveRef = makeRef(false)
  const guidedPhaseRef = makeRef<GuidedPhase>('teach')
  const guidedProgressRef = makeRef<GuidedLessonProgress>({
    packIndex: 0,
    teachIndex: 0,
    practiceAttempts: 0,
    practiceCorrect: 0,
    listenAttempts: 0,
    listenCorrect: 0,
  } as GuidedLessonProgress)
  const practiceLearnModeRef = makeRef(false)
  const practiceIfrModeRef = makeRef(false)
  const practiceReviewMissesRef = makeRef(false)
  const practiceReviewQueueRef = makeRef<unknown[]>([])

  const base: Options = {
    didCompleteSoundCheck: false,
    tutorialTapCount: 0,
    tutorialHoldCount: 0,
    persistIntroHintStep: vi.fn(),
    persistNuxStatus: vi.fn(),
    setNuxStatus: vi.fn(),
    setNuxStep: vi.fn(),
    setLearnerProfile: vi.fn(),
    onReminderChange: vi.fn(),
    setDidCompleteSoundCheck: vi.fn(),
    setTutorialTapCount: vi.fn(),
    setTutorialHoldCount: vi.fn(),
    setShowSettings: vi.fn(),
    setShowAbout: vi.fn(),
    setShowReference: vi.fn(),
    setShowHint: vi.fn(),
    setShowMnemonic: vi.fn(),
    setPracticeAutoPlay: vi.fn(),
    setPracticeLearnMode: vi.fn(),
    setPracticeIfrMode: vi.fn(),
    setPracticeReviewMisses: vi.fn(),
    setGuidedCourseActive: vi.fn(),
    setGuidedPhase: vi.fn(),
    setGuidedProgress: vi.fn(),
    learnerProfileRef,
    guidedCourseActiveRef,
    guidedPhaseRef,
    guidedProgressRef,
    practiceLearnModeRef,
    practiceIfrModeRef,
    practiceReviewMissesRef,
    practiceReviewQueueRef,
    applyKnownLearnerDefaults: vi.fn(),
    moveIntoGuidedLesson: vi.fn(),
    logAnalyticsEvent: vi.fn(),
    ensureNotificationPermission: vi.fn(async () => true),
    playTone: vi.fn(),
  }

  return { ...base, ...overrides }
}

const renderOnboardingHook = (options: Options, platform?: Platform) => {
  const resolvedPlatform = platform ?? createNoopPlatform()
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(PlatformProvider, { value: resolvedPlatform }, children)
  return renderHook(() => useOnboardingActions(options), { wrapper })
}

describe('useOnboardingActions', () => {
  it('plays a dit tone and marks the sound check complete when invoked', () => {
    const options = buildOptions()
    const { result } = renderOnboardingHook(options)

    act(() => {
      result.current.handleNuxPlaySoundCheck()
    })

    expect(options.playTone).toHaveBeenCalledTimes(1)
    expect(options.playTone).toHaveBeenCalledWith('.')
    expect(options.setDidCompleteSoundCheck).toHaveBeenCalledWith(true)
  })

  it('only advances past the button tutorial when tap and hold counts both reach 3', () => {
    const belowThreshold = buildOptions({ tutorialTapCount: 2, tutorialHoldCount: 3 })
    const { result: belowResult } = renderOnboardingHook(belowThreshold)

    act(() => {
      belowResult.current.handleNuxCompleteButtonTutorial()
    })

    expect(belowThreshold.setNuxStep).not.toHaveBeenCalled()

    const atThreshold = buildOptions({ tutorialTapCount: 3, tutorialHoldCount: 3 })
    atThreshold.learnerProfileRef.current = 'beginner'
    const { result: atResult } = renderOnboardingHook(atThreshold)

    act(() => {
      atResult.current.handleNuxCompleteButtonTutorial()
    })

    expect(atThreshold.setNuxStep).toHaveBeenCalledWith('beginner_stages')

    const knownAtThreshold = buildOptions({ tutorialTapCount: 4, tutorialHoldCount: 5 })
    knownAtThreshold.learnerProfileRef.current = 'known'
    const { result: knownResult } = renderOnboardingHook(knownAtThreshold)

    act(() => {
      knownResult.current.handleNuxCompleteButtonTutorial()
    })

    expect(knownAtThreshold.setNuxStep).toHaveBeenCalledWith('reminder')
    expect(knownAtThreshold.applyKnownLearnerDefaults).toHaveBeenCalledTimes(1)
  })

  it('shows the known tour after the reminder step for known learners', () => {
    const options = buildOptions()
    options.learnerProfileRef.current = 'known'
    const { result } = renderOnboardingHook(options)

    act(() => {
      result.current.handleNuxSkipReminder()
    })

    expect(options.setNuxStep).toHaveBeenCalledWith('known_tour')
    expect(options.persistNuxStatus).not.toHaveBeenCalled()
  })

  it('finishes onboarding after the known tour', () => {
    const options = buildOptions()
    options.learnerProfileRef.current = 'known'
    const { result } = renderOnboardingHook(options)

    act(() => {
      result.current.handleFinishKnownTour()
    })

    expect(options.applyKnownLearnerDefaults).toHaveBeenCalledTimes(1)
    expect(options.persistNuxStatus).toHaveBeenCalledWith('completed')
    expect(options.setNuxStep).toHaveBeenCalledWith('welcome')
  })

  it('persists the pending NUX status via platform storage on replay', async () => {
    const setItem = vi.fn(async () => {})
    const platform = createNoopPlatform({
      storage: {
        getItem: async () => null,
        setItem,
        removeItem: async () => {},
      },
    })
    const options = buildOptions()
    const { result } = renderOnboardingHook(options, platform)

    act(() => {
      result.current.handleReplayNux()
    })

    expect(setItem).toHaveBeenCalledTimes(1)
    expect(setItem).toHaveBeenCalledWith(NUX_STATUS_KEY, 'pending')
    expect(options.setNuxStatus).toHaveBeenCalledWith('pending')
    expect(options.setNuxStep).toHaveBeenCalledWith('welcome')
    expect(options.setLearnerProfile).toHaveBeenCalledWith(null)
  })
})
