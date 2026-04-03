import type { Letter } from '../data/morse'
import type { GuidedLetterCounts, GuidedLessonProgress } from '../types'

export const BEGINNER_COURSE_PACKS: readonly Letter[][] = [
  ['E', 'T'],
  ['A', 'N'],
  ['I', 'M'],
  ['R', 'S'],
  ['O', 'D'],
  ['U', 'W'],
  ['G', 'K'],
  ['H', 'L'],
  ['B', 'C'],
  ['F', 'P'],
  ['V', 'X'],
  ['Q', 'Y', 'Z'],
]

export const BEGINNER_TEACH_TARGET_REPEATS = 2
export const BEGINNER_PRACTICE_ATTEMPTS = 10
export const BEGINNER_PRACTICE_MIN_CORRECT = 8
export const BEGINNER_PRACTICE_PER_LETTER_MIN_CORRECT = 2
export const BEGINNER_LISTEN_ATTEMPTS = 6
export const BEGINNER_LISTEN_MIN_CORRECT = 4
export const BEGINNER_LISTEN_PER_LETTER_MIN_CORRECT = 1

const clampCount = (value: number) => Math.max(0, Math.round(value))

const readCount = (counts: GuidedLetterCounts, letter: Letter) => counts[letter] ?? 0

export const createGuidedLessonProgress = (): GuidedLessonProgress => ({
  teachCounts: {},
  practiceAttempts: 0,
  practiceCorrect: 0,
  practiceLetterCorrect: {},
  listenAttempts: 0,
  listenCorrect: 0,
  listenLetterCorrect: {},
})

export const getBeginnerCoursePack = (packIndex: number): Letter[] =>
  BEGINNER_COURSE_PACKS[packIndex] ? [...BEGINNER_COURSE_PACKS[packIndex]] : []

export const getBeginnerUnlockedLetters = (packIndex: number): Letter[] =>
  BEGINNER_COURSE_PACKS.slice(0, Math.max(0, packIndex) + 1).flatMap((pack) => pack)

export const incrementGuidedLetterCount = (
  counts: GuidedLetterCounts,
  letter: Letter,
  increment: number = 1,
): GuidedLetterCounts => ({
  ...counts,
  [letter]: readCount(counts, letter) + clampCount(increment),
})

export const recordGuidedTeachSuccess = (
  progress: GuidedLessonProgress,
  letter: Letter,
): GuidedLessonProgress => ({
  ...progress,
  teachCounts: incrementGuidedLetterCount(progress.teachCounts, letter),
})

export const recordGuidedPracticeResult = (
  progress: GuidedLessonProgress,
  letter: Letter,
  isCorrect: boolean,
): GuidedLessonProgress => ({
  ...progress,
  practiceAttempts: progress.practiceAttempts + 1,
  practiceCorrect: progress.practiceCorrect + (isCorrect ? 1 : 0),
  practiceLetterCorrect: isCorrect
    ? incrementGuidedLetterCount(progress.practiceLetterCorrect, letter)
    : progress.practiceLetterCorrect,
})

export const recordGuidedListenResult = (
  progress: GuidedLessonProgress,
  letter: Letter,
  isCorrect: boolean,
): GuidedLessonProgress => ({
  ...progress,
  listenAttempts: progress.listenAttempts + 1,
  listenCorrect: progress.listenCorrect + (isCorrect ? 1 : 0),
  listenLetterCorrect: isCorrect
    ? incrementGuidedLetterCount(progress.listenLetterCorrect, letter)
    : progress.listenLetterCorrect,
})

export const isGuidedTeachComplete = (
  progress: GuidedLessonProgress,
  currentPack: readonly Letter[],
): boolean =>
  currentPack.every((letter) => readCount(progress.teachCounts, letter) >= BEGINNER_TEACH_TARGET_REPEATS)

export const isGuidedPracticeComplete = (
  progress: GuidedLessonProgress,
  currentPack: readonly Letter[],
): boolean =>
  progress.practiceAttempts >= BEGINNER_PRACTICE_ATTEMPTS &&
  progress.practiceCorrect >= BEGINNER_PRACTICE_MIN_CORRECT &&
  currentPack.every(
    (letter) =>
      readCount(progress.practiceLetterCorrect, letter) >= BEGINNER_PRACTICE_PER_LETTER_MIN_CORRECT,
  )

export const isGuidedListenComplete = (
  progress: GuidedLessonProgress,
  currentPack: readonly Letter[],
): boolean =>
  progress.listenAttempts >= BEGINNER_LISTEN_ATTEMPTS &&
  progress.listenCorrect >= BEGINNER_LISTEN_MIN_CORRECT &&
  currentPack.every(
    (letter) =>
      readCount(progress.listenLetterCorrect, letter) >= BEGINNER_LISTEN_PER_LETTER_MIN_CORRECT,
  )
