import { describe, expect, it } from 'vitest'
import { parseProgress } from '../../src/utils/morseUtils'

const OPTS = { listenWpmMin: 10, listenWpmMax: 40 } as const

describe('parseProgress nuxCompleted', () => {
  it('reads nuxCompleted when it is a boolean', () => {
    const parsed = parseProgress({ nuxCompleted: true }, OPTS)
    expect(parsed?.nuxCompleted).toBe(true)
  })

  it('omits nuxCompleted when missing', () => {
    const parsed = parseProgress({}, OPTS)
    expect(parsed?.nuxCompleted).toBeUndefined()
  })

  it('ignores non-boolean nuxCompleted values', () => {
    const parsed = parseProgress({ nuxCompleted: 'yes' }, OPTS)
    expect(parsed?.nuxCompleted).toBeUndefined()
  })
})

describe('parseProgress customLetters', () => {
  it('reads customLetters when it is a list of valid Letter strings', () => {
    const parsed = parseProgress({ customLetters: ['A', 'B', '1'] }, OPTS)
    expect(parsed?.customLetters).toEqual(['A', 'B', '1'])
  })

  it('drops unknown entries and de-duplicates', () => {
    const parsed = parseProgress(
      { customLetters: ['A', 'A', 'zz', 5, null, 'B'] },
      OPTS,
    )
    expect(parsed?.customLetters).toEqual(['A', 'B'])
  })

  it('omits customLetters when missing or non-array', () => {
    expect(parseProgress({}, OPTS)?.customLetters).toBeUndefined()
    expect(parseProgress({ customLetters: 'A' }, OPTS)?.customLetters).toBeUndefined()
  })
})

describe('parseProgress guidedMaxPackReached', () => {
  it('reads guidedMaxPackReached when it is a finite number', () => {
    const parsed = parseProgress({ guidedMaxPackReached: 5 }, OPTS)
    expect(parsed?.guidedMaxPackReached).toBe(5)
  })

  it('clamps and rounds odd inputs', () => {
    expect(parseProgress({ guidedMaxPackReached: -3 }, OPTS)?.guidedMaxPackReached).toBe(
      0,
    )
    expect(parseProgress({ guidedMaxPackReached: 4.7 }, OPTS)?.guidedMaxPackReached).toBe(
      5,
    )
  })

  it('omits guidedMaxPackReached when missing or non-numeric', () => {
    expect(parseProgress({}, OPTS)?.guidedMaxPackReached).toBeUndefined()
    expect(
      parseProgress({ guidedMaxPackReached: 'lots' }, OPTS)?.guidedMaxPackReached,
    ).toBeUndefined()
  })
})
