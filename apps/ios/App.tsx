import {
  applyScoreDelta,
  DASH_THRESHOLD,
  DEBOUNCE_DELAY,
  formatWpm,
  getLettersForLevel,
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
  type Progress,
  type ProgressSnapshot,
} from '@dit/core'
import { triggerHaptics } from '@dit/dit-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native'
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
import { signInWithGoogle, signOut } from './src/services/auth'
import {
  playMorseTone,
  prepareToneEngine,
  startTone,
  stopMorseTone,
  stopTone,
} from './src/utils/tone'
import {
  getListenUnitMs,
  type ListenWavePlayback,
} from './src/utils/listenWave'

const LEVELS = [1, 2, 3, 4] as const
const DEFAULT_MAX_LEVEL: (typeof LEVELS)[number] = 3
const DEFAULT_LISTEN_WPM = 14
const DOT_THRESHOLD_MS = DASH_THRESHOLD
const INTER_CHAR_GAP_MS = UNIT_TIME_MS * INTER_LETTER_UNITS
const ERROR_LOCKOUT_MS = 1000
const LISTEN_REVEAL_EXTRA_MS = 1000
const LISTEN_REVEAL_FADE_OUT_MS = 320
const LISTEN_POST_REVEAL_PAUSE_MS = 220
const PRACTICE_WORD_UNITS = 5
const WORD_GAP_MS = UNIT_TIME_MS * INTER_WORD_UNITS
const WORD_GAP_EXTRA_MS = WORD_GAP_MS - INTER_CHAR_GAP_MS
const LISTEN_WPM_MIN = WPM_RANGE.min
const LISTEN_WPM_MAX = WPM_RANGE.max
const LISTEN_MIN_UNIT_MS = 40
const REFERENCE_WPM = 20
const PROGRESS_SAVE_DEBOUNCE_MS = DEBOUNCE_DELAY
const INTRO_HINTS_KEY = 'dit-intro-hint-step'
const LEGACY_INTRO_HINTS_KEY = 'dit-intro-hints-dismissed'
const NUX_STATUS_KEY = 'dit-nux-status'
const LOCAL_PROGRESS_KEY = 'dit-progress'
const NUX_LETTERS: Letter[] = ['E', 'T', 'I', 'M', 'A', 'N']
const NUX_FAST_THRESHOLD_MS = 1600
const NUX_FAST_DEFAULTS = {
  showHint: false,
  listenWpm: 20,
  maxLevel: 4,
} as const
const NUX_SLOW_DEFAULTS = {
  showHint: true,
  listenWpm: 10,
  maxLevel: 1,
} as const

type IntroHintStep = 'morse' | 'settings' | 'done';
type NuxStatus = 'pending' | 'completed' | 'skipped';
type NuxStep = 'welcome' | 'exercise' | 'result';
type NuxResult = 'fast' | 'slow' | null;
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

type TimeoutHandle = ReturnType<typeof setTimeout>;

const clearTimer = (ref: { current: TimeoutHandle | null }) => {
  if (ref.current !== null) {
    clearTimeout(ref.current)
    ref.current = null
  }
}

const now = () => Date.now()

const initialConfig = (() => {
  const availableLetters = getLettersForLevel(DEFAULT_MAX_LEVEL)
  const practiceWord = getRandomWord(getWordsForLetters(availableLetters))
  return {
    letter: getRandomLetter(availableLetters),
    practiceWord,
  }
})()

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
  const [isPressing, setIsPressing] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [showReference, setShowReference] = useState(false)
  const [mode, setMode] = useState<Mode>('practice')
  const [showHint, setShowHint] = useState(true)
  const [showMnemonic, setShowMnemonic] = useState(false)
  const [introHintStep, setIntroHintStep] = useState<IntroHintStep>('morse')
  const [nuxStatus, setNuxStatus] = useState<NuxStatus>('pending')
  const [nuxStep, setNuxStep] = useState<NuxStep>('welcome')
  const [nuxIndex, setNuxIndex] = useState(0)
  const [nuxReady, setNuxReady] = useState(false)
  const [nuxResult, setNuxResult] = useState<NuxResult>(null)
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
  const [listenStatus, setListenStatus] = useState<
    'idle' | 'success' | 'error'
  >('idle')
  const [listenReveal, setListenReveal] = useState<Letter | null>(null)
  const [listenWavePlayback, setListenWavePlayback] =
    useState<ListenWavePlayback | null>(null)
  const [scores, setScores] = useState(() => initializeScores())
  const nuxTimingsRef = useRef<number[]>([])
  const nuxAttemptStartRef = useRef<number | null>(null)
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
      message?: string;
      name?: string;
      stack?: string;
      [key: string]: unknown;
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
  const isFreestyle = mode === 'freestyle'
  const isListen = mode === 'listen'
  const isNuxActive = nuxReady && nuxStatus === 'pending'
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
      maxLevel,
      practiceWordMode,
      scores,
      showHint,
      showMnemonic,
      wordMode: freestyleWordMode,
    }),
    [
      freestyleWordMode,
      listenWpm,
      maxLevel,
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
  const practiceWordStartRef = useRef<number | null>(null)
  const freestyleWordModeRef = useRef(freestyleWordMode)
  const wordSpaceTimeoutRef = useRef<TimeoutHandle | null>(null)
  const scoresRef = useRef(scores)
  const maxLevelRef = useRef<1 | 2 | 3 | 4>(maxLevel as 1 | 2 | 3 | 4)
  const modeRef = useRef(mode)
  const listenStatusRef = useRef(listenStatus)
  const listenWaveSequenceRef = useRef(0)
  const errorLockoutUntilRef = useRef(0)
  const letterTimeoutRef = useRef<TimeoutHandle | null>(null)
  const successTimeoutRef = useRef<TimeoutHandle | null>(null)
  const errorTimeoutRef = useRef<TimeoutHandle | null>(null)
  const listenTimeoutRef = useRef<TimeoutHandle | null>(null)
  const completeNuxRef = useRef<() => void>(() => {})

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
      const nextLetter = nextLetters.includes(currentLetter)
        ? currentLetter
        : getRandomWeightedLetter(
            nextLetters,
            scoresRef.current,
            currentLetter,
          )
      letterRef.current = nextLetter
      setLetter(nextLetter)
      return nextLetter
    },
    [],
  )

  useEffect(() => {
    inputRef.current = input
    freestyleInputRef.current = freestyleInput
    letterRef.current = letter
    practiceWordRef.current = practiceWord
    practiceWordIndexRef.current = practiceWordIndex
    practiceWordModeRef.current = practiceWordMode
    freestyleWordModeRef.current = freestyleWordMode
    scoresRef.current = scores
    maxLevelRef.current = maxLevel
    modeRef.current = mode
    listenStatusRef.current = listenStatus
  }, [
    freestyleInput,
    freestyleWordMode,
    input,
    letter,
    listenStatus,
    maxLevel,
    mode,
    practiceWord,
    practiceWordIndex,
    practiceWordMode,
    scores,
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
    (code: string, overrideWpm?: number) => {
      stopListenPlayback()
      const resolvedWpm = overrideWpm ?? listenWpm
      const unitMs = getListenUnitMs(resolvedWpm, LISTEN_MIN_UNIT_MS)
      listenWaveSequenceRef.current += 1
      setListenWavePlayback({
        sequence: listenWaveSequenceRef.current,
        code,
        unitMs,
      })
      void playMorseTone({
        code,
        wpm: resolvedWpm,
        minUnitMs: LISTEN_MIN_UNIT_MS,
      })
    },
    [listenWpm, stopListenPlayback],
  )

  const playListenSequenceRef = useRef(playListenSequence)

  useEffect(() => {
    playListenSequenceRef.current = playListenSequence
  }, [playListenSequence])

  const resetListenState = useCallback(() => {
    clearTimer(listenTimeoutRef)
    setListenStatus('idle')
    setListenReveal(null)
  }, [])

  useEffect(() => {
    return () => {
      clearTimer(letterTimeoutRef)
      clearTimer(successTimeoutRef)
      clearTimer(errorTimeoutRef)
      clearTimer(listenTimeoutRef)
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
    if (!availableLetters.includes(letterRef.current)) {
      const nextLetter = getRandomLetter(availableLetters)
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

  const handleAboutToggle = useCallback(() => {
    setShowSettings(false)
    setShowReference(false)
    setShowAbout((prev) => !prev)
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

  const handleNuxSkip = useCallback(() => {
    persistNuxStatus('skipped')
    persistIntroHintStep('done')
    setNuxStep('welcome')
    setNuxIndex(0)
    setNuxResult(null)
  }, [persistIntroHintStep, persistNuxStatus])

  const handleNuxStart = useCallback(() => {
    setNuxStep('exercise')
    setNuxIndex(0)
    setNuxResult(null)
    nuxTimingsRef.current = []
    nuxAttemptStartRef.current = null
    setShowSettings(false)
    setShowAbout(false)
    setShowReference(false)
    setShowHint(true)
    setShowMnemonic(false)
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
      void triggerHaptics(10)
      clearTimer(listenTimeoutRef)
      stopListenPlayback()
      const isCorrect = value === letterRef.current
      setListenStatus(isCorrect ? 'success' : 'error')
      setListenReveal(letterRef.current)
      bumpScore(letterRef.current, isCorrect ? 1 : -1)
      listenTimeoutRef.current = setTimeout(
        () => {
          const nextLetter = getRandomWeightedLetter(
            availableLetters,
            scoresRef.current,
            letterRef.current,
          )
          letterRef.current = nextLetter
          setListenReveal(null)
          setLetter(nextLetter)
          listenTimeoutRef.current = setTimeout(() => {
            if (modeRef.current !== 'listen') {
              return
            }
            setListenStatus('idle')
            playListenSequence(MORSE_DATA[nextLetter].code)
          }, LISTEN_REVEAL_FADE_OUT_MS + LISTEN_POST_REVEAL_PAUSE_MS)
        },
        (isCorrect ? 650 : ERROR_LOCKOUT_MS) + LISTEN_REVEAL_EXTRA_MS,
      )
    },
    [
      availableLetters,
      bumpScore,
      listenStatus,
      playListenSequence,
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
        const target = MORSE_DATA[letterRef.current].code
        const isCorrect = attempt === target
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
              setNuxIndex(nextIndex)
              letterRef.current = nextLetter
              setLetter(nextLetter)
              setStatus('idle')
            }, 350)
            return
          }
          if (canScoreAttempt()) {
            bumpScore(letterRef.current, 1)
          }
          setInput('')
          if (practiceWordModeRef.current) {
            const currentWord = practiceWordRef.current
            if (!currentWord) {
              setPracticeWordFromList(availablePracticeWords)
              setStatus('idle')
              return
            }
            const nextIndex = practiceWordIndexRef.current + 1
            if (nextIndex >= currentWord.length) {
              const startTime = practiceWordStartRef.current
              if (startTime && currentWord.length > 0) {
                const elapsedMs = now() - startTime
                if (elapsedMs > 0) {
                  const nextWpm =
                    (currentWord.length / PRACTICE_WORD_UNITS) *
                    (60000 / elapsedMs)
                  setPracticeWpm(Math.round(nextWpm * 10) / 10)
                }
              }
              setPracticeWordFromList(availablePracticeWords, currentWord)
              setStatus('idle')
              return
            }
            const nextLetter = currentWord[nextIndex] as Letter
            practiceWordIndexRef.current = nextIndex
            letterRef.current = nextLetter
            setPracticeWordIndex(nextIndex)
            setLetter(nextLetter)
            setStatus('idle')
            return
          }
          setStatus('success')
          successTimeoutRef.current = setTimeout(() => {
            setLetter((current) =>
              getRandomWeightedLetter(
                availableLetters,
                scoresRef.current,
                current,
              ),
            )
            setStatus('idle')
          }, 650)
          return
        }
        startErrorLockout()
        if (canScoreAttempt()) {
          bumpScore(letterRef.current, -1)
        }
        setStatus('error')
        setInput('')
        nuxAttemptStartRef.current = null
        errorTimeoutRef.current = setTimeout(() => {
          setStatus('idle')
        }, ERROR_LOCKOUT_MS)
      }, INTER_CHAR_GAP_MS)
    },
    [
      availableLetters,
      availablePracticeWords,
      bumpScore,
      canScoreAttempt,
      isNuxActive,
      nuxIndex,
      nuxStep,
      setPracticeWordFromList,
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
  }, [isListen, registerSymbol, stopTonePlayback])

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
      if (isListen) {
        resetListenState()
        const nextLetter = setNextLetterForLevel(nextLetters)
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
      setNextLetterForLevel,
      setPracticeWordFromList,
    ],
  )

  const applyNuxDefaults = useCallback(
    (defaults: typeof NUX_FAST_DEFAULTS | typeof NUX_SLOW_DEFAULTS) => {
      setShowHint(defaults.showHint)
      setShowMnemonic(false)
      setListenWpm(defaults.listenWpm)
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

  const handleNuxPresetSelect = useCallback(
    (preset: 'beginner' | 'advanced') => {
      const defaults =
        preset === 'advanced' ? NUX_FAST_DEFAULTS : NUX_SLOW_DEFAULTS
      applyNuxDefaults(defaults)
      setNuxResult(preset === 'advanced' ? 'fast' : 'slow')
      handleNuxFinish()
    },
    [applyNuxDefaults, handleNuxFinish],
  )

  const completeNux = useCallback(() => {
    const timings = nuxTimingsRef.current
    const averageMs =
      timings.length === 0
        ? NUX_FAST_THRESHOLD_MS + 1
        : timings.reduce((sum, value) => sum + value, 0) / timings.length
    const isFast = averageMs <= NUX_FAST_THRESHOLD_MS
    const defaults = isFast ? NUX_FAST_DEFAULTS : NUX_SLOW_DEFAULTS
    applyNuxDefaults(defaults)
    setNuxResult(isFast ? 'fast' : 'slow')
    setNuxStep('result')
  }, [applyNuxDefaults])

  useEffect(() => {
    completeNuxRef.current = completeNux
  }, [completeNux])

  const handlePracticeWordModeChange = useCallback(
    (value: boolean) => {
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
      setNextLetterForLevel,
      setPracticeWordFromList,
    ],
  )

  const handleListenWpmChange = useCallback(
    (value: number) => {
      setListenWpm(value)
      if (!isListen || listenStatus !== 'idle') {
        return
      }
      playListenSequence(MORSE_DATA[letterRef.current].code, value)
    },
    [isListen, listenStatus, playListenSequence],
  )

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
        const nextLetter = setNextLetterForLevel(availableLetters)
        playListenSequence(MORSE_DATA[nextLetter].code)
        return
      }
      if (practiceWordModeRef.current) {
        setPracticeWordFromList(
          availablePracticeWords,
          practiceWordRef.current,
        )
        return
      }
      setNextLetterForLevel(availableLetters)
    },
    [
      availableLetters,
      availablePracticeWords,
      playListenSequence,
      resetListenState,
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
      if (typeof progress.showHint === 'boolean') {
        setShowHint(progress.showHint)
      }
      if (typeof progress.showMnemonic === 'boolean') {
        setShowMnemonic(progress.showMnemonic)
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
      if (typeof progress.listenWpm === 'number') {
        setListenWpm(progress.listenWpm)
        if (
          modeRef.current === 'listen' &&
          listenStatusRef.current === 'idle'
        ) {
          playListenSequenceRef.current(
            MORSE_DATA[letterRef.current].code,
            progress.listenWpm,
          )
        }
      }
      if (typeof progress.maxLevel === 'number') {
        maxLevelRef.current = progress.maxLevel as (typeof LEVELS)[number]
        const nextLetters = getLettersForLevel(progress.maxLevel)
        const nextLetter = setNextLetterForLevel(
          nextLetters,
          letterRef.current,
        )
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
    [setNextLetterForLevel, setPracticeWordFromList],
  )
  const {
    progressUpdatedAt,
    onRemoteProgress,
    pendingRemoteSyncTick,
    consumePendingRemoteSync,
  } = useProgressPersistence({
    progressSnapshot,
    progressSaveDebounceMs: PROGRESS_SAVE_DEBOUNCE_MS,
    applyProgress: applyParsedProgress,
    listenWpmMin: LISTEN_WPM_MIN,
    listenWpmMax: LISTEN_WPM_MAX,
    levelMin: LEVELS[0],
    levelMax: LEVELS[LEVELS.length - 1],
  })

  const { remoteLoaded, saveNow } = useFirebaseSync({
    database,
    user,
    onRemoteProgress,
    progressSaveDebounceMs: PROGRESS_SAVE_DEBOUNCE_MS,
    progressSnapshot,
    progressUpdatedAt,
  })

  useEffect(() => {
    if (!remoteLoaded || !user) {
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
    user,
  ])

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
  const isMorseDisabled = !isFreestyle && !isListen && isErrorLocked()
  const baseStatusText =
    status === 'success'
      ? 'Correct'
      : status === 'error'
      ? 'Missed. Start over.'
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
        : `Result ${freestyleResult}`
      : freestyleResult
    : freestyleInput
    ? `Input ${freestyleInput}`
    : freestyleWordMode && freestyleWord
    ? `Word ${freestyleWord}`
    : 'Tap and pause'
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
      <View style={styles.container}>
        <MorseLiquidSurface
          speedMultiplier={0.35}
          style={styles.liquidBackground}
        />
        <BackgroundGlow />
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <TopBar
            mode={mode}
            onModeChange={handleModeChange}
            onPressAbout={handleAboutToggle}
            onSettingsPress={handleSettingsToggle}
            showSettingsHint={showSettingsHint}
          />
          {showAbout ? (
            <AboutModal onClose={() => setShowAbout(false)} />
          ) : null}
          {showSettings ? (
            <SettingsModal
              isFreestyle={isFreestyle}
              isListen={isListen}
              levels={LEVELS}
              maxLevel={maxLevel}
              practiceWordMode={practiceWordMode}
              listenWpm={listenWpm}
              listenWpmMin={LISTEN_WPM_MIN}
              listenWpmMax={LISTEN_WPM_MAX}
              showHint={showHint}
              showMnemonic={showMnemonic}
              onClose={() => setShowSettings(false)}
              onMaxLevelChange={handleMaxLevelChange}
              onPracticeWordModeChange={handlePracticeWordModeChange}
              onListenWpmChange={handleListenWpmChange}
              onShowHintChange={setShowHint}
              onShowMnemonicChange={setShowMnemonic}
              onShowReference={handleShowReference}
              user={user}
              onSignIn={signInWithGoogle}
              onSignOut={signOut}
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
                  wpm: REFERENCE_WPM,
                  minUnitMs: LISTEN_MIN_UNIT_MS,
                })
              }}
            />
          ) : null}
          {isNuxActive ? (
            <NuxModal
              step={nuxStep}
              index={nuxIndex}
              total={NUX_LETTERS.length}
              result={nuxResult}
              onStart={handleNuxStart}
              onSkip={handleNuxSkip}
              onFinish={handleNuxFinish}
              onChoosePreset={handleNuxPresetSelect}
            />
          ) : null}
          <StageDisplay
            letter={stageLetter}
            statusText={statusText}
            pips={stagePips}
            hintVisible={hintVisible}
            letterPlaceholder={letterPlaceholder}
            isListen={isListen}
            listenStatus={listenStatus}
            listenWavePlayback={listenWavePlayback}
            practiceWpmText={practiceWpmText}
            practiceWordMode={showPracticeWord}
            practiceWord={showPracticeWord ? practiceWord : null}
            practiceWordIndex={practiceWordIndex}
            isFreestyle={isFreestyle}
          />
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
                <View style={styles.morseButtonWrap}>
                  {showMorseHint ? (
                    <View style={styles.morseHint}>
                      <Text style={styles.hintText}>
                        Tap the big Morse key to make a dit (short press) or dah
                        (long press).
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
        </SafeAreaView>
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
})
