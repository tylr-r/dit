import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './HomePage.css'
import { MORSE_DATA, type Letter } from '@dit/core'
import { Footer } from './Footer'
import { playMorseTone, stopMorseTone } from '../utils/tone'
import {
  buildMorsePipSchedule,
  type MorsePipSchedule,
} from '../utils/morsePipSchedule'

const APP_STORE_URL =
  'https://apps.apple.com/app/dit-practice-morse-code/id6758277876'

const NAME_LETTERS: Letter[] = ['D', 'I', 'T']
const NAME_CODE = NAME_LETTERS.map((letter) => MORSE_DATA[letter].code).join(' ')

const HERO_CHARACTER_WPM = 18
const HERO_THINK_EFFECTIVE_WPM = 8

type SpacingMode = 'real' | 'think'

const DitMark = () => (
  <span className="home-eyebrow-mark" aria-hidden="true">
    <span className="dah" />
    <span className="dit" />
    <span className="dit" />
  </span>
)

/**
 * Interactive hero module: plays the app's name in real Morse using the same
 * tone engine as the app, lighting each pip in sync with its tone. A spacing
 * toggle replays the same characters with Farnsworth room-to-think, which is
 * the product's core idea demonstrated in one element.
 */
function NameSounder() {
  const [spacing, setSpacing] = useState<SpacingMode>('real')
  const [activePip, setActivePip] = useState(-1)
  const [playState, setPlayState] = useState<'idle' | 'playing' | 'played'>(
    'idle',
  )
  const timersRef = useRef<number[]>([])

  const schedule: MorsePipSchedule = useMemo(
    () =>
      buildMorsePipSchedule(
        NAME_CODE,
        HERO_CHARACTER_WPM,
        spacing === 'think' ? HERO_THINK_EFFECTIVE_WPM : HERO_CHARACTER_WPM,
      ),
    [spacing],
  )

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) {
      window.clearTimeout(id)
    }
    timersRef.current = []
  }, [])

  useEffect(
    () => () => {
      clearTimers()
      void stopMorseTone()
    },
    [clearTimers],
  )

  const handlePlay = useCallback(() => {
    clearTimers()
    setPlayState('playing')
    setActivePip(-1)
    void playMorseTone({
      code: NAME_CODE,
      characterWpm: HERO_CHARACTER_WPM,
      effectiveWpm:
        spacing === 'think' ? HERO_THINK_EFFECTIVE_WPM : HERO_CHARACTER_WPM,
    })
    schedule.pips.forEach((pip, index) => {
      timersRef.current.push(
        window.setTimeout(() => setActivePip(index), pip.startMs),
      )
      timersRef.current.push(
        window.setTimeout(() => {
          setActivePip((current) => (current === index ? -1 : current))
        }, pip.startMs + pip.durationMs),
      )
    })
    timersRef.current.push(
      window.setTimeout(() => {
        setActivePip(-1)
        setPlayState('played')
      }, schedule.totalMs + 80),
    )
  }, [clearTimers, schedule, spacing])

  const handleSpacingChange = useCallback(
    (next: SpacingMode) => {
      if (next === spacing) {
        return
      }
      clearTimers()
      void stopMorseTone()
      setActivePip(-1)
      setSpacing(next)
      setPlayState('idle')
    },
    [clearTimers, spacing],
  )

  return (
    <div className="home-sounder">
      <button
        type="button"
        className="home-sounder-key"
        onClick={handlePlay}
        aria-label='Play the word "Dit" in Morse code'
      >
        <span className="home-sounder-pips" aria-hidden="true">
          {schedule.pips.map((pip, index) => (
            <span
              key={index}
              className={`home-pip ${pip.symbol === '.' ? 'dit' : 'dah'}${
                index === activePip ? ' active' : ''
              }${pip.tokenIndex > 0 && schedule.pips[index - 1]?.tokenIndex !== pip.tokenIndex ? ' char-start' : ''}`}
            />
          ))}
        </span>
        <span className="home-sounder-label">
          {playState === 'playing' ? 'Listen' : 'Press to hear it'}
        </span>
      </button>
      <div className="home-sounder-meta">
        <p className="home-sounder-caption" aria-live="polite">
          {playState === 'played'
            ? 'That was D, I, T — the app’s name, by ear.'
            : 'The word “Dit”, in real Morse.'}
        </p>
        <div
          className="home-sounder-toggle"
          role="group"
          aria-label="Character spacing"
        >
          <button
            type="button"
            className={spacing === 'real' ? 'selected' : ''}
            aria-pressed={spacing === 'real'}
            onClick={() => handleSpacingChange('real')}
          >
            Real speed
          </button>
          <button
            type="button"
            className={spacing === 'think' ? 'selected' : ''}
            aria-pressed={spacing === 'think'}
            onClick={() => handleSpacingChange('think')}
          >
            Room to think
          </button>
        </div>
      </div>
    </div>
  )
}

/** Public marketing homepage. Editorial page in the legal-page family. */
export function HomePage() {
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Dit — Learn Morse Code by Ear'
    return () => {
      document.title = previousTitle
    }
  }, [])

  return (
    <div className="home-page">
      <div className="home-progress" aria-hidden="true" />
      <div className="home-top">
        <p className="home-eyebrow">
          <DitMark />
          <span>Dit</span>
        </p>
        <nav className="home-nav" aria-label="Site">
          <a href="/support">Support</a>
          <a href="/">Open the app</a>
        </nav>
      </div>

      <header className="home-hero">
        <h1 className="home-title">Learn Morse code by&nbsp;ear.</h1>
        <p className="home-intro">
          Dit teaches you to hear characters as rhythm — real-speed audio,
          room to think, and review that targets what you miss. Free on iOS.
        </p>
        <div className="home-cta-row">
          <a className="home-cta" href={APP_STORE_URL}>
            Download on the App&nbsp;Store
          </a>
          <a className="home-cta-secondary" href="/">
            Try it in your browser
          </a>
        </div>
        <NameSounder />
      </header>

      <section className="home-method" aria-label="How Dit teaches">
        <div className="home-method-item">
          <h2>Real speed from the start</h2>
          <p>
            Slow Morse teaches you a code you’ll have to unlearn. Dit plays
            every character at real speed, so you learn the sound shape — not
            the chart.
          </p>
        </div>
        <div className="home-method-item">
          <h2>Room to think</h2>
          <p>
            Extra space between characters while you’re learning, tightening
            as you improve. More time to think, not slower code.
          </p>
        </div>
        <div className="home-method-item">
          <h2>Review that remembers</h2>
          <p>
            Miss a letter and it comes back. Practice narrows to what actually
            trips you up.
          </p>
        </div>
      </section>

      <section className="home-note" aria-label="From the maker">
        <p>
          Dit exists because I was learning CW and kept falling into the same
          trap: reading dots and dashes instead of hearing them. It’s free,
          with no subscription and no in-app purchases — the app I wanted
          while learning is the app you get.
        </p>
        <p className="home-note-name">Tyler Robinson</p>
      </section>

      <section className="home-features" aria-label="Features">
        <ul>
          <li>Practice, Listen, and Freestyle modes</li>
          <li>Koch-style progression</li>
          <li>Farnsworth spacing in plain language</li>
          <li>Streaks and progress</li>
          <li>Dark mode</li>
          <li>Zero purchases</li>
        </ul>
      </section>

      <Footer />
    </div>
  )
}
