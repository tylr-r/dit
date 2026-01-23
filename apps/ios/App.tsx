import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { Pressable, StyleSheet, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Circle, Path } from 'react-native-svg'
import {
  applyScoreDelta,
  AUDIO_VOLUME,
  DASH_THRESHOLD,
  formatWpm,
  getLettersForLevel,
  getRandomLetter,
  getRandomWeightedLetter,
  getRandomWord,
  getWordsForLetters,
  initializeScores,
  INTER_LETTER_UNITS,
  MORSE_DATA,
  UNIT_TIME_MS,
  type Letter,
} from '@dit/core'
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio'
import { triggerHaptics } from '@dit/dit-native'
import { AboutPanel } from './src/components/AboutPanel'
import { ModeSwitcher, type Mode } from './src/components/ModeSwitcher'
import { MorseButton } from './src/components/MorseButton'
import { SettingsPanel } from './src/components/SettingsPanel'
import { StageDisplay, type StagePip } from './src/components/StageDisplay'

const LEVELS = [1, 2, 3, 4] as const
const DOT_THRESHOLD_MS = DASH_THRESHOLD
const INTER_CHAR_GAP_MS = UNIT_TIME_MS * INTER_LETTER_UNITS
const ERROR_LOCKOUT_MS = 1000
const PRACTICE_WORD_UNITS = 5
const TONE_VOLUME = AUDIO_VOLUME
const TONE_SOURCE = require('./assets/audio/tone-640.wav')

type TimeoutHandle = ReturnType<typeof setTimeout>

const clearTimer = (ref: { current: TimeoutHandle | null }) => {
  if (ref.current !== null) {
    clearTimeout(ref.current)
    ref.current = null
  }
}

const now = () => Date.now()

const initialConfig = (() => {
  const availableLetters = getLettersForLevel(LEVELS[LEVELS.length - 1])
  const practiceWord = getRandomWord(getWordsForLetters(availableLetters))
  return {
    letter: getRandomLetter(availableLetters),
    practiceWord,
  }
})()

const DitLogo = () => (
  <Svg width={60} height={60} viewBox='0 0 806 806' opacity={0.5}>
    <Path
      d='M92.1113 255.555C74.9852 291.601 63.9443 331.099 60.3145 372.72L4.51855 367.913C8.72293 319.533 21.5381 273.619 41.4258 231.712L92.1113 255.555Z'
      fill='white'
    />
    <Path
      d='M260.393 89.8623C224.063 106.377 190.159 129.454 160.553 158.931L120.998 119.287C155.401 85.0127 194.798 58.1747 237.017 38.9598L260.393 89.8623Z'
      fill='white'
    />
    <Path
      d='M405.179 58.9257C365.272 58.6455 324.81 65.3391 285.557 79.6465L266.323 27.0505C311.944 10.4061 358.971 2.60752 405.357 2.91256L405.179 58.9257Z'
      fill='white'
    />
    <Path
      d='M550.068 91.9326C514.001 74.8502 474.49 63.8573 432.864 60.278L437.603 4.47627C485.988 8.62192 531.918 21.3814 573.849 41.2181L550.068 91.9326Z'
      fill='white'
    />
    <Path
      d='M715.074 258.079C698.29 221.872 674.963 188.141 645.267 158.753L684.618 118.906C719.146 153.054 746.275 192.251 765.802 234.327L715.074 258.079Z'
      fill='white'
    />
    <Path
      d='M735.04 493.228C745.532 454.724 749.424 413.897 745.647 372.289L801.415 367.167C805.82 415.529 801.315 462.985 789.14 507.745L735.04 493.228Z'
      fill='white'
    />
    <Path
      d='M431.712 745.881C471.483 742.578 511.181 732.28 548.991 714.507L572.868 765.164C528.926 785.836 482.788 797.824 436.563 801.684L431.712 745.881Z'
      fill='white'
    />
    <Path
      d='M283.877 725.802C321.308 739.645 361.633 747.118 403.412 747.02L403.602 803.022C355.04 803.151 308.165 794.483 264.651 778.413L283.877 725.802Z'
      fill='white'
    />
    <Path
      d='M104.124 573.485C123.874 608.163 149.937 639.828 181.984 666.633L146.1 709.628C108.84 678.483 78.5317 641.69 55.558 601.392L104.124 573.485Z'
      fill='white'
    />
    <Circle cx='99' cy='189' r='28' fill='white' />
    <Circle cx='617' cy='99' r='28' fill='white' />
    <Circle cx='615.933' cy='707.749' r='28' fill='white' />
    <Circle cx='762.114' cy='306.827' r='28' fill='white' />
    <Circle cx='740.405' cy='559.108' r='28' fill='white' />
    <Circle cx='688.211' cy='641.467' r='28' fill='white' />
    <Circle cx='215.711' cy='724.146' r='28' fill='white' />
    <Circle cx='53.2655' cy='529.086' r='28' fill='white' />
    <Circle cx='32.5273' cy='434.015' r='28' fill='white' />
    <Circle cx='630.682' cy='508.496' r='21' fill='white' />
    <Circle cx='650.503' cy='445.807' r='21' fill='white' />
    <Circle cx='620.825' cy='276.778' r='21' fill='white' />
    <Circle cx='379.724' cy='152.108' r='21' fill='white' />
    <Circle cx='315.716' cy='166.752' r='21' fill='white' />
    <Circle cx='257.693' cy='197.49' r='21' fill='white' />
    <Circle cx='160.812' cy='336.686' r='21' fill='white' />
    <Circle cx='176.189' cy='509.334' r='21' fill='white' />
    <Circle cx='509.219' cy='629.738' r='21' fill='white' />
    <Path
      d='M633.796 403.321C633.856 376.485 629.218 349.3 619.458 322.959L657.877 308.632C669.377 339.625 674.853 371.611 674.806 403.19L633.796 403.321Z'
      fill='white'
    />
    <Path
      d='M579.591 254.275C562.335 233.722 541.264 215.932 516.821 202.088L536.952 166.367C565.724 182.644 590.532 203.565 610.855 227.735L579.591 254.275Z'
      fill='white'
    />
    <Path
      d='M500.371 193.555C476.056 182.199 449.446 174.956 421.445 172.714L424.631 131.835C457.584 134.457 488.902 142.962 517.523 156.304L500.371 193.555Z'
      fill='white'
    />
    <Path
      d='M239.571 239.382C220.558 258.321 204.62 280.827 192.901 306.357L155.6 289.33C169.376 259.28 188.115 232.785 210.473 210.484L239.571 239.382Z'
      fill='white'
    />
    <Path
      d='M172.556 382.964C170.214 409.697 172.522 437.178 180.005 464.254L140.507 475.261C131.685 443.402 128.95 411.066 131.684 379.606L172.556 382.964Z'
      fill='white'
    />
    <Path
      d='M213.114 534.982C228.431 557.017 247.799 576.649 270.883 592.656L247.589 626.4C220.415 607.576 197.61 584.488 179.567 558.571L213.114 534.982Z'
      fill='white'
    />
    <Path
      d='M286.688 602.764C309.884 616.259 335.735 625.864 363.421 630.614L356.574 671.041C323.99 665.468 293.564 654.183 266.257 638.322L286.688 602.764Z'
      fill='white'
    />
    <Path
      d='M382.018 633.093C408.744 635.519 436.232 633.297 463.331 625.898L474.214 665.43C442.328 674.152 409.984 676.787 378.532 673.955L382.018 633.093Z'
      fill='white'
    />
    <Path
      d='M535.023 591.889C557.076 576.598 576.731 557.254 592.766 534.189L626.482 557.523C607.625 584.675 584.51 607.452 558.572 625.464L535.023 591.889Z'
      fill='white'
    />
    <Circle cx='403' cy='403' r='62' fill='white' />
  </Svg>
)

const SettingsIcon = () => (
  <Svg width={22} height={22} viewBox='0 0 24 24'>
    <Path
      d='M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.07-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.14 7.14 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.58.22-1.12.52-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.66 8.86a.5.5 0 0 0 .12.64l2.03 1.58c-.05.31-.07.63-.07.94s.02.63.07.94L2.71 14.5a.5.5 0 0 0-.12.64l1.92 3.32c.13.23.4.32.64.22l2.39-.96c.5.41 1.05.73 1.63.94l.36 2.54c.05.24.26.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.58-.22 1.12-.52 1.63-.94l2.39.96c.24.1.51 0 .64-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.56Zm-7.14 2.56a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z'
      fill='rgba(244, 247, 249, 0.9)'
    />
  </Svg>
)

/** Primary app entry for Dit iOS. */
export default function App() {
  const [isPressing, setIsPressing] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [mode, setMode] = useState<Mode>('practice')
  const [showHint, setShowHint] = useState(true)
  const [showMnemonic, setShowMnemonic] = useState(false)
  const [maxLevel, setMaxLevel] = useState(LEVELS[LEVELS.length - 1])
  const [practiceWordMode, setPracticeWordMode] = useState(false)
  const [letter, setLetter] = useState<Letter>(initialConfig.letter)
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [practiceWord, setPracticeWord] = useState(initialConfig.practiceWord)
  const [practiceWordIndex, setPracticeWordIndex] = useState(0)
  const [practiceWpm, setPracticeWpm] = useState<number | null>(null)
  const [freestyleInput, setFreestyleInput] = useState('')
  const [freestyleResult, setFreestyleResult] = useState<string | null>(null)
  const [scores, setScores] = useState(() => initializeScores())
  const tonePlayer = useMemo(
    () =>
      createAudioPlayer(TONE_SOURCE, {
        keepAudioSessionActive: true,
        updateInterval: 1000,
      }),
    [],
  )
  const isFreestyle = mode === 'freestyle'
  const isListen = mode === 'listen'
  const availableLetters = useMemo(
    () => getLettersForLevel(maxLevel),
    [maxLevel],
  )
  const availablePracticeWords = useMemo(
    () => getWordsForLetters(availableLetters),
    [availableLetters],
  )
  const pressStartRef = useRef<number | null>(null)
  const inputRef = useRef(input)
  const freestyleInputRef = useRef(freestyleInput)
  const letterRef = useRef(letter)
  const practiceWordRef = useRef(practiceWord)
  const practiceWordIndexRef = useRef(practiceWordIndex)
  const practiceWordModeRef = useRef(practiceWordMode)
  const practiceWordStartRef = useRef<number | null>(null)
  const scoresRef = useRef(scores)
  const errorLockoutUntilRef = useRef(0)
  const letterTimeoutRef = useRef<TimeoutHandle | null>(null)
  const successTimeoutRef = useRef<TimeoutHandle | null>(null)
  const errorTimeoutRef = useRef<TimeoutHandle | null>(null)

  useEffect(() => {
    inputRef.current = input
  }, [input])

  useEffect(() => {
    freestyleInputRef.current = freestyleInput
  }, [freestyleInput])

  useEffect(() => {
    letterRef.current = letter
  }, [letter])

  useEffect(() => {
    practiceWordRef.current = practiceWord
  }, [practiceWord])

  useEffect(() => {
    practiceWordIndexRef.current = practiceWordIndex
  }, [practiceWordIndex])

  useEffect(() => {
    practiceWordModeRef.current = practiceWordMode
  }, [practiceWordMode])

  useEffect(() => {
    scoresRef.current = scores
  }, [scores])

  useEffect(() => {
    tonePlayer.loop = true
    tonePlayer.volume = 1
  }, [tonePlayer])

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
      allowsRecording: false,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
    })
  }, [])

  const stopTonePlayback = useCallback(() => {
    if (!tonePlayer.isLoaded) {
      return
    }
    tonePlayer.pause()
    void tonePlayer.seekTo(0)
  }, [tonePlayer])

  useEffect(() => {
    return () => {
      clearTimer(letterTimeoutRef)
      clearTimer(successTimeoutRef)
      clearTimer(errorTimeoutRef)
      stopTonePlayback()
      tonePlayer.release()
    }
  }, [stopTonePlayback, tonePlayer])

  useEffect(() => {
    if (!availableLetters.includes(letterRef.current)) {
      const nextLetter = getRandomLetter(availableLetters)
      letterRef.current = nextLetter
      setLetter(nextLetter)
    }
    if (practiceWordModeRef.current) {
      const nextWord = getRandomWord(
        availablePracticeWords,
        practiceWordRef.current,
      )
      practiceWordRef.current = nextWord
      practiceWordIndexRef.current = 0
      practiceWordStartRef.current = null
      setPracticeWord(nextWord)
      setPracticeWordIndex(0)
      const nextLetter = nextWord[0] as Letter
      letterRef.current = nextLetter
      setLetter(nextLetter)
    }
  }, [availableLetters, availablePracticeWords])

  const canScoreAttempt = useCallback(() => !showHint, [showHint])

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

  const submitFreestyleInput = useCallback((value: string) => {
    if (!value) {
      setFreestyleResult('No input')
      return
    }
    const match = Object.entries(MORSE_DATA).find(
      ([, data]) => data.code === value,
    )
    const result = match ? match[0] : 'No match'
    setFreestyleResult(result)
    setFreestyleInput('')
  }, [])

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
          if (canScoreAttempt()) {
            bumpScore(letterRef.current, 1)
          }
          setInput('')
          if (practiceWordModeRef.current) {
            const currentWord = practiceWordRef.current
            if (!currentWord) {
              const nextWord = getRandomWord(availablePracticeWords)
              const nextLetter = nextWord[0] as Letter
              practiceWordStartRef.current = null
              practiceWordRef.current = nextWord
              practiceWordIndexRef.current = 0
              letterRef.current = nextLetter
              setPracticeWord(nextWord)
              setPracticeWordIndex(0)
              setLetter(nextLetter)
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
              const nextWord = getRandomWord(
                availablePracticeWords,
                currentWord,
              )
              const nextLetter = nextWord[0] as Letter
              practiceWordStartRef.current = null
              practiceWordRef.current = nextWord
              practiceWordIndexRef.current = 0
              letterRef.current = nextLetter
              setPracticeWord(nextWord)
              setPracticeWordIndex(0)
              setLetter(nextLetter)
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
      startErrorLockout,
      submitFreestyleInput,
    ],
  )

  const registerSymbol = useCallback(
    (symbol: '.' | '-') => {
      if (!isFreestyle && isErrorLocked()) {
        return
      }
      void triggerHaptics(symbol === '.' ? 12 : 28)
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
      setInput((prev) => prev + symbol)
      scheduleLetterReset('practice')
    },
    [isErrorLocked, isFreestyle, scheduleLetterReset],
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
    if (!tonePlayer.isLoaded) {
      return
    }
    void tonePlayer.seekTo(0)
    tonePlayer.play()
  }, [isErrorLocked, isFreestyle, isListen, tonePlayer])

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

  const handleMaxLevelChange = useCallback((value: number) => {
    setMaxLevel(value)
  }, [])

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
        const nextWord = getRandomWord(availablePracticeWords)
        const nextLetter = nextWord[0] as Letter
        practiceWordRef.current = nextWord
        practiceWordIndexRef.current = 0
        letterRef.current = nextLetter
        setPracticeWord(nextWord)
        setPracticeWordIndex(0)
        setLetter(nextLetter)
      } else {
        const nextLetter = getRandomWeightedLetter(
          availableLetters,
          scoresRef.current,
          letterRef.current,
        )
        letterRef.current = nextLetter
        setLetter(nextLetter)
      }
    },
    [availableLetters, availablePracticeWords],
  )

  const handleModeChange = useCallback(
    (nextMode: Mode) => {
      stopTonePlayback()
      setMode(nextMode)
      setShowSettings(false)
      setShowAbout(false)
      setIsPressing(false)
      setInput('')
      setFreestyleInput('')
      setFreestyleResult(null)
      setStatus('idle')
      clearTimer(letterTimeoutRef)
      clearTimer(successTimeoutRef)
      clearTimer(errorTimeoutRef)
      practiceWordStartRef.current = null
      if (nextMode !== 'practice') {
        setPracticeWpm(null)
      }
    },
    [stopTonePlayback],
  )

  const target = MORSE_DATA[letter].code
  const targetSymbols = target.split('')
  const hintVisible = !isFreestyle && !isListen && showHint
  const mnemonicVisible = !isFreestyle && !isListen && showMnemonic
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
  const pips: StagePip[] = targetSymbols.map((symbol, index) => ({
    type: symbol === '.' ? 'dot' : 'dah',
    state: index < highlightCount ? 'hit' : 'expected',
  }))
  const isLetterResult = freestyleResult
    ? /^[A-Z0-9]$/.test(freestyleResult)
    : false
  const freestyleStatus = freestyleResult
    ? isLetterResult
      ? `Result ${freestyleResult}`
      : freestyleResult
    : freestyleInput
      ? `Input ${freestyleInput}`
      : 'Tap and pause'
  const freestyleDisplay = freestyleResult
    ? isLetterResult
      ? freestyleResult
      : '?'
    : freestyleInput || '?'
  const statusText = isFreestyle
    ? freestyleStatus
    : isListen
      ? 'Listen mode coming soon'
      : practiceStatusText
  const stageLetter = isFreestyle ? freestyleDisplay : isListen ? '?' : letter
  const stagePips = isFreestyle || isListen ? [] : pips
  const showPracticeWord = !isFreestyle && !isListen && practiceWordMode

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.topBar}>
          <View style={styles.topBarSide}>
            <Pressable
              onPress={() => {
                setShowSettings(false)
                setShowAbout((prev) => !prev)
              }}
              accessibilityRole='button'
              accessibilityLabel='About Dit'
              style={styles.logoButton}
            >
              <View style={styles.logo}>
                <DitLogo />
              </View>
            </Pressable>
          </View>
          <View style={styles.topBarCenter}>
            <ModeSwitcher value={mode} onChange={handleModeChange} />
          </View>
          <View style={styles.topBarSide}>
            <Pressable
              onPress={() => {
                setShowAbout(false)
                setShowSettings((prev) => !prev)
              }}
              accessibilityRole='button'
              accessibilityLabel='Settings'
              style={({ pressed }) => [
                styles.settingsButton,
                pressed && styles.settingsButtonPressed,
              ]}
            >
              <SettingsIcon />
            </Pressable>
          </View>
        </View>
        {showAbout ? (
          <View style={styles.modalOverlay} pointerEvents='box-none'>
            <Pressable
              onPress={() => setShowAbout(false)}
              style={styles.modalBackdrop}
            />
            <View style={styles.modalCenter} pointerEvents='box-none'>
              <Pressable style={styles.modalCard} onPress={() => {}}>
                <AboutPanel onClose={() => setShowAbout(false)} />
              </Pressable>
            </View>
          </View>
        ) : null}
        {showSettings ? (
          <View style={styles.modalOverlay} pointerEvents='box-none'>
            <Pressable
              onPress={() => setShowSettings(false)}
              style={styles.modalBackdrop}
            />
            <View style={styles.modalCenter} pointerEvents='box-none'>
              <Pressable style={styles.modalCard} onPress={() => {}}>
                <SettingsPanel
                  isFreestyle={isFreestyle}
                  isListen={isListen}
                  levels={LEVELS}
                  maxLevel={maxLevel}
                  practiceWordMode={practiceWordMode}
                  showHint={showHint}
                  showMnemonic={showMnemonic}
                  onClose={() => setShowSettings(false)}
                  onMaxLevelChange={handleMaxLevelChange}
                  onPracticeWordModeChange={handlePracticeWordModeChange}
                  onShowHintChange={setShowHint}
                  onShowMnemonicChange={setShowMnemonic}
                />
              </Pressable>
            </View>
          </View>
        ) : null}
        <StageDisplay
          letter={stageLetter}
          statusText={statusText}
          pips={stagePips}
          hintVisible={hintVisible}
          practiceWpmText={practiceWpmText}
          practiceWordMode={showPracticeWord}
          practiceWord={showPracticeWord ? practiceWord : null}
          practiceWordIndex={practiceWordIndex}
        />
        <View style={styles.controls}>
          <MorseButton
            isPressing={isPressing}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
          />
        </View>
        </SafeAreaView>
        <StatusBar style='light' />
      </View>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1017',
    overflow: 'hidden',
  },
  safeArea: {
    flex: 1,
    position: 'relative',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  topBarSide: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarCenter: {
    flex: 1,
    alignItems: 'center',
  },
  logoButton: {
    borderRadius: 16,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  settingsButtonPressed: {
    transform: [{ scale: 0.97 }],
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 10, 14, 0.72)',
  },
  modalCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  controls: {
    alignItems: 'center',
    paddingBottom: 24,
    paddingTop: 12,
    paddingHorizontal: 24,
    width: '100%',
  },
  logo: {
    width: 60,
    height: 60,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
  },
})
