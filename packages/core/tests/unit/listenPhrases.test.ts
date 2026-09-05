import { describe, expect, it } from 'vitest'
import { LISTEN_PHRASES, LISTEN_WORD_BANKS } from '../../src/data/listenPhrases'
import { PRACTICE_WORDS } from '../../src/data/practiceWords'
import type { Letter } from '../../src/data/morse'
import { textToMorseCode } from '../../src/utils/customListenText'
import {
  createListenPhraseRound,
  getEligibleListenPhrases,
  type ListenPhrase,
} from '../../src/utils/listenPhrases'

const phrases: readonly ListenPhrase[] = [
  {
    id: 'one',
    text: 'QRS',
    meaning: 'Send slower',
    difficulty: 'short',
    parts: [],
  },
  {
    id: 'two',
    text: 'AGN',
    meaning: 'Again',
    difficulty: 'short',
    parts: [],
  },
  {
    id: 'three',
    text: 'TNX',
    meaning: 'Thanks',
    difficulty: 'short',
    parts: [],
  },
  {
    id: 'four',
    text: 'QRL',
    meaning: 'The frequency is in use',
    difficulty: 'short',
    parts: [],
  },
  {
    id: 'five',
    text: 'WX',
    meaning: 'Weather',
    difficulty: 'short',
    parts: [],
  },
] as const

describe('getEligibleListenPhrases', () => {
  it('excludes phrases containing characters outside the active set', () => {
    const activeLetters = 'QRS'.split('') as Letter[]

    expect(getEligibleListenPhrases(phrases, activeLetters).map((phrase) => phrase.id)).toEqual([
      'one',
    ])
  })
})

describe('createListenPhraseRound', () => {
  it('creates four unique options that include the target', () => {
    const round = createListenPhraseRound(phrases, {
      random: () => 0,
    })

    expect(round).not.toBeNull()
    expect(round?.options).toHaveLength(4)
    expect(new Set(round?.options.map((phrase) => phrase.id)).size).toBe(4)
    expect(round?.options.some((phrase) => phrase.id === round.target.id)).toBe(true)
  })

  it('avoids immediately repeating the previous target', () => {
    const round = createListenPhraseRound(phrases, {
      previousTargetId: 'one',
      random: () => 0,
    })

    expect(round?.target.id).toBe('two')
  })

  it('returns null when fewer than four phrases qualify', () => {
    expect(createListenPhraseRound(phrases.slice(0, 3))).toBeNull()
  })
})

describe('LISTEN_PHRASES', () => {
  it('builds English rounds from the existing bank without radio shorthand', () => {
    const words = LISTEN_WORD_BANKS.common.map((word) => word.text)
    expect(words).toContain('HELLO')
    expect(words).toContain('TIME')
    expect(words.every((word) => (PRACTICE_WORDS as readonly string[]).includes(word))).toBe(true)
    for (const code of ['CQ', 'DE', 'QSO', 'QTH', 'QSL', 'RST', 'SOS']) {
      expect(words).not.toContain(code)
    }
    const eligible = getEligibleListenPhrases(LISTEN_WORD_BANKS.common, ['T', 'E', 'A', 'M'])
    const round = createListenPhraseRound(eligible, { random: () => 0 })
    expect(round?.options).toHaveLength(4)
    expect(round?.options.every((word) => /^[TEAM]+$/.test(word.text))).toBe(true)
  })

  it('keeps every Q-code answer and distractor within the Q-code bank', () => {
    const round = createListenPhraseRound(LISTEN_WORD_BANKS['q-codes'], { random: () => 0 })
    expect(round?.options).toHaveLength(4)
    expect(LISTEN_WORD_BANKS['q-codes'].every((word) => /^Q[A-Z]{2}$/.test(word.text))).toBe(true)
    expect(round?.target.meaning).toBeTruthy()
  })

  it('ships playable single-token CW words with teaching definitions', () => {
    expect(LISTEN_PHRASES.length).toBeGreaterThanOrEqual(20)

    for (const phrase of LISTEN_PHRASES) {
      const encoded = textToMorseCode(phrase.text)
      expect(phrase.text).not.toMatch(/\s/)
      expect(encoded.normalized).toBe(phrase.text)
      expect(encoded.ignored).toBe(0)
      expect(encoded.code).not.toBe('')
      expect(phrase.parts).toHaveLength(1)
      expect(phrase.parts[0]?.code).toBe(phrase.text)
    }
  })
})
