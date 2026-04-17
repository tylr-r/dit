import {
  createGuidedLessonProgress,
  DEFAULT_CHARACTER_WPM,
  type GuidedLessonProgress,
  type GuidedPhase,
  type LearnerProfile,
} from '@dit/core'
import { triggerHaptics } from '@dit/dit-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback } from 'react'
import {
  LISTEN_MIN_UNIT_MS,
  NUX_STATUS_KEY,
} from '../utils/appState'
import { playMorseTone } from '../utils/tone'

type RefValue<T> = {
  current: T
}

type UseOnboardingActionsOptions = {
  toneFrequency: number
  didCompleteSoundCheck: boolean
  tutorialTapCount: number
  tutorialHoldCount: number
  persistIntroHintStep: (step: 'morse' | 'settings' | 'done') => void
  persistNuxStatus: (status: 'pending' | 'completed' | 'skipped') => void
  setNuxStatus: (status: 'pending' | 'completed' | 'skipped') => void
  setNuxStep: (step: 'welcome' | 'profile' | 'sound_check' | 'button_tutorial' | 'known_tour' | 'beginner_stages' | 'beginner_intro') => void
  setLearnerProfile: (profile: LearnerProfile | null) => void
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
}

/** Builds onboarding flow handlers while keeping App.tsx focused on composition. */
export const useOnboardingActions = ({
  toneFrequency,
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
}: UseOnboardingActionsOptions) => {
  const playOnboardingCode = useCallback((code: '.' | '-') => {
    void playMorseTone({
      code,
      characterWpm: DEFAULT_CHARACTER_WPM,
      effectiveWpm: DEFAULT_CHARACTER_WPM,
      minUnitMs: LISTEN_MIN_UNIT_MS,
      frequency: toneFrequency,
    })
    void triggerHaptics(10)
  }, [toneFrequency])

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

  const handleNuxPlayDitDemo = useCallback(() => {
    playOnboardingCode('.')
  }, [playOnboardingCode])

  const handleNuxPlayDahDemo = useCallback(() => {
    playOnboardingCode('-')
  }, [playOnboardingCode])

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
    persistNuxStatus('completed')
    persistIntroHintStep('done')
    setNuxStep('welcome')
    setDidCompleteSoundCheck(false)
    setTutorialTapCount(0)
    setTutorialHoldCount(0)
  }, [
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
    finishOnboarding()
  }, [
    applyKnownLearnerDefaults,
    finishOnboarding,
    guidedCourseActiveRef,
    guidedPhaseRef,
    guidedProgressRef,
    learnerProfileRef,
    setGuidedCourseActive,
    setGuidedPhase,
    setGuidedProgress,
    setLearnerProfile,
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
    finishOnboarding()
    moveIntoGuidedLesson('teach', 0, createGuidedLessonProgress())
  }, [
    finishOnboarding,
    learnerProfileRef,
    moveIntoGuidedLesson,
    practiceIfrModeRef,
    practiceLearnModeRef,
    practiceReviewMissesRef,
    practiceReviewQueueRef,
    setLearnerProfile,
    setPracticeAutoPlay,
    setPracticeIfrMode,
    setPracticeLearnMode,
    setPracticeReviewMisses,
    setShowHint,
    setShowMnemonic,
  ])

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
    void AsyncStorage.setItem(NUX_STATUS_KEY, 'pending')
  }, [
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
    handleNuxPlayDitDemo,
    handleNuxPlayDahDemo,
    handleNuxContinueFromSoundCheck,
    handleNuxCompleteButtonTutorial,
    handleNuxContinueFromStages,
    handleFinishKnownTour,
    handleStartBeginnerCourse,
    handleReplayNux,
  }
}
