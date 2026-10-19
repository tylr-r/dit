import { describe, expect, it } from 'vitest'
import {
  decodeConversationMorseCode,
  getReceivedConversationTextAtElapsedMs,
  textToConversationMorseCode,
} from '../../src/utils/conversationMorse'
import { textToMorseCode } from '../../src/utils/customListenText'
import { decodeMorseCode } from '../../src/utils/morseUtils'

describe('Conversation Morse', () => {
  it.each([
    ['K', '-.-'], ['KN', '-.--.'], ['BK', '-...-.-'], ['AR', '.-.-.'],
    ['SK', '...-.-'], ['BT', '-...-'], ['AS', '.-...'], ['HH', '........'],
  ])('encodes and decodes the joined %s signal', (name, code) => {
    expect(textToConversationMorseCode(name).code).toBe(code)
    expect(decodeConversationMorseCode(code)).toBe(name)
  })

  it('preserves letter spacing inside callsigns and ordinary words', () => {
    const text = 'W1ASK SKY START ARSK 5NN'
    expect(textToConversationMorseCode(text)).toEqual(textToMorseCode(text))
  })

  it('preserves ordinary input decoding and rejects unknown patterns', () => {
    expect(decodeConversationMorseCode('.-')).toBe('A')
    expect(decodeConversationMorseCode('...--')).toBe('3')
    expect(decodeConversationMorseCode('.........')).toBeNull()
  })

  it('keeps custom Listen and the scored alphabet separate from prosigns', () => {
    expect(textToMorseCode('AR SK').code).toBe('.- .-. / ... -.-')
    expect(decodeMorseCode('.-.-.')).toBeNull()
    expect(decodeMorseCode('...-.-')).toBeNull()
  })

  it('keeps normalization and empty input handling consistent with custom Listen', () => {
    expect(textToConversationMorseCode('  73 <sk>!  ')).toEqual({
      normalized: '73 SK', code: '--... ...-- / ...-.-', ignored: 3, truncated: false,
    })
    expect(textToConversationMorseCode('')).toEqual(textToMorseCode(''))
  })

  it('reveals each prosign atomically and keeps following text aligned', () => {
    const text = 'E AR T'
    const { code } = textToConversationMorseCode(text)
    const received = (elapsed: number) => getReceivedConversationTextAtElapsedMs(text, code, 100, elapsed)
    expect(received(799)).toBe('E')
    expect(received(800)).toBe('E ')
    expect(received(2099)).toBe('E ')
    expect(received(2100)).toBe('E AR')
    expect(received(2799)).toBe('E AR')
    expect(received(2800)).toBe('E AR ')
    expect(received(3099)).toBe('E AR ')
    expect(received(3100)).toBe(text)
  })
})
