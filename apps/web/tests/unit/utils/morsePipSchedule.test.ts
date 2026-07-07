import { describe, expect, it } from 'vitest'
import { getFarnsworthUnitMs, getListenUnitMs } from '@dit/core'
import { buildMorsePipSchedule } from '../../../src/utils/morsePipSchedule'

describe('buildMorsePipSchedule', () => {
  it('mirrors the audio timing for a single character', () => {
    const unit = getListenUnitMs(18, 40)
    const schedule = buildMorsePipSchedule('.-', 18, 18)
    expect(schedule.pips).toHaveLength(2)
    expect(schedule.pips[0]).toMatchObject({ symbol: '.', startMs: 0 })
    expect(schedule.pips[0].durationMs).toBe(unit)
    // dah starts after dit (1 unit) + intra-character gap (1 unit)
    expect(schedule.pips[1]).toMatchObject({ symbol: '-', startMs: unit * 2 })
    expect(schedule.pips[1].durationMs).toBe(unit * 3)
    expect(schedule.totalMs).toBe(unit * 5)
  })

  it('separates characters by three Farnsworth units', () => {
    const characterWpm = 18
    const effectiveWpm = 8
    const unit = getListenUnitMs(characterWpm, 40)
    const farnsworth = getFarnsworthUnitMs(characterWpm, effectiveWpm, 40)
    const schedule = buildMorsePipSchedule('. .', characterWpm, effectiveWpm)
    expect(schedule.pips).toHaveLength(2)
    expect(schedule.pips[1].startMs).toBe(unit + farnsworth * 3)
    expect(schedule.pips[1].tokenIndex).toBe(1)
  })

  it('widens the inter-character gap when effective WPM drops', () => {
    const real = buildMorsePipSchedule('. .', 18, 18)
    const think = buildMorsePipSchedule('. .', 18, 8)
    expect(think.pips[1].startMs).toBeGreaterThan(real.pips[1].startMs)
  })

  it('advances seven Farnsworth units for word gaps', () => {
    const farnsworth = getFarnsworthUnitMs(18, 18, 40)
    const unit = getListenUnitMs(18, 40)
    const schedule = buildMorsePipSchedule('. / .', 18, 18)
    expect(schedule.pips[1].startMs).toBe(unit + farnsworth * 7)
  })

  it('ignores tokens that are not morse symbols', () => {
    const schedule = buildMorsePipSchedule('.  x  -', 18, 18)
    expect(schedule.pips.map((pip) => pip.symbol)).toEqual(['.', '-'])
  })
})
