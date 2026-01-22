import { describe, expect, it } from 'vitest'
import { MORSE_DATA } from '../../src'

describe('MORSE_DATA', () => {
  it('contains 36 characters', () => {
    expect(Object.keys(MORSE_DATA)).toHaveLength(36)
  })

  it('uses unique morse codes', () => {
    const codes = Object.values(MORSE_DATA).map((entry) => entry.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('uses only dots and dashes in codes', () => {
    Object.values(MORSE_DATA).forEach((entry) => {
      expect(entry.code).toMatch(/^[.-]+$/)
    })
  })
})
