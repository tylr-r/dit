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
  ActivityMode,
  DailyActivity,
  DailyActivityEntry,
  GuidedLetterCounts,
  GuidedLessonProgress,
  GuidedPhase,
  LearnerProfile,
  LetterAccuracyEntry,
  LetterAccuracyRecord,
  ListenTtrEntry,
  ListenTtrRecord,
  ParseProgressOptions,
  Progress,
  ProgressSnapshot,
  ReminderSettings,
  ScoreRecord,
  StreakState,
} from './types'
export {
  computeHero,
  countsAnswer,
  dateKey,
  isMastered,
  MASTERY_ACCURACY_MIN,
  MASTERY_RECENT_WINDOW,
  MASTERY_SCORE_MIN,
  recordCorrectAnswer,
  recordLetterAttempt,
  STREAK_DAILY_GOAL,
  todayStreakContribution,
  updateBestWpm,
} from './utils/retention'
export type { HeroMetric, RecordAnswerInput } from './utils/retention'
export type {
  FirebaseSignInMethod,
  FirebaseSyncService,
  FirebaseUser,
} from './firebase'
export type { FirebaseProgressAdapter, ProgressPayload } from './firebase/progress'
