import { describe, expect, it } from 'vitest'
import { AUDIO_VOLUME, AUDIO_VOLUME_MAX } from '../../src/constants'
import { resolveToneVolume } from '../../src/utils/audio'

describe('resolveToneVolume', () => {
  it('returns the shared default when no override is passed', () => {
    expect(resolveToneVolume()).toBe(AUDIO_VOLUME)
  })

  it('clamps overrides to the configured max', () => {
    expect(resolveToneVolume(1)).toBe(AUDIO_VOLUME_MAX)
  })

  it('clamps negative values to zero', () => {
    expect(resolveToneVolume(-0.5)).toBe(0)
  })

  it('passes through values within range', () => {
    expect(resolveToneVolume(0.5)).toBe(0.5)
  })
})
