import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { DASH_THRESHOLD, DEBOUNCE_DELAY, MORSE_DATA } from '@dit/core'
import { startTone, stopTone } from '../utils/tone'
import { BackgroundGlow } from './BackgroundGlow'
import { DitLogo } from './DitLogo'
import { Footer } from './Footer'
import { MorseButton } from './MorseButton'
import { MorseLiquidSurface } from './MorseLiquidSurface'
import './HomePage.css'

/** Where the practice app lives. Swap to the app subdomain when it goes live. */
const WEB_APP_URL = '/app'

const APP_STORE_URL =
  'https://apps.apple.com/us/app/dit-practice-morse-code/id6758277876'

const CODE_TO_CHAR = Object.fromEntries(
  Object.entries(MORSE_DATA).map(([letter, { code }]) => [code, letter]),
)

const MAX_DECODED_LENGTH = 10

const SELLING_POINTS = [
  {
    title: 'Sound first',
    body: 'No charts. You build the reflex, not a translation habit.',
  },
  {
    title: 'Proven method',
    body: 'Koch speed and Farnsworth spacing, the way CW is really taught.',
  },
  {
    title: 'Tracks the reflex',
    body: 'Review by recognition speed per letter, not just accuracy.',
  },
  {
    title: 'Your pace',
    body: 'Small packs, no fixed lessons, no streak shame.',
  },
  {
    title: 'Paddle ready',
    body: 'VBand paddles work in Practice and Freestyle, iPhone and web.',
  },
  {
    title: 'No account needed',
    body: 'Open it and start. Sign in only to sync.',
  },
]

const METHOD_PRINCIPLES = [
  {
    term: 'Koch method',
    body: 'Characters play at full target speed from the first lesson. Slowing them down builds a crutch that never transfers, so the sound you learn is the sound you copy.',
  },
  {
    term: 'Farnsworth spacing',
    body: 'Only the silence between characters is stretched, giving you time to think. It narrows as you get faster, so you never relearn the letters at speed.',
  },
  {
    term: 'Adaptive review',
    body: 'Miss a character and it comes back later instead of stalling you. Dit tracks how fast you recognize each one and drills the slowest first, because speed is the real goal.',
  },
]

/**
 * Live Morse key demo: the app's real glass key wired to the shared tone
 * engine, decoding taps and holds the same way Freestyle does.
 */
function HomeKeyDemo() {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const pressStartRef = useRef<number | null>(null)
  const commitTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [isPressing, setIsPressing] = useState(false)
  const [symbols, setSymbols] = useState('')
  const [decoded, setDecoded] = useState('')
  const [hasKeyed, setHasKeyed] = useState(false)
  const [isCoarsePointer, setIsCoarsePointer] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return
    }
    const mediaQuery = window.matchMedia('(pointer: coarse)')
    const update = () => setIsCoarsePointer(mediaQuery.matches)
    update()
    mediaQuery.addEventListener('change', update)
    return () => mediaQuery.removeEventListener('change', update)
  }, [])

  useEffect(
    () => () => {
      clearTimeout(commitTimeout.current)
      void stopTone()
    },
    [],
  )

  const beginPress = () => {
    if (pressStartRef.current !== null) {
      return
    }
    clearTimeout(commitTimeout.current)
    pressStartRef.current = performance.now()
    setIsPressing(true)
    setHasKeyed(true)
    void startTone()
  }

  const endPress = () => {
    if (pressStartRef.current === null) {
      return
    }
    const heldMs = performance.now() - pressStartRef.current
    pressStartRef.current = null
    setIsPressing(false)
    void stopTone()
    const nextSymbols = symbols + (heldMs < DASH_THRESHOLD ? '.' : '-')
    setSymbols(nextSymbols)
    commitTimeout.current = setTimeout(() => {
      setSymbols('')
      setDecoded((prev) =>
        `${prev}${CODE_TO_CHAR[nextSymbols] ?? '?'}`.slice(-MAX_DECODED_LENGTH),
      )
    }, DEBOUNCE_DELAY)
  }

  const cancelPress = () => {
    if (pressStartRef.current === null) {
      return
    }
    pressStartRef.current = null
    setIsPressing(false)
    void stopTone()
  }

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    beginPress()
  }

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    endPress()
  }

  // Space keys the demo from anywhere on the page, mirroring the app; the
  // refs keep the once-registered listeners reading fresh state.
  const beginPressRef = useRef(beginPress)
  const endPressRef = useRef(endPress)
  useEffect(() => {
    beginPressRef.current = beginPress
    endPressRef.current = endPress
  })

  useEffect(() => {
    const handleWindowKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== ' ' || event.repeat) {
        return
      }
      event.preventDefault()
      beginPressRef.current()
    }
    const handleWindowKeyUp = (event: globalThis.KeyboardEvent) => {
      if (event.key !== ' ') {
        return
      }
      event.preventDefault()
      endPressRef.current()
    }
    window.addEventListener('keydown', handleWindowKeyDown)
    window.addEventListener('keyup', handleWindowKeyUp)
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown)
      window.removeEventListener('keyup', handleWindowKeyUp)
    }
  }, [])

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.repeat || event.key !== 'Enter') {
      return
    }
    event.preventDefault()
    beginPress()
  }

  const handleKeyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Enter') {
      return
    }
    event.preventDefault()
    endPress()
  }

  return (
    <div className="home-key">
      <div className="home-key-stage" aria-live="polite">
        <p className="home-key-decoded">{decoded}</p>
        <div className="home-key-symbols" aria-hidden="true">
          {symbols.split('').map((symbol, index) => (
            <span
              key={index}
              className={symbol === '.' ? 'home-key-dit' : 'home-key-dah'}
            />
          ))}
        </div>
      </div>
      <MorseButton
        buttonRef={buttonRef}
        isPressing={isPressing}
        onBlur={cancelPress}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onPointerCancel={cancelPress}
        onPointerDown={handlePointerDown}
        onPointerLeave={cancelPress}
        onPointerUp={handlePointerUp}
        showTapHint={isCoarsePointer && !hasKeyed}
        showShortcutHint={!isCoarsePointer}
      />
      <p className="home-key-hint">
        Tap <span>(dit)</span> Hold <span>(dah)</span>
      </p>
    </div>
  )
}

/** Public marketing homepage for Dit, served at the web root. */
export function HomePage() {
  return (
    <div className="home-page">
      <div className="home-bg" aria-hidden="true">
        <MorseLiquidSurface />
        <BackgroundGlow />
      </div>

      <div className="home-top">
        <p className="home-brand">
          <DitLogo />
          <span>Dit</span>
        </p>
        <nav className="home-nav" aria-label="Site">
          <a href={WEB_APP_URL}>Web app</a>
          <a href="/support">Support</a>
        </nav>
      </div>

      <header className="home-hero">
        <h1 className="home-title">Learn Morse code by&nbsp;ear.</h1>
        <p className="home-intro">
          Real rhythm from the first minute. No charts.
        </p>
        <div className="home-cta-row">
          <a className="home-cta" href={WEB_APP_URL}>
            Start practicing
          </a>
          <a className="home-cta-quiet" href={APP_STORE_URL}>
            Get the iPhone app
          </a>
        </div>
        <HomeKeyDemo />
      </header>

      <section className="home-why" aria-labelledby="home-why-title">
        <div className="home-why-inner">
          <header className="home-why-head">
            <p className="home-why-label">Why Dit</p>
            <h2 className="home-why-title" id="home-why-title">
              Built the way operators actually&nbsp;learn.
            </h2>
            <p className="home-why-sub">
              Practice, Freestyle, and Listen: three angles on one reflex.
            </p>
          </header>
          <ol className="home-why-list">
            {SELLING_POINTS.map((point, index) => (
              <li className="home-why-row" key={point.title}>
                <span className="home-why-index" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="home-why-copy">
                  <p className="home-why-point-title">{point.title}</p>
                  <p className="home-why-point-body">{point.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="home-method" aria-labelledby="home-method-title">
        <p className="home-method-label">The method</p>
        <h2 className="home-method-title" id="home-method-title">
          Why learning by ear&nbsp;works.
        </h2>
        <p className="home-method-lead">
          Skilled operators hear a character as one shape, the way you hear
          your name, not a string of dots to decode. Dit trains that reflex
          directly, on the fundamentals serious CW training is built on.
        </p>
        <ol className="home-method-steps">
          {METHOD_PRINCIPLES.map((principle, index) => (
            <li className="home-method-step" key={principle.term}>
              <span className="home-method-num">{index + 1}</span>
              <p className="home-method-step-title">{principle.term}</p>
              <p className="home-method-step-body">{principle.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="home-app" aria-labelledby="home-app-title">
        <div className="home-app-copy">
          <p className="home-app-label">On iPhone</p>
          <h2 className="home-app-title" id="home-app-title">
            Take Dit with&nbsp;you.
          </h2>
          <p className="home-app-body">
            Haptics that mirror the audio, daily reminders, and paddle
            support. Your progress syncs across devices.
          </p>
          <div className="home-app-get">
            <div className="home-app-qr" aria-hidden="true">
              <img src="/home/qr-appstore.svg" alt="" width="92" height="92" />
            </div>
            <div className="home-app-get-text">
              <p className="home-app-scan">Scan to download</p>
              <a
                className="home-app-badge"
                href={APP_STORE_URL}
                aria-label="Download Dit on the App Store"
              >
                <img
                  src="/home/app-store-badge.svg"
                  alt="Download on the App Store"
                  width="146"
                  height="50"
                />
              </a>
            </div>
          </div>
        </div>
        <div className="home-app-scene" aria-hidden="true">
          <div className="home-app-phone">
            <div
              className="home-app-screen"
              style={{ backgroundImage: 'url(/home/ios-screenshot-2.webp)' }}
            />
          </div>
        </div>
      </section>

      <section className="home-close">
        <div className="home-close-logo">
          <DitLogo />
        </div>
        <h2 className="home-close-title">Start by listening.</h2>
        <div className="home-cta-row home-cta-row-center">
          <a className="home-cta" href={WEB_APP_URL}>
            Start practicing
          </a>
          <a className="home-cta-quiet" href={APP_STORE_URL}>
            Get the iPhone app
          </a>
        </div>
        <p className="home-close-meta">
          No account needed · Koch method · Farnsworth timing
        </p>
      </section>

      <Footer />
    </div>
  )
}
