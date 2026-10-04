import type { LearnerProfile, NuxStep } from '@dit/core'
import { useEffect, useRef, useState } from 'react'
import { isIOS } from '../platform/device'
import { useScreenTracker } from '../lib/analytics'

import { IntroFluencyIllustration } from './nux/IntroFluencyIllustration'
import { IntroListenIllustration } from './nux/IntroListenIllustration'
import { IntroSpeedIllustration } from './nux/IntroSpeedIllustration'

type AuthUser = { uid: string }

const TUTORIAL_REQUIRED = 3


type NuxModalProps = {
  step: NuxStep
  learnerProfile: LearnerProfile | null
  soundChecked: boolean
  tutorialTapCount: number
  tutorialHoldCount: number
  currentPack: readonly string[]
  morseButton: React.ReactNode
  user: AuthUser | null
  onWelcomeDone: () => void
  onBack: (step: NuxStep) => void
  onChooseProfile: (profile: LearnerProfile) => void
  onContinueFromIntroFluency: () => void
  onContinueFromIntroListen: () => void
  onContinueFromIntroSpeed: () => void
  onPlaySoundCheck: () => void
  onContinueFromSoundCheck: () => void
  onCompleteButtonTutorial: () => void
  onFinishKnownTour: () => void
  onContinueFromStages: () => void
  onStartBeginnerCourse: () => void
  onSkipReminder: () => void
  onRequestSignIn: () => void
}

const SIGNED_IN_WELCOME_ADVANCE_MS = 350
const SWIPE_BACK_THRESHOLD_PX = 48
type DotSlot =
  | 'profile'
  | 'intro'
  | 'sound_check'
  | 'button_tutorial'
  | 'stage'

const DOT_SLOTS: readonly DotSlot[] = [
  'profile',
  'intro',
  'sound_check',
  'button_tutorial',
  'stage',
]

const STEP_TO_SLOT: Record<NuxStep, DotSlot | null> = {
  welcome: null,
  profile: 'profile',
  intro_fluency: 'intro',
  intro_listen: 'intro',
  intro_speed: 'intro',
  sound_check: 'sound_check',
  button_tutorial: 'button_tutorial',
  known_tour: 'stage',
  beginner_stages: 'stage',
  beginner_intro: 'stage',
  reminder: 'stage',
}

const ProgressDots = ({ step }: { step: NuxStep }) => {
  const activeSlot = STEP_TO_SLOT[step]
  const activeIndex = activeSlot ? DOT_SLOTS.indexOf(activeSlot) : -1
  return (
    <div className="nux-progress" aria-hidden="true">
      {DOT_SLOTS.map((slot, i) => (
        <span
          key={slot}
          className={`nux-dot ${i === activeIndex ? 'active' : ''} ${i < activeIndex ? 'past' : ''}`}
        />
      ))}
    </div>
  )
}

/** Overlay that walks first-time users through the 8-step onboarding flow. */
export function NuxModal({
  step,
  learnerProfile,
  soundChecked,
  tutorialTapCount,
  tutorialHoldCount,
  currentPack,
  morseButton,
  user,
  onWelcomeDone,
  onBack,
  onChooseProfile,
  onContinueFromIntroFluency,
  onContinueFromIntroListen,
  onContinueFromIntroSpeed,
  onPlaySoundCheck,
  onContinueFromSoundCheck,
  onCompleteButtonTutorial,
  onFinishKnownTour,
  onContinueFromStages,
  onStartBeginnerCourse,
  onSkipReminder,
  onRequestSignIn,
}: NuxModalProps) {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (step !== 'welcome') {
      return
    }
    if (user) {
      const timer = window.setTimeout(onWelcomeDone, SIGNED_IN_WELCOME_ADVANCE_MS)
      return () => window.clearTimeout(timer)
    }
  }, [step, user, onWelcomeDone])

  const handleTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    const touch = event.touches[0]
    if (!touch) return
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  const handleTouchEnd = (event: React.TouchEvent<HTMLElement>, currentStep: NuxStep) => {
    const start = touchStartRef.current
    touchStartRef.current = null
    const touch = event.changedTouches[0]
    if (!start || !touch) return

    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    if (dx < -SWIPE_BACK_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy) * 1.4) {
      onBack(currentStep)
    }
  }

  useEffect(() => {
    if (step !== 'button_tutorial') {
      return
    }
    if (
      tutorialTapCount < TUTORIAL_REQUIRED ||
      tutorialHoldCount < TUTORIAL_REQUIRED
    ) {
      return
    }
    const timer = window.setTimeout(onCompleteButtonTutorial, 600)
    return () => window.clearTimeout(timer)
  }, [step, tutorialTapCount, tutorialHoldCount, onCompleteButtonTutorial])

  useEffect(() => {
    if (step === 'reminder') {
      onSkipReminder()
    }
  }, [step, onSkipReminder])

  const [displayedStep, setDisplayedStep] = useState(step)
  const [soundCheckState, setSoundCheckState] = useState<
    'idle' | 'played' | 'heard' | 'not_heard'
  >('idle')
  const bodyExiting = step !== displayedStep

  useEffect(() => {
    if (step === displayedStep) return
    const swap = window.setTimeout(() => {
      setDisplayedStep(step)
    }, 140)
    return () => window.clearTimeout(swap)
  }, [step, displayedStep])

  const handlePlaySound = () => {
    onPlaySoundCheck()
    setSoundCheckState((prev) => (prev === 'heard' ? 'heard' : 'played'))
  }

  useScreenTracker('nux')

  if (step === 'reminder') {
    return null
  }

  if (step === 'welcome') {
    return (
      <div
        className="nux-overlay nux-overlay-welcome"
        role="dialog"
        aria-modal="true"
        onClick={user ? onWelcomeDone : undefined}
        onTouchStart={handleTouchStart}
        onTouchEnd={(event) => handleTouchEnd(event, 'welcome')}
      >
        <div className="nux-welcome nux-welcome-start">
          <img src="/Dit-logo.svg" alt="Dit" className="nux-welcome-logo" />
          <h1 className="nux-welcome-title">Learn Morse by ear.</h1>
          {!user ? (
            <div className="nux-start-actions">
              <button
                type="button"
                className="nux-start-button"
                onClick={(event) => { event.stopPropagation(); onWelcomeDone() }}
              >
                Get started
              </button>
              <p className="nux-sign-in-prompt">
                Already use Dit?{' '}
                <button
                  type="button"
                  onClick={(event) => { event.stopPropagation(); onRequestSignIn() }}
                >
                  Sign in
                </button>
              </p>
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div
      className="nux-overlay"
      role="dialog"
      aria-modal="true"
      onTouchStart={handleTouchStart}
      onTouchEnd={(event) => handleTouchEnd(event, displayedStep)}
    >
      <div className="nux-content">
        <div className="nux-navigation">
          <button
            type="button"
            className="nux-back"
            disabled={bodyExiting}
            onClick={() => onBack(displayedStep)}
          >
            <span aria-hidden="true">‹</span> Back
          </button>
          <ProgressDots step={step} />
        </div>
        <div
          className="nux-body"
          data-step={displayedStep}
          data-exiting={bodyExiting ? '' : undefined}
          key={displayedStep}
        >
          {displayedStep === 'profile' ? (
            <>
              <div className="nux-copy">
                <p className="nux-headline">Choose your path</p>
                <p className="nux-subtext">
                  Pick the option that fits your experience.
                </p>
              </div>
              <div className="nux-option-column">
                <button
                  type="button"
                  className={`nux-option-card ${learnerProfile === 'beginner' ? 'selected' : ''}`}
                  onClick={() => onChooseProfile('beginner')}
                >
                  <p className="nux-option-title">Learn Morse</p>
                  <p className="nux-option-body">
                    Start from the basics and build up.
                  </p>
                </button>
                <button
                  type="button"
                  className={`nux-option-card ${learnerProfile === 'known' ? 'selected' : ''}`}
                  onClick={() => onChooseProfile('known')}
                >
                  <p className="nux-option-title">I know Morse</p>
                  <p className="nux-option-body">
                    Quick tour, then dive right in.
                  </p>
                </button>
              </div>
            </>
          ) : null}

          {displayedStep === 'intro_fluency' ? (
            <>
              <div className="nux-copy">
                <p className="nux-headline">Real Morse fluency.</p>
                <p className="nux-subtext">
                  Science-backed training, instant feedback, and smart review that targets your
                  weakest letters.
                </p>
              </div>
              <div className="nux-intro-illustration">
                <IntroFluencyIllustration />
              </div>
            </>
          ) : null}

          {displayedStep === 'intro_listen' ? (
            <>
              <div className="nux-copy">
                <p className="nux-headline">No chart. Just listen.</p>
                <p className="nux-subtext">
                  Experienced operators don't count dots and dashes. They hear each letter the way
                  you hear your name. Dit trains that reflex from the start.
                </p>
              </div>
              <div className="nux-intro-illustration">
                <IntroListenIllustration />
              </div>
            </>
          ) : null}

          {displayedStep === 'intro_speed' ? (
            <>
              <div className="nux-copy">
                <p className="nux-headline">Real speed from day one.</p>
                <p className="nux-subtext">
                  Slow letters teach you to count. Dit uses the Koch method, which keeps every
                  character at a usable speed. The gaps between letters start roomy and tighten as
                  you improve, so you always have time to think.
                </p>
              </div>
              <div className="nux-intro-illustration">
                <IntroSpeedIllustration />
              </div>
            </>
          ) : null}

          {displayedStep === 'sound_check' ? (
            <>
              <div className="nux-copy">
                <p className="nux-headline">Check your sound</p>
                <p className="nux-subtext">
                  {soundCheckState === 'idle'
                    ? 'Turn your volume up, then play the sound.'
                    : soundCheckState === 'heard'
                    ? 'Great — sound works.'
                    : soundCheckState === 'not_heard'
                    ? "Let's get that fixed."
                    : 'Did you hear it?'}
                </p>
              </div>
              <button
                type="button"
                className="nux-sound-button"
                onClick={handlePlaySound}
              >
                <svg className="nux-sound-icon" viewBox="0 0 32 32" aria-hidden="true">
                  <path d="M11 7.5a1.5 1.5 0 0 1 2.3-1.27l13 8.5a1.5 1.5 0 0 1 0 2.54l-13 8.5A1.5 1.5 0 0 1 11 24.5Z" fill="currentColor" />
                </svg>
                <span className="nux-sound-label">
                  {soundCheckState === 'idle' ? 'Play sound' : 'Play again'}
                </span>
              </button>
                <div
                  className="nux-sound-confirm"
                  role="group"
                  aria-label="Did you hear it?"
                  aria-hidden={soundCheckState === 'idle'}
                  inert={soundCheckState === 'idle'}
                >
                  <button
                    type="button"
                    className={`nux-sound-choice ${
                      soundCheckState === 'heard' ? 'selected' : ''
                    }`}
                    onClick={() => setSoundCheckState('heard')}
                    aria-pressed={soundCheckState === 'heard'}
                  >
                    <svg className="nux-sound-checkmark" viewBox="0 0 20 20" aria-hidden="true">
                      <path d="m4 10 4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Yes, I heard it
                  </button>
                  <button
                    type="button"
                    className={`nux-sound-choice ${
                      soundCheckState === 'not_heard' ? 'selected' : ''
                    }`}
                    onClick={() => setSoundCheckState('not_heard')}
                    aria-pressed={soundCheckState === 'not_heard'}
                  >
                    No sound
                  </button>
                </div>
              {soundCheckState === 'not_heard' ? (
                <div className="nux-sound-help">
                  {isIOS() ? (
                    <>
                      <p className="nux-sound-help-title">On iPhone or iPad</p>
                      <ol className="nux-sound-help-list">
                        <li>
                          Open Control Center and tap the{' '}
                          <span className="nux-sound-help-emph">bell icon</span> to
                          turn off Silent Mode.
                        </li>
                        <li>Raise the volume with the side buttons.</li>
                        <li>
                          Leave this tab in the foreground, then play again.
                        </li>
                      </ol>
                    </>
                  ) : (
                    <>
                      <p className="nux-sound-help-title">Try this</p>
                      <ol className="nux-sound-help-list">
                        <li>Turn your system volume up.</li>
                        <li>Unmute this browser tab if it's muted.</li>
                        <li>Check your output device, then play again.</li>
                      </ol>
                    </>
                  )}
                </div>
              ) : null}
            </>
          ) : null}

          {displayedStep === 'button_tutorial' ? (
            <>
              <div className="nux-copy">
                <p className="nux-headline">Meet the Morse key</p>
                <p className="nux-subtext">
                  Try it below — short taps are dits, long holds are dahs.
                </p>
              </div>
              <div className="nux-tutorial-block">
                <div className="nux-tutorial-row">
                  <span className="nux-tutorial-label">
                    Tap <span className="nux-tutorial-hint">(dit)</span>
                  </span>
                  <TutorialProgress count={tutorialTapCount} />
                </div>
                <div className="nux-tutorial-row">
                  <span className="nux-tutorial-label">
                    Hold <span className="nux-tutorial-hint">(dah)</span>
                  </span>
                  <TutorialProgress count={tutorialHoldCount} />
                </div>
                <div className="nux-tutorial-button-slot">{morseButton}</div>
              </div>
            </>
          ) : null}

          {/* Dead branch: known_tour is handled by TourOverlay (App.tsx); NuxModal
              is unmounted before this step is reached. Kept as spec reference. */}
          {displayedStep === 'known_tour' ? (
            <>
              <div className="nux-copy">
                <p className="nux-headline">Quick app tour</p>
                <p className="nux-subtext">
                  Practice shows the target, Listen plays a letter, Freestyle decodes whatever you tap.
                </p>
              </div>
              <ul className="nux-card nux-bullet-list">
                <li>Practice: send the shown character</li>
                <li>Freestyle: tap whatever you want and decode it</li>
                <li>Listen: hear a letter and type the answer</li>
              </ul>
            </>
          ) : null}

          {displayedStep === 'beginner_stages' ? (
            <>
              <div className="nux-copy">
                <p className="nux-headline">How you'll learn</p>
                <p className="nux-subtext">Each pack moves through three stages.</p>
              </div>
              <div className="nux-stages">
                <StageRow number={1} title="Listen" description="Hear each letter and copy the sound" />
                <StageRow number={2} title="Practice" description="Mix old and new letters by ear" />
                <StageRow number={3} title="Recall" description="Hear a letter, tap the matching sound" />
              </div>
            </>
          ) : null}

          {displayedStep === 'beginner_intro' ? (
            <>
              <div className="nux-copy">
                <p className="nux-headline">Your first letters</p>
                <p className="nux-subtext">
                  You'll start with two letters and build from there.
                </p>
              </div>
              <div className="nux-pack-preview">
                <p className="nux-pack-label">We'll start with</p>
                <div className="nux-pack-chips">
                  {currentPack.map((letter) => (
                    <span key={letter} className="nux-pack-chip">
                      {letter}
                    </span>
                  ))}
                </div>
              </div>
            </>
          ) : null}

        </div>

        <div className="nux-cta-slot">
          {displayedStep === 'intro_fluency' ? (
            <button type="button" className="nux-cta" onClick={onContinueFromIntroFluency}>
              Continue
            </button>
          ) : null}
          {displayedStep === 'intro_listen' ? (
            <button type="button" className="nux-cta" onClick={onContinueFromIntroListen}>
              Continue
            </button>
          ) : null}
          {displayedStep === 'intro_speed' ? (
            <button type="button" className="nux-cta" onClick={onContinueFromIntroSpeed}>
              Continue
            </button>
          ) : null}
          {displayedStep === 'sound_check' ? (
            <button
              type="button"
              className="nux-cta"
              onClick={onContinueFromSoundCheck}
              disabled={soundCheckState !== 'heard' || !soundChecked}
            >
              Continue
            </button>
          ) : null}
          {/* Dead branch: see comment above. TourOverlay calls onFinishKnownTour. */}
          {displayedStep === 'known_tour' ? (
            <button type="button" className="nux-cta" onClick={onFinishKnownTour}>
              Start practicing
            </button>
          ) : null}
          {displayedStep === 'beginner_stages' ? (
            <button type="button" className="nux-cta" onClick={onContinueFromStages}>
              Continue
            </button>
          ) : null}
          {displayedStep === 'beginner_intro' ? (
            <button type="button" className="nux-cta" onClick={onStartBeginnerCourse}>
              Start first lesson
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

const TutorialProgress = ({ count }: { count: number }) => (
  <div className="nux-tutorial-pips" aria-hidden="true">
    {Array.from({ length: TUTORIAL_REQUIRED }, (_, i) => (
      <span
        key={i}
        className={`nux-tutorial-pip ${i < count ? 'filled' : ''}`}
      />
    ))}
  </div>
)

const StageRow = ({
  number,
  title,
  description,
}: {
  number: number
  title: string
  description: string
}) => (
  <div className="nux-stage-row">
    <span className="nux-stage-number">{number}</span>
    <div className="nux-stage-body">
      <p className="nux-stage-title">{title}</p>
      <p className="nux-stage-desc">{description}</p>
    </div>
  </div>
)
