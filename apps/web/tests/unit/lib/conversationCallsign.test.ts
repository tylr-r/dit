import { describe, expect, it } from 'vitest'
import { generatePracticeCallsign } from '../../../src/lib/conversationCallsign'

describe('generatePracticeCallsign', () => {
  it('generates a US-style practice callsign', () => {
    const randomValues = [0, 0.1, 0, 0.04, 0.08]
    const random = () => randomValues.shift() ?? 0

    expect(generatePracticeCallsign({ random })).toBe('K1ABC')
  })

  it('does not repeat the previous callsign', () => {
    const randomValues = [0, 0.1, 0, 0.04, 0.08]
    const random = () => randomValues.shift() ?? 0

    expect(generatePracticeCallsign({ random, previousCallsign: 'K1ABC' })).toBe('K1ABD')
  })
})
