import type { Letter } from '../data/morse'

export type ListenPhraseDifficulty = 'short' | 'medium' | 'long'

export type ListenPhrasePart = {
  code: string
  meaning: string
}

export type ListenPhrase = {
  id: string
  text: string
  meaning?: string
  difficulty: ListenPhraseDifficulty
  parts: readonly ListenPhrasePart[]
}

export type ListenPhraseRound = {
  target: ListenPhrase
  options: readonly ListenPhrase[]
}

type CreateListenPhraseRoundOptions = {
  previousTargetId?: string
  random?: () => number
}

/** Return CW words that contain only characters the learner has available. */
export const getEligibleListenPhrases = (
  phrases: readonly ListenPhrase[],
  availableLetters: readonly Letter[],
) => {
  const available = new Set<string>(availableLetters)
  return phrases.filter((phrase) =>
    [...phrase.text].every((character) => character === ' ' || available.has(character)),
  )
}

const pickIndex = (length: number, random: () => number) =>
  Math.min(length - 1, Math.floor(random() * length))

const shuffle = <T>(values: readonly T[], random: () => number) => {
  const next = [...values]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = pickIndex(index + 1, random)
    const current = next[index]
    next[index] = next[swapIndex]
    next[swapIndex] = current
  }
  return next
}

/** Create a four-choice CW word round, preferring distractors of equal difficulty. */
export const createListenPhraseRound = (
  phrases: readonly ListenPhrase[],
  options: CreateListenPhraseRoundOptions = {},
): ListenPhraseRound | null => {
  if (phrases.length < 4) {
    return null
  }

  const random = options.random ?? Math.random
  const targetPool = phrases.filter((phrase) => phrase.id !== options.previousTargetId)
  const target = targetPool[pickIndex(targetPool.length, random)]
  const sameDifficulty = phrases.filter(
    (phrase) => phrase.id !== target.id && phrase.difficulty === target.difficulty,
  )
  const otherDifficulties = phrases.filter(
    (phrase) => phrase.id !== target.id && phrase.difficulty !== target.difficulty,
  )
  const distractors = [
    ...shuffle(sameDifficulty, random),
    ...shuffle(otherDifficulties, random),
  ].slice(0, 3)

  return {
    target,
    options: shuffle([target, ...distractors], random),
  }
}
