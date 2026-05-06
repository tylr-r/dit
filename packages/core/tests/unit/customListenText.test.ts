import { describe, expect, it } from 'vitest'
import {
  normalizeCustomText,
  textToMorseCode,
} from '../../src/utils/customListenText'

describe('normalizeCustomText', () => {
  it('uppercases letters and keeps digits and single spaces', () => {
    const result = normalizeCustomText('hello 123')
    expect(result.normalized).toBe('HELLO 123')
    expect(result.ignored).toBe(0)
  })

  it('strips unsupported characters and counts them', () => {
    const result = normalizeCustomText('hi! how are you?')
    expect(result.normalized).toBe('HI HOW ARE YOU')
    expect(result.ignored).toBe(2) // '!' and '?'; whitespace collapses silently
  })

  it('collapses newlines and tabs to a single space', () => {
    const result = normalizeCustomText('line one\nline\ttwo')
    expect(result.normalized).toBe('LINE ONE LINE TWO')
    expect(result.ignored).toBe(0)
  })

  it('collapses runs of whitespace to a single space', () => {
    const result = normalizeCustomText('a    b\n\n\nc')
    expect(result.normalized).toBe('A B C')
  })

  it('trims leading and trailing whitespace', () => {
    const result = normalizeCustomText('   hi   ')
    expect(result.normalized).toBe('HI')
  })

  it('returns empty string when input is only whitespace or unsupported', () => {
    expect(normalizeCustomText('   ').normalized).toBe('')
    expect(normalizeCustomText('!!!').normalized).toBe('')
    expect(normalizeCustomText('!!!').ignored).toBe(3)
  })

  it('truncates to the configured cap and reports the trim', () => {
    const long = 'A'.repeat(2050)
    const result = normalizeCustomText(long, { maxChars: 2000 })
    expect(result.normalized).toHaveLength(2000)
    expect(result.truncated).toBe(true)
  })
})

describe('textToMorseCode', () => {
  it('returns empty code for empty text', () => {
    expect(textToMorseCode('').code).toBe('')
  })

  it('joins letter codes with single spaces inside a word', () => {
    expect(textToMorseCode('AB').code).toBe('.- -...')
  })

  it('separates words with a forward slash flanked by spaces', () => {
    expect(textToMorseCode('A B').code).toBe('.- / -...')
  })

  it('handles a multi-word passage with digits', () => {
    expect(textToMorseCode('SOS 12').code).toBe(
      '... --- ... / .---- ..---',
    )
  })

  it('reports ignored characters from normalization', () => {
    const result = textToMorseCode('hi!')
    expect(result.ignored).toBe(1)
    expect(result.normalized).toBe('HI')
    expect(result.code).toBe('.... ..')
  })

  it('produces valid code when truncation lands on a word boundary', () => {
    // 'B ' repeated produces a normalized string where every odd index is a
    // space; truncating at maxChars=2000 (odd index 1999) lands on a space.
    const result = textToMorseCode('B '.repeat(2000), { maxChars: 2000 })
    expect(result.normalized).not.toMatch(/ $/)
    expect(result.code).not.toMatch(/ \/ $/)
    expect(result.truncated).toBe(true)
  })
})
