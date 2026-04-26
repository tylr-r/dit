import { MORSE_DATA, type Letter } from '../data/morse'
import { PRACTICE_WORDS } from '../data/practiceWords'
import type {
  ActivityMode,
  DailyActivity,
  GuidedLetterCounts,
  GuidedLessonProgress,
  GuidedPhase,
  LearnerProfile,
  LetterAccuracyRecord,
  ListenTtrRecord,
  ParseProgressOptions,
  Progress,
  ReminderSettings,
  ScoreRecord,
  StreakState,
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

const parseLearnerProfile = (value: unknown): LearnerProfile | null => {
  if (value === 'beginner' || value === 'known') {
    return value
  }
  return null
}

const parseGuidedPhase = (value: unknown): GuidedPhase | null => {
  if (value === 'teach' || value === 'practice' || value === 'listen' || value === 'complete') {
    return value
  }
  return null
}

const parseGuidedLetterCounts = (value: unknown): GuidedLetterCounts | null => {
  if (!value || typeof value !== 'object') {
    return null
  }
  const record = value as Record<string, unknown>
  const next: GuidedLetterCounts = {}
  let hasEntry = false
  LETTERS.forEach((letter) => {
    const entry = record[letter]
    if (typeof entry !== 'number' || !Number.isFinite(entry)) {
      return
    }
    next[letter] = Math.max(0, Math.round(entry))
    hasEntry = true
  })
  return hasEntry ? next : null
}

const parseGuidedProgress = (value: unknown): GuidedLessonProgress | null => {
  if (!value || typeof value !== 'object') {
    return null
  }
  const record = value as Record<string, unknown>
  const teachCounts = parseGuidedLetterCounts(record.teachCounts) ?? {}
  const practiceLetterCorrect = parseGuidedLetterCounts(record.practiceLetterCorrect) ?? {}
  const listenLetterCorrect = parseGuidedLetterCounts(record.listenLetterCorrect) ?? {}
  const practiceAttempts = record.practiceAttempts
  const practiceCorrect = record.practiceCorrect
  const listenAttempts = record.listenAttempts
  const listenCorrect = record.listenCorrect

  if (
    typeof practiceAttempts !== 'number' ||
    !Number.isFinite(practiceAttempts) ||
    typeof practiceCorrect !== 'number' ||
    !Number.isFinite(practiceCorrect) ||
    typeof listenAttempts !== 'number' ||
    !Number.isFinite(listenAttempts) ||
    typeof listenCorrect !== 'number' ||
    !Number.isFinite(listenCorrect)
  ) {
    return null
  }

  return {
    teachCounts,
    practiceAttempts: Math.max(0, Math.round(practiceAttempts)),
    practiceCorrect: Math.max(0, Math.round(practiceCorrect)),
    practiceLetterCorrect,
    listenAttempts: Math.max(0, Math.round(listenAttempts)),
    listenCorrect: Math.max(0, Math.round(listenCorrect)),
    listenLetterCorrect,
  }
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/

const parseActivityMode = (value: unknown): ActivityMode | null => {
  return value === 'practice' || value === 'listen' ? value : null
}

const parseDailyActivity = (value: unknown): DailyActivity | null => {
  if (!value || typeof value !== 'object') {
    return null
  }
  const record = value as Record<string, unknown>
  const next: DailyActivity = {}
  let hasEntry = false
  Object.keys(record).forEach((key) => {
    if (!DATE_KEY_RE.test(key)) {
      return
    }
    const entry = record[key]
    if (!entry || typeof entry !== 'object') {
      return
    }
    const entryRecord = entry as Record<string, unknown>
    const correct = entryRecord.correct
    if (typeof correct !== 'number' || !Number.isFinite(correct)) {
      return
    }
    const modes: ActivityMode[] = []
    if (Array.isArray(entryRecord.modes)) {
      entryRecord.modes.forEach((mode) => {
        const parsed = parseActivityMode(mode)
        if (parsed && !modes.includes(parsed)) {
          modes.push(parsed)
        }
      })
    }
    next[key] = { correct: Math.max(0, Math.round(correct)), modes }
    hasEntry = true
  })
  return hasEntry ? next : null
}

const parseStreakState = (value: unknown): StreakState | null => {
  if (!value || typeof value !== 'object') {
    return null
  }
  const record = value as Record<string, unknown>
  const current = record.current
  const longest = record.longest
  if (
    typeof current !== 'number' ||
    !Number.isFinite(current) ||
    typeof longest !== 'number' ||
    !Number.isFinite(longest)
  ) {
    return null
  }
  const lastCountedDate =
    typeof record.lastCountedDate === 'string' &&
    DATE_KEY_RE.test(record.lastCountedDate)
      ? record.lastCountedDate
      : null
  return {
    current: Math.max(0, Math.round(current)),
    longest: Math.max(0, Math.round(longest)),
    lastCountedDate,
  }
}

const parseLetterAccuracy = (value: unknown): LetterAccuracyRecord | null => {
  if (!value || typeof value !== 'object') {
    return null
  }
  const record = value as Record<string, unknown>
  const next: LetterAccuracyRecord = {}
  let hasEntry = false
  LETTERS.forEach((letter) => {
    const entry = record[letter]
    if (!entry || typeof entry !== 'object') {
      return
    }
    const recent = (entry as Record<string, unknown>).recent
    if (!Array.isArray(recent)) {
      return
    }
    const bools = recent
      .filter((v): v is boolean => typeof v === 'boolean')
      .slice(-10)
    next[letter] = { recent: bools }
    hasEntry = true
  })
  return hasEntry ? next : null
}

const parseReminder = (value: unknown): ReminderSettings | null => {
  if (!value || typeof value !== 'object') {
    return null
  }
  const record = value as Record<string, unknown>
  if (typeof record.enabled !== 'boolean') {
    return null
  }
  if (typeof record.time !== 'string' || !TIME_HHMM_RE.test(record.time)) {
    return null
  }
  return { enabled: record.enabled, time: record.time }
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
  if (typeof record.practiceAutoPlay === 'boolean') {
    progress.practiceAutoPlay = record.practiceAutoPlay
  }
  if (typeof record.practiceLearnMode === 'boolean') {
    progress.practiceLearnMode = record.practiceLearnMode
  }
  if (typeof record.practiceIfrMode === 'boolean') {
    progress.practiceIfrMode = record.practiceIfrMode
  }
  if (typeof record.practiceReviewMisses === 'boolean') {
    progress.practiceReviewMisses = record.practiceReviewMisses
  }
  const learnerProfile = parseLearnerProfile(record.learnerProfile)
  if (learnerProfile) {
    progress.learnerProfile = learnerProfile
  }
  if (typeof record.guidedCourseActive === 'boolean') {
    progress.guidedCourseActive = record.guidedCourseActive
  }
  if (typeof record.guidedPackIndex === 'number' && Number.isFinite(record.guidedPackIndex)) {
    progress.guidedPackIndex = Math.max(0, Math.round(record.guidedPackIndex))
  }
  const guidedPhase = parseGuidedPhase(record.guidedPhase)
  if (guidedPhase) {
    progress.guidedPhase = guidedPhase
  }
  const guidedProgress = parseGuidedProgress(record.guidedProgress)
  if (guidedProgress) {
    progress.guidedProgress = guidedProgress
  }
  if (
    typeof record.toneFrequency === 'number' &&
    Number.isFinite(record.toneFrequency)
  ) {
    progress.toneFrequency = clamp(record.toneFrequency, 400, 800)
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
  const dailyActivity = parseDailyActivity(record.dailyActivity)
  if (dailyActivity) {
    progress.dailyActivity = dailyActivity
  }
  const streak = parseStreakState(record.streak)
  if (streak) {
    progress.streak = streak
  }
  const letterAccuracy = parseLetterAccuracy(record.letterAccuracy)
  if (letterAccuracy) {
    progress.letterAccuracy = letterAccuracy
  }
  if (typeof record.bestWpm === 'number' && Number.isFinite(record.bestWpm)) {
    progress.bestWpm = Math.max(0, Math.round(record.bestWpm))
  }
  const reminder = parseReminder(record.reminder)
  if (reminder) {
    progress.reminder = reminder
  }
  if (typeof record.nuxCompleted === 'boolean') {
    progress.nuxCompleted = record.nuxCompleted
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
