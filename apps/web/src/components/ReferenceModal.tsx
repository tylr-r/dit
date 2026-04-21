import type { CSSProperties } from 'react'
import type { HeroMetric, Letter, StreakState } from '@dit/core'
import { STREAK_DAILY_GOAL, isMastered } from '@dit/core'
import type { ReferenceModalProps } from './componentProps'

const SCORE_INTENSITY_MAX = 15

const formatScore = (value: number) => (value > 0 ? `+${value}` : `${value}`)

const getScoreStyle = (
  scoreValue: number,
): CSSProperties | undefined => {
  if (scoreValue === 0) {
    return
  }
  const normalized = Math.abs(scoreValue) / SCORE_INTENSITY_MAX
  const intensity = Math.min(Math.max(normalized, 0.2), 1)
  const alpha = 0.35 * intensity
  const tint = scoreValue > 0 ? '56, 242, 162' : '255, 90, 96'
  return {
    '--score-tint': tint,
    '--score-alpha': String(alpha),
  } as CSSProperties
}

const ProgressHero = ({ hero }: { hero: HeroMetric }) => {
  if (hero.kind === 'wpm') {
    const display = hero.value > 0 ? hero.value.toFixed(1) : '—'
    return (
      <div className="reference-hero">
        <div className="reference-hero-value">{display}</div>
        <div className="reference-hero-label">Best WPM</div>
      </div>
    )
  }
  return (
    <div className="reference-hero">
      <div className="reference-hero-value">
        {hero.count}
        <span className="reference-hero-value-muted"> / {hero.total}</span>
      </div>
      <div className="reference-hero-label">Letters mastered</div>
    </div>
  )
}

const StreakRow = ({
  streak,
  todayCorrect,
  goal,
}: {
  streak?: StreakState
  todayCorrect: number
  goal: number
}) => {
  const current = streak?.current ?? 0
  const filled = Math.min(todayCorrect, goal)
  const ratio = goal > 0 ? filled / goal : 0
  const streakText =
    current > 0 ? `${current}-day streak` : 'No active streak'
  const detailText =
    todayCorrect >= goal ? 'Today counted' : `${todayCorrect} / ${goal} today`
  return (
    <div className="reference-streak">
      <div className="reference-streak-header">
        <span className="reference-streak-text">{streakText}</span>
        <span className="reference-streak-detail">{detailText}</span>
      </div>
      <div className="reference-streak-track">
        <div
          className="reference-streak-fill"
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
    </div>
  )
}

/** Modal overlay with hero metric, streak, guided-course banner, and Morse reference grid. */
export function ReferenceModal({
  letters,
  morseData,
  numbers,
  onClose,
  onResetScores,
  scores,
  hero,
  streak,
  todayCorrect,
  letterAccuracy,
  courseProgress,
}: ReferenceModalProps) {
  const masteryProgress = { scores, letterAccuracy }
  const renderReferenceCard = (char: Letter) => {
    const scoreValue = scores[char] ?? 0
    const mastered = isMastered(masteryProgress, char)
    const scoreClass =
      scoreValue > 0
        ? 'score-positive'
        : scoreValue < 0
          ? 'score-negative'
          : 'score-neutral'
    const code = morseData[char].code
    return (
      <div
        key={char}
        className={`reference-card${mastered ? ' reference-card-mastered' : ''}`}
        style={getScoreStyle(scoreValue)}
      >
        <div className="reference-head">
          <div className="reference-letter">{char}</div>
          <div className={`reference-score ${scoreClass}`}>
            {scoreValue === 0 ? '' : formatScore(scoreValue)}
          </div>
        </div>
        <div className="reference-code" aria-label={code}>
          {code.split('').map((symbol, index) => (
            <span key={`${char}-${index}`} className="reference-symbol">
              {symbol === '.'
                ? '•'
                : symbol === '-'
                  ? '—'
                  : symbol}
            </span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Morse reference"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title">Progress</div>
          <div className="modal-actions">
            <button
              type="button"
              className="modal-close modal-reset"
              onClick={onResetScores}
            >
              Reset scores
            </button>
            <button type="button" className="modal-close" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        <div className="reference-scroll">
          <ProgressHero hero={hero} />
          <StreakRow
            streak={streak}
            todayCorrect={todayCorrect}
            goal={STREAK_DAILY_GOAL}
          />
          {courseProgress ? (
            <div className="reference-course-banner">
              <div className="reference-course-banner-title">
                Pack {courseProgress.packIndex + 1}/{courseProgress.totalPacks}
                {' · '}
                {courseProgress.phase}
              </div>
              <div className="reference-course-banner-letters">
                {courseProgress.packLetters.map((l) => `"${l}"`).join(' ')}
              </div>
            </div>
          ) : null}
          <div className="reference-grid">
            {letters.map(renderReferenceCard)}
            <div className="reference-row">
              {numbers.map(renderReferenceCard)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
