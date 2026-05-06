import { describe, expect, it } from 'vitest'
import { customListenDiff } from '../../src/utils/customListenDiff'

describe('customListenDiff', () => {
  it('returns a single ok token for a perfect match', () => {
    const result = customListenDiff('HELLO', 'HELLO')
    expect(result.tokens).toEqual([{ kind: 'ok', text: 'HELLO' }])
    expect(result.matched).toBe(5)
    expect(result.missed).toBe(0)
    expect(result.extra).toBe(0)
    expect(result.total).toBe(5)
  })

  it('renders an empty user copy as one gap token', () => {
    const result = customListenDiff('HI', '')
    expect(result.tokens).toEqual([{ kind: 'gap', text: '··' }])
    expect(result.missed).toBe(2)
    expect(result.matched).toBe(0)
  })

  it('models a substitution as miss + extra', () => {
    const result = customListenDiff('FOX', 'FOA')
    expect(result.tokens).toEqual([
      { kind: 'ok', text: 'FO' },
      { kind: 'miss', text: 'X' },
      { kind: 'extra', text: 'A' },
    ])
    expect(result.matched).toBe(2)
    expect(result.missed).toBe(1)
    expect(result.extra).toBe(1)
    expect(result.total).toBe(3)
  })

  it('renders trailing source-only chars as a gap', () => {
    const result = customListenDiff('HELLO', 'HEL')
    expect(result.tokens).toEqual([
      { kind: 'ok', text: 'HEL' },
      { kind: 'gap', text: '··' },
    ])
    expect(result.matched).toBe(3)
    expect(result.missed).toBe(2)
    expect(result.extra).toBe(0)
  })

  it('renders extra chars in the middle without affecting alignment', () => {
    const result = customListenDiff('LAZY', 'LAZZY')
    expect(result.tokens).toEqual([
      { kind: 'ok', text: 'LAZ' },
      { kind: 'extra', text: 'Z' },
      { kind: 'ok', text: 'Y' },
    ])
    expect(result.extra).toBe(1)
    expect(result.matched).toBe(4)
  })

  it('renders missed chars in the middle as miss when typed continues afterward', () => {
    const result = customListenDiff('HELLO', 'HLO')
    // LCS gives: H, ., ., L, O matched at H, L, O — drops E and L from source
    expect(result.matched).toBe(3)
    expect(result.missed).toBe(2)
    expect(result.tokens.some((t) => t.kind === 'miss')).toBe(true)
  })

  it('handles spaces as ordinary characters in alignment', () => {
    const result = customListenDiff('A B', 'AB')
    expect(result.matched).toBe(2)
    expect(result.missed).toBe(1)
  })

  it('returns total equal to source length even with extras', () => {
    const result = customListenDiff('AB', 'XABY')
    expect(result.total).toBe(2)
    expect(result.matched).toBe(2)
    expect(result.extra).toBe(2)
  })

  it('anchors matches to the earliest source position', () => {
    const result = customListenDiff('LISTEN LISTEN', 'LISTEN')
    expect(result.tokens[0]).toEqual({ kind: 'ok', text: 'LISTEN' })
    expect(result.matched).toBe(6)
    expect(result.missed).toBe(7)
    expect(result.tokens[1].kind).toBe('gap')
  })
})
