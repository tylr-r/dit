import { describe, expect, it } from 'vitest'
import {
  computeReferenceScoreMaxDeviation,
  computeReferenceScoreMedian,
  getReferenceAbsoluteScoreTint,
  getReferenceRelativeScoreTint,
} from '../../src/utils/referenceTint'

describe('referenceTint', () => {
  it('computes median and max deviation for mastered scores', () => {
    expect(computeReferenceScoreMedian([2, 4, 8])).toBe(4)
    expect(computeReferenceScoreMaxDeviation([2, 4, 8], 4)).toBe(4)
  })

  it('returns absolute tint for non-zero scores', () => {
    expect(getReferenceAbsoluteScoreTint(3)?.alpha).toBeGreaterThan(0)
    expect(getReferenceAbsoluteScoreTint(0)).toBeNull()
  })

  it('returns relative tint only when spread is meaningful', () => {
    expect(getReferenceRelativeScoreTint(8, 4, 4)?.green).toBe(242)
    expect(getReferenceRelativeScoreTint(4, 4, 2)).toBeNull()
  })
})
