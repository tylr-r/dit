export { MORSE_DATA } from './data/morse'
export { PRACTICE_WORDS } from './data/practiceWords'
export {
  applyScoreDelta,
  clamp,
  formatWpm,
  getLettersForLevel,
  getRandomLetter,
  getRandomLatencyAwareLetter,
  getRandomWeightedLetter,
  getRandomWord,
  getWordsForLetters,
  initializeScores,
  parseFirebaseScores,
  parseLocalStorageScores,
  parseProgress,
} from './utils/morseUtils'
export {
  createFirebaseProgressService,
  createProgressPayload,
  progressPathForUser,
} from './firebase/progress'
export {
  AUDIO_FREQUENCY,
  AUDIO_VOLUME,
  DASH_THRESHOLD,
  DEBOUNCE_DELAY,
  DEFAULT_CHARACTER_WPM,
  DEFAULT_EFFECTIVE_WPM,
  EFFECTIVE_WPM_RANGE,
  INTER_LETTER_UNITS,
  INTER_WORD_UNITS,
  UNIT_TIME_MS,
  WPM_RANGE,
} from './constants'
export type { Letter } from './data/morse'
export type {
  ListenTtrEntry,
  ListenTtrRecord,
  ParseProgressOptions,
  Progress,
  ProgressSnapshot,
  ScoreRecord,
} from './types'
export type { FirebaseProgressAdapter, ProgressPayload } from './firebase/progress'
