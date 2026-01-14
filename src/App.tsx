import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { MORSE_DATA, type Letter } from './data/morse'

const LETTERS = Object.keys(MORSE_DATA) as Letter[]
const LEVELS = [1, 2, 3, 4] as const
const DOT_THRESHOLD_MS = 200
const UNIT_MS = DOT_THRESHOLD_MS
const INTER_CHAR_GAP_MS = UNIT_MS * 3
const WORD_GAP_MS = UNIT_MS * 7
const WORD_GAP_EXTRA_MS = WORD_GAP_MS - INTER_CHAR_GAP_MS
const STORAGE_KEYS = {
  mode: 'morse-mode',
  showHint: 'morse-show-hint',
  wordMode: 'morse-word-mode',
  maxLevel: 'morse-max-level',
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

const clearTimer = (ref: { current: number | null }) => {
  if (ref.current !== null) {
    window.clearTimeout(ref.current)
    ref.current = null
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
  const freestyleInputRef = useRef('')
  const freestyleWordModeRef = useRef(freestyleWordMode)
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
    if (mode !== 'characters') {
      return
    }
    setInput('')
    setStatus('idle')
    setShowHintOnce(false)
    setLetter((current) =>
      availableLetters.includes(current)
        ? current
        : pickNewLetter(availableLetters),
    )
  }, [availableLetters, mode])

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

  const applyModeChange = useCallback((nextMode: 'characters' | 'freestyle') => {
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
    }
  }, [])

  const handleModeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextMode =
      event.target.value === 'freestyle' ? 'freestyle' : 'characters'
    applyModeChange(nextMode)
  }

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
      setStatus('error')
      setInput('')
      errorTimeoutRef.current = window.setTimeout(() => {
        setStatus('idle')
      }, 700)
    }, INTER_CHAR_GAP_MS)
  }, [submitFreestyleInput, letterTimeoutRef, errorTimeoutRef, successTimeoutRef, setStatus, setInput])

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
  ])

  const registerSymbol = useCallback((symbol: '.' | '-') => {
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
        setStatus('error')
        errorTimeoutRef.current = window.setTimeout(() => {
          setStatus('idle')
        }, 700)
        return ''
      }

      if (next === target) {
        setStatus('success')
        successTimeoutRef.current = window.setTimeout(() => {
          setLetter((current) => pickNewLetter(availableLetters, current))
          setShowHintOnce(false)
          setStatus('idle')
        }, 650)
        return ''
      }

      setStatus('idle')
      scheduleLetterReset('characters')
      return next
    })
  }, [isFreestyle, setFreestyleInput, setFreestyleResult, setInput, setStatus, setLetter, setShowHintOnce, scheduleLetterReset, errorTimeoutRef, successTimeoutRef, letterTimeoutRef, letter, availableLetters])

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
  }, [releasePress, startTone])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.repeat) {
      return
    }
    if (event.key !== ' ' && event.key !== 'Enter') {
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
        <div className="settings-panel" role="group" aria-label="Settings">
          <label className="toggle">
            <span className="toggle-label">Show hint</span>
            <input
              className="toggle-input"
              type="checkbox"
              checked={showHint}
              onChange={(event) => setShowHint(event.target.checked)}
              disabled={isFreestyle}
            />
          </label>
          {!isFreestyle ? (
            <label className="toggle">
              <span className="toggle-label">Max level</span>
              <select
                className="panel-select"
                value={maxLevel}
                onChange={(event) => {
                  setMaxLevel(Number(event.target.value))
                }}
              >
                {LEVELS.map((level) => (
                  <option key={level} value={level}>
                    Level {level}
                  </option>
                ))}
              </select>
            </label>
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
    </div>
  )
}

export default App
