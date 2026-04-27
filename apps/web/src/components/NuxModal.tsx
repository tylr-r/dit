import type { LearnerProfile, NuxStep } from '@dit/core'
import { useEffect, useState } from 'react'
import { isIOS } from '../platform/device'

type AuthUser = { uid: string }

const TUTORIAL_REQUIRED = 3

const STEP_ORDER: readonly NuxStep[] = [
  'welcome',
  'profile',
  'sound_check',
  'button_tutorial',
  'known_tour',
  'beginner_stages',
  'beginner_intro',
]

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
  onChooseProfile: (profile: LearnerProfile) => void
  onPlaySoundCheck: () => void
  onContinueFromSoundCheck: () => void
  onCompleteButtonTutorial: () => void
  onFinishKnownTour: () => void
  onContinueFromStages: () => void
  onStartBeginnerCourse: () => void
  onSkipReminder: () => void
  onRequestSignIn: () => void
}

const ProgressDots = ({ step }: { step: NuxStep }) => {
  const activeIndex = STEP_ORDER.indexOf(step)
  return (
    <div className="nux-progress" aria-hidden="true">
      {STEP_ORDER.map((s, i) => (
        <span
          key={s}
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
  onChooseProfile,
  onPlaySoundCheck,
  onContinueFromSoundCheck,
  onCompleteButtonTutorial,
  onFinishKnownTour,
  onContinueFromStages,
  onStartBeginnerCourse,
  onSkipReminder,
  onRequestSignIn,
}: NuxModalProps) {
  const [optionsVisible, setOptionsVisible] = useState(false)

  useEffect(() => {
    if (step !== 'welcome') {
      return
    }
    if (user) {
      // Already signed in (replay scenario): auto-advance after a short delay
      const timer = window.setTimeout(onWelcomeDone, 2200)
      return () => window.clearTimeout(timer)
    }
    // Signed-out: show sign-in options after 2s instead of auto-advancing
    const t = window.setTimeout(() => setOptionsVisible(true), 2000)
    return () => window.clearTimeout(t)
  }, [step, user, onWelcomeDone])

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
  const [soundRippleKey, setSoundRippleKey] = useState(0)
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
    setSoundRippleKey((k) => k + 1)
    onPlaySoundCheck()
    setSoundCheckState((prev) => (prev === 'heard' ? 'heard' : 'played'))
  }

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
      >
        <div className="nux-welcome">
          <img src="/Dit-logo.svg" alt="Dit" className="nux-welcome-logo" />
          <p className="nux-welcome-title">Dit</p>
          <p className="nux-welcome-sub">Learn Morse by ear.</p>
          {!user ? (
            <div className={`welcome-options${optionsVisible ? ' is-visible' : ''}`}>
              <button
                type="button"
                className="welcome-option-button welcome-option-primary"
                onClick={(e) => { e.stopPropagation(); onRequestSignIn() }}
              >
                Sign in
              </button>
              <button
                type="button"
                className="welcome-option-button"
                onClick={(e) => { e.stopPropagation(); onWelcomeDone() }}
              >
                Stay signed out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="nux-overlay" role="dialog" aria-modal="true">
      <div className="nux-content">
        <ProgressDots step={step} />
        <div
          className="nux-body"
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
                className={`nux-sound-button ${
                  soundCheckState === 'heard' ? 'complete' : ''
                }`}
                onClick={handlePlaySound}
              >
                {soundRippleKey > 0 ? (
                  <>
                    <span
                      key={`ring1-${soundRippleKey}`}
                      className="nux-sound-ring"
                      aria-hidden="true"
                    />
                    <span
                      key={`ring2-${soundRippleKey}`}
                      className="nux-sound-ring nux-sound-ring-delayed"
                      aria-hidden="true"
                    />
                  </>
                ) : null}
                <span className="nux-sound-label">
                  {soundCheckState === 'idle' ? 'Play sound' : 'Play again'}
                </span>
              </button>
              {soundCheckState === 'played' ||
              soundCheckState === 'not_heard' ||
              soundCheckState === 'heard' ? (
                <div className="nux-sound-confirm" role="group" aria-label="Did you hear it?">
                  <button
                    type="button"
                    className={`nux-sound-choice ${
                      soundCheckState === 'heard' ? 'selected' : ''
                    }`}
                    onClick={() => setSoundCheckState('heard')}
                    aria-pressed={soundCheckState === 'heard'}
                  >
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
              ) : null}
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

