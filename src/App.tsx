import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { MORSE_DATA, type Letter } from './data/morse'

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
const INTER_CHAR_GAP_MS = UNIT_MS * 3
const WORD_GAP_MS = UNIT_MS * 7
const WORD_GAP_EXTRA_MS = WORD_GAP_MS - INTER_CHAR_GAP_MS
const SCORE_INTENSITY_MAX = 15
const ERROR_LOCKOUT_MS = 1000
const STORAGE_KEYS = {
  mode: 'morse-mode',
  showHint: 'morse-show-hint',
  wordMode: 'morse-word-mode',
  maxLevel: 'morse-max-level',
  scores: 'morse-scores',
}

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
  const clamped = Math.max(min, Math.min(max, Math.round(parsed)))
  return clamped
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

function App() {
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
  const [mode, setMode] = useState<'characters' | 'freestyle'>(() => {
    if (typeof window === 'undefined') {
      return 'characters'
    }
    const stored = window.localStorage.getItem(STORAGE_KEYS.mode)
    return stored === 'freestyle' ? 'freestyle' : 'characters'
  })
  const [showHintOnce, setShowHintOnce] = useState(false)
  const [freestyleInput, setFreestyleInput] = useState('')
  const [freestyleResult, setFreestyleResult] = useState<string | null>(null)
  const [freestyleWordMode, setFreestyleWordMode] = useState(() =>
    readStoredBoolean(STORAGE_KEYS.wordMode, false),
  )
  const [freestyleWord, setFreestyleWord] = useState('')
  const [showReference, setShowReference] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [scores, setScores] = useState(() => readStoredScores())
  const freestyleInputRef = useRef('')
  const freestyleWordModeRef = useRef(freestyleWordMode)
  const showReferenceRef = useRef(showReference)
  const errorLockoutUntilRef = useRef(0)
  const pressStartRef = useRef<number | null>(null)
  const errorTimeoutRef = useRef<number | null>(null)
  const successTimeoutRef = useRef<number | null>(null)
  const letterTimeoutRef = useRef<number | null>(null)
  const wordSpaceTimeoutRef = useRef<number | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const oscillatorRef = useRef<OscillatorNode | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const availableLetters = useMemo(
    () => getLettersForLevel(maxLevel),
    [maxLevel],
  )
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

  useEffect(() => {
    return () => {
      clearTimer(errorTimeoutRef)
      clearTimer(successTimeoutRef)
      clearTimer(letterTimeoutRef)
      clearTimer(wordSpaceTimeoutRef)
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
    if (typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(STORAGE_KEYS.mode, mode)
  }, [mode])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(STORAGE_KEYS.showHint, String(showHint))
  }, [showHint])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(
      STORAGE_KEYS.wordMode,
      String(freestyleWordMode),
    )
  }, [freestyleWordMode])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(STORAGE_KEYS.maxLevel, String(maxLevel))
  }, [maxLevel])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(STORAGE_KEYS.scores, JSON.stringify(scores))
  }, [scores])

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

  const startTone = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume()
    }
    if (oscillatorRef.current) {
      return
    }
    const oscillator = audioContextRef.current.createOscillator()
    const gain = audioContextRef.current.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = 640
    gain.gain.value = 0.06
    oscillator.connect(gain)
    gain.connect(audioContextRef.current.destination)
    oscillator.start()
    oscillatorRef.current = oscillator
    gainRef.current = gain
  }, [])

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

  const isFreestyle = mode === 'freestyle'

  useEffect(() => {
    if (showHint || isFreestyle) {
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
  }, [isFreestyle, showHint, showHintOnce])

  const applyModeChange = useCallback(
    (nextMode: 'characters' | 'freestyle') => {
      setMode(nextMode)
      setFreestyleInput('')
      setFreestyleResult(null)
      setFreestyleWord('')
      clearTimer(letterTimeoutRef)
      clearTimer(wordSpaceTimeoutRef)
      if (nextMode === 'freestyle') {
        setInput('')
        setStatus('idle')
        setShowHintOnce(false)
        return
      }
      setInput('')
      setStatus('idle')
      setShowHintOnce(false)
      setLetter((current) =>
        availableLetters.includes(current)
          ? current
          : pickWeightedLetter(availableLetters, scores),
      )
    },
    [availableLetters, scores],
  )

  const handleModeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextMode =
      event.target.value === 'freestyle' ? 'freestyle' : 'characters'
    applyModeChange(nextMode)
  }

  const handleMaxLevelChange = useCallback(
    (nextLevel: number) => {
      setMaxLevel(nextLevel)
      setInput('')
      setStatus('idle')
      setShowHintOnce(false)
      const nextLetters = getLettersForLevel(nextLevel)
      setLetter((current) =>
        nextLetters.includes(current)
          ? current
          : pickWeightedLetter(nextLetters, scores),
      )
    },
    [scores, setMaxLevel],
  )

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

  const scheduleLetterReset = useCallback((nextMode: 'characters' | 'freestyle') => {
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
  }, [bumpScore, canScoreAttempt, startErrorLockout, submitFreestyleInput, letter, letterTimeoutRef, errorTimeoutRef, successTimeoutRef, setStatus, setInput])

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
    const handleShortcut = (event: KeyboardEvent) => {
      if (showReference) {
        return
      }
      if (event.repeat) {
        return
      }
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return
      }
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.isContentEditable ||
          target.tagName === 'INPUT' ||
          target.tagName === 'SELECT' ||
          target.tagName === 'TEXTAREA')
      ) {
        return
      }
      const key = event.key.toLowerCase()
      if (key === 'f') {
        event.preventDefault()
        applyModeChange('freestyle')
        return
      }
      if (key === 'l') {
        event.preventDefault()
        applyModeChange('characters')
        return
      }
      if (key === 'h') {
        if (mode === 'characters') {
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
      scheduleLetterReset('characters')
      return next
    })
  }, [isFreestyle, isErrorLocked, startErrorLockout, bumpScore, canScoreAttempt, setFreestyleInput, setFreestyleResult, setInput, setStatus, setLetter, setShowHintOnce, scheduleLetterReset, errorTimeoutRef, successTimeoutRef, letterTimeoutRef, letter, availableLetters, scores])

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
    if (!isFreestyle && isErrorLocked()) {
      return
    }
    if (pressStartRef.current !== null) {
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    clearTimer(letterTimeoutRef)
    clearTimer(wordSpaceTimeoutRef)
    setIsPressing(true)
    pressStartRef.current = performance.now()
    void startTone()
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
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
      scheduleLetterReset(isFreestyle ? 'freestyle' : 'characters')
    }
  }

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (showReferenceRef.current) {
        return
      }
      if (!isFreestyle && isErrorLocked()) {
        return
      }
      if (event.repeat) {
        return
      }
      if (event.code !== 'Space' && event.key !== ' ') {
        return
      }
      event.preventDefault()
      if (pressStartRef.current !== null) {
        return
      }
      clearTimer(letterTimeoutRef)
      clearTimer(wordSpaceTimeoutRef)
      setIsPressing(true)
      pressStartRef.current = performance.now()
      void startTone()
    }

    const handleGlobalKeyUp = (event: KeyboardEvent) => {
      if (showReferenceRef.current) {
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
  }, [isErrorLocked, isFreestyle, releasePress, startTone])

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
    if (pressStartRef.current !== null) {
      return
    }
    clearTimer(letterTimeoutRef)
    clearTimer(wordSpaceTimeoutRef)
    setIsPressing(true)
    pressStartRef.current = performance.now()
    void startTone()
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

  const hintVisible = !isFreestyle && (showHint || showHintOnce)
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
  const formatScore = (value: number) =>
    value > 0 ? `+${value}` : `${value}`
  const getScoreStyle = (
    scoreValue: number,
  ): React.CSSProperties | undefined => {
    if (scoreValue === 0) {
      return
    }
    const normalized = Math.abs(scoreValue) / SCORE_INTENSITY_MAX
    const intensity = Math.min(Math.max(normalized, 0.2), 1)
    const alpha = 0.35 * intensity
    const tint = scoreValue > 0 ? '56, 242, 162' : '255, 90, 96'
    return {
      '--score-tint': tint,
      '--score-alpha': String(alpha),
    } as React.CSSProperties
  }
  return (
    <div className={`app status-${status}`}>
      <div className="logo">
        <img src="/DitDot-logo.svg" alt="DitDot" />
      </div>
      <select
        className="mode-select"
        value={mode}
        onChange={handleModeChange}
        aria-label="Mode"
      >
        <option value="characters">Characters</option>
        <option value="freestyle">Freestyle</option>
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
          <div
            className="settings-panel"
            role="group"
            aria-label="Settings"
            id="settings-panel"
          >
            <label className="toggle">
              <span className="toggle-label">Show hints</span>
              <input
                className="toggle-input"
                type="checkbox"
                checked={showHint}
                onChange={(event) => setShowHint(event.target.checked)}
                disabled={isFreestyle}
              />
            </label>
            {!isFreestyle ? (
              <div className="panel-group">
                <label className="toggle">
                  <span className="toggle-label">Max level</span>
                  <select
                    className="panel-select"
                    value={maxLevel}
                    onChange={(event) => {
                      handleMaxLevelChange(Number(event.target.value))
                    }}
                  >
                    {LEVELS.map((level) => (
                      <option key={level} value={level}>
                        Level {level}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="panel-button"
                  onClick={() => setShowReference(true)}
                >
                  Reference
                </button>
              </div>
            ) : null}
            {isFreestyle ? (
            <label className="toggle">
              <span className="toggle-label">Word mode</span>
              <input
                className="toggle-input"
                type="checkbox"
                checked={freestyleWordMode}
                onChange={(event) => {
                  handleWordModeChange(event.target.checked)
                }}
              />
            </label>
            ) : null}
          </div>
        ) : null}
      </div>
      <main className="stage">
        {isFreestyle ? (
          <div
            className={`letter ${
              hasFreestyleDisplay ? '' : 'letter-placeholder'
            }`}
            aria-live="polite"
          >
            {freestyleDisplay}
          </div>
        ) : (
          <>
            <div key={letter} className="letter">
              {letter}
            </div>
            {hintVisible ? (
              <div className="progress" aria-label={`Target ${target}`}>
                {pips}
              </div>
            ) : (
              <div className="progress progress-hidden" aria-hidden="true" />
            )}
            <p className="status-text" aria-live="polite">
              {statusText}
            </p>
          </>
        )}
      </main>
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
        {!showHint && !isFreestyle ? (
          <button
            type="button"
            className="hint-button"
            onClick={() => setShowHintOnce(true)}
            disabled={showHintOnce}
          >
            Show this hint
          </button>
        ) : null}
        <button
          type="button"
          className={`morse-button ${isPressing ? 'pressing' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onPointerLeave={handlePointerCancel}
          onContextMenu={(event) => event.preventDefault()}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onBlur={handlePointerCancel}
          aria-label="Tap for dot, hold for dash"
        >
          <span className="button-content" aria-hidden="true">
            <span className="signal dot" />
            <span className="signal dash" />
            <span className="signal dot" />
          </span>
        </button>
      </div>
      {showReference ? (
        <div
          className="modal-overlay"
          onClick={() => setShowReference(false)}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Morse reference"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title">Reference</div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="modal-close modal-reset"
                  onClick={handleResetScores}
                >
                  Reset scores
                </button>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setShowReference(false)}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="reference-grid">
              {REFERENCE_LETTERS.map((char) => {
                const scoreValue = scores[char]
                const scoreClass =
                  scoreValue > 0
                    ? 'score-positive'
                    : scoreValue < 0
                      ? 'score-negative'
                      : 'score-neutral'
                return (
                  <div
                    key={char}
                    className="reference-card"
                    style={getScoreStyle(scoreValue)}
                  >
                    <div className="reference-head">
                      <div className="reference-letter">{char}</div>
                      <div className={`reference-score ${scoreClass}`}>
                        {formatScore(scoreValue)}
                      </div>
                    </div>
                    <div
                      className="reference-code"
                      aria-label={MORSE_DATA[char].code}
                    >
                      {MORSE_DATA[char].code.split('').map((symbol, index) => (
                        <span
                          key={`${char}-${index}`}
                          className="reference-symbol"
                        >
                          {symbol === '.'
                            ? '•'
                            : symbol === '-'
                              ? '—'
                              : symbol}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
              <div className="reference-row">
                {REFERENCE_NUMBERS.map((char) => {
                  const scoreValue = scores[char]
                  const scoreClass =
                    scoreValue > 0
                      ? 'score-positive'
                      : scoreValue < 0
                        ? 'score-negative'
                        : 'score-neutral'
                  return (
                    <div
                      key={char}
                      className="reference-card"
                      style={getScoreStyle(scoreValue)}
                    >
                      <div className="reference-head">
                        <div className="reference-letter">{char}</div>
                        <div className={`reference-score ${scoreClass}`}>
                          {formatScore(scoreValue)}
                        </div>
                      </div>
                      <div
                        className="reference-code"
                        aria-label={MORSE_DATA[char].code}
                      >
                        {MORSE_DATA[char].code.split('').map(
                          (symbol, index) => (
                            <span
                              key={`${char}-${index}`}
                              className="reference-symbol"
                            >
                              {symbol === '.'
                                ? '•'
                                : symbol === '-'
                                  ? '—'
                                  : symbol}
                            </span>
                          ),
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App
