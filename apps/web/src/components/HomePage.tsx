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

type WhyBand = {
  eyebrow: string
  headline: string
  body: string
  visual: 'reflex' | 'speed' | 'ttr'
  cite?: string
}

const WHY_BANDS: WhyBand[] = [
  {
    eyebrow: 'Recognition, not translation',
    headline: 'Fluent operators never count. Neither will you.',
    body: "Learn Morse off a chart and you build a step you can't undo: hear it, count the beats, look it up. That step is the ceiling on your speed. Dit skips it. Every letter is a sound you come to know on contact, the way you know your own name the moment someone says it.",
    visual: 'reflex',
  },
  {
    eyebrow: 'The method',
    headline: 'The same method serious operators have trusted for 90 years.',
    body: "In 1935 Ludwig Koch showed that letters have to be learned at full speed from the start. Slow them down and the muscle memory falls apart the moment real traffic speeds up. So Dit plays every letter at real speed and stretches only the silence between them, the way the ARRL's Farnsworth standard sets out. Those gaps close as you get faster.",
    cite: 'Koch, 1935 · ARRL Farnsworth timing standard',
    visual: 'speed',
  },
  {
    eyebrow: 'It tracks your speed',
    headline:
      "It can tell which letters you're still working out in your head.",
    body: 'You can answer every prompt right and still be slow, solving each one a half-second behind. Dit times how long a letter takes you to recognize and brings the slow ones around more often. The hesitation is what fades.',
    visual: 'ttr',
  },
]

const CONVENIENCES = [
  'No sign-up to start',
  'Your own pace, no streaks to keep',
  'Works with a paddle',
]

/** Recognition-speed rows for the stats screen: faster letters fill more. */
const RECOGNITION_ROWS = [
  { letter: 'E', pct: 94, time: '0.3s' },
  { letter: 'T', pct: 78, time: '0.5s' },
  { letter: 'I', pct: 60, time: '0.7s' },
  { letter: 'N', pct: 44, time: '1.0s' },
  { letter: 'R', pct: 28, time: '1.4s' },
]

/** The app's Practice screen: a prompted letter over the glass key. */
function PracticeScreen() {
  return (
    <div className="home-screen home-screen-practice">
      <span className="home-screen-pill">Practice</span>
      <span className="home-screen-glyph">R</span>
      <span className="home-screen-key" />
    </div>
  )
}

/** The app's playback settings: real character speed and tone controls. */
function SpeedScreen() {
  return (
    <div className="home-screen home-screen-settings">
      <span className="home-screen-label">Playback</span>
      <div className="home-screen-control">
        <div className="home-screen-control-head">
          <span>Letter speed</span>
          <span className="home-screen-value">12 WPM</span>
        </div>
        <div className="home-screen-slider">
          <span className="home-screen-slider-fill" style={{ width: '24%' }} />
          <span className="home-screen-knob" style={{ left: '24%' }} />
        </div>
      </div>
      <div className="home-screen-control">
        <div className="home-screen-control-head">
          <span>Tone pitch</span>
          <span className="home-screen-value">600 Hz</span>
        </div>
        <div className="home-screen-slider">
          <span className="home-screen-slider-fill" style={{ width: '58%' }} />
          <span className="home-screen-knob" style={{ left: '58%' }} />
        </div>
      </div>
    </div>
  )
}

/** Per-letter recognition speed: the latency the app tracks per character. */
function RecognitionScreen() {
  return (
    <div className="home-screen home-screen-stats">
      <span className="home-screen-label">Recognition speed</span>
      {RECOGNITION_ROWS.map((row) => (
        <div className="home-screen-stat" key={row.letter}>
          <span className="home-screen-stat-letter">{row.letter}</span>
          <span className="home-screen-stat-track">
            <span
              className="home-screen-stat-fill"
              style={{ width: `${row.pct}%` }}
            />
          </span>
          <span className="home-screen-stat-time">{row.time}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * Band visuals: the real app shown on a tilted device, one screen per claim.
 * Built as crisp CSS rather than screenshots so they stay sharp on any display
 * and so no dot/dash chart can leak in (seeing the pattern trains the wrong
 * skill). The phone tilts toward its copy via the band's flip state.
 */
function BandVisual({ kind }: { kind: WhyBand['visual'] }) {
  return (
    <div className="home-band-vis" aria-hidden="true">
      <div className="home-phone">
        <div className="home-phone-screen">
          {kind === 'reflex' ? (
            <PracticeScreen />
          ) : kind === 'speed' ? (
            <SpeedScreen />
          ) : (
            <RecognitionScreen />
          )}
        </div>
      </div>
    </div>
  )
}

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
      <p className="home-key-decoded" aria-live="polite">
        {decoded}
      </p>
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

      {WHY_BANDS.map((band, index) => (
        <section
          className={index % 2 === 1 ? 'home-band home-band-flip' : 'home-band'}
          key={band.eyebrow}
          aria-labelledby={`home-band-${index}`}
        >
          <div className="home-band-copy">
            <p className="home-band-eyebrow">{band.eyebrow}</p>
            <h2 className="home-band-h" id={`home-band-${index}`}>
              {band.headline}
            </h2>
            <p className="home-band-b">{band.body}</p>
            {band.cite ? <p className="home-band-cite">{band.cite}</p> : null}
          </div>
          <BandVisual kind={band.visual} />
        </section>
      ))}

      <section className="home-conveniences" aria-label="A few more things">
        <ul className="home-conveniences-list">
          {CONVENIENCES.map((item) => (
            <li className="home-pill" key={item}>
              {item}
            </li>
          ))}
        </ul>
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
