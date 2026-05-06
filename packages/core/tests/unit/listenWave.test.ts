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

  it('returns expected tone levels for dot-dash in single letter', () => {
    const unitMs = 100
    expect(getListenToneLevelAtElapsedMs('.-', unitMs, 20)).toBeCloseTo(0.72)
    expect(getListenToneLevelAtElapsedMs('.-', unitMs, 230)).toBe(1)
  })

  it('computes duration across multi-letter sequences with inter-character gaps', () => {
    // 'AB' = '.- -...': dot 1u, gap 1u, dash 3u, ICG 3u, dash 3u, gap 1u, dot 1u, gap 1u, dot 1u, gap 1u, dot 1u
    // = 1+1+3+3+3+1+1+1+1+1+1 = 17 units
    // Plus trailing inter-character gap (3u) = 20 units total
    // Note: this test uses unit==1ms for clarity.
    const duration = getListenPlaybackDurationMs('.- -...', 1, 3)
    expect(duration).toBe(20)
  })

  it('uses inter-word gap for / tokens', () => {
    // '. / .' : dot 1u, IWG, dot 1u, trailing ICG
    // 1 + 7 + 1 + 3 = 12
    const duration = getListenPlaybackDurationMs('. / .', 1, 3, 7)
    expect(duration).toBe(12)
  })

  it('returns dot energy mid-first-letter of a multi-letter sequence', () => {
    const level = getListenToneLevelAtElapsedMs('.- -...', 100, 50, 300)
    expect(level).toBeCloseTo(0.72)
  })

  it('returns 0 during the inter-character gap of a multi-letter sequence', () => {
    // Char 1: '.': 0..100 dot, 100..200 intra-letter gap, '-': 200..500 dash
    // ICG: 500..800
    // Sample at 600 → ICG → 0
    const level = getListenToneLevelAtElapsedMs('.- -...', 100, 600, 300)
    expect(level).toBe(0)
  })

  it('returns dash energy mid-first-letter of the second word', () => {
    // '. / -': dot 0..100, IWG 100..800, dash 800..1100
    // Sample at 900 → dash → 1
    const level = getListenToneLevelAtElapsedMs('. / -', 100, 900, 300, 700)
    expect(level).toBe(1)
  })

  it('preserves single-letter behavior when no spaces or slashes are present', () => {
    // Existing single-letter callers in the codebase pass strings like '.-'
    // with no spaces. Both helpers must match prior outputs for those.
    expect(getListenPlaybackDurationMs('.-', 100, 696)).toBe(1196)
    expect(getListenToneLevelAtElapsedMs('.-', 100, 20, 696)).toBeCloseTo(0.72)
    expect(getListenToneLevelAtElapsedMs('.-', 100, 230, 696)).toBe(1)
    expect(getListenToneLevelAtElapsedMs('.-', 100, 900, 696)).toBe(0)
  })
})
