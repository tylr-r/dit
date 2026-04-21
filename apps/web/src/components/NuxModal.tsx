import type { LearnerProfile, NuxStep } from '@dit/core'
import { useEffect, useState } from 'react'

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
  onWelcomeDone: () => void
  onChooseProfile: (profile: LearnerProfile) => void
  onPlaySoundCheck: () => void
  onContinueFromSoundCheck: () => void
  onCompleteButtonTutorial: () => void
  onFinishKnownTour: () => void
  onContinueFromStages: () => void
  onStartBeginnerCourse: () => void
  onSkipReminder: () => void
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
  onWelcomeDone,
  onChooseProfile,
  onPlaySoundCheck,
  onContinueFromSoundCheck,
  onCompleteButtonTutorial,
  onFinishKnownTour,
  onContinueFromStages,
  onStartBeginnerCourse,
  onSkipReminder,
}: NuxModalProps) {
  useEffect(() => {
    if (step !== 'welcome') {
      return
    }
    const timer = window.setTimeout(onWelcomeDone, 2200)
    return () => window.clearTimeout(timer)
  }, [step, onWelcomeDone])

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
  const bodyExiting = step !== displayedStep

  useEffect(() => {
    if (step === displayedStep) return
    const swap = window.setTimeout(() => {
      setDisplayedStep(step)
    }, 140)
    return () => window.clearTimeout(swap)
  }, [step, displayedStep])

  if (step === 'reminder') {
    return null
  }

  if (step === 'welcome') {
    return (
      <div className="nux-overlay nux-overlay-welcome" role="dialog" aria-modal="true">
        <div className="nux-welcome">
          <img src="/Dit-logo.svg" alt="Dit" className="nux-welcome-logo" />
          <p className="nux-welcome-title">Dit</p>
          <p className="nux-welcome-sub">Learn Morse by ear.</p>
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
                  Turn your volume up, then tap below to confirm you can hear the tones.
                </p>
              </div>
              <button
                type="button"
                className={`nux-sound-button ${soundChecked ? 'complete' : ''}`}
                onClick={() => {
                  setSoundRippleKey((k) => k + 1)
                  onPlaySoundCheck()
                }}
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
                  {soundChecked ? 'Sound works' : 'Test sound'}
                </span>
              </button>
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
              disabled={!soundChecked}
            >
              Continue
            </button>
          ) : null}
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

