import {
  BEGINNER_COURSE_PACKS,
  applyScoreDelta,
  createGuidedLessonProgress,
  DEFAULT_CHARACTER_WPM,
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
  MORSE_DATA,
  recordGuidedListenResult,
  recordGuidedPracticeResult,
  recordGuidedTeachSuccess,
  type GuidedLessonProgress,
  type GuidedPhase,
  type Letter,
  type LearnerProfile,
  type ListenTtrRecord,
  type ProgressSnapshot,
} from '@dit/core'
import { triggerHaptics } from '@dit/dit-native'
import type { User } from '@firebase/auth'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { AboutModal } from './src/components/AboutModal'
import { BackgroundGlow } from './src/components/BackgroundGlow'
import { DitButton } from './src/components/DitButton'
import { ListenControls } from './src/components/ListenControls'
import { type Mode } from './src/components/ModeSwitcher'
import { MorseButton } from './src/components/MorseButton'
import { MorseLiquidSurface } from './src/components/MorseLiquidSurface'
import { NuxModal } from './src/components/NuxModal'
import { PhaseModal } from './src/components/PhaseModal'
import { ReferenceModalSheet } from './src/components/ReferenceModalSheet'
import { SettingsModal } from './src/components/SettingsModal'
import { StageDisplay, type StagePip } from './src/components/StageDisplay'
import { TopBar } from './src/components/TopBar'
import { database } from './src/firebase'
import { useAuth } from './src/hooks/useAuth'
import { useBackgroundIdle } from './src/hooks/useBackgroundIdle'
import { useOnboardingState } from './src/hooks/useOnboardingState'
import { usePhaseModalState } from './src/hooks/usePhaseModalState'
import { useProgressSyncController } from './src/hooks/useProgressSyncController'
import { useSystemLowPowerMode } from './src/hooks/useSystemLowPowerMode'
import {
  deleteCurrentUserAccount,
  prepareCurrentUserAccountDeletion,
  signInWithApple,
  signInWithGoogle,
  signOut,
} from './src/services/auth'
import {
  getAutoEffectiveWpm,
  normalizeListenSpeeds,
} from './src/utils/listenSpeed'
import {
  getListenPlaybackDurationMs,
  getListenTiming,
  type ListenWavePlayback,
} from './src/utils/listenWave'
import {
  enqueueReviewLetter,
  filterReviewQueue,
  pullDueReviewLetter,
  type PracticeReviewItem,
} from './src/utils/practiceReviewQueue'
import {
  playMorseTone,
  prepareToneEngine,
  startTone,
  stopMorseTone,
  stopTone,
} from './src/utils/tone'
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
  LISTEN_WPM_MAX,
  LISTEN_WPM_MIN,
  PRACTICE_NEXT_LETTER_DELAY_MS,
  PRACTICE_REVIEW_DELAY_STEPS,
  PRACTICE_REVIEW_MAX_SIZE,
  PRACTICE_WORD_UNITS,
  NUX_STATUS_KEY,
  REFERENCE_LETTERS,
  REFERENCE_NUMBERS,
  REFERENCE_WPM,
  WORD_GAP_EXTRA_MS,
  applyListenTtrSample,
  clearTimer,
  createInitialPracticeConfig,
  enqueueListenOverlearnLetters,
  getDeleteAccountErrorMessage,
  getGuidedPracticePool,
  getLevelForLetters,
  getListenOverlearnRepeats,
  getNextOrderedLetter,
  getSignInErrorMessage,
  initialConfig,
  isErrorWithCode,
  now,
  pullNextListenOverlearnLetter,
  type ListenPromptTiming,
  type TimeoutHandle,
} from './src/utils/appState'

/** Primary app entry for Dit iOS. */
export default function App() {
  const { user } = useAuth()
  const { phaseModal, showPhaseModal, handlePhaseModalDismiss } = usePhaseModalState()
  const {
    introHintStep,
    dismissMorseHint,
    dismissSettingsHint,
    nuxStatus,
    setNuxStatus,
    persistIntroHintStep,
    persistNuxStatus,
    nuxStep,
    setNuxStep,
    nuxReady,
    learnerProfile,
    setLearnerProfile,
    didCompleteSoundCheck,
    setDidCompleteSoundCheck,
    didCompleteTutorialTap,
    setDidCompleteTutorialTap,
    didCompleteTutorialHold,
    setDidCompleteTutorialHold,
  } = useOnboardingState()
  const isSystemLowPowerModeEnabled = useSystemLowPowerMode()
  const { isBackgroundIdle, handleRootTouchStart } = useBackgroundIdle()
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [isPressing, setIsPressing] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [showReference, setShowReference] = useState(false)
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
  const [listenHasSubmittedAnswer, setListenHasSubmittedAnswer] = useState(false)
  const [listenRecognitionText, setListenRecognitionText] = useState<string | null>(null)
  const learnerProfileRef = useRef<LearnerProfile | null>(learnerProfile)
  const guidedCourseActiveRef = useRef(guidedCourseActive)
  const guidedPackIndexRef = useRef(guidedPackIndex)
  const guidedPhaseRef = useRef<GuidedPhase>(guidedPhase)
  const guidedProgressRef = useRef<GuidedLessonProgress>(guidedProgress)
  const isFreestyle = mode === 'freestyle'
  const isListen = mode === 'listen'
  const isBackgroundAnimationPaused =
    !(nuxReady && nuxStatus === 'pending') && (isSystemLowPowerModeEnabled || isBackgroundIdle)
  const isNuxActive = nuxReady && nuxStatus === 'pending'
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
  // Also treat reference panel as a mode that requires the tone player to stay alive for instant playback
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
      listenWpm,
      listenEffectiveWpm,
      listenAutoTightening,
      listenAutoTighteningCorrectCount,
      listenTtr,
      maxLevel,
      practiceWordMode,
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
    }),
    [
      freestyleWordMode,
      listenAutoTightening,
      listenAutoTighteningCorrectCount,
      listenEffectiveWpm,
      listenTtr,
      listenWpm,
      maxLevel,
      learnerProfile,
      practiceIfrMode,
      guidedCourseActive,
      guidedPackIndex,
      guidedPhase,
      guidedProgress,
      practiceReviewMisses,
      practiceWordMode,
      scores,
      showHint,
      showMnemonic,
    ],
  )
  const pressStartRef = useRef<number | null>(null)
  const inputRef = useRef(input)
  const freestyleInputRef = useRef(freestyleInput)
  const letterRef = useRef(letter)
  const practiceWordRef = useRef(practiceWord)
  const practiceWordIndexRef = useRef(practiceWordIndex)
  const practiceWordModeRef = useRef(practiceWordMode)
  const practiceLearnModeRef = useRef(practiceLearnMode)
  const practiceIfrModeRef = useRef(practiceIfrMode)
  const practiceReviewMissesRef = useRef(practiceReviewMisses)
  const practiceWordStartRef = useRef<number | null>(null)
  const practiceReviewQueueRef = useRef<PracticeReviewItem[]>([])
  const freestyleWordModeRef = useRef(freestyleWordMode)
  const wordSpaceTimeoutRef = useRef<TimeoutHandle | null>(null)
  const scoresRef = useRef(scores)
  const listenTtrRef = useRef(listenTtr)
  const maxLevelRef = useRef<1 | 2 | 3 | 4>(maxLevel as 1 | 2 | 3 | 4)
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
    const { currentPack, unlockedLetters, reviewPool } = getGuidedPracticePool(guidedPackIndexRef.current)
    if (guidedPhaseRef.current === 'teach') {
      const incompleteLetter =
        currentPack.find(
          (letter) => (guidedProgressRef.current.teachCounts[letter] ?? 0) < 2,
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
          (letter) => (guidedProgressRef.current.listenLetterCorrect[letter] ?? 0) < 1,
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
        getRandomLatencyAwareLetter(
          nextLetters,
          scoresRef.current,
          listenTtrRef.current,
          currentLetter,
        )
      if (hasReachedConsecutiveCap && nextLetter === currentLetter && nextLetters.length > 1) {
        if (reviewLetter === currentLetter) {
          nextQueue = enqueueListenOverlearnLetters(
            nextQueue,
            currentLetter,
            1,
            LISTEN_OVERLEARN_MAX_QUEUE_SIZE,
          )
        }
        const alternatives = nextLetters.filter((letter) => letter !== currentLetter)
        nextLetter = getRandomLatencyAwareLetter(
          alternatives,
          scoresRef.current,
          listenTtrRef.current,
        )
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
    maxLevelRef.current = maxLevel
    modeRef.current = mode
    listenWpmRef.current = listenWpm
    listenEffectiveWpmRef.current = listenEffectiveWpm
    listenAutoTighteningRef.current = listenAutoTightening
    listenAutoTighteningCorrectCountRef.current = listenAutoTighteningCorrectCount
    listenStatusRef.current = listenStatus
  }, [
    freestyleInput,
    freestyleWordMode,
    input,
    letter,
    listenAutoTightening,
    listenAutoTighteningCorrectCount,
    listenEffectiveWpm,
    listenStatus,
    listenWpm,
    maxLevel,
    mode,
    practiceWord,
    practiceWordIndex,
    practiceWordMode,
    practiceLearnMode,
    practiceIfrMode,
    practiceReviewMisses,
    learnerProfile,
    guidedCourseActive,
    guidedPackIndex,
    guidedPhase,
    guidedProgress,
    scores,
    listenTtr,
  ])

  const stopTonePlayback = useCallback(() => {
    void stopTone()
  }, [stopTone])

  const startTonePlayback = useCallback(() => {
    void startTone()
  }, [startTone])

  const stopListenPlayback = useCallback(() => {
    void stopMorseTone()
    stopTonePlayback()
  }, [stopMorseTone, stopTonePlayback])

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
      const timing = getListenTiming(resolvedCharacterWpm, resolvedEffectiveWpm, LISTEN_MIN_UNIT_MS)
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
      })
    },
    [stopListenPlayback],
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
  }, [prepareToneEngine, stopMorseTone, stopTone])

  useEffect(() => {
    if (isListen || isReferencePanelActive) {
      void prepareToneEngine()
    }
  }, [isListen, isReferencePanelActive, prepareToneEngine])

  useEffect(() => {
    if (mode === 'listen') {
      return
    }
    practiceReviewQueueRef.current = filterReviewQueue(
      practiceReviewQueueRef.current,
      activeLetters,
    )
    if (!activeLetters.includes(letterRef.current)) {
      const nextLetter = practiceLearnModeRef.current
        ? activeLetters[0]
        : getRandomLetter(activeLetters)
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
  }, [isNuxActive])

  const canScoreAttempt = useCallback(
    () => !isNuxActive && (!showHint || isGuidedPracticeActive),
    [isGuidedPracticeActive, isNuxActive, showHint],
  )

  const bumpScore = useCallback((targetLetter: Letter, delta: number) => {
    setScores((prev) => applyScoreDelta(prev, targetLetter, delta))
  }, [])

  const isErrorLocked = useCallback(() => now() < errorLockoutUntilRef.current, [])

  const startErrorLockout = useCallback(() => {
    errorLockoutUntilRef.current = now() + ERROR_LOCKOUT_MS
  }, [])

  const handleShowReference = useCallback(() => {
    setShowSettings(false)
    setShowAbout(false)
    setShowReference(true)
  }, [])

  const handleShowAbout = useCallback(() => {
    setShowReference(false)
    setShowAbout(true)
  }, [])

  const handleSignInWithApple = useCallback(async () => {
    try {
      await signInWithApple()
    } catch (error) {
      if (isErrorWithCode(error, 'ERR_APPLE_SIGN_IN_CANCELLED')) {
        return
      }

      console.error('Failed to sign in with Apple', error)
      Alert.alert('Could Not Sign In', getSignInErrorMessage(error))
    }
  }, [])

  const handleSignInWithGoogle = useCallback(async () => {
    try {
      await signInWithGoogle()
    } catch (error) {
      console.error('Failed to sign in with Google', error)
      Alert.alert('Could Not Sign In', getSignInErrorMessage(error))
    }
  }, [])

  const handleSettingsToggle = useCallback(() => {
    setShowAbout(false)
    setShowReference(false)
    dismissSettingsHint()
    setShowSettings((prev) => !prev)
  }, [dismissSettingsHint])

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
    setDidCompleteTutorialTap(false)
    setDidCompleteTutorialHold(false)
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
  }, [stopListenPlayback])

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
    [setGuidedPhaseState, setNextListenLetter, setNextPracticeLetter],
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
      showPhaseModal({ title: 'Course complete', subtitle: 'You unlocked all beginner letter packs.' })
      return
    }
    const nextPack = getBeginnerCoursePack(nextPackIndex)
    showPhaseModal({ title: 'New letters unlocked', letters: nextPack }, () => {
      moveIntoGuidedLesson('teach', nextPackIndex, createGuidedLessonProgress())
    })
  }, [moveIntoGuidedLesson])

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
    showPhaseModal({ title: 'Keep going', subtitle: 'One more practice round before new letters.' }, () => {
      moveIntoGuidedLesson('practice', packIndex, nextProgress)
    })
  }, [moveIntoGuidedLesson])

  const handleNuxChooseProfile = useCallback((profile: LearnerProfile) => {
    setLearnerProfile(profile)
    learnerProfileRef.current = profile
    setNuxStep('sound_check')
  }, [])

  const handleNuxPlaySoundCheck = useCallback(() => {
    void playMorseTone({
      code: '.',
      characterWpm: DEFAULT_CHARACTER_WPM,
      effectiveWpm: DEFAULT_CHARACTER_WPM,
      minUnitMs: LISTEN_MIN_UNIT_MS,
    })
    void triggerHaptics(10)
    setDidCompleteSoundCheck(true)
  }, [])

  const handleNuxPlayDitDemo = useCallback(() => {
    void playMorseTone({
      code: '.',
      characterWpm: DEFAULT_CHARACTER_WPM,
      effectiveWpm: DEFAULT_CHARACTER_WPM,
      minUnitMs: LISTEN_MIN_UNIT_MS,
    })
    void triggerHaptics(10)
  }, [])

  const handleNuxPlayDahDemo = useCallback(() => {
    void playMorseTone({
      code: '-',
      characterWpm: DEFAULT_CHARACTER_WPM,
      effectiveWpm: DEFAULT_CHARACTER_WPM,
      minUnitMs: LISTEN_MIN_UNIT_MS,
    })
    void triggerHaptics(10)
  }, [])

  const handleNuxContinueFromSoundCheck = useCallback(() => {
    if (!didCompleteSoundCheck) {
      return
    }
    setNuxStep('button_tutorial')
  }, [didCompleteSoundCheck])

  const handleNuxCompleteButtonTutorial = useCallback(() => {
    if (!didCompleteTutorialTap || !didCompleteTutorialHold) {
      return
    }
    setNuxStep(learnerProfileRef.current === 'known' ? 'known_tour' : 'beginner_intro')
  }, [didCompleteTutorialHold, didCompleteTutorialTap])

  const finishOnboarding = useCallback(() => {
    persistNuxStatus('completed')
    persistIntroHintStep('done')
    setNuxStep('profile')
    setDidCompleteSoundCheck(false)
    setDidCompleteTutorialTap(false)
    setDidCompleteTutorialHold(false)
  }, [persistIntroHintStep, persistNuxStatus])

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
  }, [applyKnownLearnerDefaults, finishOnboarding])

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
  }, [finishOnboarding, moveIntoGuidedLesson])

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
      if (listenStatus !== 'idle') {
        return
      }
      if (!/^[A-Z0-9]$/.test(value)) {
        return
      }
      if (!activeLetterSet.has(value)) {
        return
      }
      setListenHasSubmittedAnswer(true)
      void triggerHaptics(10)
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
      activeLetters,
      activeLetterSet,
      bumpScore,
      listenStatus,
      playListenSequence,
      retryGuidedPractice,
      setNextListenLetter,
      stopListenPlayback,
      triggerHaptics,
      unlockNextGuidedPack,
    ],
  )

  const handleListenReplay = useCallback(() => {
    if (listenStatus !== 'idle') {
      return
    }
    setListenReveal(null)
    void triggerHaptics(12)
    playListenSequence(MORSE_DATA[letterRef.current].code)
  }, [listenStatus, playListenSequence, triggerHaptics])

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
    void triggerHaptics(12)
    void playMorseTone({
      code: MORSE_DATA[letterRef.current].code,
      characterWpm: listenWpm,
      effectiveWpm: listenEffectiveWpm,
      minUnitMs: LISTEN_MIN_UNIT_MS,
    })
  }, [isFreestyle, isListen, listenEffectiveWpm, listenWpm, stopListenPlayback, triggerHaptics])

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
    })
  }, [isNuxActive, letter, listenEffectiveWpm, listenWpm, mode, practiceAutoPlay, stopListenPlayback])

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
        const ifrEnabled =
          practiceIfrModeRef.current && !isNuxActive && modeRef.current === 'practice'
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
                  showPhaseModal({ title: 'Next up', subtitle: 'Practice in mixed order.', letters: currentPack }, () => {
                    moveIntoGuidedLesson('practice', packIdx, practiceProgress)
                  })
                  return
                }
                setNextPracticeLetter(activeLetters, targetLetter)
                setStatus('idle')
              }, PRACTICE_NEXT_LETTER_DELAY_MS)
              return
            }
            bumpScore(targetLetter, 1)
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
                showPhaseModal({ title: 'Ready to listen', subtitle: 'Hear and identify these letters.', letters: currentPack }, () => {
                  moveIntoGuidedLesson('listen', listenPackIdx, listenProgress)
                })
                return
              }
              setNextPracticeLetter(activeLetters, targetLetter)
              setStatus('idle')
            }, PRACTICE_NEXT_LETTER_DELAY_MS)
            return
          }
          if (canScoreAttempt()) {
            bumpScore(targetLetter, 1)
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
          })
          errorTimeoutRef.current = setTimeout(() => {
            setStatus('idle')
          }, ERROR_LOCKOUT_MS)
          return
        }
        if (canScoreAttempt()) {
          bumpScore(targetLetter, -1)
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
      advancePracticeWordTarget,
      activeLetters,
      bumpScore,
      canScoreAttempt,
      moveIntoGuidedLesson,
      setNextPracticeLetter,
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
          setDidCompleteTutorialTap(true)
        } else {
          setDidCompleteTutorialHold(true)
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
    [isErrorLocked, isFreestyle, isNuxActive, nuxStep, scheduleLetterReset],
  )

  const handlePressIn = useCallback(() => {
    if (pressStartRef.current !== null) {
      return
    }
    if (isListen) {
      return
    }
    if (!isFreestyle && isErrorLocked()) {
      return
    }
    setIsPressing(true)
    pressStartRef.current = now()
    clearTimer(letterTimeoutRef)
    if (!isFreestyle) {
      void stopMorseTone()
    }
    startTonePlayback()
  }, [isErrorLocked, isFreestyle, isListen, startTonePlayback, stopMorseTone])
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
    const duration = now() - start
    const symbol = duration < DOT_THRESHOLD_MS ? '.' : '-'
    registerSymbol(symbol)
  }, [isListen, registerSymbol, stopMorseTone, stopTonePlayback])

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
      practiceReviewQueueRef.current = filterReviewQueue(
        practiceReviewQueueRef.current,
        nextLetters,
      )
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

  const handleReplayNux = useCallback(() => {
    setShowSettings(false)
    setShowAbout(false)
    setShowReference(false)
    setNuxStatus('pending')
    setNuxStep('profile')
    setLearnerProfile(null)
    setDidCompleteSoundCheck(false)
    setDidCompleteTutorialTap(false)
    setDidCompleteTutorialHold(false)
    void AsyncStorage.setItem(NUX_STATUS_KEY, 'pending')
  }, [])

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
    maxLevelRef.current = preferredMaxLevel as 1 | 2 | 3 | 4

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
    maxLevel,
    playListenSequence,
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
    listenWpm,
    listenAutoTightening,
    listenAutoTighteningCorrectCount,
    listenEffectiveWpm,
  ])

  const handleModeChange = useCallback(
    (nextMode: Mode) => {
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
      stopListenPlayback,
    ],
  )

  const { clearLocalProgress, deleteRemoteProgress } = useProgressSyncController({
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
      setFreestyleWordMode,
      setFreestyleResult,
      setFreestyleInput,
      setFreestyleWord,
      setListenWpm,
      setListenEffectiveWpm,
      setListenAutoTightening,
      setListenAutoTighteningCorrectCount,
      setMaxLevel,
      setPracticeWordMode,
      setPracticeWpm,
    },
    refs: {
      scoresRef,
      listenTtrRef,
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

  const performAccountDeletion = useCallback(
    async (currentUser: User) => {
      if (isDeletingAccount) {
        return
      }

      setIsDeletingAccount(true)
      let accountDeleted = false

      try {
        setShowSettings(false)
        await prepareCurrentUserAccountDeletion(currentUser)
        await deleteRemoteProgress(currentUser.uid)
        await deleteCurrentUserAccount(currentUser)
        accountDeleted = true
        await clearLocalProgress()
        resetProgressState()
      } catch (error) {
        if (isErrorWithCode(error, 'ERR_APPLE_ACCOUNT_DELETION_CANCELLED')) {
          return
        }

        if (accountDeleted) {
          resetProgressState()
          Alert.alert(
            'Account Deleted',
            'Your account was deleted, but local cleanup did not finish cleanly. Relaunch the app if any old progress remains.',
          )
          return
        }

        Alert.alert('Could Not Delete Account', getDeleteAccountErrorMessage(error))
      } finally {
        setIsDeletingAccount(false)
      }
    },
    [clearLocalProgress, deleteRemoteProgress, isDeletingAccount, resetProgressState],
  )

  const handleDeleteAccount = useCallback(() => {
    if (!user || isDeletingAccount) {
      return
    }

    Alert.alert(
      'Delete account?',
      'This permanently deletes your Dit account, synced progress, and local progress on this device.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => {
            void performAccountDeletion(user)
          },
        },
      ],
    )
  }, [isDeletingAccount, performAccountDeletion, user])

  const target = MORSE_DATA[letter].code
  const targetSymbols = useMemo(() => target.split(''), [target])
  const hintVisible =
    !isFreestyle && !isListen && showHint
  const mnemonicVisible = !isFreestyle && !isListen && showMnemonic
  const showMorseHint = introHintStep === 'morse' && !isListen && !isNuxActive
  const showSettingsHint = introHintStep === 'settings' && !isListen && !isNuxActive
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
      ? 'Tap what you hear'
      : ' '
    : null
  const guidedPracticeStatusDetailText =
    isGuidedPracticeActive &&
    guidedPhase === 'teach' &&
    status !== 'success'
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
  const listenTtrText =
    isListen && listenRecognitionText
    ? listenRecognitionText
    : null
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
      : isGuidedListenActive
      ? 'Type what you hear'
      : 'Type what you hear'
  const listenStatusDetailTokens =
    listenStatus === 'idle' &&
    !listenHasSubmittedAnswer &&
    isGuidedListenActive
      ? guidedCurrentPack
      : null
  const listenDisplay = listenReveal ?? '?'
  const statusText = isFreestyle
    ? freestyleStatus
    : isListen
    ? listenStatusText
    : practiceStatusText
  const stageLetter = isFreestyle ? freestyleDisplay : isListen ? listenDisplay : letter
  const stagePips = isFreestyle || isListen ? [] : pips
  const showPracticeWord = !isFreestyle && !isListen && practiceWordMode
  const letterPlaceholder = isListen && listenReveal === null

  return (
    <SafeAreaProvider>
      <View style={styles.container} onStartShouldSetResponderCapture={handleRootTouchStart}>
        <MorseLiquidSurface
          paused={isBackgroundAnimationPaused}
          targetFps={20}
          speedMultiplier={0.35}
          style={styles.liquidBackground}
        />
        <BackgroundGlow />
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          {!isNuxActive ? (
            <TopBar
              mode={mode}
              onModeChange={handleModeChange}
              onPressReference={handleShowReference}
              onSettingsPress={handleSettingsToggle}
              showSettingsHint={showSettingsHint}
              courseChipText={guidedCourseActive ? `Pack ${guidedPackIndex + 1}` : null}
            />
          ) : null}
          {showAbout ? <AboutModal onClose={() => setShowAbout(false)} /> : null}
          {showSettings ? (
            <SettingsModal
              isFreestyle={isFreestyle}
              isListen={isListen}
              levels={LEVELS}
              maxLevel={maxLevel}
              practiceWordMode={isFreestyle ? freestyleWordMode : practiceWordMode}
              practiceAutoPlay={practiceAutoPlay}
              practiceLearnMode={practiceLearnMode}
              practiceIfrMode={practiceIfrMode}
              practiceReviewMisses={practiceReviewMisses}
              guidedCourseActive={guidedCourseActive}
              listenCharacterWpm={listenWpm}
              listenCharacterWpmMin={LISTEN_WPM_MIN}
              listenCharacterWpmMax={LISTEN_WPM_MAX}
              showHint={showHint}
              showMnemonic={showMnemonic}
              isDeletingAccount={isDeletingAccount}
              onClose={() => setShowSettings(false)}
              onMaxLevelChange={handleMaxLevelChange}
              onPracticeWordModeChange={handlePracticeWordModeChange}
              onPracticeAutoPlayChange={setPracticeAutoPlay}
              onPracticeLearnModeChange={handlePracticeLearnModeChange}
              onPracticeIfrModeChange={handlePracticeIfrModeChange}
              onPracticeReviewMissesChange={handlePracticeReviewMissesChange}
              onListenCharacterWpmChange={handleListenWpmChange}
              onShowHintChange={setShowHint}
              onShowMnemonicChange={setShowMnemonic}
              onUseRecommended={handleUseRecommended}
              onShowAbout={handleShowAbout}
              user={user}
              onSignInWithApple={handleSignInWithApple}
              onSignInWithGoogle={handleSignInWithGoogle}
              onSignOut={signOut}
              onDeleteAccount={handleDeleteAccount}
              onReplayNux={handleReplayNux}
            />
          ) : null}
          {showReference ? (
            <ReferenceModalSheet
              letters={REFERENCE_LETTERS}
              numbers={REFERENCE_NUMBERS}
              morseData={MORSE_DATA}
              scores={scores}
              courseProgress={guidedCourseActive ? {
                packIndex: guidedPackIndex,
                totalPacks: BEGINNER_COURSE_PACKS.length,
                phase: guidedPhase,
                packLetters: guidedCurrentPack,
              } : null}
              onClose={() => setShowReference(false)}
              onResetScores={handleResetScores}
              onPlaySound={(char) => {
                void playMorseTone({
                  code: MORSE_DATA[char].code,
                  characterWpm: REFERENCE_WPM,
                  effectiveWpm: REFERENCE_WPM,
                  minUnitMs: LISTEN_MIN_UNIT_MS,
                })
              }}
            />
          ) : null}
          {!isNuxActive ? (
            <StageDisplay
              letter={stageLetter}
              statusText={statusText}
              statusDetailText={!isListen ? guidedPracticeStatusDetailText : null}
              statusDetailTokens={
                isListen
                  ? listenStatusDetailTokens
                  : null
              }
              pips={stagePips}
              hintVisible={hintVisible}
              letterPlaceholder={letterPlaceholder}
              isListen={isListen}
              listenStatus={listenStatus}
              listenWavePlayback={listenWavePlayback}
              freestyleToneActive={isPressing}
              practiceWpmText={practiceWpmText}
              listenTtrText={listenTtrText}
              practiceWordMode={showPracticeWord}
              practiceWord={showPracticeWord ? practiceWord : null}
              practiceWordIndex={practiceWordIndex}
              isFreestyle={isFreestyle}
            />
          ) : null}
          {!isNuxActive ? (
            <View style={styles.controls}>
              {isGuidedLessonModeMismatch ? (
                <DitButton
                  onPress={() => {
                    moveIntoGuidedLesson(
                      guidedPhaseRef.current,
                      guidedPackIndexRef.current,
                      guidedProgressRef.current,
                    )
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Return to guided lesson"
                  style={{ marginBottom: 12 }}
                  textStyle={{ fontSize: 14 }}
                  radius={24}
                  paddingHorizontal={16}
                  paddingVertical={10}
                  text="Return to lesson"
                />
              ) : null}
              {isListen ? (
                <ListenControls
                  availableLetters={activeLetters}
                  listenStatus={listenStatus}
                  onReplay={handleListenReplay}
                  onSubmitAnswer={submitListenAnswer}
                />
              ) : (
                <>
                  {isFreestyle ? (
                    <DitButton
                      onPress={handleFreestyleClear}
                      accessibilityRole="button"
                      accessibilityLabel="Clear freestyle word"
                      style={{ marginBottom: 12 }}
                      textStyle={{ fontSize: 14 }}
                      radius={24}
                      paddingHorizontal={12}
                      paddingVertical={8}
                      text="Clear"
                    />
                  ) : null}
                  {!isFreestyle ? (
                    <DitButton
                      onPress={handlePracticeReplay}
                      accessibilityRole="button"
                      accessibilityLabel="Play target character"
                      style={styles.practicePlayButton}
                      textStyle={styles.practicePlayButtonText}
                      radius={24}
                      paddingHorizontal={18}
                      paddingVertical={8}
                      text="Play"
                    />
                  ) : null}
                  <View style={styles.morseButtonWrap}>
                    {showMorseHint ? (
                      <View style={styles.morseHint}>
                        <Text style={styles.hintText}>
                          Tap the big Morse key to make a dit (short press) or dah (long press).
                        </Text>
                        <View style={styles.morseHintArrow} />
                      </View>
                    ) : null}
                    <MorseButton
                      disabled={isMorseDisabled}
                      isPressing={isPressing}
                      onPressIn={handleIntroPressIn}
                      onPressOut={handlePressOut}
                    />
                  </View>
                </>
              )}
            </View>
          ) : isNuxActive && nuxStep === 'button_tutorial' ? (
            <View style={styles.nuxExerciseControls}>
              <MorseButton
                disabled={isMorseDisabled}
                isPressing={isPressing}
                onPressIn={handleIntroPressIn}
                onPressOut={handlePressOut}
                showTapHint={!didCompleteTutorialTap && !didCompleteTutorialHold}
              />
            </View>
          ) : null}
        </SafeAreaView>
        {phaseModal ? (
          <PhaseModal
            content={phaseModal}
            onDismiss={handlePhaseModalDismiss}
          />
        ) : null}
        {isNuxActive ? (
          <NuxModal
            step={nuxStep}
            learnerProfile={learnerProfile}
            soundChecked={didCompleteSoundCheck}
            didCompleteTutorialTap={didCompleteTutorialTap}
            didCompleteTutorialHold={didCompleteTutorialHold}
            currentPack={getBeginnerCoursePack(0)}
            onChooseProfile={handleNuxChooseProfile}
            onPlaySoundCheck={handleNuxPlaySoundCheck}
            onContinueFromSoundCheck={handleNuxContinueFromSoundCheck}
            onPlayDitDemo={handleNuxPlayDitDemo}
            onPlayDahDemo={handleNuxPlayDahDemo}
            onCompleteButtonTutorial={handleNuxCompleteButtonTutorial}
            onFinishKnownTour={handleFinishKnownTour}
            onStartBeginnerCourse={handleStartBeginnerCourse}
          />
        ) : null}
      </View>
      <StatusBar style="light" />
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0c12',
    overflow: 'hidden',
  },
  liquidBackground: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.3,
    zIndex: 0,
  },
  safeArea: {
    flex: 1,
    position: 'relative',
  },
  controls: {
    alignItems: 'center',
    paddingBottom: 24,
    paddingTop: 12,
    paddingHorizontal: 24,
    width: '100%',
  },
  morseButtonWrap: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  practicePlayButton: {
    marginBottom: 16,
  },
  practicePlayButtonText: {
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  morseHint: {
    width: '100%',
    maxWidth: 320,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'hsla(210, 33%, 14%, 0.90)',
    alignItems: 'center',
    gap: 12,
  },
  morseHintArrow: {
    position: 'absolute',
    bottom: -6,
    left: '50%',
    width: 12,
    height: 12,
    backgroundColor: 'hsla(210, 33%, 14%, 0.90)',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    transform: [{ translateX: -6 }, { rotate: '45deg' }],
  },
  hintText: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(244, 247, 249, 0.9)',
  },
  nuxExerciseControls: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
})
