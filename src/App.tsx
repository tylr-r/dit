import { useEffect, useRef, useState } from 'react'
import './App.css'

const MORSE_MAP = {
  A: '.-',
  B: '-...',
  C: '-.-.',
  D: '-..',
  E: '.',
  F: '..-.',
  G: '--.',
  H: '....',
  I: '..',
  J: '.---',
  K: '-.-',
  L: '.-..',
  M: '--',
  N: '-.',
  O: '---',
  P: '.--.',
  Q: '--.-',
  R: '.-.',
  S: '...',
  T: '-',
  U: '..-',
  V: '...-',
  W: '.--',
  X: '-..-',
  Y: '-.--',
  Z: '--..',
} as const

type Letter = keyof typeof MORSE_MAP

const LETTERS = Object.keys(MORSE_MAP) as Letter[]
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
  const pressStartRef = useRef<number | null>(null)
  const errorTimeoutRef = useRef<number | null>(null)
  const successTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      clearTimer(errorTimeoutRef)
      clearTimer(successTimeoutRef)
    }
  }, [])

  const registerSymbol = (symbol: '.' | '-') => {
    clearTimer(errorTimeoutRef)
    clearTimer(successTimeoutRef)

    setInput((prev) => {
      const next = prev + symbol
      const target = MORSE_MAP[letter]

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

  const statusText =
    status === 'success'
      ? 'Correct. New letter.'
      : status === 'error'
        ? 'Missed. Start over.'
        : 'Tap for dot, hold for dash.'

  const target = MORSE_MAP[letter]
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

  return (
    <div className={`app status-${status}`}>
      <main className="stage">
        <div key={letter} className="letter">
          {letter}
        </div>
        <div className="progress" aria-label={`Target ${target}`}>
          {pips}
        </div>
        <p className="status-text" aria-live="polite">
          {statusText}
        </p>
      </main>
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
  )
}

export default App
