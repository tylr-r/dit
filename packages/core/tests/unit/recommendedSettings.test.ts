import { describe, expect, it } from 'vitest'
import { getRecommendedSettings } from '../../src/utils/recommendedSettings'

describe('getRecommendedSettings', () => {
  it('returns known-user presets', () => {
    const settings = getRecommendedSettings('known')
    expect(settings.showHint).toBe(false)
    expect(settings.showMnemonic).toBe(false)
    expect(settings.maxLevel).toBe(3)
    expect(settings.practiceLearnMode).toBe(true)
  })

  it('returns beginner presets with helpers enabled', () => {
    const settings = getRecommendedSettings('beginner')
    expect(settings.showHint).toBe(true)
    expect(settings.showMnemonic).toBe(true)
    expect(settings.maxLevel).toBe(1)
    expect(settings.practiceIfrMode).toBe(false)
  })

  it('defaults to beginner presets when profile is unset', () => {
    expect(getRecommendedSettings(null).maxLevel).toBe(1)
    expect(getRecommendedSettings(undefined).showHint).toBe(true)
  })
})
