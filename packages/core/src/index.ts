export { MORSE_DATA } from './data/morse'
export { PRACTICE_WORDS } from './data/practiceWords'
export {
  BEGINNER_COURSE_PACKS,
  BEGINNER_LISTEN_ATTEMPTS,
  BEGINNER_LISTEN_MIN_CORRECT,
  BEGINNER_LISTEN_PER_LETTER_MIN_CORRECT,
  BEGINNER_PRACTICE_ATTEMPTS,
  BEGINNER_PRACTICE_MIN_CORRECT,
  BEGINNER_PRACTICE_PER_LETTER_MIN_CORRECT,
  BEGINNER_TEACH_TARGET_REPEATS,
  createGuidedLessonProgress,
  getBeginnerCoursePack,
  getBeginnerUnlockedLetters,
  incrementGuidedLetterCount,
  isGuidedListenComplete,
  isGuidedPracticeComplete,
  isGuidedTeachComplete,
  recordGuidedListenResult,
  recordGuidedPracticeResult,
  recordGuidedTeachSuccess,
} from './utils/beginnerCourse'
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
export { useFirebaseSync } from './hooks/useFirebaseSync'
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
  TONE_FREQUENCY_RANGE,
  UNIT_TIME_MS,
  WPM_RANGE,
} from './constants'
export type { Letter } from './data/morse'
export type {
  GuidedLetterCounts,
  GuidedLessonProgress,
  GuidedPhase,
  LearnerProfile,
  ListenTtrEntry,
  ListenTtrRecord,
  ParseProgressOptions,
  Progress,
  ProgressSnapshot,
  ScoreRecord,
} from './types'
export type {
  FirebaseSignInMethod,
  FirebaseSyncService,
  FirebaseUser,
} from './firebase'
export type { FirebaseProgressAdapter, ProgressPayload } from './firebase/progress'
