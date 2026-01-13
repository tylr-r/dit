import { useEffect, useRef, useState } from 'react'
import './App.css'
import { MORSE_DATA, type Letter } from './data/morse'

const LETTERS = Object.keys(MORSE_DATA) as Letter[]
const DOT_THRESHOLD_MS = 240

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
  const [showHintOnce, setShowHintOnce] = useState(false)
  const pressStartRef = useRef<number | null>(null)
  const errorTimeoutRef = useRef<number | null>(null)
  const successTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      clearTimer(errorTimeoutRef)
      clearTimer(successTimeoutRef)
    }
  }, [])

  useEffect(() => {
    if (showHint) {
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
  }, [showHint, showHintOnce])

  const registerSymbol = (symbol: '.' | '-') => {
    clearTimer(errorTimeoutRef)
    clearTimer(successTimeoutRef)

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
      return next
    })
  }

  const releasePress = (register: boolean) => {
    setIsPressing(false)
    const start = pressStartRef.current
    pressStartRef.current = null
    if (!register || start === null) {
      return
    }
    const duration = performance.now() - start
    registerSymbol(duration < DOT_THRESHOLD_MS ? '.' : '-')
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
    setIsPressing(true)
    pressStartRef.current = performance.now()
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
    setIsPressing(true)
    pressStartRef.current = performance.now()
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

  const target = MORSE_DATA[letter].code
  const mnemonic = MORSE_DATA[letter].mnemonic
  const statusText =
    status === 'success'
      ? 'Correct. New letter.'
      : status === 'error'
        ? 'Missed. Start over.'
        : mnemonic
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
  const hintVisible = showHint || showHintOnce

  return (
    <div className={`app status-${status}`}>
      <div className="settings">
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
              />
            </label>
          </div>
        ) : null}
      </div>
      <main className="stage">
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
      </main>
      <div className="controls">
        {!showHint ? (
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
