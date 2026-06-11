import { describe, expect, it } from 'vitest'
import { AUDIO_VOLUME, AUDIO_VOLUME_MAX } from '../../src/constants'
import { LISTEN_MIN_UNIT_MS } from '../../src/utils/appState'
import { buildPlaybackToneRequest, resolveToneVolume } from '../../src/utils/audio'

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

describe('buildPlaybackToneRequest', () => {
  it('uses listen WPM and tone frequency from settings', () => {
    expect(
      buildPlaybackToneRequest('-', {
        listenWpm: 18,
        listenEffectiveWpm: 14,
        toneFrequency: 720,
      }),
    ).toEqual({
      code: '-',
      characterWpm: 18,
      effectiveWpm: 14,
      minUnitMs: LISTEN_MIN_UNIT_MS,
      frequency: 720,
    })
  })

  it('falls back to listen WPM when effective WPM is unset', () => {
    expect(
      buildPlaybackToneRequest('.', {
        listenWpm: 22,
        toneFrequency: 600,
      }).effectiveWpm,
    ).toBe(22)
  })
})
