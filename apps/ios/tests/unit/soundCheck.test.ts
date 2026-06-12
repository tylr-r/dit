import { describe, expect, it } from 'vitest'
import {
  isOutputVolumeSufficient,
  SOUND_CHECK_MIN_OUTPUT_VOLUME,
} from '../../src/utils/soundCheck'

describe('isOutputVolumeSufficient', () => {
  it('treats very low output volume as insufficient', () => {
    expect(isOutputVolumeSufficient(0)).toBe(false)
    expect(isOutputVolumeSufficient(SOUND_CHECK_MIN_OUTPUT_VOLUME - 0.01)).toBe(
      false,
    )
  })

  it('treats normal output volume as sufficient', () => {
    expect(isOutputVolumeSufficient(SOUND_CHECK_MIN_OUTPUT_VOLUME)).toBe(true)
    expect(isOutputVolumeSufficient(1)).toBe(true)
  })
})
