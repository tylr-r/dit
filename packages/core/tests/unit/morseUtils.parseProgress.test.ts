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
