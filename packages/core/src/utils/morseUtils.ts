import { MORSE_DATA, type Letter } from '../data/morse'
import { PRACTICE_WORDS } from '../data/practiceWords'
import type {
  ListenTtrRecord,
  ParseProgressOptions,
  Progress,
  ScoreRecord,
} from '../types'

const LETTERS = Object.keys(MORSE_DATA) as Letter[]

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.round(value)))

export const formatWpm = (value: number) => {
  const rounded = Math.round(value * 10) / 10
  return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1)
}

export const getLettersForLevel = (maxLevel: number) =>
  LETTERS.filter((letter) => MORSE_DATA[letter].level <= maxLevel)

export const getRandomLetter = (
  letters: Letter[],
  previous?: Letter,
): Letter => {
  if (letters.length === 0) {
    return LETTERS[0]
  }
  if (letters.length === 1) {
    return letters[0]
  }
  if (!previous || !letters.includes(previous)) {
    return letters[Math.floor(Math.random() * letters.length)]
  }
  let next = previous
  while (next === previous) {
    next = letters[Math.floor(Math.random() * letters.length)]
  }
  return next
}

export const getWordsForLetters = (letters: Letter[]) => {
  const allowed = new Set(letters)
  const filtered = PRACTICE_WORDS.filter((word) =>
    word.split('').every((char) => allowed.has(char as Letter)),
  )
  return filtered.length > 0 ? filtered : letters.map((letter) => letter)
}

export const getRandomWord = (words: readonly string[], previous?: string) => {
  if (words.length === 0) {
    return LETTERS[0]
  }
  if (words.length === 1) {
    return words[0]
  }
  if (!previous || !words.includes(previous)) {
    return words[Math.floor(Math.random() * words.length)]
  }
  let next = previous
  while (next === previous) {
    next = words[Math.floor(Math.random() * words.length)]
  }
  return next
}

export const getRandomWeightedLetter = (
  letters: Letter[],
  scores: ScoreRecord,
  previous?: Letter,
): Letter => {
  if (letters.length === 0) {
    return LETTERS[0]
  }
  if (letters.length === 1) {
    return letters[0]
  }
  const maxScore = Math.max(...letters.map((item) => scores[item] ?? 0))
  const baseline = 3
  const weights = letters.map(
    (item) => Math.max(maxScore - (scores[item] ?? 0), 0) + baseline,
  )
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  let roll = Math.random() * totalWeight
  for (let index = 0; index < letters.length; index += 1) {
    roll -= weights[index]
    if (roll <= 0) {
      const picked = letters[index]
      if (picked === previous) {
        return letters[(index + 1) % letters.length]
      }
      return picked
    }
  }
  return letters[letters.length - 1]
}

export const getRandomLatencyAwareLetter = (
  letters: Letter[],
  scores: ScoreRecord,
  listenTtr: ListenTtrRecord = {},
  previous?: Letter,
): Letter => {
  if (letters.length === 0) {
    return LETTERS[0]
  }
  if (letters.length === 1) {
    return letters[0]
  }
  const maxScore = Math.max(...letters.map((item) => scores[item] ?? 0))
  const baseline = 3
  const weights = letters.map((item) => {
    const scoreWeakness = Math.max(maxScore - (scores[item] ?? 0), 0)
    const ttrEntry = listenTtr[item]
    // Keep latency influence intentionally light and only after enough data.
    const latencyWeakness =
      ttrEntry && ttrEntry.samples >= 5
        ? Math.min(2, Math.max(0, Math.round((ttrEntry.averageMs - 1000) / 700)))
        : 0
    return baseline + scoreWeakness + latencyWeakness
  })
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  let roll = Math.random() * totalWeight
  for (let index = 0; index < letters.length; index += 1) {
    roll -= weights[index]
    if (roll <= 0) {
      const picked = letters[index]
      if (picked === previous) {
        return letters[(index + 1) % letters.length]
      }
      return picked
    }
  }
  return letters[letters.length - 1]
}

export const initializeScores = (): ScoreRecord =>
  LETTERS.reduce(
    (acc, letter) => {
      acc[letter] = 0
      return acc
    },
    {} as ScoreRecord,
  )

export const applyScoreDelta = (
  scores: ScoreRecord,
  targetLetter: Letter,
  delta: number,
): ScoreRecord => ({
  ...scores,
  [targetLetter]: scores[targetLetter] + delta,
})

export const parseFirebaseScores = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    return null
  }
  const record = value as Record<string, unknown>
  const next = initializeScores()
  let hasScore = false
  LETTERS.forEach((letter) => {
    const entry = record[letter]
    if (typeof entry === 'number' && Number.isFinite(entry)) {
      next[letter] = entry
      hasScore = true
    }
  })
  return hasScore ? next : null
}

const parseListenTtr = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    return null
  }
  const record = value as Record<string, unknown>
  const next: ListenTtrRecord = {}
  let hasEntry = false
  LETTERS.forEach((letter) => {
    const entry = record[letter]
    if (!entry || typeof entry !== 'object') {
      return
    }
    const entryRecord = entry as Record<string, unknown>
    const averageMs = entryRecord.averageMs
    const samples = entryRecord.samples
    if (
      typeof averageMs !== 'number' ||
      !Number.isFinite(averageMs) ||
      typeof samples !== 'number' ||
      !Number.isFinite(samples)
    ) {
      return
    }
    next[letter] = {
      averageMs: Math.max(0, Math.round(averageMs)),
      samples: Math.max(1, Math.round(samples)),
    }
    hasEntry = true
  })
  return hasEntry ? next : null
}

export const parseProgress = (
  value: unknown,
  {
    listenWpmMin,
    listenWpmMax,
    listenEffectiveWpmMin = listenWpmMin,
    listenEffectiveWpmMax = listenWpmMax,
    levelMin = 1,
    levelMax = 4,
  }: ParseProgressOptions,
): Progress | null => {
  if (!value || typeof value !== 'object') {
    return null
  }
  const record = value as Record<string, unknown>
  const progress: Progress = {}
  if (typeof record.showHint === 'boolean') {
    progress.showHint = record.showHint
  }
  if (typeof record.showMnemonic === 'boolean') {
    progress.showMnemonic = record.showMnemonic
  }
  if (typeof record.wordMode === 'boolean') {
    progress.wordMode = record.wordMode
  }
  if (typeof record.practiceWordMode === 'boolean') {
    progress.practiceWordMode = record.practiceWordMode
  }
  if (typeof record.practiceIfrMode === 'boolean') {
    progress.practiceIfrMode = record.practiceIfrMode
  }
  if (typeof record.practiceReviewMisses === 'boolean') {
    progress.practiceReviewMisses = record.practiceReviewMisses
  }
  if (typeof record.maxLevel === 'number' && Number.isFinite(record.maxLevel)) {
    progress.maxLevel = clamp(record.maxLevel, levelMin, levelMax)
  }
  if (
    typeof record.listenWpm === 'number' &&
    Number.isFinite(record.listenWpm)
  ) {
    progress.listenWpm = clamp(record.listenWpm, listenWpmMin, listenWpmMax)
  }
  if (
    typeof record.listenEffectiveWpm === 'number' &&
    Number.isFinite(record.listenEffectiveWpm)
  ) {
    progress.listenEffectiveWpm = clamp(
      record.listenEffectiveWpm,
      listenEffectiveWpmMin,
      listenEffectiveWpmMax,
    )
  }
  if (
    typeof progress.listenWpm === 'number' &&
    typeof progress.listenEffectiveWpm === 'number' &&
    progress.listenEffectiveWpm > progress.listenWpm
  ) {
    progress.listenEffectiveWpm = progress.listenWpm
  }
  if (typeof record.listenAutoTightening === 'boolean') {
    progress.listenAutoTightening = record.listenAutoTightening
  }
  if (
    typeof record.listenAutoTighteningCorrectCount === 'number' &&
    Number.isFinite(record.listenAutoTighteningCorrectCount)
  ) {
    progress.listenAutoTighteningCorrectCount = Math.max(
      0,
      Math.round(record.listenAutoTighteningCorrectCount),
    )
  }
  const scores = parseFirebaseScores(record.scores)
  if (scores) {
    progress.scores = scores
  }
  const listenTtr = parseListenTtr(record.listenTtr)
  if (listenTtr) {
    progress.listenTtr = listenTtr
  }
  return progress
}

export const parseLocalStorageScores = (stored: string | null) => {
  if (!stored) {
    return initializeScores()
  }
  try {
    const parsed = JSON.parse(stored) as Record<string, unknown>
    const next = initializeScores()
    LETTERS.forEach((letter) => {
      const value = parsed[letter]
      if (typeof value === 'number' && Number.isFinite(value)) {
        next[letter] = value
      }
    })
    return next
  } catch {
    return initializeScores()
  }
}
