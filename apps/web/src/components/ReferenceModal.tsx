import {
  classifyLetter,
  computeReferenceScoreMaxDeviation,
  computeReferenceScoreMedian,
  getAverageRecognitionMs,
  getRecognitionFillRatio,
  getReferenceRelativeScoreTint,
  REFERENCE_RELATIVE_TINT_MIN_DEVIATION,
  STREAK_DAILY_GOAL,
  type Letter,
} from '@dit/core'
import { useCallback, useRef, useState, type CSSProperties } from 'react'
import { useScreenTracker } from '../lib/analytics'
import type { ReferenceModalProps } from './componentProps'

const LONG_PRESS_MS = 350
// Mastered tiles always show at least this much bar fill, so a letter mastered
// via Practice (no Listen TTR yet) doesn't read identically to "very slow."
const MASTERED_MIN_FILL = 0.05

const getRelativeTintStyle = (
  scoreValue: number,
  status: 'mastered' | 'learning' | 'not-yet',
  medianScore: number,
  maxDeviation: number,
): CSSProperties | undefined => {
  if (status !== 'mastered') return undefined
  const tint = getReferenceRelativeScoreTint(scoreValue, medianScore, maxDeviation)
  if (!tint) return undefined
  return {
    '--score-tint': `${tint.red}, ${tint.green}, ${tint.blue}`,
    '--score-alpha': String(tint.alpha),
  } as CSSProperties
}

const renderMorseGlyph = (code: string) =>
  code.split('').map((symbol, index) => (
    <span key={index} className="reference-tile-symbol">
      {symbol === '.' ? '•' : symbol === '-' ? '—' : symbol}
    </span>
  ))

const RecognitionLegend = () => (
  <div className="reference-legend" aria-hidden="true">
    <span className="reference-legend-label">slow</span>
    <span className="reference-legend-bar" />
    <span className="reference-legend-label">fast</span>
  </div>
)

/** Modal overlay with progress stats, letter-status sections, and a Morse reference grid. */
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
  streakAtRisk,
  letterAccuracy,
  listenTtr,
  onPlayCharacter,
}: ReferenceModalProps) {
  useScreenTracker('reference')

  const progressForClassify = { scores, letterAccuracy }
  const allChars: Letter[] = [...letters, ...numbers]

  const mastered: Letter[] = []
  const learning: Letter[] = []
  const notYet: Letter[] = []
  for (const ch of allChars) {
    const status = classifyLetter(progressForClassify, ch)
    if (status === 'mastered') mastered.push(ch)
    else if (status === 'learning') learning.push(ch)
    else notYet.push(ch)
  }

  const avgRecognitionMs = getAverageRecognitionMs(progressForClassify, listenTtr)

  const masteredScores = mastered.map((c) => scores[c] ?? 0)
  const masteredScoreMedian = computeReferenceScoreMedian(masteredScores)
  const masteredScoreMaxDeviation = computeReferenceScoreMaxDeviation(
    masteredScores,
    masteredScoreMedian,
  )

  const masteredCount = hero.kind === 'mastered' ? hero.count : mastered.length
  const totalCount = hero.kind === 'mastered' ? hero.total : allChars.length
  const currentStreak = streak?.current ?? 0
  const streakClamp = Math.min(todayCorrect, STREAK_DAILY_GOAL)
  const streakRatio = STREAK_DAILY_GOAL > 0 ? streakClamp / STREAK_DAILY_GOAL : 0
  const streakHeader =
    currentStreak > 0 ? `Today's goal · ${currentStreak}-day streak` : "Today's goal"

  const [revealedChar, setRevealedChar] = useState<Letter | null>(null)
  const longPressTimerRef = useRef<number | null>(null)
  const longPressTriggeredRef = useRef(false)

  const hasHover =
    typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches
  const interactionHint = hasHover
    ? 'Click any letter to hear it. Hover to peek at the pattern.'
    : 'Tap any letter to hear it.'

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  const handlePointerDown = useCallback(
    (char: Letter) => {
      cancelLongPress()
      longPressTriggeredRef.current = false
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTriggeredRef.current = true
        setRevealedChar(char)
        longPressTimerRef.current = null
      }, LONG_PRESS_MS)
    },
    [cancelLongPress],
  )

  const handlePointerEnd = useCallback(() => {
    cancelLongPress()
    setRevealedChar(null)
  }, [cancelLongPress])

  const handleClick = useCallback(
    (char: Letter) => {
      if (longPressTriggeredRef.current) {
        longPressTriggeredRef.current = false
        return
      }
      onPlayCharacter?.(char)
    },
    [onPlayCharacter],
  )

  const renderTile = (char: Letter, status: 'mastered' | 'learning' | 'not-yet') => {
    const ttrEma = listenTtr?.[char]?.averageMs ?? null
    const rawFillRatio = getRecognitionFillRatio(ttrEma)
    const fillRatio =
      status === 'mastered'
        ? Math.max(rawFillRatio, MASTERED_MIN_FILL)
        : rawFillRatio
    const interactive = Boolean(onPlayCharacter)
    const isRevealed = revealedChar === char
    const className = `reference-tile reference-tile--${status}${
      isRevealed ? ' reference-tile--revealed' : ''
    }`

    if (status === 'not-yet') {
      const inner = <span className="reference-tile-letter">{char}</span>
      if (interactive) {
        return (
          <button
            key={char}
            type="button"
            className={`${className} reference-tile-button`}
            aria-label={`Play Morse for ${char}`}
            onClick={() => handleClick(char)}
            onPointerDown={() => handlePointerDown(char)}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onPointerLeave={handlePointerEnd}
          >
            {inner}
          </button>
        )
      }
      return (
        <div key={char} className={className}>
          {inner}
        </div>
      )
    }

    const scoreValue = scores[char] ?? 0
    // Show the score (and tint the tile) only on mastered tiles. Pre-mastery,
    // these would signal struggle on a letter the user is still figuring out
    // — the kind of negative reinforcement the pedagogy guidance warns against.
    const tintStyle = getRelativeTintStyle(
      scoreValue,
      status,
      masteredScoreMedian,
      masteredScoreMaxDeviation,
    )
    // Score is delta from median so it agrees with the relative tint.
    // Rounded to a whole number for display; an even-count median produces
    // half-integer deltas otherwise. Shown on every mastered tile once
    // there's meaningful spread — letters at the median display "0" so the
    // chip's presence stays consistent across the section.
    const relativeScore =
      status === 'mastered'
        ? Math.round(scoreValue - masteredScoreMedian)
        : 0
    const showScore =
      status === 'mastered' &&
      masteredScoreMaxDeviation >= REFERENCE_RELATIVE_TINT_MIN_DEVIATION
    const inner = (
      <>
        {showScore ? (
          <span
            className={`reference-tile-score${
              relativeScore < 0 ? ' reference-tile-score--negative' : ''
            }`}
            aria-hidden="true"
          >
            {relativeScore > 0 ? `+${relativeScore}` : String(relativeScore)}
          </span>
        ) : null}
        <span className="reference-tile-stage">
          <span className="reference-tile-letter">{char}</span>
          <span className="reference-tile-pattern" aria-label={morseData[char].code}>
            {renderMorseGlyph(morseData[char].code)}
          </span>
        </span>
        <span
          className="reference-tile-bar"
          aria-hidden="true"
          style={{ '--fill': `${Math.round(fillRatio * 100)}%` } as CSSProperties}
        />
      </>
    )

    if (interactive) {
      return (
        <button
          key={char}
          type="button"
          className={`${className} reference-tile-button`}
          aria-label={`Play Morse for ${char}`}
          style={tintStyle}
          onClick={() => handleClick(char)}
          onPointerDown={() => handlePointerDown(char)}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onPointerLeave={handlePointerEnd}
        >
          {inner}
        </button>
      )
    }
    return (
      <div key={char} className={className} style={tintStyle}>
        {inner}
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal reference-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Progress"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="reference-header">
          <h2 className="reference-title">Progress</h2>
          <button
            type="button"
            className="reference-close"
            onClick={onClose}
            aria-label="Close progress"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M6 6 L18 18 M18 6 L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="reference-scroll">
          <div className="reference-stats">
            <div className="reference-stat">
              <div className="reference-stat-value">
                {masteredCount}
                <span className="reference-stat-value-muted">
                  {' / '}
                  {totalCount}
                </span>
              </div>
              <div className="reference-stat-label">Letters mastered</div>
            </div>
            <div className="reference-stat-divider" aria-hidden="true" />
            <div className="reference-stat">
              <div className="reference-stat-value">
                {avgRecognitionMs != null ? avgRecognitionMs : '—'}
                {avgRecognitionMs != null ? (
                  <span className="reference-stat-value-unit">ms</span>
                ) : null}
              </div>
              <div className="reference-stat-label">Avg recognition</div>
            </div>
            <div className="reference-stat-divider" aria-hidden="true" />
            <div
              className={`reference-stat reference-stat-streak${streakAtRisk ? ' is-at-risk' : ''}`}
            >
              <div className="reference-stat-streak-detail">
                <div className="reference-stat-value reference-stat-streak-counts">
                  {streakClamp}
                  <span className="reference-stat-value-muted">
                    {' / '}
                    {STREAK_DAILY_GOAL}
                  </span>
                </div>
                <div className="reference-stat-streak-track">
                  <div
                    className="reference-stat-streak-fill"
                    style={{ width: `${Math.round(streakRatio * 100)}%` }}
                  />
                </div>
              </div>
              <div className="reference-stat-label">{streakHeader}</div>
            </div>
          </div>

          <p className="reference-caption">
            {interactionHint}{' '}Bars track recognition speed. The +/- is relative to your average score.
          </p>

          {mastered.length > 0 ? (
            <section className="reference-section">
              <div className="reference-section-header">
                <h3 className="reference-section-title">
                  Known by ear
                  <span className="reference-section-count">{mastered.length}</span>
                </h3>
                <RecognitionLegend />
              </div>
              <div className="reference-section-grid">
                {mastered.map((c) => renderTile(c, 'mastered'))}
              </div>
            </section>
          ) : null}

          {learning.length > 0 ? (
            <section className="reference-section">
              <div className="reference-section-header">
                <h3 className="reference-section-title">
                  Still learning
                  <span className="reference-section-count">{learning.length}</span>
                </h3>
                {mastered.length === 0 ? <RecognitionLegend /> : null}
              </div>
              <div className="reference-section-grid">
                {learning.map((c) => renderTile(c, 'learning'))}
              </div>
            </section>
          ) : null}

          {notYet.length > 0 ? (
            <section className="reference-section reference-section--locked">
              <div className="reference-section-header">
                <h3 className="reference-section-title">
                  Not started
                  <span className="reference-section-count">{notYet.length}</span>
                </h3>
              </div>
              <div className="reference-section-grid">
                {notYet.map((c) => renderTile(c, 'not-yet'))}
              </div>
            </section>
          ) : null}

          <div className="reference-footer">
            <button type="button" className="reference-reset" onClick={onResetScores}>
              Reset scores
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
