import { EFFECTIVE_WPM_RANGE, WPM_RANGE } from '@dit/core'
import { describe, expect, it } from 'vitest'
import {
  clampListenEffectiveWpm,
  clampListenWpm,
  getAutoEffectiveWpm,
  LISTEN_AUTO_TIGHTENING_STAGE_THRESHOLDS,
  normalizeListenSpeeds,
} from '../../src/utils/listenSpeed'

describe('listenSpeed utils', () => {
  it('clamps listen character and effective wpm to configured ranges', () => {
    expect(clampListenWpm(WPM_RANGE.min - 10)).toBe(WPM_RANGE.min)
    expect(clampListenWpm(WPM_RANGE.max + 10)).toBe(WPM_RANGE.max)
    expect(clampListenEffectiveWpm(EFFECTIVE_WPM_RANGE.min - 10)).toBe(
      EFFECTIVE_WPM_RANGE.min,
    )
    expect(clampListenEffectiveWpm(EFFECTIVE_WPM_RANGE.max + 10)).toBe(
      EFFECTIVE_WPM_RANGE.max,
    )
  })

  it('normalizes listen speeds so effective wpm never exceeds character wpm', () => {
    const normalized = normalizeListenSpeeds(12, 20)
    expect(normalized).toEqual({
      characterWpm: 12,
      effectiveWpm: 12,
    })
  })

  it('auto-tightens effective speed as correct streak grows', () => {
    expect(getAutoEffectiveWpm(12, 0)).toBe(8)
    expect(
      getAutoEffectiveWpm(
        12,
        LISTEN_AUTO_TIGHTENING_STAGE_THRESHOLDS.medium,
      ),
    ).toBe(10)
    expect(
      getAutoEffectiveWpm(12, LISTEN_AUTO_TIGHTENING_STAGE_THRESHOLDS.tight),
    ).toBe(12)
  })
})
