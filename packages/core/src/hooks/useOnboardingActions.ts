import { useCallback } from 'react'
import { usePlatform } from '../platform'
import { NUX_STATUS_KEY, type NuxStep } from '../utils/appState'
import { createGuidedLessonProgress } from '../utils/beginnerCourse'
import type {
  GuidedLessonProgress,
  GuidedPhase,
  LearnerProfile,
  ReminderSettings,
} from '../types'

type RefValue<T> = {
  current: T
}

type UseOnboardingActionsOptions = {
  didCompleteSoundCheck: boolean
  tutorialTapCount: number
  tutorialHoldCount: number
  persistIntroHintStep: (step: 'morse' | 'settings' | 'done') => void
  persistNuxStatus: (status: 'pending' | 'completed' | 'skipped') => void
  setNuxStatus: (status: 'pending' | 'completed' | 'skipped') => void
  setNuxStep: (step: NuxStep) => void
  setLearnerProfile: (profile: LearnerProfile | null) => void
  onReminderChange: (reminder: ReminderSettings | undefined) => void
  setDidCompleteSoundCheck: (value: boolean) => void
  setTutorialTapCount: (value: number) => void
  setTutorialHoldCount: (value: number) => void
  setShowSettings: (value: boolean) => void
  setShowAbout: (value: boolean) => void
  setShowReference: (value: boolean) => void
  setShowHint: (value: boolean) => void
  setShowMnemonic: (value: boolean) => void
  setPracticeAutoPlay: (value: boolean) => void
  setPracticeLearnMode: (value: boolean) => void
  setPracticeIfrMode: (value: boolean) => void
  setPracticeReviewMisses: (value: boolean) => void
  setGuidedCourseActive: (value: boolean) => void
  setGuidedPhase: (phase: GuidedPhase) => void
  setGuidedProgress: (progress: GuidedLessonProgress) => void
  learnerProfileRef: RefValue<LearnerProfile | null>
  guidedCourseActiveRef: RefValue<boolean>
  guidedPhaseRef: RefValue<GuidedPhase>
  guidedProgressRef: RefValue<GuidedLessonProgress>
  practiceLearnModeRef: RefValue<boolean>
  practiceIfrModeRef: RefValue<boolean>
  practiceReviewMissesRef: RefValue<boolean>
  practiceReviewQueueRef: RefValue<unknown[]>
  applyKnownLearnerDefaults: () => void
  moveIntoGuidedLesson: (
    nextPhase: GuidedPhase,
    nextPackIndex: number,
    nextProgress: GuidedLessonProgress,
  ) => void
  logAnalyticsEvent: (event: string, params?: Record<string, unknown>) => void
  ensureNotificationPermission: () => Promise<boolean>
  playTone: (code: '.' | '-') => void
}

/** Builds onboarding flow handlers while keeping App.tsx focused on composition. */
export const useOnboardingActions = ({
  didCompleteSoundCheck,
  tutorialTapCount,
  tutorialHoldCount,
  persistIntroHintStep,
  persistNuxStatus,
  setNuxStatus,
  setNuxStep,
  setLearnerProfile,
  setDidCompleteSoundCheck,
  setTutorialTapCount,
  setTutorialHoldCount,
  setShowSettings,
  setShowAbout,
  setShowReference,
  setShowHint,
  setShowMnemonic,
  setPracticeAutoPlay,
  setPracticeLearnMode,
  setPracticeIfrMode,
  setPracticeReviewMisses,
  setGuidedCourseActive,
  setGuidedPhase,
  setGuidedProgress,
  learnerProfileRef,
  guidedCourseActiveRef,
  guidedPhaseRef,
  guidedProgressRef,
  practiceLearnModeRef,
  practiceIfrModeRef,
  practiceReviewMissesRef,
  practiceReviewQueueRef,
  applyKnownLearnerDefaults,
  moveIntoGuidedLesson,
  onReminderChange,
  logAnalyticsEvent,
  ensureNotificationPermission,
  playTone,
}: UseOnboardingActionsOptions) => {
  const platform = usePlatform()

  const playOnboardingCode = useCallback((code: '.' | '-') => {
    playTone(code)
  }, [playTone])

  const handleNuxWelcomeDone = useCallback(() => {
    setNuxStep('profile')
  }, [setNuxStep])

  const handleNuxChooseProfile = useCallback((profile: LearnerProfile) => {
    setLearnerProfile(profile)
    learnerProfileRef.current = profile
    setNuxStep('sound_check')
  }, [learnerProfileRef, setLearnerProfile, setNuxStep])

  const handleNuxPlaySoundCheck = useCallback(() => {
    playOnboardingCode('.')
    setDidCompleteSoundCheck(true)
  }, [playOnboardingCode, setDidCompleteSoundCheck])

  const handleNuxContinueFromSoundCheck = useCallback(() => {
    if (!didCompleteSoundCheck) {
      return
    }
    setNuxStep('button_tutorial')
  }, [didCompleteSoundCheck, setNuxStep])

  const handleNuxCompleteButtonTutorial = useCallback(() => {
    if (tutorialTapCount < 3 || tutorialHoldCount < 3) {
      return
    }
    setNuxStep(learnerProfileRef.current === 'known' ? 'known_tour' : 'beginner_stages')
  }, [tutorialHoldCount, tutorialTapCount, learnerProfileRef, setNuxStep])

  const handleNuxContinueFromStages = useCallback(() => {
    setNuxStep('beginner_intro')
  }, [setNuxStep])

  const finishOnboarding = useCallback(() => {
    logAnalyticsEvent('onboarding_completed')
    persistNuxStatus('completed')
    persistIntroHintStep('done')
    setNuxStep('welcome')
    setDidCompleteSoundCheck(false)
    setTutorialTapCount(0)
    setTutorialHoldCount(0)
  }, [
    logAnalyticsEvent,
    persistIntroHintStep,
    persistNuxStatus,
    setDidCompleteSoundCheck,
    setTutorialHoldCount,
    setTutorialTapCount,
    setNuxStep,
  ])

  const handleFinishKnownTour = useCallback(() => {
    applyKnownLearnerDefaults()
    learnerProfileRef.current = 'known'
    setLearnerProfile('known')
    guidedCourseActiveRef.current = false
    guidedPhaseRef.current = 'complete'
    guidedProgressRef.current = createGuidedLessonProgress()
    setGuidedCourseActive(false)
    setGuidedPhase('complete')
    setGuidedProgress(createGuidedLessonProgress())
    setNuxStep('reminder')
  }, [
    applyKnownLearnerDefaults,
    guidedCourseActiveRef,
    guidedPhaseRef,
    guidedProgressRef,
    learnerProfileRef,
    setGuidedCourseActive,
    setGuidedPhase,
    setGuidedProgress,
    setLearnerProfile,
    setNuxStep,
  ])

  const handleStartBeginnerCourse = useCallback(() => {
    learnerProfileRef.current = 'beginner'
    setLearnerProfile('beginner')
    setShowHint(false)
    setShowMnemonic(false)
    setPracticeAutoPlay(true)
    setPracticeLearnMode(false)
    practiceLearnModeRef.current = false
    setPracticeIfrMode(false)
    practiceIfrModeRef.current = false
    practiceReviewQueueRef.current = []
    setPracticeReviewMisses(false)
    practiceReviewMissesRef.current = false
    setNuxStep('reminder')
  }, [
    learnerProfileRef,
    practiceIfrModeRef,
    practiceLearnModeRef,
    practiceReviewMissesRef,
    practiceReviewQueueRef,
    setLearnerProfile,
    setNuxStep,
    setPracticeAutoPlay,
    setPracticeIfrMode,
    setPracticeLearnMode,
    setPracticeReviewMisses,
    setShowHint,
    setShowMnemonic,
  ])

  const completeAfterReminderStep = useCallback(() => {
    const profile = learnerProfileRef.current
    finishOnboarding()
    if (profile === 'beginner') {
      moveIntoGuidedLesson('teach', 0, createGuidedLessonProgress())
    }
  }, [finishOnboarding, learnerProfileRef, moveIntoGuidedLesson])

  const handleNuxSetReminder = useCallback(
    async (time: string) => {
      const granted = await ensureNotificationPermission()
      onReminderChange({ enabled: granted, time })
      completeAfterReminderStep()
    },
    [completeAfterReminderStep, ensureNotificationPermission, onReminderChange],
  )

  const handleNuxSkipReminder = useCallback(() => {
    completeAfterReminderStep()
  }, [completeAfterReminderStep])

  const handleReplayNux = useCallback(() => {
    setShowSettings(false)
    setShowAbout(false)
    setShowReference(false)
    setNuxStatus('pending')
    setNuxStep('welcome')
    setLearnerProfile(null)
    setDidCompleteSoundCheck(false)
    setTutorialTapCount(0)
    setTutorialHoldCount(0)
    void platform.storage.setItem(NUX_STATUS_KEY, 'pending')
  }, [
    platform,
    setDidCompleteSoundCheck,
    setTutorialHoldCount,
    setTutorialTapCount,
    setLearnerProfile,
    setNuxStatus,
    setNuxStep,
    setShowAbout,
    setShowReference,
    setShowSettings,
  ])

  return {
    handleNuxWelcomeDone,
    handleNuxChooseProfile,
    handleNuxPlaySoundCheck,
    handleNuxContinueFromSoundCheck,
    handleNuxCompleteButtonTutorial,
    handleNuxContinueFromStages,
    handleFinishKnownTour,
    handleStartBeginnerCourse,
    handleNuxSetReminder,
    handleNuxSkipReminder,
    handleReplayNux,
  }
}
