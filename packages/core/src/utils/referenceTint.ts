export const REFERENCE_SCORE_INTENSITY_MAX = 15
export const REFERENCE_SCORE_TINT_MAX_ALPHA = 0.18
export const REFERENCE_RELATIVE_TINT_MIN_DEVIATION = 3

export const computeReferenceScoreMedian = (scores: number[]): number => {
  if (scores.length === 0) {
    return 0
  }
  const sorted = [...scores].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

export const computeReferenceScoreMaxDeviation = (
  scores: number[],
  median: number,
) => scores.reduce((max, score) => Math.max(max, Math.abs(score - median)), 0)

type ReferenceTintColor = {
  red: number
  green: number
  blue: number
  alpha: number
}

/** Absolute score tint used on reference cards (iOS border, web CSS vars). */
export const getReferenceAbsoluteScoreTint = (
  scoreValue: number,
): ReferenceTintColor | null => {
  if (scoreValue === 0) {
    return null
  }
  const normalized = Math.abs(scoreValue) / REFERENCE_SCORE_INTENSITY_MAX
  const intensity = Math.min(Math.max(normalized, 0.2), 1)
  const alpha = 0.35 * intensity
  return scoreValue > 0
    ? { red: 56, green: 242, blue: 162, alpha }
    : { red: 255, green: 90, blue: 96, alpha }
}

/** Relative mastered-letter tint vs the section median (web + iOS reference cards). */
export const getReferenceRelativeScoreTint = (
  scoreValue: number,
  medianScore: number,
  maxDeviation: number,
): ReferenceTintColor | null => {
  if (maxDeviation < REFERENCE_RELATIVE_TINT_MIN_DEVIATION) {
    return null
  }
  const relative = (scoreValue - medianScore) / maxDeviation
  const intensity = Math.abs(relative)
  if (intensity < 0.1) {
    return null
  }
  const alpha = REFERENCE_SCORE_TINT_MAX_ALPHA * intensity
  return relative > 0
    ? { red: 56, green: 242, blue: 162, alpha }
    : { red: 255, green: 90, blue: 96, alpha }
}
