import { describe, expect, it } from 'vitest'
import { getKeyboardMorseSymbol } from '../../../src/utils/morseKeyboardInput'

const eventFor = (code: string, key = '') => ({ code, key })

describe('getKeyboardMorseSymbol', () => {
  it('maps VBand paddle control keys to dit and dah symbols', () => {
    expect(getKeyboardMorseSymbol(eventFor('ControlLeft', 'Control'))).toBe('.')
    expect(getKeyboardMorseSymbol(eventFor('ControlRight', 'Control'))).toBe('-')
  })

  it('maps VBand keyboard paddle keys to dit and dah symbols', () => {
    expect(getKeyboardMorseSymbol(eventFor('BracketLeft', '['))).toBe('.')
    expect(getKeyboardMorseSymbol(eventFor('BracketRight', ']'))).toBe('-')
  })

  it('ignores regular shortcut keys', () => {
    expect(getKeyboardMorseSymbol(eventFor('KeyF', 'f'))).toBeNull()
    expect(getKeyboardMorseSymbol(eventFor('Space', ' '))).toBeNull()
  })
})
