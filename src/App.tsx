import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth'
import { get, ref, set } from 'firebase/database'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { ListenControls } from './components/ListenControls'
import { MorseButton } from './components/MorseButton'
import { ReferenceModal } from './components/ReferenceModal'
import { SettingsPanel } from './components/SettingsPanel'
import { StageDisplay } from './components/StageDisplay'
import { MORSE_DATA, type Letter } from './data/morse'
import { auth, database, googleProvider } from './firebase'

const LETTERS = Object.keys(MORSE_DATA) as Letter[]
const LEVELS = [1, 2, 3, 4] as const
const REFERENCE_LETTERS = LETTERS.filter((letter) => /^[A-Z]$/.test(letter))
const REFERENCE_NUMBERS: Letter[] = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '0',
]
const DOT_THRESHOLD_MS = 200
const UNIT_MS = DOT_THRESHOLD_MS
const LISTEN_WPM_MIN = 10
const LISTEN_WPM_MAX = 30
const INTER_CHAR_GAP_MS = UNIT_MS * 3
const WORD_GAP_MS = UNIT_MS * 7
const WORD_GAP_EXTRA_MS = WORD_GAP_MS - INTER_CHAR_GAP_MS
const TONE_FREQUENCY = 640
const TONE_GAIN = 0.06
const ERROR_LOCKOUT_MS = 1000
const PROGRESS_SAVE_DEBOUNCE_MS = 800
const STORAGE_KEYS = {
  mode: 'morse-mode',
  showHint: 'morse-show-hint',
  wordMode: 'morse-word-mode',
  maxLevel: 'morse-max-level',
  scores: 'morse-scores',
  listenWpm: 'morse-listen-wpm',
}

const clampNumber = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.round(value)))

const readStoredBoolean = (key: string, fallback: boolean) => {
  if (typeof window === 'undefined') {
    return fallback
  }
  const stored = window.localStorage.getItem(key)
  if (stored === null) {
    return fallback
  }
  return stored === 'true'
}

const readStoredNumber = (
  key: string,
  fallback: number,
  min: number,
  max: number,
) => {
  if (typeof window === 'undefined') {
    return fallback
  }
  const stored = window.localStorage.getItem(key)
  if (stored === null) {
    return fallback
  }
  const parsed = Number(stored)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return clampNumber(parsed, min, max)
}

const getLettersForLevel = (maxLevel: number) =>
  LETTERS.filter((letter) => MORSE_DATA[letter].level <= maxLevel)

const pickNewLetter = (letters: Letter[], previous?: Letter): Letter => {
  if (letters.length === 0) {
    return LETTERS[0]
  }
  if (letters.length === 1) {
    return letters[0]
  }
  if (!previous || !letters.includes(previous)) {
    return letters[Math.floor(Math.random() * letters.length)]
  }
  let next = previous
  while (next === previous) {
    next = letters[Math.floor(Math.random() * letters.length)]
  }
  return next
}

const pickWeightedLetter = (
  letters: Letter[],
  scores: Record<Letter, number>,
  previous?: Letter,
): Letter => {
  if (letters.length === 0) {
    return LETTERS[0]
  }
  if (letters.length === 1) {
    return letters[0]
  }
  const maxScore = Math.max(...letters.map((item) => scores[item] ?? 0))
  const baseline = 3
  const weights = letters.map(
    (item) => Math.max(maxScore - (scores[item] ?? 0), 0) + baseline,
  )
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  let roll = Math.random() * totalWeight
  for (let index = 0; index < letters.length; index += 1) {
    roll -= weights[index]
    if (roll <= 0) {
      const picked = letters[index]
      if (picked === previous) {
        return letters[(index + 1) % letters.length]
      }
      return picked
    }
  }
  return letters[letters.length - 1]
}

const clearTimer = (ref: { current: number | null }) => {
  if (ref.current !== null) {
    window.clearTimeout(ref.current)
    ref.current = null
  }
}

const buildScoreMap = () =>
  LETTERS.reduce(
    (acc, letter) => {
      acc[letter] = 0
      return acc
    },
    {} as Record<Letter, number>,
  )

type RemoteProgress = {
  listenWpm?: number
  maxLevel?: number
  scores?: Record<Letter, number>
  showHint?: boolean
  wordMode?: boolean
}

const parseRemoteScores = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    return null
  }
  const record = value as Record<string, unknown>
  const next = buildScoreMap()
  let hasScore = false
  LETTERS.forEach((letter) => {
    const entry = record[letter]
    if (typeof entry === 'number' && Number.isFinite(entry)) {
      next[letter] = entry
      hasScore = true
    }
  })
  return hasScore ? next : null
}

const parseRemoteProgress = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    return null
  }
  const record = value as Record<string, unknown>
  const progress: RemoteProgress = {}
  if (typeof record.showHint === 'boolean') {
    progress.showHint = record.showHint
  }
  if (typeof record.wordMode === 'boolean') {
    progress.wordMode = record.wordMode
  }
  if (typeof record.maxLevel === 'number' && Number.isFinite(record.maxLevel)) {
    progress.maxLevel = clampNumber(record.maxLevel, 1, 4)
  }
  if (
    typeof record.listenWpm === 'number' &&
    Number.isFinite(record.listenWpm)
  ) {
    progress.listenWpm = clampNumber(
      record.listenWpm,
      LISTEN_WPM_MIN,
      LISTEN_WPM_MAX,
    )
  }
  const scores = parseRemoteScores(record.scores)
  if (scores) {
    progress.scores = scores
  }
  return progress
}

const readStoredScores = () => {
  if (typeof window === 'undefined') {
    return buildScoreMap()
  }
  const stored = window.localStorage.getItem(STORAGE_KEYS.scores)
  if (!stored) {
    return buildScoreMap()
  }
  try {
    const parsed = JSON.parse(stored) as Record<string, unknown>
    const next = buildScoreMap()
    LETTERS.forEach((letter) => {
      const value = parsed[letter]
      if (typeof value === 'number' && Number.isFinite(value)) {
        next[letter] = value
      }
    })
    return next
  } catch {
    return buildScoreMap()
  }
}

const useStoredValue = (key: string, value: string) => {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(key, value)
  }, [key, value])
}

const isEditableTarget = (target: EventTarget | null) => {
  const element = target as HTMLElement | null
  if (!element) {
    return false
  }
  return (
    element.isContentEditable ||
    element.tagName === 'INPUT' ||
    element.tagName === 'SELECT' ||
    element.tagName === 'TEXTAREA'
  )
}

const shouldIgnoreShortcutEvent = (event: KeyboardEvent) =>
  event.repeat ||
  event.ctrlKey ||
  event.metaKey ||
  event.altKey ||
  isEditableTarget(event.target)

const createToneNodes = (context: AudioContext, initialGain: number) => {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = TONE_FREQUENCY
  gain.gain.value = initialGain
  oscillator.connect(gain)
  gain.connect(context.destination)
  return { oscillator, gain }
}

const scheduleToneEnvelope = (
  gain: GainNode,
  startTime: number,
  duration: number,
  rampSeconds: number,
  sustain = true,
) => {
  const endTime = startTime + duration
  gain.gain.setValueAtTime(0, startTime)
  gain.gain.linearRampToValueAtTime(TONE_GAIN, startTime + rampSeconds)
  if (sustain) {
    gain.gain.setValueAtTime(TONE_GAIN, endTime - rampSeconds)
  }
  gain.gain.linearRampToValueAtTime(0, endTime)
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [remoteLoaded, setRemoteLoaded] = useState(false)
  const [maxLevel, setMaxLevel] = useState(() =>
    readStoredNumber(STORAGE_KEYS.maxLevel, 4, 1, 4),
  )
  const [letter, setLetter] = useState<Letter>(() =>
    pickNewLetter(getLettersForLevel(maxLevel)),
  )
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [isPressing, setIsPressing] = useState(false)
  const [showHint, setShowHint] = useState(() =>
    readStoredBoolean(STORAGE_KEYS.showHint, true),
  )
  const [mode, setMode] = useState<'practice' | 'freestyle' | 'listen'>(() => {
    if (typeof window === 'undefined') {
      return 'practice'
    }
    const stored = window.localStorage.getItem(STORAGE_KEYS.mode)
    if (stored === 'freestyle') {
      return 'freestyle'
    }
    if (stored === 'listen') {
      return 'listen'
    }
    return 'practice'
  })
  const [showHintOnce, setShowHintOnce] = useState(false)
  const [freestyleInput, setFreestyleInput] = useState('')
  const [freestyleResult, setFreestyleResult] = useState<string | null>(null)
  const [freestyleWordMode, setFreestyleWordMode] = useState(() =>
    readStoredBoolean(STORAGE_KEYS.wordMode, false),
  )
  const [freestyleWord, setFreestyleWord] = useState('')
  const [listenWpm, setListenWpm] = useState(() =>
    readStoredNumber(STORAGE_KEYS.listenWpm, 20, LISTEN_WPM_MIN, LISTEN_WPM_MAX),
  )
  const [useCustomKeyboard, setUseCustomKeyboard] = useState(false)
  const [soundCheckStatus, setSoundCheckStatus] = useState<'idle' | 'playing'>(
    'idle',
  )
  const [listenStatus, setListenStatus] = useState<'idle' | 'success' | 'error'>(
    'idle',
  )
  const [listenReveal, setListenReveal] = useState<Letter | null>(null)
  const [showReference, setShowReference] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [scores, setScores] = useState(readStoredScores)
  const freestyleInputRef = useRef('')
  const freestyleWordModeRef = useRef(freestyleWordMode)
  const showReferenceRef = useRef(showReference)
  const letterRef = useRef(letter)
  const scoresRef = useRef(scores)
  const errorLockoutUntilRef = useRef(0)
  const pressStartRef = useRef<number | null>(null)
  const errorTimeoutRef = useRef<number | null>(null)
  const successTimeoutRef = useRef<number | null>(null)
  const letterTimeoutRef = useRef<number | null>(null)
  const wordSpaceTimeoutRef = useRef<number | null>(null)
  const listenTimeoutRef = useRef<number | null>(null)
  const saveProgressTimeoutRef = useRef<number | null>(null)
  const listenPlaybackRef = useRef<{
    oscillator: OscillatorNode
    gain: GainNode
  } | null>(null)
  const morseButtonRef = useRef<HTMLButtonElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const oscillatorRef = useRef<OscillatorNode | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const availableLetters = useMemo(
    () => getLettersForLevel(maxLevel),
    [maxLevel],
  )
  const scoresStorageValue = useMemo(() => JSON.stringify(scores), [scores])
  const progressSnapshot = useMemo(
    () => ({
      listenWpm,
      maxLevel,
      scores,
      showHint,
      wordMode: freestyleWordMode,
    }),
    [freestyleWordMode, listenWpm, maxLevel, scores, showHint],
  )
  const ensureAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }
    const context = audioContextRef.current
    if (context.state === 'suspended') {
      await context.resume()
    }
    return context
  }, [])
  const triggerHaptics = useCallback((pattern: number | number[]) => {
    if (typeof navigator === 'undefined') {
      return
    }
    if (!('vibrate' in navigator)) {
      return
    }
    navigator.vibrate(pattern)
  }, [])
  const bumpScore = useCallback((targetLetter: Letter, delta: number) => {
    setScores((prev) => ({
      ...prev,
      [targetLetter]: prev[targetLetter] + delta,
    }))
  }, [])
  const handleResetScores = useCallback(() => {
    setScores(buildScoreMap())
  }, [])
  const isErrorLocked = useCallback(
    () => performance.now() < errorLockoutUntilRef.current,
    [],
  )
  const startErrorLockout = useCallback(() => {
    errorLockoutUntilRef.current = performance.now() + ERROR_LOCKOUT_MS
  }, [])
  const canScoreAttempt = useCallback(
    () => !(showHint || showHintOnce),
    [showHint, showHintOnce],
  )

  useStoredValue(STORAGE_KEYS.mode, mode)
  useStoredValue(STORAGE_KEYS.showHint, String(showHint))
  useStoredValue(STORAGE_KEYS.wordMode, String(freestyleWordMode))
  useStoredValue(STORAGE_KEYS.maxLevel, String(maxLevel))
  useStoredValue(STORAGE_KEYS.listenWpm, String(listenWpm))
  useStoredValue(STORAGE_KEYS.scores, scoresStorageValue)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      setRemoteLoaded(false)
      setAuthReady(true)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    freestyleInputRef.current = freestyleInput
  }, [freestyleInput])

  useEffect(() => {
    freestyleWordModeRef.current = freestyleWordMode
  }, [freestyleWordMode])

  useEffect(() => {
    showReferenceRef.current = showReference
  }, [showReference])

  useEffect(() => {
    letterRef.current = letter
  }, [letter])

  useEffect(() => {
    scoresRef.current = scores
  }, [scores])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return
    }
    const mediaQuery = window.matchMedia('(pointer: coarse)')
    const updateKeyboardMode = () => {
      setUseCustomKeyboard(mediaQuery.matches)
    }
    updateKeyboardMode()
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', updateKeyboardMode)
    } else {
      mediaQuery.addListener(updateKeyboardMode)
    }
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', updateKeyboardMode)
      } else {
        mediaQuery.removeListener(updateKeyboardMode)
      }
    }
  }, [])

  useEffect(() => {
    if (!showReference) {
      return
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowReference(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [showReference])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }
    if (!showReference) {
      return
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [showReference])

  const isFreestyle = mode === 'freestyle'
  const isListen = mode === 'listen'

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const updateAppHeight = () => {
      const height = window.visualViewport?.height ?? window.innerHeight
      const heightValue = `${height}px`
      document.documentElement.style.setProperty('--app-height', heightValue)
      document.documentElement.style.height = heightValue
      if (document.body) {
        document.body.style.height = heightValue
      }
      if (window.scrollY) {
        window.scrollTo(0, 0)
      }
    }
    updateAppHeight()
    window.addEventListener('resize', updateAppHeight)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateAppHeight)
      window.visualViewport.addEventListener('scroll', updateAppHeight)
    }
    return () => {
      window.removeEventListener('resize', updateAppHeight)
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateAppHeight)
        window.visualViewport.removeEventListener('scroll', updateAppHeight)
      }
    }
  }, [])

  useEffect(() => {
    const button = morseButtonRef.current
    if (!button) {
      return
    }
    const preventTouchDefault = (event: Event) => {
      if (event.cancelable) {
        event.preventDefault()
      }
    }
    const preventContextMenu = (event: Event) => {
      event.preventDefault()
    }
    button.addEventListener('touchstart', preventTouchDefault, {
      passive: false,
    })
    button.addEventListener('touchmove', preventTouchDefault, {
      passive: false,
    })
    button.addEventListener('touchend', preventTouchDefault, {
      passive: false,
    })
    button.addEventListener('touchcancel', preventTouchDefault, {
      passive: false,
    })
    button.addEventListener('dblclick', preventTouchDefault, {
      passive: false,
    })
    button.addEventListener('contextmenu', preventContextMenu)
    return () => {
      button.removeEventListener('touchstart', preventTouchDefault)
      button.removeEventListener('touchmove', preventTouchDefault)
      button.removeEventListener('touchend', preventTouchDefault)
      button.removeEventListener('touchcancel', preventTouchDefault)
      button.removeEventListener('dblclick', preventTouchDefault)
      button.removeEventListener('contextmenu', preventContextMenu)
    }
  }, [isListen])

  const startTone = useCallback(async () => {
    const context = await ensureAudioContext()
    if (oscillatorRef.current) {
      return
    }
    const { oscillator, gain } = createToneNodes(context, TONE_GAIN)
    oscillator.start()
    oscillatorRef.current = oscillator
    gainRef.current = gain
  }, [ensureAudioContext])

  const stopTone = useCallback(() => {
    if (!oscillatorRef.current) {
      return
    }
    oscillatorRef.current.stop()
    oscillatorRef.current.disconnect()
    oscillatorRef.current = null
    if (gainRef.current) {
      gainRef.current.disconnect()
      gainRef.current = null
    }
  }, [])

  const stopListenPlayback = useCallback(() => {
    const current = listenPlaybackRef.current
    if (!current) {
      return
    }
    try {
      current.oscillator.stop()
    } catch {
      // No-op: oscillator might already be stopped.
    }
    current.oscillator.disconnect()
    current.gain.disconnect()
    listenPlaybackRef.current = null
  }, [])

  const playListenSequence = useCallback(
    async (code: string) => {
      stopListenPlayback()
      const context = await ensureAudioContext()
      const { oscillator, gain } = createToneNodes(context, 0)
      listenPlaybackRef.current = { oscillator, gain }

      const unitSeconds = 1.2 / listenWpm
      const rampSeconds = 0.005
      let currentTime = context.currentTime + 0.05
      if (useCustomKeyboard) {
        const unitMs = Math.max(Math.round(unitSeconds * 1000), 40)
        const pattern: number[] = []
        for (let index = 0; index < code.length; index += 1) {
          const symbol = code[index]
          pattern.push(symbol === '.' ? unitMs : unitMs * 3)
          if (index < code.length - 1) {
            pattern.push(unitMs)
          }
        }
        triggerHaptics(pattern)
      }

      for (const symbol of code) {
        const duration = symbol === '.' ? unitSeconds : unitSeconds * 3
        scheduleToneEnvelope(gain, currentTime, duration, rampSeconds)
        currentTime += duration + unitSeconds
      }

      oscillator.start(context.currentTime)
      oscillator.stop(currentTime + 0.05)
      oscillator.onended = () => {
        if (listenPlaybackRef.current?.oscillator === oscillator) {
          listenPlaybackRef.current = null
        }
        oscillator.disconnect()
        gain.disconnect()
      }
    },
    [
      ensureAudioContext,
      listenWpm,
      stopListenPlayback,
      triggerHaptics,
      useCustomKeyboard,
    ],
  )

  useEffect(() => {
    return () => {
      clearTimer(errorTimeoutRef)
      clearTimer(successTimeoutRef)
      clearTimer(letterTimeoutRef)
      clearTimer(wordSpaceTimeoutRef)
      clearTimer(listenTimeoutRef)
      clearTimer(saveProgressTimeoutRef)
      stopListenPlayback()
      if (oscillatorRef.current) {
        oscillatorRef.current.stop()
        oscillatorRef.current.disconnect()
      }
      if (gainRef.current) {
        gainRef.current.disconnect()
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [stopListenPlayback])

  const resetListenState = useCallback(() => {
    clearTimer(listenTimeoutRef)
    setListenStatus('idle')
    setListenReveal(null)
  }, [])

  useEffect(() => {
    if (showHint || isFreestyle || isListen) {
      return
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return
      }
      if (event.key.toLowerCase() !== 'n') {
        return
      }
      if (showHintOnce) {
        return
      }
      event.preventDefault()
      setShowHintOnce(true)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isFreestyle, isListen, showHint, showHintOnce])

  const applyModeChange = useCallback(
    (nextMode: 'practice' | 'freestyle' | 'listen') => {
      setMode(nextMode)
      stopListenPlayback()
      setFreestyleInput('')
      setFreestyleResult(null)
      setFreestyleWord('')
      clearTimer(letterTimeoutRef)
      clearTimer(wordSpaceTimeoutRef)
      setInput('')
      setStatus('idle')
      setShowHintOnce(false)
      resetListenState()
      if (nextMode === 'freestyle') {
        return
      }
      if (nextMode === 'listen') {
        const nextLetter = availableLetters.includes(letter)
          ? letter
          : pickWeightedLetter(availableLetters, scores)
        setLetter(nextLetter)
        void playListenSequence(MORSE_DATA[nextLetter].code)
        return
      }
      setLetter((current) =>
        availableLetters.includes(current)
          ? current
          : pickWeightedLetter(availableLetters, scores),
      )
    },
    [
      availableLetters,
      letter,
      playListenSequence,
      resetListenState,
      scores,
      stopListenPlayback,
    ],
  )

  const handleModeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const { value } = event.target
    const nextMode =
      value === 'freestyle'
        ? 'freestyle'
        : value === 'listen'
          ? 'listen'
          : 'practice'
    applyModeChange(nextMode)
  }

  const handleShowHintToggle = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setShowHint(event.target.checked)
    },
    [],
  )

  const handleMaxLevelChange = useCallback(
    (nextLevel: number) => {
      setMaxLevel(nextLevel)
      setInput('')
      setStatus('idle')
      setShowHintOnce(false)
      resetListenState()
      const nextLetters = getLettersForLevel(nextLevel)
      const nextLetter = nextLetters.includes(letter)
        ? letter
        : pickWeightedLetter(nextLetters, scores)
      setLetter(nextLetter)
      if (isListen) {
        void playListenSequence(MORSE_DATA[nextLetter].code)
      }
    },
    [isListen, letter, playListenSequence, resetListenState, scores, setMaxLevel],
  )

  const handleMaxLevelSelectChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      handleMaxLevelChange(Number(event.target.value))
    },
    [handleMaxLevelChange],
  )

  const handleListenWpmChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      setListenWpm(Number(event.target.value))
    },
    [],
  )

  const handleSignIn = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (error) {
      const fallbackToRedirect =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error.code === 'auth/popup-blocked' ||
          error.code === 'auth/operation-not-supported-in-this-environment')
      if (fallbackToRedirect) {
        await signInWithRedirect(auth, googleProvider)
        return
      }
      console.error('Failed to sign in', error)
    }
  }, [])

  const handleSignOut = useCallback(async () => {
    try {
      await signOut(auth)
    } catch (error) {
      console.error('Failed to sign out', error)
    }
  }, [])

  const applyRemoteProgress = useCallback((raw: unknown) => {
    const progress = parseRemoteProgress(raw)
    if (!progress) {
      return
    }
    const nextScores = progress.scores ?? scoresRef.current
    if (progress.scores) {
      setScores(progress.scores)
    }
    if (typeof progress.showHint === 'boolean') {
      setShowHint(progress.showHint)
    }
    if (typeof progress.wordMode === 'boolean') {
      setFreestyleWordMode(progress.wordMode)
    }
    if (typeof progress.listenWpm === 'number') {
      setListenWpm(progress.listenWpm)
    }
    if (typeof progress.maxLevel === 'number') {
      const nextLetters = getLettersForLevel(progress.maxLevel)
      const currentLetter = letterRef.current
      const nextLetter = nextLetters.includes(currentLetter)
        ? currentLetter
        : pickWeightedLetter(nextLetters, nextScores, currentLetter)
      setMaxLevel(progress.maxLevel)
      setLetter(nextLetter)
    }
  }, [])

  useEffect(() => {
    if (!user) {
      return
    }
    const progressRef = ref(database, `users/${user.uid}/progress`)
    let isActive = true
    get(progressRef)
      .then((snapshot) => {
        if (!isActive) {
          return
        }
        if (snapshot.exists()) {
          applyRemoteProgress(snapshot.val())
        }
      })
      .catch((error) => {
        console.error('Failed to load progress', error)
      })
      .finally(() => {
        if (isActive) {
          setRemoteLoaded(true)
        }
      })
    return () => {
      isActive = false
    }
  }, [applyRemoteProgress, user])

  useEffect(() => {
    if (!user || !remoteLoaded) {
      return
    }
    clearTimer(saveProgressTimeoutRef)
    saveProgressTimeoutRef.current = window.setTimeout(() => {
      const progressRef = ref(database, `users/${user.uid}/progress`)
      void set(progressRef, {
        ...progressSnapshot,
        updatedAt: Date.now(),
      }).catch((error) => {
        console.error('Failed to save progress', error)
      })
    }, PROGRESS_SAVE_DEBOUNCE_MS)
    return () => {
      clearTimer(saveProgressTimeoutRef)
    }
  }, [progressSnapshot, remoteLoaded, user])

  const scheduleWordSpace = useCallback(() => {
    clearTimer(wordSpaceTimeoutRef)
    wordSpaceTimeoutRef.current = window.setTimeout(() => {
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

  const submitFreestyleInput = useCallback((value: string) => {
    if (!value) {
      setFreestyleResult('No input')
      return
    }
    const match = Object.entries(MORSE_DATA).find(
      ([, data]) => data.code === value,
    )
    const result = match ? match[0] : 'No match'
    if (result !== 'No match') {
      if (freestyleWordMode) {
        setFreestyleWord((prev) => prev + result)
        scheduleWordSpace()
      }
    }
    setFreestyleResult(result)
    setFreestyleInput('')
  }, [freestyleWordMode, scheduleWordSpace])

  const scheduleLetterReset = useCallback(
    (nextMode: 'practice' | 'freestyle') => {
      clearTimer(letterTimeoutRef)
      letterTimeoutRef.current = window.setTimeout(() => {
        if (nextMode === 'freestyle') {
          submitFreestyleInput(freestyleInputRef.current)
          return
        }
        clearTimer(errorTimeoutRef)
        clearTimer(successTimeoutRef)
        startErrorLockout()
        if (canScoreAttempt()) {
          bumpScore(letter, -1)
        }
        setStatus('error')
        setInput('')
        errorTimeoutRef.current = window.setTimeout(() => {
          setStatus('idle')
        }, ERROR_LOCKOUT_MS)
      }, INTER_CHAR_GAP_MS)
    },
    [bumpScore, canScoreAttempt, letter, startErrorLockout, submitFreestyleInput],
  )

  const handleFreestyleClear = useCallback(() => {
    clearTimer(letterTimeoutRef)
    clearTimer(wordSpaceTimeoutRef)
    setFreestyleResult(null)
    setFreestyleInput('')
    setFreestyleWord('')
  }, [])

  const handleFreestyleBackspace = useCallback(() => {
    clearTimer(letterTimeoutRef)
    clearTimer(wordSpaceTimeoutRef)
    setFreestyleResult(null)
    if (freestyleInputRef.current) {
      setFreestyleInput((prev) => {
        const next = prev.slice(0, -1)
        freestyleInputRef.current = next
        return next
      })
      return
    }
    if (!freestyleWordModeRef.current) {
      return
    }
    setFreestyleWord((prev) => {
      const trimmed = prev.replace(/\s+$/, '')
      if (!trimmed) {
        return ''
      }
      return trimmed.slice(0, -1)
    })
  }, [])

  const handleWordModeChange = useCallback(
    (nextValue: boolean) => {
      setFreestyleWordMode(nextValue)
      handleFreestyleClear()
    },
    [handleFreestyleClear],
  )

  const handleWordModeToggle = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      handleWordModeChange(event.target.checked)
    },
    [handleWordModeChange],
  )

  const submitListenAnswer = useCallback(
    (value: Letter) => {
      if (listenStatus !== 'idle') {
        return
      }
      if (!/^[A-Z0-9]$/.test(value)) {
        return
      }
      if (useCustomKeyboard) {
        triggerHaptics(10)
      }
      clearTimer(listenTimeoutRef)
      stopListenPlayback()
      const isCorrect = value === letter
      setListenStatus(isCorrect ? 'success' : 'error')
      setListenReveal(letter)
      bumpScore(letter, isCorrect ? 1 : -1)
      listenTimeoutRef.current = window.setTimeout(() => {
        const nextLetter = pickWeightedLetter(availableLetters, scores, letter)
        setListenStatus('idle')
        setListenReveal(null)
        setLetter(nextLetter)
        void playListenSequence(MORSE_DATA[nextLetter].code)
      }, isCorrect ? 650 : ERROR_LOCKOUT_MS)
    },
    [
      availableLetters,
      bumpScore,
      letter,
      listenStatus,
      playListenSequence,
      scores,
      stopListenPlayback,
      triggerHaptics,
      useCustomKeyboard,
    ],
  )

  const handleListenReplay = useCallback(() => {
    if (listenStatus !== 'idle') {
      return
    }
    setListenReveal(null)
    if (useCustomKeyboard) {
      triggerHaptics(12)
    }
    void playListenSequence(MORSE_DATA[letter].code)
  }, [letter, listenStatus, playListenSequence, triggerHaptics, useCustomKeyboard])

  const handleSoundCheck = useCallback(async () => {
    if (soundCheckStatus !== 'idle') {
      return
    }
    setSoundCheckStatus('playing')
    const context = await ensureAudioContext()
    const { oscillator, gain } = createToneNodes(context, 0)
    const startTime = context.currentTime + 0.02
    const duration = 0.25
    scheduleToneEnvelope(gain, startTime, duration, 0.02, false)
    oscillator.start(startTime)
    oscillator.stop(startTime + duration + 0.02)
    oscillator.onended = () => {
      oscillator.disconnect()
      gain.disconnect()
      setSoundCheckStatus('idle')
    }
    if (useCustomKeyboard) {
      triggerHaptics([40, 40, 40])
    }
  }, [ensureAudioContext, soundCheckStatus, triggerHaptics, useCustomKeyboard])

  useEffect(() => {
    if (!isFreestyle) {
      return
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return
      }
      if (event.key.toLowerCase() !== 'n') {
        return
      }
      event.preventDefault()
      handleFreestyleClear()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleFreestyleClear, isFreestyle])

  useEffect(() => {
    if (isListen) {
      return
    }
    const handleShortcut = (event: KeyboardEvent) => {
      if (showReference) {
        return
      }
      if (shouldIgnoreShortcutEvent(event)) {
        return
      }
      const key = event.key.toLowerCase()
      if (key === 'f') {
        event.preventDefault()
        applyModeChange('freestyle')
        return
      }
      if (key === 'i') {
        event.preventDefault()
        applyModeChange('listen')
        return
      }
      if (key === 'l') {
        event.preventDefault()
        applyModeChange('practice')
        return
      }
      if (key === 'h') {
        if (mode === 'practice') {
          event.preventDefault()
          setShowHint((prev) => !prev)
        }
        return
      }
      if (key === 'w') {
        if (mode === 'freestyle') {
          event.preventDefault()
          handleWordModeChange(!freestyleWordMode)
        }
        return
      }
      if (event.key === 'Backspace') {
        if (mode === 'freestyle') {
          event.preventDefault()
          handleFreestyleBackspace()
        }
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => {
      window.removeEventListener('keydown', handleShortcut)
    }
  }, [
    applyModeChange,
    freestyleWordMode,
    handleFreestyleBackspace,
    handleWordModeChange,
    isListen,
    mode,
    showReference,
  ])

  const registerSymbol = useCallback((symbol: '.' | '-') => {
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

    setInput((prev) => {
      const next = prev + symbol
      const target = MORSE_DATA[letter].code

      if (!target.startsWith(next)) {
        startErrorLockout()
        if (canScoreAttempt()) {
          bumpScore(letter, -1)
        }
        setStatus('error')
        errorTimeoutRef.current = window.setTimeout(() => {
          setStatus('idle')
        }, ERROR_LOCKOUT_MS)
        return ''
      }

      if (next === target) {
        if (canScoreAttempt()) {
          bumpScore(letter, 1)
        }
        setStatus('success')
        successTimeoutRef.current = window.setTimeout(() => {
          setLetter((current) =>
            pickWeightedLetter(availableLetters, scores, current),
          )
          setShowHintOnce(false)
          setStatus('idle')
        }, 650)
        return ''
      }

      setStatus('idle')
      scheduleLetterReset('practice')
      return next
    })
  }, [
    availableLetters,
    bumpScore,
    canScoreAttempt,
    isErrorLocked,
    isFreestyle,
    letter,
    scheduleLetterReset,
    scores,
    setLetter,
    setShowHintOnce,
    startErrorLockout,
  ])

  const beginPress = useCallback(() => {
    if (pressStartRef.current !== null) {
      return false
    }
    clearTimer(letterTimeoutRef)
    clearTimer(wordSpaceTimeoutRef)
    setIsPressing(true)
    pressStartRef.current = performance.now()
    void startTone()
    return true
  }, [startTone])

  const releasePress = useCallback(
    (register: boolean) => {
      setIsPressing(false)
      const start = pressStartRef.current
      pressStartRef.current = null
      if (!register || start === null) {
        stopTone()
        return
      }
      const duration = performance.now() - start
      registerSymbol(duration < DOT_THRESHOLD_MS ? '.' : '-')
      stopTone()
    },
    [registerSymbol, stopTone],
  )

  const handlePointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    if (event.button !== 0) {
      return
    }
    if (event.pointerType === 'touch') {
      event.preventDefault()
    }
    if (!isFreestyle && isErrorLocked()) {
      return
    }
    if (!beginPress()) {
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'touch') {
      event.preventDefault()
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (pressStartRef.current === null) {
      return
    }
    releasePress(true)
  }

  const handlePointerCancel = () => {
    if (pressStartRef.current === null) {
      return
    }
    releasePress(false)
    const hasInput = isFreestyle ? freestyleInput : input
    if (hasInput) {
      scheduleLetterReset(isFreestyle ? 'freestyle' : 'practice')
    }
  }

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (showReferenceRef.current) {
        return
      }
      if (isFreestyle || isListen) {
        return
      }
      if (isErrorLocked()) {
        return
      }
      if (event.repeat) {
        return
      }
      if (event.code !== 'Space' && event.key !== ' ') {
        return
      }
      event.preventDefault()
      beginPress()
    }

    const handleGlobalKeyUp = (event: KeyboardEvent) => {
      if (showReferenceRef.current) {
        return
      }
      if (isFreestyle || isListen) {
        return
      }
      if (event.code !== 'Space' && event.key !== ' ') {
        return
      }
      event.preventDefault()
      if (pressStartRef.current === null) {
        return
      }
      releasePress(true)
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    window.addEventListener('keyup', handleGlobalKeyUp)
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown)
      window.removeEventListener('keyup', handleGlobalKeyUp)
    }
  }, [beginPress, isErrorLocked, isFreestyle, isListen, releasePress])

  useEffect(() => {
    if (!isListen) {
      return
    }
    const handleListenKey = (event: KeyboardEvent) => {
      if (showReferenceRef.current) {
        return
      }
      if (shouldIgnoreShortcutEvent(event)) {
        return
      }
      if (event.code === 'Space' || event.key === ' ') {
        event.preventDefault()
        handleListenReplay()
        return
      }
      if (event.key.length !== 1) {
        return
      }
      const next = event.key.toUpperCase()
      if (!/^[A-Z0-9]$/.test(next)) {
        return
      }
      event.preventDefault()
      submitListenAnswer(next as Letter)
    }
    window.addEventListener('keydown', handleListenKey)
    return () => {
      window.removeEventListener('keydown', handleListenKey)
    }
  }, [handleListenReplay, isListen, submitListenAnswer])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.repeat) {
      return
    }
    if (event.key !== ' ' && event.key !== 'Enter') {
      return
    }
    if (!isFreestyle && isErrorLocked()) {
      return
    }
    event.preventDefault()
    beginPress()
  }

  const handleKeyUp = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== ' ' && event.key !== 'Enter') {
      return
    }
    event.preventDefault()
    if (pressStartRef.current === null) {
      return
    }
    releasePress(true)
  }

  const hintVisible = !isFreestyle && !isListen && (showHint || showHintOnce)
  const target = MORSE_DATA[letter].code
  const mnemonic = MORSE_DATA[letter].mnemonic
  const statusText =
    status === 'success'
      ? 'Correct'
      : status === 'error'
        ? 'Missed. Start over.'
        : hintVisible
          ? mnemonic
          : ' '
  const targetSymbols = target.split('')
  const highlightCount =
    status === 'success' ? targetSymbols.length : input.length
  const pips = targetSymbols.map((symbol, index) => {
    const isHit = index < highlightCount
    return (
      <span
        key={`${symbol}-${index}`}
        className={`pip ${symbol === '.' ? 'dot' : 'dash'} ${
          isHit ? 'hit' : 'expected'
        }`}
      />
    )
  })
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
      : ''
  const hasFreestyleDisplay = freestyleWordMode
    ? Boolean(freestyleWord) || (freestyleResult !== null && !isLetterResult)
    : Boolean(freestyleResult)
  const listenStatusText =
    listenStatus === 'success'
      ? 'Correct'
      : listenStatus === 'error'
        ? 'Incorrect'
        : 'Listen and type the character'
  const listenDisplay = listenReveal ?? '?'
  const listenDisplayClass = `letter ${
    listenReveal ? '' : 'letter-placeholder'
  }`
  const listenFocused = isListen && useCustomKeyboard
  const userLabel = user ? user.displayName ?? user.email ?? 'Signed in' : ''
  const userInitial = user ? (userLabel ? userLabel[0].toUpperCase() : '?') : ''

  return (
    <div
      className={`app status-${status} mode-${mode}${
        listenFocused ? ' listen-focused' : ''
      }`}
    >
      <header className="top-bar">
        <div className="logo">
          <img src="/Dit-logo.svg" alt="Dit" />
        </div>
        <select
          className="mode-select"
          value={mode}
          onChange={handleModeChange}
          aria-label="Mode"
        >
          <option value="practice">Practice</option>
          <option value="freestyle">Freestyle</option>
          <option value="listen">Listen</option>
        </select>
        <div className="settings">
          <button
            type="button"
            className="settings-button"
            onClick={() => setShowSettings((prev) => !prev)}
            aria-expanded={showSettings}
            aria-controls="settings-panel"
            aria-label="Settings"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.07-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.14 7.14 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.58.22-1.12.52-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.66 8.86a.5.5 0 0 0 .12.64l2.03 1.58c-.05.31-.07.63-.07.94s.02.63.07.94L2.71 14.5a.5.5 0 0 0-.12.64l1.92 3.32c.13.23.4.32.64.22l2.39-.96c.5.41 1.05.73 1.63.94l.36 2.54c.05.24.26.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.58-.22 1.12-.52 1.63-.94l2.39.96c.24.1.51 0 .64-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.56Zm-7.14 2.56a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"
                fill="currentColor"
              />
            </svg>
          </button>
          {showSettings ? (
            <SettingsPanel
              showHint={showHint}
              onShowHintChange={handleShowHintToggle}
              isFreestyle={isFreestyle}
              isListen={isListen}
              levels={LEVELS}
              maxLevel={maxLevel}
              onMaxLevelChange={handleMaxLevelSelectChange}
              listenWpm={listenWpm}
              listenWpmMin={LISTEN_WPM_MIN}
              listenWpmMax={LISTEN_WPM_MAX}
              onListenWpmChange={handleListenWpmChange}
              onShowReference={() => setShowReference(true)}
              freestyleWordMode={freestyleWordMode}
              onWordModeChange={handleWordModeToggle}
              onSoundCheck={handleSoundCheck}
              soundCheckStatus={soundCheckStatus}
              user={user}
              userLabel={userLabel}
              userInitial={userInitial}
              authReady={authReady}
              onSignIn={handleSignIn}
              onSignOut={handleSignOut}
            />
          ) : null}
        </div>
      </header>
      <StageDisplay
        freestyleDisplay={freestyleDisplay}
        hasFreestyleDisplay={hasFreestyleDisplay}
        hintVisible={hintVisible}
        isFreestyle={isFreestyle}
        isListen={isListen}
        letter={letter}
        listenDisplay={listenDisplay}
        listenDisplayClass={listenDisplayClass}
        listenStatusText={listenStatusText}
        pips={pips}
        statusText={statusText}
        target={target}
      />
      <div className="controls">
        {isFreestyle ? (
          <>
            <div className="freestyle-status" aria-live="polite">
              {freestyleStatus}
            </div>
            <button
              type="button"
              className="hint-button submit-button"
              onClick={handleFreestyleClear}
            >
              Clear
            </button>
          </>
        ) : null}
        {!showHint && !isFreestyle && !isListen ? (
          <button
            type="button"
            className="hint-button"
            onClick={() => setShowHintOnce(true)}
            disabled={showHintOnce}
          >
            Show this hint
          </button>
        ) : null}
        {isListen ? (
          <ListenControls
            listenStatus={listenStatus}
            onReplay={handleListenReplay}
            onSubmitAnswer={submitListenAnswer}
            useCustomKeyboard={useCustomKeyboard}
          />
        ) : (
          <MorseButton
            buttonRef={morseButtonRef}
            isPressing={isPressing}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onPointerLeave={handlePointerCancel}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onBlur={handlePointerCancel}
          />
        )}
      </div>
      {showReference ? (
        <ReferenceModal
          letters={REFERENCE_LETTERS}
          morseData={MORSE_DATA}
          numbers={REFERENCE_NUMBERS}
          onClose={() => setShowReference(false)}
          onResetScores={handleResetScores}
          scores={scores}
        />
      ) : null}
    </div>
  )
}

export default App
