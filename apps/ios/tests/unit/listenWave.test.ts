import { describe, expect, it } from 'vitest'
import {
  getListenToneLevelAtElapsedMs,
  getListenUnitMs,
} from '../../src/utils/listenWave'

describe('listenWave utils', () => {
  it('clamps listen unit time by minUnitMs', () => {
    expect(getListenUnitMs(20, 40)).toBe(60)
    expect(getListenUnitMs(40, 40)).toBe(40)
    expect(getListenUnitMs(100, 40)).toBe(40)
  })

  it('returns expected tone levels for dot and dash segments', () => {
    const unitMs = 100
    const dotLevel = getListenToneLevelAtElapsedMs('.-', unitMs, 20)
    const firstGapLevel = getListenToneLevelAtElapsedMs('.-', unitMs, 120)
    const dashLevel = getListenToneLevelAtElapsedMs('.-', unitMs, 230)
    const tailGapLevel = getListenToneLevelAtElapsedMs('.-', unitMs, 520)

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
