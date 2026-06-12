import { describe, expect, it } from 'vitest'
import { resolvePracticeFeedbackColor } from '../../src/components/stageFeedback'
import { colors } from '../../src/design/tokens'

describe('resolvePracticeFeedbackColor', () => {
  it('uses success green for correct practice feedback', () => {
    expect(resolvePracticeFeedbackColor('success')).toBe(colors.feedback.success)
  })

  it('uses error red for missed practice feedback', () => {
    expect(resolvePracticeFeedbackColor('error')).toBe(colors.feedback.error)
  })

  it('does not tint idle practice feedback', () => {
    expect(resolvePracticeFeedbackColor('idle')).toBeNull()
  })
})
