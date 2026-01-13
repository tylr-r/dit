import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { MORSE_DATA, type Letter } from './data/morse'

const LETTERS = Object.keys(MORSE_DATA) as Letter[]
const DOT_THRESHOLD_MS = 200

const pickNewLetter = (previous?: Letter): Letter => {
  if (!previous) {
    return LETTERS[Math.floor(Math.random() * LETTERS.length)]
  }
  let next = previous
  while (next === previous) {
    next = LETTERS[Math.floor(Math.random() * LETTERS.length)]
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
  const [letter, setLetter] = useState<Letter>(() => pickNewLetter())
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [isPressing, setIsPressing] = useState(false)
  const [showHint, setShowHint] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mode, setMode] = useState<'learn' | 'freestyle'>('learn')
  const [showHintOnce, setShowHintOnce] = useState(false)
  const [freestyleInput, setFreestyleInput] = useState('')
  const [freestyleResult, setFreestyleResult] = useState<string | null>(null)
  const [freestyleWordMode, setFreestyleWordMode] = useState(false)
  const [freestyleWord, setFreestyleWord] = useState('')
  const freestyleInputRef = useRef('')
  const pressStartRef = useRef<number | null>(null)
  const errorTimeoutRef = useRef<number | null>(null)
  const successTimeoutRef = useRef<number | null>(null)
  const letterTimeoutRef = useRef<number | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const oscillatorRef = useRef<OscillatorNode | null>(null)
  const gainRef = useRef<GainNode | null>(null)

  useEffect(() => {
    return () => {
      clearTimer(errorTimeoutRef)
      clearTimer(successTimeoutRef)
      clearTimer(letterTimeoutRef)
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

  const startTone = async () => {
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
  }

  const stopTone = () => {
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
  }

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

  const handleModeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextMode =
      event.target.value === 'freestyle' ? 'freestyle' : 'learn'
    setMode(nextMode)
    setFreestyleInput('')
    setFreestyleResult(null)
    setFreestyleWord('')
    clearTimer(letterTimeoutRef)
    if (nextMode === 'freestyle') {
      setInput('')
      setStatus('idle')
      setShowHintOnce(false)
    }
  }

  const submitFreestyleInput = (value: string) => {
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
      }
    }
    setFreestyleResult(result)
    setFreestyleInput('')
  }

  const scheduleLetterReset = (nextMode: 'learn' | 'freestyle') => {
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
    }, DOT_THRESHOLD_MS * 2)
  }

  const handleFreestyleClear = useCallback(() => {
    clearTimer(letterTimeoutRef)
    setFreestyleResult(null)
    setFreestyleInput('')
    setFreestyleWord('')
  }, [])

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

  const registerSymbol = (symbol: '.' | '-') => {
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
          setLetter((current) => pickNewLetter(current))
          setShowHintOnce(false)
          setStatus('idle')
        }, 650)
        return ''
      }

      setStatus('idle')
      scheduleLetterReset('learn')
      return next
    })
  }

  const releasePress = (register: boolean) => {
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
  }

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
      scheduleLetterReset(isFreestyle ? 'freestyle' : 'learn')
    }
  }

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
      ? 'Correct. New letter.'
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
    ? /^[A-Z]$/.test(freestyleResult)
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
      <div className="settings">
        <select
          className="mode-select"
          value={mode}
          onChange={handleModeChange}
          aria-label="Mode"
        >
          <option value="learn">Learn</option>
          <option value="freestyle">Freestyle</option>
        </select>
        <button
          type="button"
          className="settings-button"
          aria-label="Open settings"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen((prev) => !prev)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8Zm9.2 3.4c0-.4 0-.8-.1-1.2l-2.1-.3c-.2-.6-.4-1.1-.7-1.6l1.3-1.7c-.6-.7-1.3-1.4-2-2l-1.7 1.3c-.5-.3-1-.5-1.6-.7l-.3-2.1c-.4-.1-.8-.1-1.2-.1s-.8 0-1.2.1l-.3 2.1c-.6.2-1.1.4-1.6.7L6.4 5.7c-.7.6-1.4 1.3-2 2l1.3 1.7c-.3.5-.5 1-.7 1.6l-2.1.3c-.1.4-.1.8-.1 1.2s0 .8.1 1.2l2.1.3c.2.6.4 1.1.7 1.6L4.4 18c.6.7 1.3 1.4 2 2l1.7-1.3c.5.3 1 .5 1.6.7l.3 2.1c.4.1.8.1 1.2.1s.8 0 1.2-.1l.3-2.1c.6-.2 1.1-.4 1.6-.7l1.7 1.3c.7-.6 1.4-1.3 2-2l-1.3-1.7c.3-.5.5-1 .7-1.6l2.1-.3c.1-.4.1-.8.1-1.2Z"
              fill="currentColor"
            />
          </svg>
        </button>
        {settingsOpen ? (
          <div className="settings-panel" role="dialog" aria-label="Settings">
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
            {isFreestyle ? (
              <label className="toggle">
                <span className="toggle-label">Word mode</span>
                <input
                  className="toggle-input"
                  type="checkbox"
                  checked={freestyleWordMode}
                  onChange={(event) => {
                    setFreestyleWordMode(event.target.checked)
                    clearTimer(letterTimeoutRef)
                    setFreestyleInput('')
                    setFreestyleResult(null)
                    setFreestyleWord('')
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
          </span>
        </button>
      </div>
    </div>
  )
}

export default App
