import { EFFECTIVE_WPM_RANGE, WPM_RANGE } from '../constants'

export const LISTEN_AUTO_TIGHTENING_STAGE_THRESHOLDS = {
  medium: 12,
  tight: 24,
} as const

type ListenSpeeds = {
  characterWpm: number
  effectiveWpm: number
}

export const clampListenWpm = (value: number) =>
  Math.max(WPM_RANGE.min, Math.min(WPM_RANGE.max, Math.round(value)))

export const clampListenEffectiveWpm = (value: number) =>
  Math.max(
    EFFECTIVE_WPM_RANGE.min,
    Math.min(EFFECTIVE_WPM_RANGE.max, Math.round(value)),
  )

export const normalizeListenSpeeds = (
  characterWpm: number,
  effectiveWpm: number,
): ListenSpeeds => {
  const resolvedCharacterWpm = clampListenWpm(characterWpm)
  const resolvedEffectiveWpm = clampListenEffectiveWpm(
    Math.min(effectiveWpm, resolvedCharacterWpm),
  )
  return {
    characterWpm: resolvedCharacterWpm,
    effectiveWpm: resolvedEffectiveWpm,
  }
}

export const getListenAutoTighteningStage = (correctCount: number) => {
  if (correctCount >= LISTEN_AUTO_TIGHTENING_STAGE_THRESHOLDS.tight) {
    return 2
  }
  if (correctCount >= LISTEN_AUTO_TIGHTENING_STAGE_THRESHOLDS.medium) {
    return 1
  }
  return 0
}

export const getAutoEffectiveWpm = (characterWpm: number, correctCount: number) => {
  const stage = getListenAutoTighteningStage(correctCount)
  const targetGap = stage === 0 ? 4 : stage === 1 ? 2 : 0
  return normalizeListenSpeeds(characterWpm, characterWpm - targetGap).effectiveWpm
}

export const getListenUnitMs = (wpm: number, minUnitMs: number) =>
  Math.max(Math.round(1200 / wpm), minUnitMs)

/**
 * Farnsworth unit (t_fdit) in ms per the ARRL/Bloom 1990 standard:
 *   t_fdit = (300·Wc − 186·Wf) / (95·Wc·Wf)  seconds
 * "PARIS " is 31 character-speed units inside characters plus 19 Farnsworth
 * units between characters/words, summing to 60/Wf seconds total throughput.
 * When Wf >= Wc no stretching is needed and the character unit is returned.
 */
export const getFarnsworthUnitMs = (
  characterWpm: number,
  effectiveWpm: number,
  minUnitMs: number,
) => {
  const characterUnitMs = getListenUnitMs(characterWpm, minUnitMs)
  if (effectiveWpm >= characterWpm) {
    return characterUnitMs
  }
  const tFditSeconds =
    (300 * characterWpm - 186 * effectiveWpm) /
    (95 * characterWpm * effectiveWpm)
  return Math.max(Math.round(tFditSeconds * 1000), characterUnitMs, minUnitMs)
}
