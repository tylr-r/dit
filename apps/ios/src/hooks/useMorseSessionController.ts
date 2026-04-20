import {
  BEGINNER_COURSE_PACKS,
  applyScoreDelta,
  countsAnswer,
  createGuidedLessonProgress,
  formatWpm,
  getBeginnerCoursePack,
  getBeginnerUnlockedLetters,
  getLettersForLevel,
  getRandomLatencyAwareLetter,
  getRandomLetter,
  getRandomWord,
  getRandomWeightedLetter,
  getWordsForLetters,
  initializeScores,
  isGuidedListenComplete,
  isGuidedPracticeComplete,
  isGuidedTeachComplete,
  AUDIO_FREQUENCY,
  MORSE_DATA,
  TONE_FREQUENCY_RANGE,
  recordCorrectAnswer,
  recordGuidedListenResult,
  recordGuidedPracticeResult,
  recordGuidedTeachSuccess,
  recordLetterAttempt,
  updateBestWpm,
  type ActivityMode,
  type DailyActivity,
  type GuidedLessonProgress,
  type GuidedPhase,
  type Letter,
  type LearnerProfile,
  type LetterAccuracyRecord,
  type ListenTtrRecord,
  type Progress,
  type ProgressSnapshot,
  type ReminderSettings,
  type StreakState,
} from '@dit/core'
import type { User } from '@firebase/auth'
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { AppState } from 'react-native'
import type { PhaseModalContent } from '../components/PhaseModal'
import { type Mode } from '../components/ModeSwitcher'
import type { StagePip } from '../components/StageDisplay'
import { logAnalyticsEvent } from '../analytics'
import { database } from '../firebase'
import { useAccountActions } from './useAccountActions'
import { useOnboardingActions } from './useOnboardingActions'
import { useProgressSyncController } from './useProgressSyncController'
import {
  DEFAULT_LISTEN_AUTO_TIGHTENING,
  DEFAULT_LISTEN_AUTO_TIGHTENING_CORRECT_COUNT,
  DEFAULT_LISTEN_EFFECTIVE_WPM,
  DEFAULT_LISTEN_WPM,
  DEFAULT_MAX_LEVEL,
  DEFAULT_PRACTICE_IFR_MODE,
  DEFAULT_PRACTICE_REVIEW_MISSES,
  DOT_THRESHOLD_MS,
  ERROR_LOCKOUT_MS,
  GUIDED_TEACH_SUCCESS_COPY,
  INTER_CHAR_GAP_MS,
  LEVELS,
  LISTEN_MAX_CONSECUTIVE_SAME,
  LISTEN_MIN_UNIT_MS,
  LISTEN_OVERLEARN_MAX_QUEUE_SIZE,
  LISTEN_POST_REVEAL_PAUSE_MS,
  LISTEN_RECOGNITION_DISPLAY_MS,
  LISTEN_REVEAL_EXTRA_MS,
  LISTEN_REVEAL_FADE_OUT_MS,
  PRACTICE_NEXT_LETTER_DELAY_MS,
  PRACTICE_REVIEW_DELAY_STEPS,
  PRACTICE_REVIEW_MAX_SIZE,
  PRACTICE_WORD_UNITS,
  WORD_GAP_EXTRA_MS,
  applyListenTtrSample,
  clearTimer,
  createInitialPracticeConfig,
  enqueueListenOverlearnLetters,
  getGuidedPracticePool,
  getLevelForLetters,
  getListenOverlearnRepeats,
  getNextOrderedLetter,
  initialConfig,
  now,
  pullNextListenOverlearnLetter,
  type IntroHintStep,
  type ListenPromptTiming,
  type NuxStatus,
  type NuxStep,
  type TimeoutHandle,
} from '../utils/appState'
import { getAutoEffectiveWpm, normalizeListenSpeeds } from '../utils/listenSpeed'
import {
  getListenPlaybackDurationMs,
  getListenTiming,
  type ListenWavePlayback,
} from '../utils/listenWave'
import {
  enqueueReviewLetter,
  filterReviewQueue,
  pullDueReviewLetter,
  type PracticeReviewItem,
} from '../utils/practiceReviewQueue'
import {
  playMorseTone,
  prepareToneEngine,
  startTone,
  stopMorseTone,
  stopTone,
} from '../utils/tone'

type Setter<T> = Dispatch<SetStateAction<T>>

type UseMorseSessionControllerOptions = {
  user: User | null
  isDeletingAccount: boolean
  setIsDeletingAccount: Setter<boolean>
  showReference: boolean
  setShowSettings: Setter<boolean>
  setShowAbout: Setter<boolean>
  setShowReference: Setter<boolean>
  showPhaseModal: (content: PhaseModalContent, onDismiss?: () => void) => void
  onboarding: {
    introHintStep: IntroHintStep
    nuxStatus: NuxStatus
    nuxStep: NuxStep
    nuxReady: boolean
    learnerProfile: LearnerProfile | null
    setLearnerProfile: Setter<LearnerProfile | null>
    didCompleteSoundCheck: boolean
    setDidCompleteSoundCheck: Setter<boolean>
    tutorialTapCount: number
    setTutorialTapCount: Setter<number>
    tutorialHoldCount: number
    setTutorialHoldCount: Setter<number>
    persistIntroHintStep: (next: IntroHintStep) => void
    persistNuxStatus: (next: NuxStatus) => void
    dismissMorseHint: () => void
    dismissSettingsHint: () => void
    setNuxStatus: Setter<NuxStatus>
    setNuxStep: Setter<NuxStep>
  }
}

/** Owns the practice/listen session state machine and its sync side effects. */
export const useMorseSessionController = ({
  user,
  isDeletingAccount,
  setIsDeletingAccount,
  showReference,
  setShowSettings,
  setShowAbout,
  setShowReference,
  showPhaseModal,
  onboarding,
}: UseMorseSessionControllerOptions) => {
  const {
    introHintStep,
    nuxStatus,
    nuxStep,
    nuxReady,
    learnerProfile,
    setLearnerProfile,
    didCompleteSoundCheck,
    setDidCompleteSoundCheck,
    tutorialTapCount,
    setTutorialTapCount,
    tutorialHoldCount,
    setTutorialHoldCount,
    persistIntroHintStep,
    persistNuxStatus,
    dismissMorseHint,
    setNuxStatus,
    setNuxStep,
  } = onboarding

  const [isPressing, setIsPressing] = useState(false)
  const [mode, setMode] = useState<Mode>('practice')
  const [showHint, setShowHint] = useState(false)
  const [showMnemonic, setShowMnemonic] = useState(false)
  const [practiceAutoPlay, setPracticeAutoPlay] = useState(true)
  const [practiceLearnMode, setPracticeLearnMode] = useState(true)
  const [practiceIfrMode, setPracticeIfrMode] = useState(DEFAULT_PRACTICE_IFR_MODE)
  const [practiceReviewMisses, setPracticeReviewMisses] = useState(DEFAULT_PRACTICE_REVIEW_MISSES)
  const [guidedCourseActive, setGuidedCourseActive] = useState(false)
  const [guidedPackIndex, setGuidedPackIndex] = useState(0)
  const [guidedPhase, setGuidedPhase] = useState<GuidedPhase>('teach')
  const [guidedProgress, setGuidedProgress] = useState<GuidedLessonProgress>(
    createGuidedLessonProgress(),
  )
  const [maxLevel, setMaxLevel] = useState(DEFAULT_MAX_LEVEL)
  const [practiceWordMode, setPracticeWordMode] = useState(false)
  const [letter, setLetter] = useState<Letter>(initialConfig.letter)
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [practiceWord, setPracticeWord] = useState(initialConfig.practiceWord)
  const [practiceWordIndex, setPracticeWordIndex] = useState(0)
  const [practiceWpm, setPracticeWpm] = useState<number | null>(null)
  const [freestyleInput, setFreestyleInput] = useState('')
  const [freestyleResult, setFreestyleResult] = useState<string | null>(null)
  const [freestyleWordMode, setFreestyleWordMode] = useState(false)
  const [freestyleWord, setFreestyleWord] = useState('')
  const [toneFrequency, setToneFrequency] = useState(AUDIO_FREQUENCY)
  const [listenWpm, setListenWpm] = useState(DEFAULT_LISTEN_WPM)
  const [listenEffectiveWpm, setListenEffectiveWpm] = useState(DEFAULT_LISTEN_EFFECTIVE_WPM)
  const [listenAutoTightening, setListenAutoTightening] = useState(DEFAULT_LISTEN_AUTO_TIGHTENING)
  const [listenAutoTighteningCorrectCount, setListenAutoTighteningCorrectCount] = useState(
    DEFAULT_LISTEN_AUTO_TIGHTENING_CORRECT_COUNT,
  )
  const [listenStatus, setListenStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [listenReveal, setListenReveal] = useState<Letter | null>(null)
  const [listenWavePlayback, setListenWavePlayback] = useState<ListenWavePlayback | null>(null)
  const [scores, setScores] = useState(() => initializeScores())
  const [listenTtr, setListenTtr] = useState<ListenTtrRecord>({})
  const [dailyActivity, setDailyActivity] = useState<DailyActivity>({})
  const [streak, setStreak] = useState<StreakState | undefined>(undefined)
  const [letterAccuracy, setLetterAccuracy] = useState<LetterAccuracyRecord>({})
  const [bestWpm, setBestWpm] = useState<number | undefined>(undefined)
  const [reminder, setReminder] = useState<ReminderSettings | undefined>(undefined)
  const [listenHasSubmittedAnswer, setListenHasSubmittedAnswer] = useState(false)
  const [listenRecognitionText, setListenRecognitionText] = useState<string | null>(null)

  const isNuxActive = nuxReady && nuxStatus === 'pending'
  const isFreestyle = mode === 'freestyle'
  const isListen = mode === 'listen'
  const guidedCurrentPack = useMemo(
    () => (guidedCourseActive ? getBeginnerCoursePack(guidedPackIndex) : []),
    [guidedCourseActive, guidedPackIndex],
  )
  const guidedUnlockedLetters = useMemo(
    () => (guidedCourseActive ? getBeginnerUnlockedLetters(guidedPackIndex) : []),
    [guidedCourseActive, guidedPackIndex],
  )
  const guidedLessonMode: Mode = guidedPhase === 'listen' ? 'listen' : 'practice'
  const isGuidedLessonModeMismatch =
    guidedCourseActive && !isNuxActive && mode !== guidedLessonMode
  const isGuidedPracticeActive =
    guidedCourseActive && !isNuxActive && !isGuidedLessonModeMismatch && mode === 'practice'
  const isGuidedListenActive =
    guidedCourseActive && !isNuxActive && !isGuidedLessonModeMismatch && mode === 'listen'
  const userForSync = isDeletingAccount ? null : user
  const isReferencePanelActive = showReference
  const availableLetters = useMemo(() => getLettersForLevel(maxLevel), [maxLevel])
  const activeLetters = guidedCourseActive ? guidedUnlockedLetters : availableLetters
  const activeLetterSet = useMemo(() => new Set(activeLetters), [activeLetters])
  const availablePracticeWords = useMemo(
    () => getWordsForLetters(activeLetters),
    [activeLetters],
  )

  const progressSnapshot = useMemo<ProgressSnapshot>(
    () => ({
      toneFrequency,
      listenWpm,
      listenEffectiveWpm,
      listenAutoTightening,
      listenAutoTighteningCorrectCount,
      listenTtr,
      maxLevel,
      practiceWordMode,
      practiceAutoPlay,
      practiceLearnMode,
      practiceIfrMode,
      practiceReviewMisses,
      learnerProfile: learnerProfile ?? undefined,
      guidedCourseActive,
      guidedPackIndex,
      guidedPhase,
      guidedProgress,
      scores,
      showHint,
      showMnemonic,
      wordMode: freestyleWordMode,
      dailyActivity,
      streak,
      letterAccuracy,
      bestWpm,
      reminder,
    }),
    [
      bestWpm,
      reminder,
      dailyActivity,
      freestyleWordMode,
      guidedCourseActive,
      guidedPackIndex,
      guidedPhase,
      guidedProgress,
      learnerProfile,
      letterAccuracy,
      listenAutoTightening,
      listenAutoTighteningCorrectCount,
      listenEffectiveWpm,
      listenTtr,
      listenWpm,
      toneFrequency,
      maxLevel,
      practiceAutoPlay,
      practiceIfrMode,
      practiceLearnMode,
      practiceReviewMisses,
      practiceWordMode,
      scores,
      showHint,
      showMnemonic,
      streak,
    ],
  )

  const pressStartRef = useRef<number | null>(null)
  const inputRef = useRef(input)
  const freestyleInputRef = useRef(freestyleInput)
  const letterRef = useRef(letter)
  const practiceWordRef = useRef(practiceWord)
  const practiceWordIndexRef = useRef(practiceWordIndex)
  const practiceWordModeRef = useRef(practiceWordMode)
  const practiceAutoPlayRef = useRef(practiceAutoPlay)
  const practiceLearnModeRef = useRef(practiceLearnMode)
  const practiceIfrModeRef = useRef(practiceIfrMode)
  const practiceReviewMissesRef = useRef(practiceReviewMisses)
  const practiceWordStartRef = useRef<number | null>(null)
  const practiceReviewQueueRef = useRef<PracticeReviewItem[]>([])
  const freestyleWordModeRef = useRef(freestyleWordMode)
  const wordSpaceTimeoutRef = useRef<TimeoutHandle | null>(null)
  const scoresRef = useRef(scores)
  const listenTtrRef = useRef(listenTtr)
  const maxLevelRef = useRef<(typeof LEVELS)[number]>(maxLevel as (typeof LEVELS)[number])
  const modeRef = useRef(mode)
  const listenWpmRef = useRef(listenWpm)
  const listenEffectiveWpmRef = useRef(listenEffectiveWpm)
  const listenAutoTighteningRef = useRef(listenAutoTightening)
  const listenAutoTighteningCorrectCountRef = useRef(listenAutoTighteningCorrectCount)
  const listenStatusRef = useRef(listenStatus)
  const listenOverlearnQueueRef = useRef<Letter[]>([])
  const listenPromptTimingRef = useRef<ListenPromptTiming | null>(null)
  const listenConsecutiveLetterRef = useRef<Letter | null>(letter)
  const listenConsecutiveCountRef = useRef(1)
  const listenWaveSequenceRef = useRef(0)
  const errorLockoutUntilRef = useRef(0)
  const letterTimeoutRef = useRef<TimeoutHandle | null>(null)
  const successTimeoutRef = useRef<TimeoutHandle | null>(null)
  const errorTimeoutRef = useRef<TimeoutHandle | null>(null)
  const listenTimeoutRef = useRef<TimeoutHandle | null>(null)
  const listenRecognitionTimeoutRef = useRef<TimeoutHandle | null>(null)
  const learnerProfileRef = useRef<LearnerProfile | null>(learnerProfile)
  const guidedCourseActiveRef = useRef(guidedCourseActive)
  const guidedPackIndexRef = useRef(guidedPackIndex)
  const guidedPhaseRef = useRef<GuidedPhase>(guidedPhase)
  const guidedProgressRef = useRef<GuidedLessonProgress>(guidedProgress)

  const setPracticeWordFromList = useCallback((words: string[], avoidWord?: string) => {
    const nextWord = getRandomWord(words, avoidWord)
    practiceWordRef.current = nextWord
    practiceWordIndexRef.current = 0
    practiceWordStartRef.current = null
    const nextLetter = nextWord[0] as Letter
    letterRef.current = nextLetter
    setPracticeWord(nextWord)
    setPracticeWordIndex(0)
    setLetter(nextLetter)
  }, [])

  const setNextLetterForLevel = useCallback(
    (nextLetters: Letter[], currentLetter: Letter = letterRef.current) => {
      if (nextLetters.length === 0) {
        return currentLetter
      }
      const nextLetter = nextLetters.includes(currentLetter)
        ? currentLetter
        : practiceLearnModeRef.current
          ? nextLetters[0]
          : getRandomWeightedLetter(nextLetters, scoresRef.current, currentLetter)
      letterRef.current = nextLetter
      setLetter(nextLetter)
      return nextLetter
    },
    [],
  )

  const syncGuidedLevel = useCallback((packIndex: number) => {
    const nextLevel = getLevelForLetters(getBeginnerUnlockedLetters(packIndex))
    maxLevelRef.current = nextLevel
    setMaxLevel(nextLevel)
  }, [])

  const applyKnownLearnerDefaults = useCallback(() => {
    setShowHint(false)
    setShowMnemonic(false)
    setPracticeAutoPlay(true)
    setPracticeLearnMode(true)
    practiceLearnModeRef.current = true
    setPracticeIfrMode(DEFAULT_PRACTICE_IFR_MODE)
    practiceIfrModeRef.current = DEFAULT_PRACTICE_IFR_MODE
    setPracticeReviewMisses(DEFAULT_PRACTICE_REVIEW_MISSES)
    practiceReviewMissesRef.current = DEFAULT_PRACTICE_REVIEW_MISSES
    practiceReviewQueueRef.current = []
    setPracticeWordMode(false)
    practiceWordModeRef.current = false
    setListenWpm(DEFAULT_LISTEN_WPM)
    listenWpmRef.current = DEFAULT_LISTEN_WPM
    setListenEffectiveWpm(DEFAULT_LISTEN_EFFECTIVE_WPM)
    listenEffectiveWpmRef.current = DEFAULT_LISTEN_EFFECTIVE_WPM
    setListenAutoTightening(DEFAULT_LISTEN_AUTO_TIGHTENING)
    listenAutoTighteningRef.current = DEFAULT_LISTEN_AUTO_TIGHTENING
    setListenAutoTighteningCorrectCount(DEFAULT_LISTEN_AUTO_TIGHTENING_CORRECT_COUNT)
    listenAutoTighteningCorrectCountRef.current = DEFAULT_LISTEN_AUTO_TIGHTENING_CORRECT_COUNT
    maxLevelRef.current = DEFAULT_MAX_LEVEL
    setMaxLevel(DEFAULT_MAX_LEVEL)
  }, [])

  const setGuidedPhaseState = useCallback(
    (nextPhase: GuidedPhase, nextPackIndex: number, nextProgress: GuidedLessonProgress) => {
      guidedCourseActiveRef.current = true
      guidedPackIndexRef.current = nextPackIndex
      guidedPhaseRef.current = nextPhase
      guidedProgressRef.current = nextProgress
      setGuidedCourseActive(true)
      setGuidedPackIndex(nextPackIndex)
      setGuidedPhase(nextPhase)
      setGuidedProgress(nextProgress)
      syncGuidedLevel(nextPackIndex)
      setPracticeWordMode(false)
      practiceWordModeRef.current = false
      setPracticeWpm(null)
      practiceWordStartRef.current = null
      setInput('')
      setStatus('idle')
      setListenStatus('idle')
      setListenReveal(null)
      setListenHasSubmittedAnswer(false)
      clearTimer(letterTimeoutRef)
      clearTimer(successTimeoutRef)
      clearTimer(errorTimeoutRef)
      clearTimer(listenTimeoutRef)
      clearTimer(listenRecognitionTimeoutRef)
    },
    [syncGuidedLevel],
  )

  const pickGuidedPracticeLetter = useCallback((currentLetter: Letter = letterRef.current) => {
    const { currentPack, unlockedLetters, reviewPool } = getGuidedPracticePool(
      guidedPackIndexRef.current,
    )
    if (guidedPhaseRef.current === 'teach') {
      const incompleteLetter =
        currentPack.find(
          (targetLetter) => (guidedProgressRef.current.teachCounts[targetLetter] ?? 0) < 2,
        ) ?? currentPack[0]
      return incompleteLetter ?? currentLetter
    }
    if (reviewPool.length > 0 && Math.random() >= 0.6) {
      return getRandomWeightedLetter(reviewPool, scoresRef.current, currentLetter)
    }
    return getRandomWeightedLetter(
      currentPack.length > 0 ? currentPack : unlockedLetters,
      scoresRef.current,
      currentLetter,
    )
  }, [])

  const setNextPracticeLetter = useCallback(
    (nextLetters: Letter[], currentLetter: Letter = letterRef.current) => {
      if (nextLetters.length === 0) {
        return currentLetter
      }
      if (guidedCourseActiveRef.current) {
        const nextLetter = pickGuidedPracticeLetter(currentLetter)
        letterRef.current = nextLetter
        setLetter(nextLetter)
        return nextLetter
      }
      if (practiceIfrModeRef.current && practiceReviewMissesRef.current) {
        const { nextQueue, reviewLetter } = pullDueReviewLetter(practiceReviewQueueRef.current)
        practiceReviewQueueRef.current = nextQueue
        if (reviewLetter && nextLetters.includes(reviewLetter)) {
          letterRef.current = reviewLetter
          setLetter(reviewLetter)
          return reviewLetter
        }
      }
      const nextLetter = practiceLearnModeRef.current
        ? getNextOrderedLetter(nextLetters, currentLetter)
        : getRandomWeightedLetter(nextLetters, scoresRef.current, currentLetter)
      letterRef.current = nextLetter
      setLetter(nextLetter)
      return nextLetter
    },
    [pickGuidedPracticeLetter],
  )

  const setNextListenLetter = useCallback(
    (nextLetters: Letter[], currentLetter: Letter = letterRef.current) => {
      if (nextLetters.length === 0) {
        return currentLetter
      }
      if (guidedCourseActiveRef.current && guidedPhaseRef.current === 'listen') {
        const { currentPack, unlockedLetters } = getGuidedPracticePool(guidedPackIndexRef.current)
        const unseenCurrentPack = currentPack.filter(
          (targetLetter) => (guidedProgressRef.current.listenLetterCorrect[targetLetter] ?? 0) < 1,
        )
        const nextLetter =
          unseenCurrentPack[0] ??
          getRandomLatencyAwareLetter(
            unlockedLetters.length > 0 ? unlockedLetters : nextLetters,
            scoresRef.current,
            listenTtrRef.current,
            currentLetter,
          )
        listenConsecutiveLetterRef.current = nextLetter
        listenConsecutiveCountRef.current = nextLetter === currentLetter ? 2 : 1
        letterRef.current = nextLetter
        setLetter(nextLetter)
        return nextLetter
      }
      let { nextQueue, reviewLetter } = pullNextListenOverlearnLetter(
        listenOverlearnQueueRef.current,
        nextLetters,
        currentLetter,
      )
      const hasReachedConsecutiveCap =
        listenConsecutiveLetterRef.current === currentLetter &&
        listenConsecutiveCountRef.current >= LISTEN_MAX_CONSECUTIVE_SAME
      let nextLetter =
        reviewLetter ??
        getRandomLatencyAwareLetter(nextLetters, scoresRef.current, listenTtrRef.current, currentLetter)
      if (hasReachedConsecutiveCap && nextLetter === currentLetter && nextLetters.length > 1) {
        if (reviewLetter === currentLetter) {
          nextQueue = enqueueListenOverlearnLetters(
            nextQueue,
            currentLetter,
            1,
            LISTEN_OVERLEARN_MAX_QUEUE_SIZE,
          )
        }
        const alternatives = nextLetters.filter((targetLetter) => targetLetter !== currentLetter)
        nextLetter = getRandomLatencyAwareLetter(alternatives, scoresRef.current, listenTtrRef.current)
      }
      listenOverlearnQueueRef.current = nextQueue
      if (nextLetter === currentLetter) {
        const nextCount =
          listenConsecutiveLetterRef.current === currentLetter
            ? listenConsecutiveCountRef.current + 1
            : 2
        listenConsecutiveCountRef.current = nextCount
      } else {
        listenConsecutiveCountRef.current = 1
      }
      listenConsecutiveLetterRef.current = nextLetter
      letterRef.current = nextLetter
      setLetter(nextLetter)
      return nextLetter
    },
    [],
  )

  const advancePracticeWordTarget = useCallback(() => {
    const currentWord = practiceWordRef.current
    if (!currentWord) {
      setPracticeWordFromList(availablePracticeWords)
      return
    }
    const nextIndex = practiceWordIndexRef.current + 1
    if (nextIndex >= currentWord.length) {
      const startTime = practiceWordStartRef.current
      if (startTime && currentWord.length > 0) {
        const elapsedMs = now() - startTime
        if (elapsedMs > 0) {
          const nextWpm = (currentWord.length / PRACTICE_WORD_UNITS) * (60000 / elapsedMs)
          setPracticeWpm(Math.round(nextWpm * 10) / 10)
          setBestWpm((prev) => {
            const next = updateBestWpm({ bestWpm: prev }, nextWpm)
            return next.bestWpm
          })
        }
      }
      setPracticeWordFromList(availablePracticeWords, currentWord)
      return
    }
    const nextLetter = currentWord[nextIndex] as Letter
    practiceWordIndexRef.current = nextIndex
    letterRef.current = nextLetter
    setPracticeWordIndex(nextIndex)
    setLetter(nextLetter)
  }, [availablePracticeWords, setPracticeWordFromList])

  useEffect(() => {
    inputRef.current = input
    freestyleInputRef.current = freestyleInput
    letterRef.current = letter
    practiceWordRef.current = practiceWord
    practiceWordIndexRef.current = practiceWordIndex
    practiceWordModeRef.current = practiceWordMode
    practiceLearnModeRef.current = practiceLearnMode
    practiceIfrModeRef.current = practiceIfrMode
    practiceReviewMissesRef.current = practiceReviewMisses
    learnerProfileRef.current = learnerProfile
    guidedCourseActiveRef.current = guidedCourseActive
    guidedPackIndexRef.current = guidedPackIndex
    guidedPhaseRef.current = guidedPhase
    guidedProgressRef.current = guidedProgress
    freestyleWordModeRef.current = freestyleWordMode
    scoresRef.current = scores
    listenTtrRef.current = listenTtr
    maxLevelRef.current = maxLevel as (typeof LEVELS)[number]
    modeRef.current = mode
    listenWpmRef.current = listenWpm
    listenEffectiveWpmRef.current = listenEffectiveWpm
    listenAutoTighteningRef.current = listenAutoTightening
    listenAutoTighteningCorrectCountRef.current = listenAutoTighteningCorrectCount
    listenStatusRef.current = listenStatus
  }, [
    freestyleInput,
    freestyleWordMode,
    guidedCourseActive,
    guidedPackIndex,
    guidedPhase,
    guidedProgress,
    input,
    learnerProfile,
    letter,
    listenAutoTightening,
    listenAutoTighteningCorrectCount,
    listenEffectiveWpm,
    listenStatus,
    listenTtr,
    listenWpm,
    maxLevel,
    mode,
    practiceIfrMode,
    practiceLearnMode,
    practiceReviewMisses,
    practiceWord,
    practiceWordIndex,
    practiceWordMode,
    scores,
  ])

  const stopTonePlayback = useCallback(() => {
    void stopTone()
  }, [])

  const startTonePlayback = useCallback(() => {
    void startTone({ frequency: toneFrequency })
  }, [toneFrequency])

  const stopListenPlayback = useCallback(() => {
    void stopMorseTone()
    stopTonePlayback()
  }, [stopTonePlayback])

  const playListenSequence = useCallback(
    (
      code: string,
      overrides?: {
        characterWpm?: number
        effectiveWpm?: number
      },
    ) => {
      stopListenPlayback()
      const normalizedListenSpeeds = normalizeListenSpeeds(
        overrides?.characterWpm ?? listenWpmRef.current,
        overrides?.effectiveWpm ?? listenEffectiveWpmRef.current,
      )
      const resolvedCharacterWpm = normalizedListenSpeeds.characterWpm
      const resolvedEffectiveWpm = normalizedListenSpeeds.effectiveWpm
      const timing = getListenTiming(
        resolvedCharacterWpm,
        resolvedEffectiveWpm,
        LISTEN_MIN_UNIT_MS,
      )
      const expectedEndAt =
        now() + getListenPlaybackDurationMs(code, timing.unitMs, timing.interCharacterGapMs)
      listenPromptTimingRef.current = {
        targetLetter: letterRef.current,
        expectedEndAt,
      }
      listenWaveSequenceRef.current += 1
      setListenWavePlayback({
        sequence: listenWaveSequenceRef.current,
        code,
        unitMs: timing.unitMs,
        interCharacterGapMs: timing.interCharacterGapMs,
      })
      void playMorseTone({
        code,
        characterWpm: resolvedCharacterWpm,
        effectiveWpm: resolvedEffectiveWpm,
        minUnitMs: LISTEN_MIN_UNIT_MS,
        frequency: toneFrequency,
      })
    },
    [stopListenPlayback, toneFrequency],
  )

  const playListenSequenceRef = useRef(playListenSequence)

  useEffect(() => {
    playListenSequenceRef.current = playListenSequence
  }, [playListenSequence])

  const resetListenState = useCallback(() => {
    clearTimer(listenTimeoutRef)
    clearTimer(listenRecognitionTimeoutRef)
    listenPromptTimingRef.current = null
    listenOverlearnQueueRef.current = []
    listenConsecutiveLetterRef.current = letterRef.current
    listenConsecutiveCountRef.current = 1
    setListenRecognitionText(null)
    setListenStatus('idle')
    setListenReveal(null)
  }, [])

  useEffect(() => {
    return () => {
      clearTimer(letterTimeoutRef)
      clearTimer(successTimeoutRef)
      clearTimer(errorTimeoutRef)
      clearTimer(listenTimeoutRef)
      clearTimer(listenRecognitionTimeoutRef)
      clearTimer(wordSpaceTimeoutRef)
      stopListenPlayback()
    }
  }, [stopListenPlayback])

  useEffect(() => {
    void prepareToneEngine()
    return () => {
      void stopMorseTone()
      void stopTone()
    }
  }, [])

  useEffect(() => {
    if (isListen || isReferencePanelActive) {
      void prepareToneEngine()
    }
  }, [isListen, isReferencePanelActive])

  useEffect(() => {
    if (mode === 'listen') {
      return
    }
    practiceReviewQueueRef.current = filterReviewQueue(practiceReviewQueueRef.current, activeLetters)
    if (!activeLetters.includes(letterRef.current)) {
      const nextLetter = practiceLearnModeRef.current ? activeLetters[0] : getRandomLetter(activeLetters)
      letterRef.current = nextLetter
      setLetter(nextLetter)
    }
    if (practiceWordModeRef.current) {
      setPracticeWordFromList(availablePracticeWords, practiceWordRef.current)
    }
  }, [activeLetters, availablePracticeWords, mode, setPracticeWordFromList])

  useEffect(() => {
    if (!isNuxActive) {
      return
    }
    setShowSettings(false)
    setShowAbout(false)
    setShowReference(false)
  }, [isNuxActive, setShowAbout, setShowReference, setShowSettings])

  const canScoreAttempt = useCallback(
    () => !isNuxActive && (!showHint || isGuidedPracticeActive),
    [isGuidedPracticeActive, isNuxActive, showHint],
  )

  const bumpScore = useCallback((targetLetter: Letter, delta: number) => {
    setScores((prev) => applyScoreDelta(prev, targetLetter, delta))
  }, [])

  const dailyActivityRef = useRef(dailyActivity)
  const streakRef = useRef(streak)
  const letterAccuracyRef = useRef(letterAccuracy)
  useEffect(() => {
    dailyActivityRef.current = dailyActivity
  }, [dailyActivity])
  useEffect(() => {
    streakRef.current = streak
  }, [streak])
  useEffect(() => {
    letterAccuracyRef.current = letterAccuracy
  }, [letterAccuracy])

  const recordRetentionAttempt = useCallback(
    (targetLetter: Letter, mode: ActivityMode, isCorrect: boolean) => {
      if (countsAnswer(mode, isCorrect)) {
        const base: Progress = {
          dailyActivity: dailyActivityRef.current,
          streak: streakRef.current,
          letterAccuracy: letterAccuracyRef.current,
        }
        const next = recordCorrectAnswer(base, { letter: targetLetter, mode })
        const nextDaily = next.dailyActivity ?? {}
        const nextAccuracy = next.letterAccuracy ?? {}
        dailyActivityRef.current = nextDaily
        letterAccuracyRef.current = nextAccuracy
        setDailyActivity(nextDaily)
        setLetterAccuracy(nextAccuracy)
        if (next.streak && next.streak !== streakRef.current) {
          const prevStreak = streakRef.current?.current ?? 0
          if (next.streak.current > prevStreak) {
            logAnalyticsEvent('streak_day_reached', {
              streak_length: next.streak.current,
            })
          }
          streakRef.current = next.streak
          setStreak(next.streak)
        }
        return
      }
      const next = recordLetterAttempt(
        { letterAccuracy: letterAccuracyRef.current },
        targetLetter,
        isCorrect,
      )
      const nextAccuracy = next.letterAccuracy ?? letterAccuracyRef.current
      letterAccuracyRef.current = nextAccuracy
      setLetterAccuracy(nextAccuracy)
    },
    [],
  )

  const isErrorLocked = useCallback(() => now() < errorLockoutUntilRef.current, [])

  const startErrorLockout = useCallback(() => {
    errorLockoutUntilRef.current = now() + ERROR_LOCKOUT_MS
  }, [])

  const handleResetScores = useCallback(() => {
    setScores(initializeScores())
  }, [])

  const resetProgressState = useCallback(() => {
    const nextConfig = createInitialPracticeConfig()
    const nextScores = initializeScores()

    stopListenPlayback()
    clearTimer(wordSpaceTimeoutRef)
    clearTimer(letterTimeoutRef)
    clearTimer(successTimeoutRef)
    clearTimer(errorTimeoutRef)
    clearTimer(listenTimeoutRef)
    clearTimer(listenRecognitionTimeoutRef)

    setShowSettings(false)
    setShowAbout(false)
    setShowReference(false)
    setIsPressing(false)
    setMode('practice')
    setShowHint(false)
    setShowMnemonic(false)
    setPracticeAutoPlay(true)
    setPracticeLearnMode(true)
    setPracticeIfrMode(DEFAULT_PRACTICE_IFR_MODE)
    setPracticeReviewMisses(DEFAULT_PRACTICE_REVIEW_MISSES)
    setLearnerProfile(null)
    setGuidedCourseActive(false)
    setGuidedPackIndex(0)
    setGuidedPhase('teach')
    setGuidedProgress(createGuidedLessonProgress())
    setDidCompleteSoundCheck(false)
    setTutorialTapCount(0)
    setTutorialHoldCount(0)
    setMaxLevel(DEFAULT_MAX_LEVEL)
    setPracticeWordMode(false)
    setLetter(nextConfig.letter)
    setInput('')
    setStatus('idle')
    setPracticeWord(nextConfig.practiceWord)
    setPracticeWordIndex(0)
    setPracticeWpm(null)
    setFreestyleInput('')
    setFreestyleResult(null)
    setFreestyleWordMode(false)
    setFreestyleWord('')
    setListenWpm(DEFAULT_LISTEN_WPM)
    setListenEffectiveWpm(DEFAULT_LISTEN_EFFECTIVE_WPM)
    setListenAutoTightening(DEFAULT_LISTEN_AUTO_TIGHTENING)
    setListenAutoTighteningCorrectCount(DEFAULT_LISTEN_AUTO_TIGHTENING_CORRECT_COUNT)
    setListenStatus('idle')
    setListenReveal(null)
    setListenWavePlayback(null)
    setScores(nextScores)
    setListenTtr({})
    setDailyActivity({})
    setStreak(undefined)
    setLetterAccuracy({})
    setBestWpm(undefined)
    setReminder(undefined)
    dailyActivityRef.current = {}
    streakRef.current = undefined
    letterAccuracyRef.current = {}
    setListenHasSubmittedAnswer(false)
    setListenRecognitionText(null)

    pressStartRef.current = null
    inputRef.current = ''
    freestyleInputRef.current = ''
    letterRef.current = nextConfig.letter
    practiceWordRef.current = nextConfig.practiceWord
    practiceWordIndexRef.current = 0
    practiceWordModeRef.current = false
    practiceLearnModeRef.current = true
    practiceIfrModeRef.current = DEFAULT_PRACTICE_IFR_MODE
    practiceReviewMissesRef.current = DEFAULT_PRACTICE_REVIEW_MISSES
    learnerProfileRef.current = null
    guidedCourseActiveRef.current = false
    guidedPackIndexRef.current = 0
    guidedPhaseRef.current = 'teach'
    guidedProgressRef.current = createGuidedLessonProgress()
    practiceWordStartRef.current = null
    practiceReviewQueueRef.current = []
    freestyleWordModeRef.current = false
    scoresRef.current = nextScores
    listenTtrRef.current = {}
    maxLevelRef.current = DEFAULT_MAX_LEVEL
    modeRef.current = 'practice'
    listenWpmRef.current = DEFAULT_LISTEN_WPM
    listenEffectiveWpmRef.current = DEFAULT_LISTEN_EFFECTIVE_WPM
    listenAutoTighteningRef.current = DEFAULT_LISTEN_AUTO_TIGHTENING
    listenAutoTighteningCorrectCountRef.current = DEFAULT_LISTEN_AUTO_TIGHTENING_CORRECT_COUNT
    listenStatusRef.current = 'idle'
    listenOverlearnQueueRef.current = []
    listenPromptTimingRef.current = null
    listenConsecutiveLetterRef.current = nextConfig.letter
    listenConsecutiveCountRef.current = 1
    errorLockoutUntilRef.current = 0
  }, [
    setDidCompleteSoundCheck,
    setTutorialHoldCount,
    setTutorialTapCount,
    setIsPressing,
    setLearnerProfile,
    setShowAbout,
    setShowReference,
    setShowSettings,
    stopListenPlayback,
  ])

  const moveIntoGuidedLesson = useCallback(
    (nextPhase: GuidedPhase, nextPackIndex: number, nextProgress: GuidedLessonProgress) => {
      setGuidedPhaseState(nextPhase, nextPackIndex, nextProgress)
      setShowSettings(false)
      setShowAbout(false)
      setShowReference(false)
      const lessonMode = nextPhase === 'listen' ? 'listen' : 'practice'
      setMode(lessonMode)
      modeRef.current = lessonMode
      const nextLetters = getBeginnerUnlockedLetters(nextPackIndex)
      if (lessonMode === 'listen') {
        const nextLetter = setNextListenLetter(nextLetters, letterRef.current)
        playListenSequenceRef.current(MORSE_DATA[nextLetter].code, {
          characterWpm: listenWpmRef.current,
          effectiveWpm: listenEffectiveWpmRef.current,
        })
        return
      }
      setNextPracticeLetter(nextLetters, letterRef.current)
    },
    [setGuidedPhaseState, setNextListenLetter, setNextPracticeLetter, setShowAbout, setShowReference, setShowSettings],
  )

  const unlockNextGuidedPack = useCallback(() => {
    const nextPackIndex = guidedPackIndexRef.current + 1
    if (nextPackIndex >= BEGINNER_COURSE_PACKS.length) {
      const completedProgress = createGuidedLessonProgress()
      guidedCourseActiveRef.current = false
      guidedPhaseRef.current = 'complete'
      guidedProgressRef.current = completedProgress
      setGuidedCourseActive(false)
      setGuidedPhase('complete')
      setGuidedProgress(completedProgress)
      showPhaseModal({
        title: 'Course complete',
        subtitle: 'You unlocked all beginner letter packs.',
      })
      return
    }
    const nextPack = getBeginnerCoursePack(nextPackIndex)
    showPhaseModal({ title: 'New letters unlocked', letters: nextPack }, () => {
      moveIntoGuidedLesson('teach', nextPackIndex, createGuidedLessonProgress())
    })
  }, [moveIntoGuidedLesson, showPhaseModal])

  const retryGuidedPractice = useCallback(() => {
    const nextProgress: GuidedLessonProgress = {
      teachCounts: guidedProgressRef.current.teachCounts,
      practiceAttempts: 0,
      practiceCorrect: 0,
      practiceLetterCorrect: {},
      listenAttempts: 0,
      listenCorrect: 0,
      listenLetterCorrect: {},
    }
    const packIndex = guidedPackIndexRef.current
    showPhaseModal(
      { title: 'Keep going', subtitle: 'One more practice round before new letters.' },
      () => {
        moveIntoGuidedLesson('practice', packIndex, nextProgress)
      },
    )
  }, [moveIntoGuidedLesson, showPhaseModal])

  const onboardingActions = useOnboardingActions({
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
    onReminderChange: setReminder,
  })

  const scheduleWordSpace = useCallback(() => {
    clearTimer(wordSpaceTimeoutRef)
    wordSpaceTimeoutRef.current = setTimeout(() => {
      if (!freestyleWordModeRef.current) {
        return
      }
      if (freestyleInputRef.current) {
        return
      }
      setFreestyleWord((prev) => {
        if (!prev || prev.endsWith(' ')) {
          return prev
        }
        return `${prev} `
      })
    }, WORD_GAP_EXTRA_MS)
  }, [])

  const submitFreestyleInput = useCallback(
    (value: string) => {
      if (!value) {
        setFreestyleResult('No input')
        return
      }
      const match = Object.entries(MORSE_DATA).find(([, data]) => data.code === value)
      const result = match ? match[0] : 'No match'
      if (result !== 'No match' && freestyleWordMode) {
        setFreestyleWord((prev) => prev + result)
        scheduleWordSpace()
      }
      setFreestyleResult(result)
      setFreestyleInput('')
    },
    [freestyleWordMode, scheduleWordSpace],
  )

  const submitListenAnswer = useCallback(
    (value: Letter) => {
      if (listenStatus !== 'idle' || !/^[A-Z0-9]$/.test(value) || !activeLetterSet.has(value)) {
        return
      }
      setListenHasSubmittedAnswer(true)
      clearTimer(listenTimeoutRef)
      const targetLetter = letterRef.current
      const responseAt = now()
      const promptTiming = listenPromptTimingRef.current
      const ttrMs =
        promptTiming && promptTiming.targetLetter === targetLetter
          ? Math.max(0, responseAt - promptTiming.expectedEndAt)
          : null
      listenPromptTimingRef.current = null
      stopListenPlayback()
      const isCorrect = value === targetLetter
      let nextEffectiveWpm = listenEffectiveWpmRef.current
      setListenStatus(isCorrect ? 'success' : 'error')
      setListenReveal(targetLetter)
      bumpScore(targetLetter, isCorrect ? 1 : -1)
      recordRetentionAttempt(targetLetter, 'listen', isCorrect)
      const isGuidedListenAttempt =
        guidedCourseActiveRef.current &&
        guidedPhaseRef.current === 'listen' &&
        modeRef.current === 'listen'
      let nextGuidedProgress = guidedProgressRef.current
      if (isGuidedListenAttempt) {
        nextGuidedProgress = recordGuidedListenResult(nextGuidedProgress, targetLetter, isCorrect)
        guidedProgressRef.current = nextGuidedProgress
        setGuidedProgress(nextGuidedProgress)
      }
      if (ttrMs !== null) {
        const recognitionText = `${(ttrMs / 1000).toFixed(1)}s`
        setListenRecognitionText(recognitionText)
        clearTimer(listenRecognitionTimeoutRef)
        listenRecognitionTimeoutRef.current = setTimeout(() => {
          setListenRecognitionText(null)
        }, LISTEN_RECOGNITION_DISPLAY_MS)
        const nextListenTtr = applyListenTtrSample(listenTtrRef.current, targetLetter, ttrMs)
        if (nextListenTtr !== listenTtrRef.current) {
          listenTtrRef.current = nextListenTtr
          setListenTtr(nextListenTtr)
          const nextEntry = nextListenTtr[targetLetter]
          if (!isCorrect && nextEntry) {
            const repeats = getListenOverlearnRepeats(nextEntry.averageMs)
            if (repeats > 0) {
              listenOverlearnQueueRef.current = enqueueListenOverlearnLetters(
                listenOverlearnQueueRef.current,
                targetLetter,
                repeats,
                LISTEN_OVERLEARN_MAX_QUEUE_SIZE,
              )
            }
          }
        }
      }
      if (isCorrect && listenAutoTighteningRef.current) {
        const nextCorrectCount = listenAutoTighteningCorrectCountRef.current + 1
        listenAutoTighteningCorrectCountRef.current = nextCorrectCount
        setListenAutoTighteningCorrectCount(nextCorrectCount)
        const autoEffectiveWpm = getAutoEffectiveWpm(listenWpmRef.current, nextCorrectCount)
        if (autoEffectiveWpm !== listenEffectiveWpmRef.current) {
          listenEffectiveWpmRef.current = autoEffectiveWpm
          nextEffectiveWpm = autoEffectiveWpm
          setListenEffectiveWpm(autoEffectiveWpm)
        }
      }
      listenTimeoutRef.current = setTimeout(() => {
        if (
          isGuidedListenAttempt &&
          isGuidedListenComplete(nextGuidedProgress, getBeginnerCoursePack(guidedPackIndexRef.current))
        ) {
          unlockNextGuidedPack()
          return
        }
        if (
          isGuidedListenAttempt &&
          nextGuidedProgress.listenAttempts >= 6 &&
          !isGuidedListenComplete(nextGuidedProgress, getBeginnerCoursePack(guidedPackIndexRef.current))
        ) {
          retryGuidedPractice()
          return
        }
        const nextLetter = setNextListenLetter(activeLetters, targetLetter)
        setListenReveal(null)
        listenTimeoutRef.current = setTimeout(() => {
          if (modeRef.current !== 'listen') {
            return
          }
          setListenStatus('idle')
          playListenSequence(MORSE_DATA[nextLetter].code, {
            characterWpm: listenWpmRef.current,
            effectiveWpm: nextEffectiveWpm,
          })
        }, LISTEN_REVEAL_FADE_OUT_MS + LISTEN_POST_REVEAL_PAUSE_MS)
      }, (isCorrect ? 650 : ERROR_LOCKOUT_MS) + LISTEN_REVEAL_EXTRA_MS)
    },
    [
      activeLetterSet,
      activeLetters,
      bumpScore,
      listenStatus,
      playListenSequence,
      recordRetentionAttempt,
      retryGuidedPractice,
      setNextListenLetter,
      stopListenPlayback,
      unlockNextGuidedPack,
    ],
  )

  const handleListenReplay = useCallback(() => {
    if (listenStatus !== 'idle') {
      return
    }
    setListenReveal(null)
    playListenSequence(MORSE_DATA[letterRef.current].code)
  }, [listenStatus, playListenSequence])

  const handlePracticeReplay = useCallback(() => {
    if (isFreestyle || isListen) {
      return
    }
    clearTimer(letterTimeoutRef)
    clearTimer(successTimeoutRef)
    clearTimer(errorTimeoutRef)
    setInput('')
    setStatus('idle')
    stopListenPlayback()
    void playMorseTone({
      code: MORSE_DATA[letterRef.current].code,
      characterWpm: listenWpm,
      effectiveWpm: listenEffectiveWpm,
      minUnitMs: LISTEN_MIN_UNIT_MS,
      frequency: toneFrequency,
    })
  }, [isFreestyle, isListen, listenEffectiveWpm, listenWpm, stopListenPlayback, toneFrequency])

  useEffect(() => {
    if (mode !== 'practice' || !practiceAutoPlay || isNuxActive) {
      return
    }
    stopListenPlayback()
    void playMorseTone({
      code: MORSE_DATA[letter].code,
      characterWpm: listenWpm,
      effectiveWpm: listenEffectiveWpm,
      minUnitMs: LISTEN_MIN_UNIT_MS,
      frequency: toneFrequency,
    })
  }, [isNuxActive, letter, listenEffectiveWpm, listenWpm, mode, practiceAutoPlay, stopListenPlayback, toneFrequency])

  const scheduleLetterReset = useCallback(
    (nextMode: 'practice' | 'freestyle') => {
      clearTimer(letterTimeoutRef)
      letterTimeoutRef.current = setTimeout(() => {
        if (nextMode === 'freestyle') {
          submitFreestyleInput(freestyleInputRef.current)
          return
        }
        const attempt = inputRef.current
        if (!attempt) {
          return
        }
        clearTimer(errorTimeoutRef)
        clearTimer(successTimeoutRef)
        const targetLetter = letterRef.current
        const target = MORSE_DATA[targetLetter].code
        const isCorrect = attempt === target
        const ifrEnabled = practiceIfrModeRef.current && !isNuxActive && modeRef.current === 'practice'
        const isGuidedPracticeAttempt =
          guidedCourseActiveRef.current &&
          modeRef.current === 'practice' &&
          (guidedPhaseRef.current === 'teach' || guidedPhaseRef.current === 'practice')
        if (isCorrect) {
          if (isGuidedPracticeAttempt) {
            const currentPack = getBeginnerCoursePack(guidedPackIndexRef.current)
            setInput('')
            if (guidedPhaseRef.current === 'teach') {
              const nextGuidedProgress = recordGuidedTeachSuccess(guidedProgressRef.current, targetLetter)
              guidedProgressRef.current = nextGuidedProgress
              setGuidedProgress(nextGuidedProgress)
              setStatus('success')
              successTimeoutRef.current = setTimeout(() => {
                if (isGuidedTeachComplete(nextGuidedProgress, currentPack)) {
                  const practiceProgress: GuidedLessonProgress = {
                    ...nextGuidedProgress,
                    practiceAttempts: 0,
                    practiceCorrect: 0,
                    practiceLetterCorrect: {},
                    listenAttempts: 0,
                    listenCorrect: 0,
                    listenLetterCorrect: {},
                  }
                  const packIdx = guidedPackIndexRef.current
                  showPhaseModal(
                    { title: 'Next up', subtitle: 'Practice in mixed order.', letters: currentPack },
                    () => {
                      moveIntoGuidedLesson('practice', packIdx, practiceProgress)
                    },
                  )
                  return
                }
                setNextPracticeLetter(activeLetters, targetLetter)
                setStatus('idle')
              }, PRACTICE_NEXT_LETTER_DELAY_MS)
              return
            }
            bumpScore(targetLetter, 1)
            recordRetentionAttempt(targetLetter, 'practice', true)
            const nextGuidedProgress = recordGuidedPracticeResult(
              guidedProgressRef.current,
              targetLetter,
              true,
            )
            guidedProgressRef.current = nextGuidedProgress
            setGuidedProgress(nextGuidedProgress)
            setStatus('success')
            successTimeoutRef.current = setTimeout(() => {
              if (isGuidedPracticeComplete(nextGuidedProgress, currentPack)) {
                const listenProgress: GuidedLessonProgress = {
                  ...nextGuidedProgress,
                  listenAttempts: 0,
                  listenCorrect: 0,
                  listenLetterCorrect: {},
                }
                const listenPackIdx = guidedPackIndexRef.current
                showPhaseModal(
                  { title: 'Ready to listen', subtitle: 'Hear and identify these letters.', letters: currentPack },
                  () => {
                    moveIntoGuidedLesson('listen', listenPackIdx, listenProgress)
                  },
                )
                return
              }
              setNextPracticeLetter(activeLetters, targetLetter)
              setStatus('idle')
            }, PRACTICE_NEXT_LETTER_DELAY_MS)
            return
          }
          if (canScoreAttempt()) {
            bumpScore(targetLetter, 1)
            recordRetentionAttempt(targetLetter, 'practice', true)
          }
          setInput('')
          if (practiceWordModeRef.current) {
            advancePracticeWordTarget()
            setStatus('idle')
            return
          }
          setStatus('success')
          successTimeoutRef.current = setTimeout(() => {
            setNextPracticeLetter(activeLetters, targetLetter)
            setStatus('idle')
          }, PRACTICE_NEXT_LETTER_DELAY_MS)
          return
        }
        if (isGuidedPracticeAttempt) {
          if (guidedPhaseRef.current === 'practice') {
            bumpScore(targetLetter, -1)
            recordRetentionAttempt(targetLetter, 'practice', false)
            const nextGuidedProgress = recordGuidedPracticeResult(
              guidedProgressRef.current,
              targetLetter,
              false,
            )
            guidedProgressRef.current = nextGuidedProgress
            setGuidedProgress(nextGuidedProgress)
          }
          setInput('')
          setStatus('error')
          void playMorseTone({
            code: MORSE_DATA[targetLetter].code,
            characterWpm: listenWpmRef.current,
            effectiveWpm: listenEffectiveWpmRef.current,
            minUnitMs: LISTEN_MIN_UNIT_MS,
            frequency: toneFrequency,
          })
          errorTimeoutRef.current = setTimeout(() => {
            setStatus('idle')
          }, ERROR_LOCKOUT_MS)
          return
        }
        if (canScoreAttempt()) {
          bumpScore(targetLetter, -1)
          recordRetentionAttempt(targetLetter, 'practice', false)
        }
        setInput('')
        if (ifrEnabled) {
          if (practiceReviewMissesRef.current) {
            practiceReviewQueueRef.current = enqueueReviewLetter(
              practiceReviewQueueRef.current,
              targetLetter,
              PRACTICE_REVIEW_DELAY_STEPS,
              PRACTICE_REVIEW_MAX_SIZE,
            )
          }
          const isPracticeWordMode = practiceWordModeRef.current
          if (!isPracticeWordMode) {
            errorLockoutUntilRef.current = now() + PRACTICE_NEXT_LETTER_DELAY_MS
          }
          setStatus('error')
          errorTimeoutRef.current = setTimeout(() => {
            if (isPracticeWordMode) {
              advancePracticeWordTarget()
            } else {
              setNextPracticeLetter(activeLetters, targetLetter)
            }
            setStatus('idle')
          }, PRACTICE_NEXT_LETTER_DELAY_MS)
          return
        }
        startErrorLockout()
        setStatus('error')
        errorTimeoutRef.current = setTimeout(() => {
          setStatus('idle')
        }, ERROR_LOCKOUT_MS)
      }, INTER_CHAR_GAP_MS)
    },
    [
      activeLetters,
      advancePracticeWordTarget,
      bumpScore,
      canScoreAttempt,
      isNuxActive,
      moveIntoGuidedLesson,
      recordRetentionAttempt,
      setNextPracticeLetter,
      showPhaseModal,
      startErrorLockout,
      submitFreestyleInput,
    ],
  )

  const handleFreestyleClear = useCallback(() => {
    clearTimer(letterTimeoutRef)
    clearTimer(wordSpaceTimeoutRef)
    setFreestyleResult(null)
    setFreestyleInput('')
    setFreestyleWord('')
  }, [])

  const registerSymbol = useCallback(
    (symbol: '.' | '-') => {
      if (!isFreestyle && isErrorLocked()) {
        return
      }
      clearTimer(errorTimeoutRef)
      clearTimer(successTimeoutRef)
      clearTimer(letterTimeoutRef)

      if (isFreestyle) {
        setFreestyleInput((prev) => {
          const next = prev + symbol
          scheduleLetterReset('freestyle')
          return next
        })
        setFreestyleResult(null)
        return
      }

      if (isNuxActive && nuxStep === 'button_tutorial') {
        if (symbol === '.') {
          setTutorialTapCount((c) => c + 1)
        } else {
          setTutorialHoldCount((c) => c + 1)
        }
        return
      }

      if (
        practiceWordModeRef.current &&
        practiceWordIndexRef.current === 0 &&
        practiceWordStartRef.current === null &&
        practiceWordRef.current
      ) {
        practiceWordStartRef.current = now()
      }

      setStatus('idle')
      setInput((prev) => prev + symbol)
      scheduleLetterReset('practice')
    },
    [
      isErrorLocked,
      isFreestyle,
      isNuxActive,
      nuxStep,
      scheduleLetterReset,
      setTutorialHoldCount,
      setTutorialTapCount,
    ],
  )

  const handlePressIn = useCallback(() => {
    if (pressStartRef.current !== null || isListen || (!isFreestyle && isErrorLocked())) {
      return
    }
    setIsPressing(true)
    pressStartRef.current = now()
    clearTimer(letterTimeoutRef)
    if (!isFreestyle) {
      void stopMorseTone()
    }
    startTonePlayback()
  }, [isErrorLocked, isFreestyle, isListen, startTonePlayback])

  const handleIntroPressIn = useCallback(() => {
    if (!isNuxActive) {
      dismissMorseHint()
    }
    handlePressIn()
  }, [dismissMorseHint, handlePressIn, isNuxActive])

  const handlePressOut = useCallback(() => {
    setIsPressing(false)
    stopTonePlayback()
    if (!isListen) {
      void stopMorseTone()
    }
    if (isListen) {
      pressStartRef.current = null
      return
    }
    const start = pressStartRef.current
    pressStartRef.current = null
    if (start === null) {
      return
    }
    const symbol = now() - start < DOT_THRESHOLD_MS ? '.' : '-'
    registerSymbol(symbol)
  }, [isListen, registerSymbol, stopTonePlayback])

  const handleMaxLevelChange = useCallback(
    (value: number) => {
      if (guidedCourseActiveRef.current) {
        return
      }
      setMaxLevel(value as (typeof LEVELS)[number])
      setInput('')
      setStatus('idle')
      clearTimer(letterTimeoutRef)
      clearTimer(successTimeoutRef)
      clearTimer(errorTimeoutRef)
      practiceWordStartRef.current = null
      const nextLetters = getLettersForLevel(value)
      practiceReviewQueueRef.current = filterReviewQueue(practiceReviewQueueRef.current, nextLetters)
      if (isListen) {
        resetListenState()
        const nextLetter = setNextListenLetter(nextLetters)
        playListenSequence(MORSE_DATA[nextLetter].code)
        return
      }
      if (practiceWordModeRef.current) {
        setPracticeWordFromList(getWordsForLetters(nextLetters), practiceWordRef.current)
        return
      }
      setNextLetterForLevel(nextLetters)
    },
    [
      isListen,
      playListenSequence,
      resetListenState,
      setNextListenLetter,
      setNextLetterForLevel,
      setPracticeWordFromList,
    ],
  )

  const handlePracticeWordModeChange = useCallback(
    (value: boolean) => {
      if (guidedCourseActiveRef.current && !isFreestyle) {
        return
      }
      if (isFreestyle) {
        setFreestyleWordMode(value)
        freestyleWordModeRef.current = value
        handleFreestyleClear()
        return
      }
      setPracticeWordMode(value)
      practiceWordModeRef.current = value
      practiceWordStartRef.current = null
      clearTimer(letterTimeoutRef)
      clearTimer(successTimeoutRef)
      clearTimer(errorTimeoutRef)
      setPracticeWpm(null)
      setInput('')
      setStatus('idle')
      if (value) {
        setPracticeWordFromList(availablePracticeWords)
      } else {
        setNextLetterForLevel(availableLetters)
      }
    },
    [
      availableLetters,
      availablePracticeWords,
      handleFreestyleClear,
      isFreestyle,
      setNextLetterForLevel,
      setPracticeWordFromList,
    ],
  )

  const handleListenWpmChange = useCallback(
    (value: number) => {
      const normalizedListenSpeeds = normalizeListenSpeeds(value, listenEffectiveWpmRef.current)
      const nextCharacterWpm = normalizedListenSpeeds.characterWpm
      const nextEffectiveWpm = normalizedListenSpeeds.effectiveWpm
      setListenWpm(nextCharacterWpm)
      listenWpmRef.current = nextCharacterWpm
      if (nextEffectiveWpm !== listenEffectiveWpmRef.current) {
        setListenEffectiveWpm(nextEffectiveWpm)
        listenEffectiveWpmRef.current = nextEffectiveWpm
      }
      setListenAutoTightening(false)
      listenAutoTighteningRef.current = false
      if (!isListen || listenStatus !== 'idle') {
        return
      }
      playListenSequence(MORSE_DATA[letterRef.current].code, {
        characterWpm: nextCharacterWpm,
        effectiveWpm: nextEffectiveWpm,
      })
    },
    [isListen, listenStatus, playListenSequence],
  )

  const handleToneFrequencyChange = useCallback(
    (value: number) => {
      const clamped = Math.round(
        Math.min(TONE_FREQUENCY_RANGE.max, Math.max(TONE_FREQUENCY_RANGE.min, value)) /
          TONE_FREQUENCY_RANGE.step,
      ) * TONE_FREQUENCY_RANGE.step
      setToneFrequency(clamped)
    },
    [],
  )

  const handleReminderChange = useCallback(
    (next: ReminderSettings | undefined) => {
      setReminder(next)
    },
    [],
  )

  const handlePracticeLearnModeChange = useCallback(
    (value: boolean) => {
      if (guidedCourseActiveRef.current) {
        return
      }
      setPracticeLearnMode(value)
      practiceLearnModeRef.current = value
      if (modeRef.current !== 'practice' || practiceWordModeRef.current || !value) {
        return
      }
      const firstLetter = availableLetters[0]
      if (!firstLetter) {
        return
      }
      clearTimer(letterTimeoutRef)
      clearTimer(successTimeoutRef)
      clearTimer(errorTimeoutRef)
      setInput('')
      setStatus('idle')
      letterRef.current = firstLetter
      setLetter(firstLetter)
    },
    [availableLetters],
  )

  const handlePracticeIfrModeChange = useCallback((value: boolean) => {
    if (guidedCourseActiveRef.current) {
      return
    }
    setPracticeIfrMode(value)
    practiceIfrModeRef.current = value
    if (!value) {
      practiceReviewQueueRef.current = []
    } else {
      errorLockoutUntilRef.current = 0
    }
    if (modeRef.current !== 'practice') {
      return
    }
    clearTimer(errorTimeoutRef)
    setStatus('idle')
  }, [])

  const handlePracticeReviewMissesChange = useCallback((value: boolean) => {
    if (guidedCourseActiveRef.current) {
      return
    }
    setPracticeReviewMisses(value)
    practiceReviewMissesRef.current = value
    if (!value) {
      practiceReviewQueueRef.current = []
    }
  }, [])

  const handleUseRecommended = useCallback(() => {
    if (guidedCourseActiveRef.current) {
      return
    }
    const preferredMaxLevel = DEFAULT_MAX_LEVEL
    const preferredListenWpm = DEFAULT_LISTEN_WPM
    const preferredListenEffectiveWpm = DEFAULT_LISTEN_EFFECTIVE_WPM
    const preferredListenAutoTightening = DEFAULT_LISTEN_AUTO_TIGHTENING
    const preferredListenAutoTighteningCorrectCount = DEFAULT_LISTEN_AUTO_TIGHTENING_CORRECT_COUNT
    const preferredShowHint = false
    const preferredShowMnemonic = false
    const preferredPracticeLearnMode = true
    const preferredPracticeAutoPlay = true
    const preferredPracticeIfrMode = DEFAULT_PRACTICE_IFR_MODE
    const preferredPracticeReviewMisses = DEFAULT_PRACTICE_REVIEW_MISSES

    const isAlreadyRecommended =
      showHint === preferredShowHint &&
      showMnemonic === preferredShowMnemonic &&
      practiceLearnMode === preferredPracticeLearnMode &&
      practiceAutoPlay === preferredPracticeAutoPlay &&
      practiceIfrMode === preferredPracticeIfrMode &&
      practiceReviewMisses === preferredPracticeReviewMisses &&
      listenWpm === preferredListenWpm &&
      listenEffectiveWpm === preferredListenEffectiveWpm &&
      listenAutoTightening === preferredListenAutoTightening &&
      listenAutoTighteningCorrectCount === preferredListenAutoTighteningCorrectCount &&
      maxLevel === preferredMaxLevel

    if (isAlreadyRecommended) {
      return
    }

    const nextLetters = getLettersForLevel(preferredMaxLevel)
    setShowHint(preferredShowHint)
    setShowMnemonic(preferredShowMnemonic)
    setPracticeAutoPlay(preferredPracticeAutoPlay)
    setPracticeLearnMode(preferredPracticeLearnMode)
    practiceLearnModeRef.current = preferredPracticeLearnMode
    setPracticeIfrMode(preferredPracticeIfrMode)
    practiceIfrModeRef.current = preferredPracticeIfrMode
    setPracticeReviewMisses(preferredPracticeReviewMisses)
    practiceReviewMissesRef.current = preferredPracticeReviewMisses
    practiceReviewQueueRef.current = []
    setListenWpm(preferredListenWpm)
    listenWpmRef.current = preferredListenWpm
    setListenEffectiveWpm(preferredListenEffectiveWpm)
    listenEffectiveWpmRef.current = preferredListenEffectiveWpm
    setListenAutoTightening(preferredListenAutoTightening)
    listenAutoTighteningRef.current = preferredListenAutoTightening
    setListenAutoTighteningCorrectCount(preferredListenAutoTighteningCorrectCount)
    listenAutoTighteningCorrectCountRef.current = preferredListenAutoTighteningCorrectCount
    setMaxLevel(preferredMaxLevel)
    maxLevelRef.current = preferredMaxLevel as (typeof LEVELS)[number]
    setPracticeWpm(null)
    practiceWordStartRef.current = null
    clearTimer(wordSpaceTimeoutRef)
    clearTimer(letterTimeoutRef)
    clearTimer(successTimeoutRef)
    clearTimer(errorTimeoutRef)
    setInput('')
    setStatus('idle')
    setFreestyleInput('')
    setFreestyleResult(null)
    setFreestyleWord('')

    if (modeRef.current === 'listen') {
      resetListenState()
      const nextLetter = setNextListenLetter(nextLetters)
      playListenSequence(MORSE_DATA[nextLetter].code, {
        characterWpm: preferredListenWpm,
        effectiveWpm: preferredListenEffectiveWpm,
      })
      return
    }

    if (practiceWordModeRef.current) {
      setPracticeWordFromList(getWordsForLetters(nextLetters), practiceWordRef.current)
      return
    }

    setNextLetterForLevel(nextLetters)
  }, [
    listenAutoTightening,
    listenAutoTighteningCorrectCount,
    listenEffectiveWpm,
    listenWpm,
    maxLevel,
    mode,
    practiceAutoPlay,
    practiceIfrMode,
    practiceLearnMode,
    practiceReviewMisses,
    resetListenState,
    setNextListenLetter,
    setNextLetterForLevel,
    setPracticeWordFromList,
    showHint,
    showMnemonic,
  ])

  const handleModeChange = useCallback(
    (nextMode: Mode) => {
      logAnalyticsEvent('mode_start', { mode: nextMode })
      stopListenPlayback()
      setMode(nextMode)
      setShowSettings(false)
      setShowAbout(false)
      setIsPressing(false)
      setInput('')
      setFreestyleInput('')
      setFreestyleResult(null)
      setFreestyleWord('')
      clearTimer(wordSpaceTimeoutRef)
      setStatus('idle')
      clearTimer(letterTimeoutRef)
      clearTimer(successTimeoutRef)
      clearTimer(errorTimeoutRef)
      practiceWordStartRef.current = null
      resetListenState()
      if (nextMode !== 'practice') {
        setPracticeWpm(null)
      }
      if (nextMode === 'freestyle') {
        return
      }
      if (nextMode === 'listen') {
        setListenHasSubmittedAnswer(false)
        const nextLetter = setNextListenLetter(activeLetters)
        playListenSequence(MORSE_DATA[nextLetter].code)
        return
      }
      if (practiceWordModeRef.current) {
        setPracticeWordFromList(availablePracticeWords, practiceWordRef.current)
        return
      }
      setNextLetterForLevel(activeLetters)
    },
    [
      activeLetters,
      availablePracticeWords,
      playListenSequence,
      resetListenState,
      setNextListenLetter,
      setNextLetterForLevel,
      setPracticeWordFromList,
      setShowAbout,
      setShowSettings,
      stopListenPlayback,
    ],
  )

  const { clearLocalProgress, deleteRemoteProgress, flushPendingSave } = useProgressSyncController({
    database,
    user: userForSync,
    progressSnapshot,
    state: {
      setScores,
      setListenTtr,
      setShowHint,
      setShowMnemonic,
      setPracticeIfrMode,
      setPracticeReviewMisses,
      setLearnerProfile,
      setGuidedCourseActive,
      setGuidedPackIndex,
      setGuidedPhase,
      setGuidedProgress,
      setPracticeAutoPlay,
      setPracticeLearnMode,
      setFreestyleWordMode,
      setFreestyleResult,
      setFreestyleInput,
      setFreestyleWord,
      setToneFrequency,
      setListenWpm,
      setListenEffectiveWpm,
      setListenAutoTightening,
      setListenAutoTighteningCorrectCount,
      setMaxLevel,
      setPracticeWordMode,
      setPracticeWpm,
      setDailyActivity,
      setStreak,
      setLetterAccuracy,
      setBestWpm,
      setReminder,
    },
    refs: {
      scoresRef,
      listenTtrRef,
      dailyActivityRef,
      streakRef,
      letterAccuracyRef,
      practiceAutoPlayRef,
      practiceLearnModeRef,
      practiceIfrModeRef,
      practiceReviewMissesRef,
      practiceReviewQueueRef,
      errorLockoutUntilRef,
      learnerProfileRef,
      guidedCourseActiveRef,
      guidedPackIndexRef,
      guidedPhaseRef,
      guidedProgressRef,
      freestyleWordModeRef,
      wordSpaceTimeoutRef,
      listenWpmRef,
      listenEffectiveWpmRef,
      listenAutoTighteningRef,
      listenAutoTighteningCorrectCountRef,
      modeRef,
      listenStatusRef,
      maxLevelRef,
      practiceWordModeRef,
      practiceWordStartRef,
      letterRef,
    },
    helpers: {
      syncGuidedLevel,
      setNextListenLetter,
      setNextLetterForLevel,
      setPracticeWordFromList,
      playListenSequenceForLetter: (targetLetter, overrides) => {
        playListenSequenceRef.current(MORSE_DATA[targetLetter].code, overrides)
      },
    },
  })

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        if (__DEV__) {
          console.log('[progress] app going to background, flushing pending save')
        }
        flushPendingSave()
      }
    })
    return () => {
      subscription.remove()
    }
  }, [flushPendingSave])

  const accountActions = useAccountActions({
    user,
    isDeletingAccount,
    setIsDeletingAccount,
    setShowSettings,
    clearLocalProgress,
    deleteRemoteProgress,
    resetProgressState,
  })

  const target = MORSE_DATA[letter].code
  const targetSymbols = useMemo(() => target.split(''), [target])
  const hintVisible = !isFreestyle && !isListen && showHint
  const mnemonicVisible = !isFreestyle && !isListen && showMnemonic
  const ifrActive =
    !isFreestyle && !isListen && !isNuxActive && !guidedCourseActive && practiceIfrMode
  const isMorseDisabled = !isFreestyle && !isListen && isErrorLocked()
  const guidedTeachRemaining = Math.max(0, 2 - (guidedProgress.teachCounts[letter] ?? 0))
  const guidedTeachSuccessCount = guidedCurrentPack.reduce(
    (total, currentLetter) => total + (guidedProgress.teachCounts[currentLetter] ?? 0),
    0,
  )
  const guidedTeachSuccessText =
    GUIDED_TEACH_SUCCESS_COPY[
      Math.max(0, Math.round(guidedTeachSuccessCount) - 1) % GUIDED_TEACH_SUCCESS_COPY.length
    ]
  const baseStatusText =
    status === 'success'
      ? 'Correct'
      : status === 'error'
        ? ifrActive
          ? 'Missed. Keep going.'
          : 'Missed. Start over.'
        : mnemonicVisible
          ? MORSE_DATA[letter].mnemonic
          : ' '
  const guidedPracticeStatusText = isGuidedPracticeActive
    ? status === 'success'
      ? guidedPhase === 'teach'
        ? guidedTeachSuccessText
        : 'Correct'
      : status === 'error'
        ? guidedPhase === 'teach'
          ? 'Try again'
          : 'Listen and try again'
        : guidedPhase === 'teach'
          ? 'Repeat what you heard'
          : ' '
    : null
  const guidedPracticeStatusDetailText =
    isGuidedPracticeActive && guidedPhase === 'teach' && status !== 'success'
      ? `${guidedTeachRemaining} remaining`
      : null
  const practiceProgressText =
    !isFreestyle &&
    !isListen &&
    practiceWordMode &&
    status === 'idle' &&
    !hintVisible &&
    !mnemonicVisible &&
    practiceWord
      ? `Letter ${practiceWordIndex + 1} of ${practiceWord.length}`
      : null
  const practiceStatusText = guidedPracticeStatusText ?? practiceProgressText ?? baseStatusText
  const practiceWpmText =
    !isFreestyle && !isListen && practiceWordMode && practiceWpm !== null
      ? `${formatWpm(practiceWpm)} WPM`
      : null
  const listenTtrText = isListen && listenRecognitionText ? listenRecognitionText : null
  const isInputOnTrack = !isFreestyle && !isListen && Boolean(input) && target.startsWith(input)
  const highlightCount =
    status === 'success' ? targetSymbols.length : isInputOnTrack ? input.length : 0
  const pips = useMemo<StagePip[]>(
    () =>
      targetSymbols.map((symbol, index) => ({
        type: symbol === '.' ? 'dot' : 'dah',
        state: index < highlightCount ? 'hit' : 'expected',
      })),
    [highlightCount, targetSymbols],
  )
  const isLetterResult = freestyleResult ? /^[A-Z0-9]$/.test(freestyleResult) : false
  const freestyleStatus = freestyleResult
    ? isLetterResult
      ? freestyleWordMode
        ? `Added ${freestyleResult}`
        : ' '
      : freestyleResult
    : freestyleInput
      ? `Input ${freestyleInput}`
      : freestyleWordMode && freestyleWord
        ? `Word ${freestyleWord}`
        : 'Tap to dit or dah'
  const freestyleDisplay = freestyleWordMode
    ? freestyleWord || (freestyleResult && !isLetterResult ? '?' : '')
    : freestyleResult
      ? isLetterResult
        ? freestyleResult
        : '?'
      : freestyleInput || '?'
  const listenStatusText =
    listenStatus === 'success'
      ? 'Correct'
      : listenStatus === 'error'
        ? isGuidedListenActive
          ? `It was ${listenReveal ?? letter}`
          : 'Incorrect'
        : listenHasSubmittedAnswer
          ? ' '
          : 'Type what you hear'
  const listenStatusDetailTokens =
    listenStatus === 'idle' && !listenHasSubmittedAnswer && isGuidedListenActive
      ? guidedCurrentPack
      : null
  const listenDisplay = listenReveal ?? '?'
  const statusText = isFreestyle ? freestyleStatus : isListen ? listenStatusText : practiceStatusText
  const stageLetter = isFreestyle ? freestyleDisplay : isListen ? listenDisplay : letter
  const stagePips = isFreestyle || isListen ? [] : pips
  const showPracticeWord = !isFreestyle && !isListen && practiceWordMode
  const letterPlaceholder = isListen && listenReveal === null

  return {
    state: {
      mode,
      showHint,
      showMnemonic,
      practiceAutoPlay,
      practiceLearnMode,
      practiceIfrMode,
      practiceReviewMisses,
      guidedCourseActive,
      guidedPackIndex,
      guidedPhase,
      guidedProgress,
      maxLevel,
      practiceWordMode,
      practiceWord,
      practiceWordIndex,
      freestyleWordMode,
      toneFrequency,
      listenWpm,
      listenStatus,
      listenWavePlayback,
      scores,
      isPressing,
      tutorialTapCount,
      tutorialHoldCount,
      learnerProfile,
      didCompleteSoundCheck,
      dailyActivity,
      streak,
      letterAccuracy,
      bestWpm,
      reminder,
    },
    setters: {
      setShowHint,
      setShowMnemonic,
      setPracticeAutoPlay,
      flushPendingSave,
    },
    derived: {
      isFreestyle,
      isListen,
      isGuidedLessonModeMismatch,
      isGuidedPracticeActive,
      isGuidedListenActive,
      activeLetters,
      guidedCurrentPack,
      statusText,
      guidedPracticeStatusDetailText,
      listenStatusDetailTokens,
      stageLetter,
      stagePips,
      hintVisible,
      letterPlaceholder,
      practiceWpmText,
      listenTtrText,
      showPracticeWord,
      practiceWord,
      practiceWordIndex,
      showMorseHint: introHintStep === 'morse' && !isListen && !isNuxActive,
      showSettingsHint: introHintStep === 'settings' && !isListen && !isNuxActive,
      isMorseDisabled,
    },
    handlers: {
      handleResetScores,
      handleModeChange,
      handlePracticeWordModeChange,
      handlePracticeLearnModeChange,
      handlePracticeIfrModeChange,
      handlePracticeReviewMissesChange,
      handleListenWpmChange,
      handleToneFrequencyChange,
      handleReminderChange,
      handleUseRecommended,
      handleListenReplay,
      submitListenAnswer,
      handleFreestyleClear,
      handlePracticeReplay,
      handleIntroPressIn,
      handlePressOut,
      handleMaxLevelChange,
      moveIntoGuidedLesson,
      resetProgressState,
      ...onboardingActions,
      ...accountActions,
    },
  }
}
