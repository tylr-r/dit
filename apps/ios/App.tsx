import {
  applyScoreDelta,
  DASH_THRESHOLD,
  DEBOUNCE_DELAY,
  DEFAULT_CHARACTER_WPM,
  DEFAULT_EFFECTIVE_WPM,
  EFFECTIVE_WPM_RANGE,
  formatWpm,
  getLettersForLevel,
  getRandomLatencyAwareLetter,
  getRandomLetter,
  getRandomWeightedLetter,
  getRandomWord,
  getWordsForLetters,
  initializeScores,
  INTER_LETTER_UNITS,
  INTER_WORD_UNITS,
  MORSE_DATA,
  UNIT_TIME_MS,
  WPM_RANGE,
  type Letter,
  type ListenTtrRecord,
  type Progress,
  type ProgressSnapshot,
} from '@dit/core'
import {
  addLowPowerModeListener,
  getLowPowerModeEnabled,
  triggerHaptics,
} from '@dit/dit-native'
import type { User } from '@firebase/auth'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'
import { AboutModal } from './src/components/AboutModal'
import { DitButton } from './src/components/DitButton'
import { ListenControls } from './src/components/ListenControls'
import { type Mode } from './src/components/ModeSwitcher'
import { MorseButton } from './src/components/MorseButton'
import { MorseLiquidSurface } from './src/components/MorseLiquidSurface'
import { NuxModal } from './src/components/NuxModal'
import { ReferenceModalSheet } from './src/components/ReferenceModalSheet'
import { SettingsModal } from './src/components/SettingsModal'
import { StageDisplay, type StagePip } from './src/components/StageDisplay'
import { TopBar } from './src/components/TopBar'
import { database } from './src/firebase'
import { useAuth } from './src/hooks/useAuth'
import { useFirebaseSync } from './src/hooks/useFirebaseSync'
import { useProgressPersistence } from './src/hooks/useProgressPersistence'
import {
  deleteCurrentUserAccount,
  prepareCurrentUserAccountDeletion,
  signInWithApple,
  signInWithGoogle,
  signOut,
} from './src/services/auth'
import {
  getAutoEffectiveWpm,
  LISTEN_AUTO_TIGHTENING_STAGE_THRESHOLDS,
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

const LEVELS = [1, 2, 3, 4] as const
const DEFAULT_MAX_LEVEL: (typeof LEVELS)[number] = 3
const DEFAULT_LISTEN_WPM = DEFAULT_CHARACTER_WPM
const DEFAULT_LISTEN_EFFECTIVE_WPM = DEFAULT_EFFECTIVE_WPM
const DEFAULT_LISTEN_AUTO_TIGHTENING = true
const DEFAULT_LISTEN_AUTO_TIGHTENING_CORRECT_COUNT = 0
const DOT_THRESHOLD_MS = DASH_THRESHOLD
const INTER_CHAR_GAP_MS = UNIT_TIME_MS * INTER_LETTER_UNITS
const ERROR_LOCKOUT_MS = 1000
const LISTEN_REVEAL_EXTRA_MS = 1000
const LISTEN_REVEAL_FADE_OUT_MS = 320
const LISTEN_POST_REVEAL_PAUSE_MS = 220
const LISTEN_RECOGNITION_DISPLAY_MS = 2600
const PRACTICE_NEXT_LETTER_DELAY_MS = 1000
const PRACTICE_WORD_UNITS = 5
const WORD_GAP_MS = UNIT_TIME_MS * INTER_WORD_UNITS
const WORD_GAP_EXTRA_MS = WORD_GAP_MS - INTER_CHAR_GAP_MS
const LISTEN_WPM_MIN = WPM_RANGE.min
const LISTEN_WPM_MAX = WPM_RANGE.max
const LISTEN_EFFECTIVE_WPM_MIN = EFFECTIVE_WPM_RANGE.min
const LISTEN_EFFECTIVE_WPM_MAX = EFFECTIVE_WPM_RANGE.max
const LISTEN_MIN_UNIT_MS = 40
const LISTEN_TTR_EMA_ALPHA = 0.25
const LISTEN_TTR_MAX_MS = 10000
const LISTEN_TTR_MAX_SAMPLES = 300
const LISTEN_OVERLEARN_THRESHOLD_MS = 1200
const LISTEN_OVERLEARN_STRONG_THRESHOLD_MS = 2200
const LISTEN_OVERLEARN_MAX_QUEUE_SIZE = 24
const LISTEN_MAX_CONSECUTIVE_SAME = 3
const REFERENCE_WPM = 20
const PROGRESS_SAVE_DEBOUNCE_MS = DEBOUNCE_DELAY
const INTRO_HINTS_KEY = 'dit-intro-hint-step'
const LEGACY_INTRO_HINTS_KEY = 'dit-intro-hints-dismissed'
const NUX_STATUS_KEY = 'dit-nux-status'
const LOCAL_PROGRESS_KEY = 'dit-progress'
const BACKGROUND_IDLE_TIMEOUT_MS = 10000
const DEFAULT_PRACTICE_IFR_MODE = true
const DEFAULT_PRACTICE_REVIEW_MISSES = true
const PRACTICE_REVIEW_DELAY_STEPS = 3
const PRACTICE_REVIEW_MAX_SIZE = 24
const NUX_LETTERS: Letter[] = ['E', 'T', 'I', 'M', 'A', 'N']
const NUX_FAST_THRESHOLD_MS = 1600
const NUX_FAST_DEFAULTS = {
  showHint: false,
  listenWpm: DEFAULT_LISTEN_WPM,
  listenEffectiveWpm: DEFAULT_LISTEN_WPM,
  listenAutoTightening: false,
  listenAutoTighteningCorrectCount:
    LISTEN_AUTO_TIGHTENING_STAGE_THRESHOLDS.tight,
  maxLevel: 4,
} as const
const NUX_SLOW_DEFAULTS = {
  showHint: false,
  listenWpm: DEFAULT_LISTEN_WPM,
  listenEffectiveWpm: DEFAULT_LISTEN_EFFECTIVE_WPM,
  listenAutoTightening: DEFAULT_LISTEN_AUTO_TIGHTENING,
  listenAutoTighteningCorrectCount:
    DEFAULT_LISTEN_AUTO_TIGHTENING_CORRECT_COUNT,
  maxLevel: 1,
} as const

type IntroHintStep = 'morse' | 'settings' | 'done'
type NuxStatus = 'pending' | 'completed' | 'skipped'
type NuxStep = 'splash' | 'welcome' | 'sound_check' | 'dit_dah' | 'exercise' | 'result'
type NuxResult = 'fast' | 'slow' | 'skipped' | null
type ListenPromptTiming = {
  targetLetter: Letter
  expectedEndAt: number
}
const REFERENCE_LETTERS = (Object.keys(MORSE_DATA) as Letter[]).filter(
  (letter) => /^[A-Z]$/.test(letter),
)
const REFERENCE_NUMBERS: Letter[] = [
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
]

type TimeoutHandle = ReturnType<typeof setTimeout>

const clearTimer = (ref: { current: TimeoutHandle | null }) => {
  if (ref.current !== null) {
    clearTimeout(ref.current)
    ref.current = null
  }
}

const now = () => Date.now()

const getNextOrderedLetter = (letters: Letter[], current: Letter): Letter => {
  if (letters.length === 0) {
    return current
  }
  const currentIndex = letters.indexOf(current)
  if (currentIndex < 0) {
    return letters[0]
  }
  return letters[(currentIndex + 1) % letters.length]
}

const clampListenTtrMs = (value: number) =>
  Math.max(0, Math.min(LISTEN_TTR_MAX_MS, Math.round(value)))

const applyListenTtrSample = (
  current: ListenTtrRecord,
  letter: Letter,
  sampleMs: number,
  sampleWeight: number = 1,
) => {
  if (!Number.isFinite(sampleMs) || sampleWeight <= 0) {
    return current
  }
  const normalizedSampleMs = clampListenTtrMs(sampleMs)
  const normalizedWeight = Math.max(1, Math.round(sampleWeight))
  const existing = current[letter]
  if (!existing) {
    return {
      ...current,
      [letter]: {
        averageMs: normalizedSampleMs,
        samples: normalizedWeight,
      },
    }
  }
  const alpha = Math.min(0.85, LISTEN_TTR_EMA_ALPHA * normalizedWeight)
  const averageMs = clampListenTtrMs(
    existing.averageMs * (1 - alpha) + normalizedSampleMs * alpha,
  )
  const samples = Math.min(
    LISTEN_TTR_MAX_SAMPLES,
    existing.samples + normalizedWeight,
  )
  return {
    ...current,
    [letter]: {
      averageMs,
      samples,
    },
  }
}

const getListenOverlearnRepeats = (averageMs: number) => {
  if (averageMs >= LISTEN_OVERLEARN_STRONG_THRESHOLD_MS) {
    return 2
  }
  if (averageMs >= LISTEN_OVERLEARN_THRESHOLD_MS) {
    return 1
  }
  return 0
}

const enqueueListenOverlearnLetters = (
  queue: Letter[],
  letter: Letter,
  repeats: number,
  maxSize: number,
) => {
  if (repeats <= 0 || queue.length >= maxSize) {
    return queue
  }
  const nextQueue = [...queue]
  for (
    let count = 0;
    count < repeats && nextQueue.length < maxSize;
    count += 1
  ) {
    nextQueue.push(letter)
  }
  return nextQueue
}

const pullNextListenOverlearnLetter = (
  queue: Letter[],
  availableLetters: Letter[],
  previousLetter: Letter,
) => {
  if (queue.length === 0) {
    return {
      nextQueue: queue,
      reviewLetter: null as Letter | null,
    }
  }
  const allowed = new Set(availableLetters)
  const filteredQueue = queue.filter((letter) => allowed.has(letter))
  if (filteredQueue.length === 0) {
    return {
      nextQueue: filteredQueue,
      reviewLetter: null as Letter | null,
    }
  }
  const nextIndex = filteredQueue.findIndex(
    (letter) => letter !== previousLetter,
  )
  const resolvedIndex = nextIndex >= 0 ? nextIndex : 0
  const reviewLetter = filteredQueue[resolvedIndex]
  return {
    nextQueue: filteredQueue.filter((_, index) => index !== resolvedIndex),
    reviewLetter,
  }
}

const createInitialPracticeConfig = () => {
  const availableLetters = getLettersForLevel(DEFAULT_MAX_LEVEL)
  const practiceWord = getRandomWord(getWordsForLetters(availableLetters))
  return {
    letter: getRandomLetter(availableLetters),
    practiceWord,
  }
}

const initialConfig = createInitialPracticeConfig()

const getDeleteAccountErrorMessage = (error: unknown) => {
  const code =
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
      ? error.code
      : null

  if (code === 'ERR_APPLE_ACCOUNT_DELETION_USER_MISMATCH') {
    return 'Sign in with the same Apple account tied to this Dit account, then try again.'
  }

  if (code?.includes('user-mismatch')) {
    return 'Sign in with the same account you used for Dit, then try again.'
  }

  if (code?.includes('requires-recent-login')) {
    return 'For security, sign in again and retry account deletion.'
  }

  if (code?.includes('network-request-failed')) {
    return 'A network error interrupted account deletion. Try again on a stable connection.'
  }

  return 'We could not delete your account. Please try again.'
}

const isErrorWithCode = (error: unknown, code: string) =>
  Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === code,
  )

const getSignInErrorMessage = (error: unknown) => {
  if (isErrorWithCode(error, 'auth/account-exists-with-different-credential')) {
    return 'An account already exists with a different sign-in method for this email address.'
  }

  if (isErrorWithCode(error, 'auth/network-request-failed')) {
    return 'A network error interrupted sign-in. Try again on a stable connection.'
  }

  return 'We could not sign you in. Please try again.'
}

const BackgroundGlow = () => {
  const { width, height } = useWindowDimensions()

  if (width === 0 || height === 0) {
    return null
  }

  const glowStops = useMemo(
    () => [
      {
        id: 'bgGlow1',
        cx: width * 0.25,
        cy: height * 0.85,
        rx: 700,
        ry: 500,
        color: { r: 168, g: 192, b: 255, a: 0.08 },
        fade: 0.6,
      },
      {
        id: 'bgGlow2',
        cx: width * 0.75,
        cy: height * 0.15,
        rx: 600,
        ry: 450,
        color: { r: 196, g: 181, b: 253, a: 0.06 },
        fade: 0.65,
      },
      {
        id: 'bgGlow3',
        cx: width * 0.5,
        cy: height * 0.5,
        rx: 500,
        ry: 400,
        color: { r: 245, g: 199, b: 247, a: 0.04 },
        fade: 0.7,
      },
    ],
    [width, height],
  )

  return (
    <View pointerEvents="none" style={styles.backgroundGlow}>
      <Svg width={width} height={height}>
        <Defs>
          {glowStops.map((glow) => (
            <RadialGradient
              key={glow.id}
              id={glow.id}
              cx={glow.cx}
              cy={glow.cy}
              r={1}
              gradientUnits="userSpaceOnUse"
              gradientTransform={`translate(${glow.cx} ${glow.cy}) scale(${
                glow.rx
              } ${glow.ry}) translate(${-glow.cx} ${-glow.cy})`}
            >
              <Stop
                offset="0%"
                stopColor={`rgb(${glow.color.r}, ${glow.color.g}, ${glow.color.b})`}
                stopOpacity={glow.color.a}
              />
              <Stop
                offset={`${glow.fade * 100}%`}
                stopColor={`rgb(${glow.color.r}, ${glow.color.g}, ${glow.color.b})`}
                stopOpacity={0}
              />
              <Stop
                offset="100%"
                stopColor={`rgb(${glow.color.r}, ${glow.color.g}, ${glow.color.b})`}
                stopOpacity={0}
              />
            </RadialGradient>
          ))}
        </Defs>
        {glowStops.map((glow) => (
          <Rect
            key={`${glow.id}-rect`}
            width={width}
            height={height}
            fill={`url(#${glow.id})`}
          />
        ))}
      </Svg>
    </View>
  )
}

/** Primary app entry for Dit iOS. */
export default function App() {
  const { user } = useAuth()
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [isPressing, setIsPressing] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [showReference, setShowReference] = useState(false)
  const [mode, setMode] = useState<Mode>('practice')
  const [isSystemLowPowerModeEnabled, setIsSystemLowPowerModeEnabled] =
    useState(false)
  const [isBackgroundIdle, setIsBackgroundIdle] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [showMnemonic, setShowMnemonic] = useState(false)
  const [practiceAutoPlay, setPracticeAutoPlay] = useState(true)
  const [practiceLearnMode, setPracticeLearnMode] = useState(true)
  const [practiceIfrMode, setPracticeIfrMode] = useState(
    DEFAULT_PRACTICE_IFR_MODE,
  )
  const [practiceReviewMisses, setPracticeReviewMisses] = useState(
    DEFAULT_PRACTICE_REVIEW_MISSES,
  )
  const [introHintStep, setIntroHintStep] = useState<IntroHintStep>('morse')
  const [nuxStatus, setNuxStatus] = useState<NuxStatus>('pending')
  const [nuxStep, setNuxStep] = useState<NuxStep>('splash')
  const [nuxIndex, setNuxIndex] = useState(0)
  const [nuxReady, setNuxReady] = useState(false)
  const [nuxResult, setNuxResult] = useState<NuxResult>(null)
  const [nuxAvgMs, setNuxAvgMs] = useState<number | null>(null)
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
  const [listenEffectiveWpm, setListenEffectiveWpm] = useState(
    DEFAULT_LISTEN_EFFECTIVE_WPM,
  )
  const [listenAutoTightening, setListenAutoTightening] = useState(
    DEFAULT_LISTEN_AUTO_TIGHTENING,
  )
  const [
    listenAutoTighteningCorrectCount,
    setListenAutoTighteningCorrectCount,
  ] = useState(DEFAULT_LISTEN_AUTO_TIGHTENING_CORRECT_COUNT)
  const [listenStatus, setListenStatus] = useState<
    'idle' | 'success' | 'error'
  >('idle')
  const [listenReveal, setListenReveal] = useState<Letter | null>(null)
  const [listenWavePlayback, setListenWavePlayback] =
    useState<ListenWavePlayback | null>(null)
  const [scores, setScores] = useState(() => initializeScores())
  const [listenTtr, setListenTtr] = useState<ListenTtrRecord>({})
  const [listenHasSubmittedAnswer, setListenHasSubmittedAnswer] =
    useState(false)
  const [listenRecognitionText, setListenRecognitionText] = useState<
    string | null
  >(null)
  const nuxTimingsRef = useRef<number[]>([])
  const nuxAttemptStartRef = useRef<number | null>(null)
  const nuxErrorCountRef = useRef<number>(0)
  useEffect(() => {
    let isActive = true
    const loadIntroHints = async () => {
      try {
        const stored = await AsyncStorage.getItem(INTRO_HINTS_KEY)
        if (!isActive) {
          return
        }
        if (stored === 'morse' || stored === 'settings' || stored === 'done') {
          setIntroHintStep(stored)
          return
        }
        const legacy = await AsyncStorage.getItem(LEGACY_INTRO_HINTS_KEY)
        if (legacy === 'true') {
          setIntroHintStep('done')
          void AsyncStorage.setItem(INTRO_HINTS_KEY, 'done')
          return
        }
        setIntroHintStep('morse')
      } catch (error) {
        console.error('Failed to load intro hints', error)
      }
    }
    void loadIntroHints()
    return () => {
      isActive = false
    }
  }, [])
  useEffect(() => {
    let isActive = true
    const loadNuxStatus = async () => {
      try {
        const stored = await AsyncStorage.getItem(NUX_STATUS_KEY)
        if (!isActive) {
          return
        }
        if (stored === 'completed' || stored === 'skipped') {
          setNuxStatus(stored)
          return
        }
        const progressStored = await AsyncStorage.getItem(LOCAL_PROGRESS_KEY)
        if (!isActive) {
          return
        }
        if (progressStored) {
          setNuxStatus('skipped')
          void AsyncStorage.setItem(NUX_STATUS_KEY, 'skipped')
          return
        }
        setNuxStatus('pending')
      } catch (error) {
        console.error('Failed to load NUX status', error)
        setNuxStatus('pending')
      } finally {
        if (isActive) {
          setNuxReady(true)
        }
      }
    }
    void loadNuxStatus()
    return () => {
      isActive = false
    }
  }, [])
  const persistIntroHintStep = useCallback((next: IntroHintStep) => {
    setIntroHintStep(next)
    interface AsyncStorageError {
      message?: string
      name?: string
      stack?: string
      [key: string]: unknown
    }
    void AsyncStorage.setItem(INTRO_HINTS_KEY, next).catch(
      (error: AsyncStorageError) => {
        console.error('Failed to save intro hints', error)
      },
    )
  }, [])
  const persistNuxStatus = useCallback((next: NuxStatus) => {
    setNuxStatus(next)
    void AsyncStorage.setItem(NUX_STATUS_KEY, next).catch((error) => {
      console.error('Failed to save NUX status', error)
    })
  }, [])
  const dismissMorseHint = useCallback(() => {
    if (introHintStep !== 'morse') {
      return
    }
    persistIntroHintStep('settings')
  }, [introHintStep, persistIntroHintStep])
  const dismissSettingsHint = useCallback(() => {
    if (introHintStep !== 'settings') {
      return
    }
    persistIntroHintStep('done')
  }, [introHintStep, persistIntroHintStep])
  useEffect(() => {
    let isMounted = true

    void getLowPowerModeEnabled().then((enabled) => {
      if (isMounted) {
        setIsSystemLowPowerModeEnabled(enabled)
      }
    })

    const subscription = addLowPowerModeListener((enabled) => {
      setIsSystemLowPowerModeEnabled(enabled)
    })

    return () => {
      isMounted = false
      subscription.remove()
    }
  }, [])
  const isFreestyle = mode === 'freestyle'
  const isListen = mode === 'listen'
  const isBackgroundAnimationPaused =
    !(nuxReady && nuxStatus === 'pending') &&
    (isSystemLowPowerModeEnabled || isBackgroundIdle)
  const isNuxActive = nuxReady && nuxStatus === 'pending'
  const userForSync = isDeletingAccount ? null : user
  // Also treat reference panel as a mode that requires the tone player to stay alive for instant playback
  const isReferencePanelActive = showReference
  const availableLetters = useMemo(
    () => getLettersForLevel(maxLevel),
    [maxLevel],
  )
  const availablePracticeWords = useMemo(
    () => getWordsForLetters(availableLetters),
    [availableLetters],
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
      practiceIfrMode,
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
  const listenAutoTighteningCorrectCountRef = useRef(
    listenAutoTighteningCorrectCount,
  )
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
  const backgroundIdleTimeoutRef = useRef<TimeoutHandle | null>(null)
  const isBackgroundIdleRef = useRef(false)
  const completeNuxRef = useRef<() => void>(() => {})
  const scheduleBackgroundIdle = useCallback(() => {
    clearTimer(backgroundIdleTimeoutRef)
    backgroundIdleTimeoutRef.current = setTimeout(() => {
      isBackgroundIdleRef.current = true
      setIsBackgroundIdle(true)
    }, BACKGROUND_IDLE_TIMEOUT_MS)
  }, [])
  const registerAppInteraction = useCallback(() => {
    if (isBackgroundIdleRef.current) {
      isBackgroundIdleRef.current = false
      setIsBackgroundIdle(false)
    }
    scheduleBackgroundIdle()
  }, [scheduleBackgroundIdle])
  const handleRootTouchStart = useCallback(() => {
    registerAppInteraction()
    return false
  }, [registerAppInteraction])

  useEffect(() => {
    registerAppInteraction()
    return () => {
      clearTimer(backgroundIdleTimeoutRef)
    }
  }, [registerAppInteraction])

  const setPracticeWordFromList = useCallback(
    (words: string[], avoidWord?: string) => {
      const nextWord = getRandomWord(words, avoidWord)
      practiceWordRef.current = nextWord
      practiceWordIndexRef.current = 0
      practiceWordStartRef.current = null
      const nextLetter = nextWord[0] as Letter
      letterRef.current = nextLetter
      setPracticeWord(nextWord)
      setPracticeWordIndex(0)
      setLetter(nextLetter)
    },
    [],
  )

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

  const setNextPracticeLetter = useCallback(
    (nextLetters: Letter[], currentLetter: Letter = letterRef.current) => {
      if (nextLetters.length === 0) {
        return currentLetter
      }
      if (practiceIfrModeRef.current && practiceReviewMissesRef.current) {
        const { nextQueue, reviewLetter } = pullDueReviewLetter(
          practiceReviewQueueRef.current,
        )
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
    [],
  )

  const setNextListenLetter = useCallback(
    (nextLetters: Letter[], currentLetter: Letter = letterRef.current) => {
      if (nextLetters.length === 0) {
        return currentLetter
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
      if (
        hasReachedConsecutiveCap &&
        nextLetter === currentLetter &&
        nextLetters.length > 1
      ) {
        if (reviewLetter === currentLetter) {
          nextQueue = enqueueListenOverlearnLetters(
            nextQueue,
            currentLetter,
            1,
            LISTEN_OVERLEARN_MAX_QUEUE_SIZE,
          )
        }
        const alternatives = nextLetters.filter(
          (letter) => letter !== currentLetter,
        )
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
          const nextWpm =
            (currentWord.length / PRACTICE_WORD_UNITS) * (60000 / elapsedMs)
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
    freestyleWordModeRef.current = freestyleWordMode
    scoresRef.current = scores
    listenTtrRef.current = listenTtr
    maxLevelRef.current = maxLevel
    modeRef.current = mode
    listenWpmRef.current = listenWpm
    listenEffectiveWpmRef.current = listenEffectiveWpm
    listenAutoTighteningRef.current = listenAutoTightening
    listenAutoTighteningCorrectCountRef.current =
      listenAutoTighteningCorrectCount
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
      const timing = getListenTiming(
        resolvedCharacterWpm,
        resolvedEffectiveWpm,
        LISTEN_MIN_UNIT_MS,
      )
      const expectedEndAt =
        now() +
        getListenPlaybackDurationMs(
          code,
          timing.unitMs,
          timing.interCharacterGapMs,
        )
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
      availableLetters,
    )
    if (!availableLetters.includes(letterRef.current)) {
      const nextLetter = practiceLearnModeRef.current
        ? availableLetters[0]
        : getRandomLetter(availableLetters)
      letterRef.current = nextLetter
      setLetter(nextLetter)
    }
    if (practiceWordModeRef.current) {
      setPracticeWordFromList(availablePracticeWords, practiceWordRef.current)
    }
  }, [availableLetters, availablePracticeWords, mode, setPracticeWordFromList])

  useEffect(() => {
    if (!isNuxActive) {
      return
    }
    setShowSettings(false)
    setShowAbout(false)
    setShowReference(false)
  }, [isNuxActive])

  const canScoreAttempt = useCallback(
    () => !showHint && !isNuxActive,
    [isNuxActive, showHint],
  )

  const bumpScore = useCallback((targetLetter: Letter, delta: number) => {
    setScores((prev) => applyScoreDelta(prev, targetLetter, delta))
  }, [])

  const isErrorLocked = useCallback(
    () => now() < errorLockoutUntilRef.current,
    [],
  )

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
    setListenAutoTighteningCorrectCount(
      DEFAULT_LISTEN_AUTO_TIGHTENING_CORRECT_COUNT,
    )
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
    listenAutoTighteningCorrectCountRef.current =
      DEFAULT_LISTEN_AUTO_TIGHTENING_CORRECT_COUNT
    listenStatusRef.current = 'idle'
    listenOverlearnQueueRef.current = []
    listenPromptTimingRef.current = null
    listenConsecutiveLetterRef.current = nextConfig.letter
    listenConsecutiveCountRef.current = 1
    errorLockoutUntilRef.current = 0
    nuxAttemptStartRef.current = null
  }, [stopListenPlayback])

  const handleNuxSkip = useCallback(() => {
    persistNuxStatus('skipped')
    persistIntroHintStep('done')
    setNuxStep('welcome')
    setNuxIndex(0)
    setNuxResult(null)
  }, [persistIntroHintStep, persistNuxStatus])

  const handleNuxSplashDone = useCallback(() => {
    setNuxStep('welcome')
  }, [])

  const handleNuxAdvance = useCallback(() => {
    setNuxStep((current) => {
      if (current === 'welcome') return 'sound_check'
      if (current === 'sound_check') return 'dit_dah'
      return current
    })
  }, [])

  const handleNuxPlaySymbol = useCallback((symbol: '.' | '-') => {
    void playMorseTone({
      code: symbol,
      characterWpm: DEFAULT_CHARACTER_WPM,
      effectiveWpm: DEFAULT_CHARACTER_WPM,
      minUnitMs: LISTEN_MIN_UNIT_MS,
    })
    void triggerHaptics(10)
  }, [])

  const handleNuxReplayLetter = useCallback(() => {
    const code = MORSE_DATA[letter]?.code
    if (!code) return
    void playMorseTone({
      code,
      characterWpm: DEFAULT_CHARACTER_WPM,
      effectiveWpm: DEFAULT_CHARACTER_WPM,
      minUnitMs: LISTEN_MIN_UNIT_MS,
    })
    void triggerHaptics(10)
  }, [letter])

  const handleNuxStart = useCallback(() => {
    setNuxStep('exercise')
    setNuxIndex(0)
    setNuxResult(null)
    nuxTimingsRef.current = []
    nuxAttemptStartRef.current = null
    nuxErrorCountRef.current = 0
    setShowSettings(false)
    setShowAbout(false)
    setShowReference(false)
    setShowHint(false)
    setShowMnemonic(false)
    setPracticeIfrMode(DEFAULT_PRACTICE_IFR_MODE)
    practiceIfrModeRef.current = DEFAULT_PRACTICE_IFR_MODE
    setPracticeReviewMisses(DEFAULT_PRACTICE_REVIEW_MISSES)
    practiceReviewMissesRef.current = DEFAULT_PRACTICE_REVIEW_MISSES
    practiceReviewQueueRef.current = []
    listenOverlearnQueueRef.current = []
    setMode('practice')
    setPracticeWordMode(false)
    practiceWordModeRef.current = false
    setPracticeWpm(null)
    practiceWordStartRef.current = null
    clearTimer(letterTimeoutRef)
    clearTimer(successTimeoutRef)
    clearTimer(errorTimeoutRef)
    clearTimer(wordSpaceTimeoutRef)
    setInput('')
    setStatus('idle')
    const firstLetter = NUX_LETTERS[0]
    letterRef.current = firstLetter
    setLetter(firstLetter)
  }, [])

  const handleNuxFinish = useCallback(() => {
    persistNuxStatus('completed')
    persistIntroHintStep('done')
    setNuxStep('welcome')
    setNuxIndex(0)
    setNuxResult(null)
  }, [persistIntroHintStep, persistNuxStatus])

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
      const match = Object.entries(MORSE_DATA).find(
        ([, data]) => data.code === value,
      )
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
      if (ttrMs !== null) {
        const recognitionText = `${(ttrMs / 1000).toFixed(1)}s`
        setListenRecognitionText(recognitionText)
        clearTimer(listenRecognitionTimeoutRef)
        listenRecognitionTimeoutRef.current = setTimeout(() => {
          setListenRecognitionText(null)
        }, LISTEN_RECOGNITION_DISPLAY_MS)
        const nextListenTtr = applyListenTtrSample(
          listenTtrRef.current,
          targetLetter,
          ttrMs,
        )
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
        const autoEffectiveWpm = getAutoEffectiveWpm(
          listenWpmRef.current,
          nextCorrectCount,
        )
        if (autoEffectiveWpm !== listenEffectiveWpmRef.current) {
          listenEffectiveWpmRef.current = autoEffectiveWpm
          nextEffectiveWpm = autoEffectiveWpm
          setListenEffectiveWpm(autoEffectiveWpm)
        }
      }
      listenTimeoutRef.current = setTimeout(() => {
        const nextLetter = setNextListenLetter(availableLetters, targetLetter)
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
      availableLetters,
      bumpScore,
      listenStatus,
      playListenSequence,
      setNextListenLetter,
      stopListenPlayback,
      triggerHaptics,
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
  }, [
    isFreestyle,
    isListen,
    listenEffectiveWpm,
    listenWpm,
    stopListenPlayback,
    triggerHaptics,
  ])

  useEffect(() => {
    if (mode !== 'practice' || !practiceAutoPlay) {
      return
    }
    stopListenPlayback()
    void playMorseTone({
      code: MORSE_DATA[letter].code,
      characterWpm: listenWpm,
      effectiveWpm: listenEffectiveWpm,
      minUnitMs: LISTEN_MIN_UNIT_MS,
    })
  }, [
    letter,
    listenEffectiveWpm,
    listenWpm,
    mode,
    practiceAutoPlay,
    stopListenPlayback,
  ])

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
          practiceIfrModeRef.current &&
          !isNuxActive &&
          modeRef.current === 'practice'
        if (isCorrect) {
          if (isNuxActive && nuxStep === 'exercise') {
            const startedAt = nuxAttemptStartRef.current
            if (startedAt !== null) {
              nuxTimingsRef.current.push(now() - startedAt)
            }
            nuxAttemptStartRef.current = null
            setInput('')
            clearTimer(errorTimeoutRef)
            clearTimer(successTimeoutRef)
            if (nuxIndex + 1 >= NUX_LETTERS.length) {
              setStatus('success')
              successTimeoutRef.current = setTimeout(() => {
                setStatus('idle')
                completeNuxRef.current()
              }, 350)
              return
            }
            const nextIndex = nuxIndex + 1
            setStatus('success')
            successTimeoutRef.current = setTimeout(() => {
              const nextLetter = NUX_LETTERS[nextIndex]
              nuxAttemptStartRef.current = null  // reset for next letter
              setNuxIndex(nextIndex)
              letterRef.current = nextLetter
              setLetter(nextLetter)
              setStatus('idle')
            }, 350)
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
            setNextPracticeLetter(availableLetters, targetLetter)
            setStatus('idle')
          }, PRACTICE_NEXT_LETTER_DELAY_MS)
          return
        }
        if (canScoreAttempt()) {
          bumpScore(targetLetter, -1)
        }
        setInput('')
        if (isNuxActive && nuxStep === 'exercise') {
          nuxErrorCountRef.current += 1
        }
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
              setNextPracticeLetter(availableLetters, targetLetter)
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
      availableLetters,
      bumpScore,
      canScoreAttempt,
      isNuxActive,
      nuxIndex,
      nuxStep,
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

      if (
        practiceWordModeRef.current &&
        practiceWordIndexRef.current === 0 &&
        practiceWordStartRef.current === null &&
        practiceWordRef.current
      ) {
        practiceWordStartRef.current = now()
      }

      setStatus('idle')
      if (isNuxActive && nuxStep === 'exercise') {
        if (nuxAttemptStartRef.current === null) {
          nuxAttemptStartRef.current = now()
        }
      }
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
        setPracticeWordFromList(
          getWordsForLetters(nextLetters),
          practiceWordRef.current,
        )
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

  const applyNuxDefaults = useCallback(
    (defaults: typeof NUX_FAST_DEFAULTS | typeof NUX_SLOW_DEFAULTS) => {
      setShowHint(defaults.showHint)
      setShowMnemonic(false)
      setPracticeIfrMode(DEFAULT_PRACTICE_IFR_MODE)
      practiceIfrModeRef.current = DEFAULT_PRACTICE_IFR_MODE
      setPracticeReviewMisses(DEFAULT_PRACTICE_REVIEW_MISSES)
      practiceReviewMissesRef.current = DEFAULT_PRACTICE_REVIEW_MISSES
      practiceReviewQueueRef.current = []
      setListenWpm(defaults.listenWpm)
      listenWpmRef.current = defaults.listenWpm
      setListenEffectiveWpm(defaults.listenEffectiveWpm)
      listenEffectiveWpmRef.current = defaults.listenEffectiveWpm
      setListenAutoTightening(defaults.listenAutoTightening)
      listenAutoTighteningRef.current = defaults.listenAutoTightening
      setListenAutoTighteningCorrectCount(
        defaults.listenAutoTighteningCorrectCount,
      )
      listenAutoTighteningCorrectCountRef.current =
        defaults.listenAutoTighteningCorrectCount
      setPracticeWordMode(false)
      practiceWordModeRef.current = false
      setPracticeWpm(null)
      clearTimer(letterTimeoutRef)
      clearTimer(successTimeoutRef)
      clearTimer(errorTimeoutRef)
      practiceWordStartRef.current = null
      const nextLetters = getLettersForLevel(defaults.maxLevel)
      maxLevelRef.current = defaults.maxLevel as (typeof LEVELS)[number]
      setMaxLevel(defaults.maxLevel as (typeof LEVELS)[number])
      setNextLetterForLevel(nextLetters)
      setInput('')
      setStatus('idle')
    },
    [setNextLetterForLevel],
  )

  const handleReplayNux = useCallback(() => {
    setShowSettings(false)
    setNuxStatus('pending')
    setNuxStep('splash')
    setNuxIndex(0)
    setNuxResult(null)
    setNuxAvgMs(null)
    nuxTimingsRef.current = []
    nuxAttemptStartRef.current = null
    nuxErrorCountRef.current = 0
    void AsyncStorage.setItem(NUX_STATUS_KEY, 'pending')
  }, [])

  const handleNuxPresetSelect = useCallback(
    (preset: 'beginner' | 'advanced') => {
      const defaults =
        preset === 'advanced' ? NUX_FAST_DEFAULTS : NUX_SLOW_DEFAULTS
      applyNuxDefaults(defaults)
      setNuxResult(preset === 'advanced' ? 'fast' : 'slow')
    },
    [applyNuxDefaults],
  )

  const handleNuxSkipExercise = useCallback(() => {
    clearTimer(errorTimeoutRef)
    clearTimer(successTimeoutRef)
    setInput('')
    setStatus('idle')
    applyNuxDefaults(NUX_SLOW_DEFAULTS)
    setNuxAvgMs(null)
    setNuxResult('skipped')
    setNuxStep('result')
  }, [applyNuxDefaults])

  const completeNux = useCallback(() => {
    const timings = nuxTimingsRef.current
    const averageMs =
      timings.length === 0
        ? NUX_FAST_THRESHOLD_MS + 1
        : timings.reduce((sum, value) => sum + value, 0) / timings.length
    const isFast = averageMs <= NUX_FAST_THRESHOLD_MS && nuxErrorCountRef.current <= 1
    const defaults = isFast ? NUX_FAST_DEFAULTS : NUX_SLOW_DEFAULTS
    applyNuxDefaults(defaults)
    setNuxAvgMs(Math.round(averageMs))
    setNuxResult(isFast ? 'fast' : 'slow')
    setNuxStep('result')
  }, [applyNuxDefaults])

  useEffect(() => {
    completeNuxRef.current = completeNux
  }, [completeNux])

  const handlePracticeWordModeChange = useCallback(
    (value: boolean) => {
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
      const normalizedListenSpeeds = normalizeListenSpeeds(
        value,
        listenEffectiveWpmRef.current,
      )
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
      setPracticeLearnMode(value)
      practiceLearnModeRef.current = value
      if (
        modeRef.current !== 'practice' ||
        practiceWordModeRef.current ||
        !value
      ) {
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

  const handlePracticeIfrModeChange = useCallback(
    (value: boolean) => {
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
    },
    [],
  )

  const handlePracticeReviewMissesChange = useCallback(
    (value: boolean) => {
      setPracticeReviewMisses(value)
      practiceReviewMissesRef.current = value
      if (!value) {
        practiceReviewQueueRef.current = []
      }
    },
    [],
  )

  const handleUseRecommended = useCallback(() => {
    const preferredMaxLevel = DEFAULT_MAX_LEVEL
    const preferredListenWpm = DEFAULT_LISTEN_WPM
    const preferredListenEffectiveWpm = DEFAULT_LISTEN_EFFECTIVE_WPM
    const preferredListenAutoTightening = DEFAULT_LISTEN_AUTO_TIGHTENING
    const preferredListenAutoTighteningCorrectCount =
      DEFAULT_LISTEN_AUTO_TIGHTENING_CORRECT_COUNT
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
      listenAutoTighteningCorrectCount ===
        preferredListenAutoTighteningCorrectCount &&
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
    setListenAutoTighteningCorrectCount(
      preferredListenAutoTighteningCorrectCount,
    )
    listenAutoTighteningCorrectCountRef.current =
      preferredListenAutoTighteningCorrectCount
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
      setPracticeWordFromList(
        getWordsForLetters(nextLetters),
        practiceWordRef.current,
      )
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
        const nextLetter = setNextListenLetter(availableLetters)
        playListenSequence(MORSE_DATA[nextLetter].code)
        return
      }
      if (practiceWordModeRef.current) {
        setPracticeWordFromList(availablePracticeWords, practiceWordRef.current)
        return
      }
      setNextLetterForLevel(availableLetters)
    },
    [
      availableLetters,
      availablePracticeWords,
      playListenSequence,
      resetListenState,
      setNextListenLetter,
      setNextLetterForLevel,
      setPracticeWordFromList,
      stopListenPlayback,
    ],
  )

  const applyParsedProgress = useCallback(
    (progress: Progress) => {
      const resolvedMaxLevel =
        typeof progress.maxLevel === 'number'
          ? progress.maxLevel
          : maxLevelRef.current

      if (progress.scores) {
        scoresRef.current = progress.scores
        setScores(progress.scores)
      }
      if (progress.listenTtr) {
        listenTtrRef.current = progress.listenTtr
        setListenTtr(progress.listenTtr)
      }
      if (typeof progress.showHint === 'boolean') {
        setShowHint(progress.showHint)
      }
      if (typeof progress.showMnemonic === 'boolean') {
        setShowMnemonic(progress.showMnemonic)
      }
      if (typeof progress.practiceIfrMode === 'boolean') {
        practiceIfrModeRef.current = progress.practiceIfrMode
        setPracticeIfrMode(progress.practiceIfrMode)
        if (!progress.practiceIfrMode) {
          practiceReviewQueueRef.current = []
        } else {
          errorLockoutUntilRef.current = 0
        }
      }
      if (typeof progress.practiceReviewMisses === 'boolean') {
        practiceReviewMissesRef.current = progress.practiceReviewMisses
        setPracticeReviewMisses(progress.practiceReviewMisses)
        if (!progress.practiceReviewMisses) {
          practiceReviewQueueRef.current = []
        }
      }
      if (typeof progress.wordMode === 'boolean') {
        if (freestyleWordModeRef.current !== progress.wordMode) {
          freestyleWordModeRef.current = progress.wordMode
          clearTimer(wordSpaceTimeoutRef)
          setFreestyleWordMode(progress.wordMode)
          setFreestyleResult(null)
          setFreestyleInput('')
          setFreestyleWord('')
        }
      }
      let resolvedListenWpm = listenWpmRef.current
      let resolvedListenEffectiveWpm = listenEffectiveWpmRef.current
      let hasListenSpeedUpdate = false
      const incomingListenWpm =
        typeof progress.listenWpm === 'number' ? progress.listenWpm : null
      const incomingListenEffectiveWpm =
        typeof progress.listenEffectiveWpm === 'number'
          ? progress.listenEffectiveWpm
          : null
      if (
        incomingListenWpm !== null ||
        incomingListenEffectiveWpm !== null ||
        resolvedListenEffectiveWpm > resolvedListenWpm
      ) {
        const normalizedListenSpeeds = normalizeListenSpeeds(
          incomingListenWpm ?? resolvedListenWpm,
          incomingListenEffectiveWpm ?? resolvedListenEffectiveWpm,
        )
        resolvedListenWpm = normalizedListenSpeeds.characterWpm
        resolvedListenEffectiveWpm = normalizedListenSpeeds.effectiveWpm
        if (resolvedListenWpm !== listenWpmRef.current) {
          setListenWpm(resolvedListenWpm)
          listenWpmRef.current = resolvedListenWpm
          hasListenSpeedUpdate = true
        }
        if (resolvedListenEffectiveWpm !== listenEffectiveWpmRef.current) {
          setListenEffectiveWpm(resolvedListenEffectiveWpm)
          listenEffectiveWpmRef.current = resolvedListenEffectiveWpm
          hasListenSpeedUpdate = true
        }
      }
      if (typeof progress.listenAutoTightening === 'boolean') {
        setListenAutoTightening(progress.listenAutoTightening)
        listenAutoTighteningRef.current = progress.listenAutoTightening
      }
      if (typeof progress.listenAutoTighteningCorrectCount === 'number') {
        const nextCorrectCount = Math.max(
          0,
          Math.round(progress.listenAutoTighteningCorrectCount),
        )
        setListenAutoTighteningCorrectCount(nextCorrectCount)
        listenAutoTighteningCorrectCountRef.current = nextCorrectCount
      }
      if (
        hasListenSpeedUpdate &&
        modeRef.current === 'listen' &&
        listenStatusRef.current === 'idle'
      ) {
        playListenSequenceRef.current(MORSE_DATA[letterRef.current].code, {
          characterWpm: resolvedListenWpm,
          effectiveWpm: resolvedListenEffectiveWpm,
        })
      }
      if (listenAutoTighteningRef.current) {
        const autoEffectiveWpm = getAutoEffectiveWpm(
          resolvedListenWpm,
          listenAutoTighteningCorrectCountRef.current,
        )
        if (autoEffectiveWpm !== listenEffectiveWpmRef.current) {
          setListenEffectiveWpm(autoEffectiveWpm)
          listenEffectiveWpmRef.current = autoEffectiveWpm
          if (
            modeRef.current === 'listen' &&
            listenStatusRef.current === 'idle'
          ) {
            playListenSequenceRef.current(MORSE_DATA[letterRef.current].code, {
              characterWpm: resolvedListenWpm,
              effectiveWpm: autoEffectiveWpm,
            })
          }
        }
      }
      if (typeof progress.maxLevel === 'number') {
        maxLevelRef.current = progress.maxLevel as (typeof LEVELS)[number]
        const nextLetters = getLettersForLevel(progress.maxLevel)
        practiceReviewQueueRef.current = filterReviewQueue(
          practiceReviewQueueRef.current,
          nextLetters,
        )
        const nextLetter =
          modeRef.current === 'listen'
            ? setNextListenLetter(nextLetters, letterRef.current)
            : setNextLetterForLevel(nextLetters, letterRef.current)
        setMaxLevel(progress.maxLevel as (typeof LEVELS)[number])
        if (
          modeRef.current === 'listen' &&
          listenStatusRef.current === 'idle'
        ) {
          playListenSequenceRef.current(MORSE_DATA[nextLetter].code)
        }
      }
      if (typeof progress.practiceWordMode === 'boolean') {
        practiceWordModeRef.current = progress.practiceWordMode
        practiceWordStartRef.current = null
        setPracticeWordMode(progress.practiceWordMode)
        if (!progress.practiceWordMode) {
          setPracticeWpm(null)
        }
        if (progress.practiceWordMode) {
          const nextLetters = getLettersForLevel(resolvedMaxLevel)
          setPracticeWordFromList(getWordsForLetters(nextLetters))
        }
      }
    },
    [setNextLetterForLevel, setNextListenLetter, setPracticeWordFromList],
  )
  const {
    progressUpdatedAt,
    onRemoteProgress,
    pendingRemoteSyncTick,
    consumePendingRemoteSync,
    clearLocalProgress,
  } = useProgressPersistence({
    progressSnapshot,
    progressSaveDebounceMs: PROGRESS_SAVE_DEBOUNCE_MS,
    applyProgress: applyParsedProgress,
    listenWpmMin: LISTEN_WPM_MIN,
    listenWpmMax: LISTEN_WPM_MAX,
    listenEffectiveWpmMin: LISTEN_EFFECTIVE_WPM_MIN,
    listenEffectiveWpmMax: LISTEN_EFFECTIVE_WPM_MAX,
    levelMin: LEVELS[0],
    levelMax: LEVELS[LEVELS.length - 1],
  })

  const { remoteLoaded, saveNow, deleteRemoteProgress } = useFirebaseSync({
    database,
    user: userForSync,
    onRemoteProgress,
    progressSaveDebounceMs: PROGRESS_SAVE_DEBOUNCE_MS,
    progressSnapshot,
    progressUpdatedAt,
  })

  useEffect(() => {
    if (!remoteLoaded || !userForSync) {
      return
    }
    const payload = consumePendingRemoteSync()
    if (!payload) {
      return
    }
    saveNow(payload, payload.updatedAt)
  }, [
    consumePendingRemoteSync,
    pendingRemoteSyncTick,
    remoteLoaded,
    saveNow,
    userForSync,
  ])

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

        Alert.alert(
          'Could Not Delete Account',
          getDeleteAccountErrorMessage(error),
        )
      } finally {
        setIsDeletingAccount(false)
      }
    },
    [
      clearLocalProgress,
      deleteRemoteProgress,
      isDeletingAccount,
      resetProgressState,
    ],
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
    !isFreestyle &&
    !isListen &&
    (showHint || (isNuxActive && nuxStep === 'exercise'))
  const mnemonicVisible = !isFreestyle && !isListen && showMnemonic
  const showMorseHint = introHintStep === 'morse' && !isListen && !isNuxActive
  const showSettingsHint =
    introHintStep === 'settings' && !isListen && !isNuxActive
  const ifrActive = !isFreestyle && !isListen && !isNuxActive && practiceIfrMode
  const isMorseDisabled = !isFreestyle && !isListen && isErrorLocked()
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
  const practiceStatusText = practiceProgressText ?? baseStatusText
  const practiceWpmText =
    !isFreestyle && !isListen && practiceWordMode && practiceWpm !== null
      ? `${formatWpm(practiceWpm)} WPM`
      : null
  const listenTtrText =
    isListen && listenRecognitionText ? listenRecognitionText : null
  const isInputOnTrack =
    !isFreestyle && !isListen && Boolean(input) && target.startsWith(input)
  const highlightCount =
    status === 'success'
      ? targetSymbols.length
      : isInputOnTrack
      ? input.length
      : 0
  const pips = useMemo<StagePip[]>(
    () =>
      targetSymbols.map((symbol, index) => ({
        type: symbol === '.' ? 'dot' : 'dah',
        state: index < highlightCount ? 'hit' : 'expected',
      })),
    [highlightCount, targetSymbols],
  )
  const isLetterResult = freestyleResult
    ? /^[A-Z0-9]$/.test(freestyleResult)
    : false
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
      ? 'Incorrect'
      : listenHasSubmittedAnswer
      ? ' '
      : 'Type what you hear'
  const listenDisplay = listenReveal ?? '?'
  const statusText = isFreestyle
    ? freestyleStatus
    : isListen
    ? listenStatusText
    : practiceStatusText
  const stageLetter = isFreestyle
    ? freestyleDisplay
    : isListen
    ? listenDisplay
    : letter
  const stagePips = isFreestyle || isListen ? [] : pips
  const showPracticeWord = !isFreestyle && !isListen && practiceWordMode
  const letterPlaceholder = isListen && listenReveal === null

  return (
    <SafeAreaProvider>
      <View
        style={styles.container}
        onStartShouldSetResponderCapture={handleRootTouchStart}
      >
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
            />
          ) : null}
          {showAbout ? (
            <AboutModal onClose={() => setShowAbout(false)} />
          ) : null}
          {showSettings ? (
            <SettingsModal
              isFreestyle={isFreestyle}
              isListen={isListen}
              levels={LEVELS}
              maxLevel={maxLevel}
              practiceWordMode={
                isFreestyle ? freestyleWordMode : practiceWordMode
              }
              practiceAutoPlay={practiceAutoPlay}
              practiceLearnMode={practiceLearnMode}
              practiceIfrMode={practiceIfrMode}
              practiceReviewMisses={practiceReviewMisses}
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
              onReplayNux={__DEV__ ? handleReplayNux : undefined}
            />
          ) : null}
          {showReference ? (
            <ReferenceModalSheet
              letters={REFERENCE_LETTERS}
              numbers={REFERENCE_NUMBERS}
              morseData={MORSE_DATA}
              scores={scores}
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
              {isListen ? (
                <ListenControls
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
                          Tap the big Morse key to make a dit (short press) or
                          dah (long press).
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
          ) : isNuxActive && nuxStep === 'exercise' ? (
            <View style={styles.nuxExerciseControls}>
              <MorseButton
                disabled={isMorseDisabled}
                isPressing={isPressing}
                onPressIn={handleIntroPressIn}
                onPressOut={handlePressOut}
              />
            </View>
          ) : null}
        </SafeAreaView>
        {isNuxActive ? (
          <NuxModal
            step={nuxStep}
            status={status}
            index={nuxIndex}
            total={NUX_LETTERS.length}
            result={nuxResult}
            avgMs={nuxAvgMs}
            letter={letter}
            onSplashDone={handleNuxSplashDone}
            onNext={handleNuxAdvance}
            onPlaySymbol={handleNuxPlaySymbol}
            onReplayLetter={handleNuxReplayLetter}
            onStart={handleNuxStart}
            onSkip={handleNuxSkip}
            onSkipExercise={handleNuxSkipExercise}
            onFinish={handleNuxFinish}
            onChoosePreset={handleNuxPresetSelect}
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
  backgroundGlow: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
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
