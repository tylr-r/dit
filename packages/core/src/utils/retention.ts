import { MORSE_DATA, type Letter } from '../data/morse'
import type {
  ActivityMode,
  DailyActivity,
  LetterAccuracyRecord,
  ListenTtrRecord,
  Progress,
  StreakState,
} from '../types'

export const STREAK_DAILY_GOAL = 15
export const MASTERY_SCORE_MIN = 5
export const MASTERY_RECENT_WINDOW = 10
export const MASTERY_ACCURACY_MIN = 8
const DAILY_ACTIVITY_RETENTION_DAYS = 60

const TOTAL_CHARACTERS = Object.keys(MORSE_DATA).length

const pad = (n: number) => String(n).padStart(2, '0')

export const dateKey = (at: Date): string =>
  `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`

const daysBetween = (earlier: string, later: string): number => {
  const [ey, em, ed] = earlier.split('-').map(Number)
  const [ly, lm, ld] = later.split('-').map(Number)
  const a = Date.UTC(ey, em - 1, ed)
  const b = Date.UTC(ly, lm - 1, ld)
  return Math.round((b - a) / 86_400_000)
}

export const countsAnswer = (mode: ActivityMode, isCorrect: boolean): boolean =>
  isCorrect && (mode === 'practice' || mode === 'listen')

const pruneDailyActivity = (
  activity: DailyActivity,
  today: string,
): DailyActivity => {
  const pruned: DailyActivity = {}
  Object.entries(activity).forEach(([key, entry]) => {
    if (daysBetween(key, today) < DAILY_ACTIVITY_RETENTION_DAYS) {
      pruned[key] = entry
    }
  })
  return pruned
}

const bumpStreak = (
  streak: StreakState | undefined,
  today: string,
): StreakState => {
  const current = streak?.current ?? 0
  const longest = streak?.longest ?? 0
  const last = streak?.lastCountedDate ?? null
  if (last === today) {
    return {
      current,
      longest: Math.max(longest, current),
      lastCountedDate: today,
    }
  }
  const gap = last ? daysBetween(last, today) : null
  const next = gap === 1 ? current + 1 : 1
  return {
    current: next,
    longest: Math.max(longest, next),
    lastCountedDate: today,
  }
}

export type RecordAnswerInput = {
  letter: Letter
  mode: ActivityMode
  at?: Date
}

/**
 * Updates `dailyActivity`, `letterAccuracy`, and `streak` in response to a
 * correct answer. Pure — returns a new `Progress` without mutating input.
 * Call only when `countsAnswer(mode, true)` is true.
 */
export const recordCorrectAnswer = (
  progress: Progress,
  input: RecordAnswerInput,
): Progress => {
  const when = input.at ?? new Date()
  const today = dateKey(when)

  const previousActivity = progress.dailyActivity ?? {}
  const existing = previousActivity[today] ?? { correct: 0, modes: [] }
  const modes = existing.modes.includes(input.mode)
    ? existing.modes
    : [...existing.modes, input.mode]
  const updatedDay = { correct: existing.correct + 1, modes }
  const mergedActivity: DailyActivity = {
    ...previousActivity,
    [today]: updatedDay,
  }
  const dailyActivity = pruneDailyActivity(mergedActivity, today)

  const letterAccuracy = appendAttempt(
    progress.letterAccuracy,
    input.letter,
    true,
  )

  const hitGoalToday = updatedDay.correct === STREAK_DAILY_GOAL
  const alreadyHitGoal =
    progress.streak?.lastCountedDate === today &&
    (progress.streak?.current ?? 0) > 0
  const streak =
    hitGoalToday && !alreadyHitGoal
      ? bumpStreak(progress.streak, today)
      : progress.streak ?? {
          current: 0,
          longest: 0,
          lastCountedDate: null,
        }

  return {
    ...progress,
    dailyActivity,
    letterAccuracy,
    streak,
  }
}

/**
 * Appends a single accuracy attempt (correct/incorrect) to the per-letter
 * ring buffer. Keeps only the most recent `MASTERY_RECENT_WINDOW` entries.
 */
export const recordLetterAttempt = (
  progress: Progress,
  letter: Letter,
  isCorrect: boolean,
): Progress => ({
  ...progress,
  letterAccuracy: appendAttempt(progress.letterAccuracy, letter, isCorrect),
})

const appendAttempt = (
  accuracy: LetterAccuracyRecord | undefined,
  letter: Letter,
  isCorrect: boolean,
): LetterAccuracyRecord => {
  const previous = accuracy?.[letter]?.recent ?? []
  const recent = [...previous, isCorrect].slice(-MASTERY_RECENT_WINDOW)
  return {
    ...(accuracy ?? {}),
    [letter]: { recent },
  }
}

export const isMastered = (progress: Progress, letter: Letter): boolean => {
  const score = progress.scores?.[letter] ?? 0
  if (score < MASTERY_SCORE_MIN) {
    return false
  }
  const recent = progress.letterAccuracy?.[letter]?.recent ?? []
  if (recent.length < MASTERY_RECENT_WINDOW) {
    return false
  }
  const correct = recent.filter(Boolean).length
  return correct >= MASTERY_ACCURACY_MIN
}

const masteredCount = (progress: Progress): number => {
  let count = 0
  Object.keys(MORSE_DATA).forEach((key) => {
    if (isMastered(progress, key as Letter)) {
      count += 1
    }
  })
  return count
}

export type HeroMetric =
  | { kind: 'mastered'; count: number; total: number }
  | { kind: 'wpm'; value: number }

export const computeHero = (progress: Progress): HeroMetric => {
  if (progress.learnerProfile === 'known') {
    return { kind: 'wpm', value: progress.bestWpm ?? 0 }
  }
  return {
    kind: 'mastered',
    count: masteredCount(progress),
    total: TOTAL_CHARACTERS,
  }
}

export const todayStreakContribution = (
  progress: Progress,
  at: Date = new Date(),
): { correct: number; goal: number; atRisk: boolean } => {
  const today = dateKey(at)
  const correct = progress.dailyActivity?.[today]?.correct ?? 0
  const streakDate = progress.streak?.lastCountedDate ?? null
  const current = progress.streak?.current ?? 0
  const atRisk =
    current > 0 && streakDate !== today && correct < STREAK_DAILY_GOAL
  return { correct, goal: STREAK_DAILY_GOAL, atRisk }
}

/** Returns an updated Progress if `wpm` exceeds stored `bestWpm`. */
export const updateBestWpm = (progress: Progress, wpm: number): Progress => {
  if (!Number.isFinite(wpm) || wpm <= (progress.bestWpm ?? 0)) {
    return progress
  }
  return { ...progress, bestWpm: Math.round(wpm * 10) / 10 }
}

export type LetterStatus = 'mastered' | 'learning' | 'not-yet'

/**
 * Classifies a letter by where the user stands on it:
 *   - mastered: meets the isMastered bar (score + recent-window accuracy)
 *   - learning: has at least one practice attempt and is not yet mastered
 *   - not-yet:  no recorded attempts at all
 *
 * Driven entirely by progress state, never a guided-pack assignment, so the
 * "Now learning" UI reflects what the user is actually working on.
 */
export const classifyLetter = (
  progress: Progress,
  letter: Letter,
): LetterStatus => {
  if (isMastered(progress, letter)) return 'mastered'
  const attempts = progress.letterAccuracy?.[letter]?.recent.length ?? 0
  return attempts > 0 ? 'learning' : 'not-yet'
}

/** Recognition speed bounds used by the recognition-bar legend and tile fills. */
export const RECOGNITION_FAST_MS = 200
export const RECOGNITION_SLOW_MS = 2000

/**
 * Maps a Listen TTR EMA in ms to a 0..1 fill ratio for the per-letter
 * recognition bar. 1.0 at or below RECOGNITION_FAST_MS (saturated "fast"),
 * 0.0 at or above RECOGNITION_SLOW_MS (empty "slow"), linear in between.
 */
export const getRecognitionFillRatio = (ttrMs: number | null | undefined): number => {
  if (ttrMs == null || !Number.isFinite(ttrMs)) return 0
  if (ttrMs <= RECOGNITION_FAST_MS) return 1
  if (ttrMs >= RECOGNITION_SLOW_MS) return 0
  return 1 - (ttrMs - RECOGNITION_FAST_MS) / (RECOGNITION_SLOW_MS - RECOGNITION_FAST_MS)
}

/**
 * Average of per-letter Listen TTR EMAs across mastered letters only.
 * Pre-mastery TTRs are noisy and would dilute the metric. Returns null when
 * no mastered letter has a TTR sample yet (don't show a misleading 0).
 */
export const getAverageRecognitionMs = (
  progress: Progress,
  listenTtr: ListenTtrRecord | undefined,
): number | null => {
  if (!listenTtr) return null
  let sum = 0
  let count = 0
  for (const key of Object.keys(MORSE_DATA)) {
    const letter = key as Letter
    if (!isMastered(progress, letter)) continue
    const entry = listenTtr[letter]
    if (!entry) continue
    sum += entry.averageMs
    count += 1
  }
  if (count === 0) return null
  return Math.round(sum / count)
}
