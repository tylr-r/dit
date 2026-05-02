import { describe, expect, it } from 'vitest'
import {
  getListenPlaybackDurationMs,
  getListenTiming,
  getListenToneLevelAtElapsedMs,
  getListenUnitMs,
} from '../../src/utils/listenWave'

describe('listenWave utils', () => {
  it('clamps listen unit time by minUnitMs', () => {
    expect(getListenUnitMs(20, 40)).toBe(60)
    expect(getListenUnitMs(40, 40)).toBe(40)
    expect(getListenUnitMs(100, 40)).toBe(40)
  })

  it('computes ARRL Farnsworth-stretched character gaps', () => {
    // Wc=12, Wf=8 → t_fdit = (300·12 − 186·8) / (95·12·8) ≈ 0.2316 s ≈ 232 ms
    // inter-character gap = 3 · t_fdit ≈ 696 ms
    const timing = getListenTiming(12, 8, 40)
    expect(timing.unitMs).toBe(100)
    expect(timing.interCharacterGapMs).toBe(696)
  })

  it('returns the character unit when effective speed matches or exceeds it', () => {
    // No Farnsworth stretching: 1:3:1:3:7 standard ratios apply.
    const timing = getListenTiming(20, 20, 40)
    expect(timing.unitMs).toBe(60)
    expect(timing.interCharacterGapMs).toBe(180)
  })

  it('computes playback duration including symbol and character gaps', () => {
    expect(getListenPlaybackDurationMs('.-', 100, 696)).toBe(1196)
    expect(getListenPlaybackDurationMs(' . x - ', 100, 696)).toBe(1196)
    expect(getListenPlaybackDurationMs('', 100, 696)).toBe(0)
  })

  it('returns expected tone levels for dot and dash segments', () => {
    const unitMs = 100
    const interCharacterGapMs = 696
    const dotLevel = getListenToneLevelAtElapsedMs(
      '.-',
      unitMs,
      20,
      interCharacterGapMs,
    )
    const firstGapLevel = getListenToneLevelAtElapsedMs(
      '.-',
      unitMs,
      120,
      interCharacterGapMs,
    )
    const dashLevel = getListenToneLevelAtElapsedMs(
      '.-',
      unitMs,
      230,
      interCharacterGapMs,
    )
    const tailGapLevel = getListenToneLevelAtElapsedMs(
      '.-',
      unitMs,
      900,
      interCharacterGapMs,
    )

    expect(dotLevel).toBeCloseTo(0.72)
    expect(firstGapLevel).toBe(0)
    expect(dashLevel).toBe(1)
    expect(tailGapLevel).toBe(0)
  })

  it('ignores non-morse symbols when resolving tone levels', () => {
    const unitMs = 100
    expect(getListenToneLevelAtElapsedMs(' . x - ', unitMs, 20)).toBeCloseTo(
      0.72,
    )
    expect(getListenToneLevelAtElapsedMs(' . x - ', unitMs, 250)).toBe(1)
  })
})
