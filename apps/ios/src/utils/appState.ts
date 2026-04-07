import {
  clamp,
  createGuidedLessonProgress,
  DASH_THRESHOLD,
  DEBOUNCE_DELAY,
  DEFAULT_CHARACTER_WPM,
  DEFAULT_EFFECTIVE_WPM,
  EFFECTIVE_WPM_RANGE,
  getBeginnerCoursePack,
  getBeginnerUnlockedLetters,
  getLettersForLevel,
  getRandomLetter,
  getRandomWord,
  getWordsForLetters,
  INTER_LETTER_UNITS,
  INTER_WORD_UNITS,
  MORSE_DATA,
  UNIT_TIME_MS,
  WPM_RANGE,
  type Letter,
  type ListenTtrRecord,
} from '@dit/core'

export const LEVELS = [1, 2, 3, 4] as const
export const DEFAULT_MAX_LEVEL: (typeof LEVELS)[number] = 3
export const DEFAULT_LISTEN_WPM = DEFAULT_CHARACTER_WPM
export const DEFAULT_LISTEN_EFFECTIVE_WPM = DEFAULT_EFFECTIVE_WPM
export const DEFAULT_LISTEN_AUTO_TIGHTENING = true
export const DEFAULT_LISTEN_AUTO_TIGHTENING_CORRECT_COUNT = 0
export const DOT_THRESHOLD_MS = DASH_THRESHOLD
export const INTER_CHAR_GAP_MS = UNIT_TIME_MS * INTER_LETTER_UNITS
export const ERROR_LOCKOUT_MS = 1000
export const LISTEN_REVEAL_EXTRA_MS = 1000
export const LISTEN_REVEAL_FADE_OUT_MS = 320
export const LISTEN_POST_REVEAL_PAUSE_MS = 220
export const LISTEN_RECOGNITION_DISPLAY_MS = 2600
export const PRACTICE_NEXT_LETTER_DELAY_MS = 1000
export const PRACTICE_WORD_UNITS = 5
export const WORD_GAP_MS = UNIT_TIME_MS * INTER_WORD_UNITS
export const WORD_GAP_EXTRA_MS = WORD_GAP_MS - INTER_CHAR_GAP_MS
export const LISTEN_WPM_MIN = WPM_RANGE.min
export const LISTEN_WPM_MAX = WPM_RANGE.max
export const LISTEN_EFFECTIVE_WPM_MIN = EFFECTIVE_WPM_RANGE.min
export const LISTEN_EFFECTIVE_WPM_MAX = EFFECTIVE_WPM_RANGE.max
export const LISTEN_MIN_UNIT_MS = 40
export const LISTEN_TTR_EMA_ALPHA = 0.25
export const LISTEN_TTR_MAX_MS = 10000
export const LISTEN_TTR_MAX_SAMPLES = 300
export const LISTEN_OVERLEARN_THRESHOLD_MS = 1200
export const LISTEN_OVERLEARN_STRONG_THRESHOLD_MS = 2200
export const LISTEN_OVERLEARN_MAX_QUEUE_SIZE = 24
export const GUIDED_TEACH_SUCCESS_COPY = [
  'Got it 👍',
  'Nice ✨',
  'Good 🙌',
  "That's it 👏",
  'Nailed it 🎯',
] as const
export const LISTEN_MAX_CONSECUTIVE_SAME = 3
export const REFERENCE_WPM = 20
export const PROGRESS_SAVE_DEBOUNCE_MS = DEBOUNCE_DELAY
export const INTRO_HINTS_KEY = 'dit-intro-hint-step'
export const LEGACY_INTRO_HINTS_KEY = 'dit-intro-hints-dismissed'
export const NUX_STATUS_KEY = 'dit-nux-status'
export const LOCAL_PROGRESS_KEY = 'dit-progress'
export const BACKGROUND_IDLE_TIMEOUT_MS = 10000
export const DEFAULT_PRACTICE_IFR_MODE = true
export const DEFAULT_PRACTICE_REVIEW_MISSES = true
export const PRACTICE_REVIEW_DELAY_STEPS = 3
export const PRACTICE_REVIEW_MAX_SIZE = 24

export type IntroHintStep = 'morse' | 'settings' | 'done'
export type NuxStatus = 'pending' | 'completed' | 'skipped'
export type NuxStep =
  | 'welcome'
  | 'profile'
  | 'sound_check'
  | 'button_tutorial'
  | 'known_tour'
  | 'beginner_intro'
export type ListenPromptTiming = {
  targetLetter: Letter
  expectedEndAt: number
}

export const REFERENCE_LETTERS = (Object.keys(MORSE_DATA) as Letter[]).filter(
  (letter) => /^[A-Z]$/.test(letter),
)
export const REFERENCE_NUMBERS: Letter[] = [
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
]

export type TimeoutHandle = ReturnType<typeof setTimeout>

export const clearTimer = (ref: { current: TimeoutHandle | null }) => {
  if (ref.current !== null) {
    clearTimeout(ref.current)
    ref.current = null
  }
}

export const now = () => Date.now()

export const getNextOrderedLetter = (letters: Letter[], current: Letter): Letter => {
  if (letters.length === 0) {
    return current
  }
  const currentIndex = letters.indexOf(current)
  if (currentIndex < 0) {
    return letters[0]
  }
  return letters[(currentIndex + 1) % letters.length]
}

export const getLevelForLetters = (letters: readonly Letter[]) => {
  if (letters.length === 0) {
    return LEVELS[0]
  }
  const highestLevel = letters.reduce(
    (maxLevel, letter) => Math.max(maxLevel, MORSE_DATA[letter].level),
    1,
  )
  return clamp(highestLevel, LEVELS[0], LEVELS[LEVELS.length - 1]) as (typeof LEVELS)[number]
}

export const getGuidedPracticePool = (packIndex: number) => {
  const currentPack = getBeginnerCoursePack(packIndex)
  const unlockedLetters = getBeginnerUnlockedLetters(packIndex)
  const reviewPool = unlockedLetters.filter((letter) => !currentPack.includes(letter))

  return {
    currentPack,
    unlockedLetters,
    reviewPool,
  }
}

const clampListenTtrMs = (value: number) =>
  Math.max(0, Math.min(LISTEN_TTR_MAX_MS, Math.round(value)))

export const applyListenTtrSample = (
  current: ListenTtrRecord,
  letter: Letter,
  sampleMs: number,
  sampleWeight: number = 1,
) => {
  if (!Number.isFinite(sampleMs) || sampleWeight <= 0) {
    return current
  }

  const normalizedSampleMs = clampListenTtrMs(sampleMs)
  const normalizedWeight = Math.max(1, Math.round(sampleWeight))
  const existing = current[letter]

  if (!existing) {
    return {
      ...current,
      [letter]: {
        averageMs: normalizedSampleMs,
        samples: normalizedWeight,
      },
    }
  }

  const alpha = Math.min(0.85, LISTEN_TTR_EMA_ALPHA * normalizedWeight)
  const averageMs = clampListenTtrMs(
    existing.averageMs * (1 - alpha) + normalizedSampleMs * alpha,
  )
  const samples = Math.min(LISTEN_TTR_MAX_SAMPLES, existing.samples + normalizedWeight)

  return {
    ...current,
    [letter]: {
      averageMs,
      samples,
    },
  }
}

export const getListenOverlearnRepeats = (averageMs: number) => {
  if (averageMs >= LISTEN_OVERLEARN_STRONG_THRESHOLD_MS) {
    return 2
  }
  if (averageMs >= LISTEN_OVERLEARN_THRESHOLD_MS) {
    return 1
  }
  return 0
}

export const enqueueListenOverlearnLetters = (
  queue: Letter[],
  letter: Letter,
  repeats: number,
  maxSize: number,
) => {
  if (repeats <= 0 || queue.length >= maxSize) {
    return queue
  }

  const nextQueue = [...queue]
  for (let count = 0; count < repeats && nextQueue.length < maxSize; count += 1) {
    nextQueue.push(letter)
  }

  return nextQueue
}

export const pullNextListenOverlearnLetter = (
  queue: Letter[],
  availableLetters: Letter[],
  previousLetter: Letter,
) => {
  if (queue.length === 0) {
    return {
      nextQueue: queue,
      reviewLetter: null as Letter | null,
    }
  }

  const allowed = new Set(availableLetters)
  const filteredQueue = queue.filter((letter) => allowed.has(letter))

  if (filteredQueue.length === 0) {
    return {
      nextQueue: filteredQueue,
      reviewLetter: null as Letter | null,
    }
  }

  const nextIndex = filteredQueue.findIndex((letter) => letter !== previousLetter)
  const resolvedIndex = nextIndex >= 0 ? nextIndex : 0
  const reviewLetter = filteredQueue[resolvedIndex]

  return {
    nextQueue: filteredQueue.filter((_, index) => index !== resolvedIndex),
    reviewLetter,
  }
}

export const createInitialPracticeConfig = () => {
  const availableLetters = getLettersForLevel(DEFAULT_MAX_LEVEL)
  const practiceWord = getRandomWord(getWordsForLetters(availableLetters))

  return {
    letter: getRandomLetter(availableLetters),
    practiceWord,
  }
}

export const initialConfig = createInitialPracticeConfig()

export const getDeleteAccountErrorMessage = (error: unknown) => {
  const code =
    error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
      ? error.code
      : null

  if (code === 'ERR_APPLE_ACCOUNT_DELETION_USER_MISMATCH') {
    return 'Sign in with the same Apple account tied to this Dit account, then try again.'
  }

  if (code?.includes('user-mismatch')) {
    return 'Sign in with the same account you used for Dit, then try again.'
  }

  if (code?.includes('requires-recent-login')) {
    return 'For security, sign in again and retry account deletion.'
  }

  if (code?.includes('network-request-failed')) {
    return 'A network error interrupted account deletion. Try again on a stable connection.'
  }

  return 'We could not delete your account. Please try again.'
}

export const isErrorWithCode = (error: unknown, code: string) =>
  Boolean(error && typeof error === 'object' && 'code' in error && error.code === code)

export const getSignInErrorMessage = (error: unknown) => {
  if (isErrorWithCode(error, 'auth/account-exists-with-different-credential')) {
    return 'An account already exists with a different sign-in method for this email address.'
  }

  if (isErrorWithCode(error, 'auth/network-request-failed')) {
    return 'A network error interrupted sign-in. Try again on a stable connection.'
  }

  return 'We could not sign you in. Please try again.'
}

export const createEmptyGuidedProgress = () => createGuidedLessonProgress()
