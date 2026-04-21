export { noopAnalyticsClient } from './analytics'
export type {
  AnalyticsClient,
  AnalyticsEvent,
  AnalyticsEventName,
  AnalyticsEventParams,
} from './analytics'
export {
  createNoopPlatform,
  PlatformProvider,
  usePlatform,
} from './platform'
export type {
  AppLifecycleAdapter,
  AppLifecycleState,
  AuthAdapter,
  DialogAction,
  DialogActionStyle,
  DialogAdapter,
  Platform,
  StorageAdapter,
} from './platform'
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
export { useFirebaseProgressSync } from './hooks/useFirebaseProgressSync'
export { useAccountActions, isAppleUser } from './hooks/useAccountActions'
export { useOnboardingActions } from './hooks/useOnboardingActions'
export { useOnboardingState } from './hooks/useOnboardingState'
export { useProgressPersistence } from './hooks/useProgressPersistence'
export { useProgressSyncController } from './hooks/useProgressSyncController'
export type { Mode } from './hooks/useProgressSyncController'
export { useMorseSessionController } from './hooks/useMorseSessionController'
export type {
  PhaseModalContent,
  PlayMorseToneOptions,
  PlayTonePatternOptions,
  StagePip,
  UseMorseSessionControllerCallbacks,
  UseMorseSessionControllerOptions,
} from './hooks/useMorseSessionController'
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
export {
  enqueueReviewLetter,
  filterReviewQueue,
  pullDueReviewLetter,
} from './utils/practiceReviewQueue'
export type { PracticeReviewItem } from './utils/practiceReviewQueue'
export {
  clampListenEffectiveWpm,
  clampListenWpm,
  getAutoEffectiveWpm,
  getListenAutoTighteningStage,
  getListenUnitMs,
  LISTEN_AUTO_TIGHTENING_STAGE_THRESHOLDS,
  normalizeListenSpeeds,
} from './utils/listenSpeed'
export {
  getListenPlaybackDurationMs,
  getListenTiming,
  getListenToneLevelAtElapsedMs,
} from './utils/listenWave'
export type { ListenWavePlayback } from './utils/listenWave'
export {
  applyListenTtrSample,
  BACKGROUND_IDLE_TIMEOUT_MS,
  clearTimer,
  createEmptyGuidedProgress,
  createInitialPracticeConfig,
  DEFAULT_LISTEN_AUTO_TIGHTENING,
  DEFAULT_LISTEN_AUTO_TIGHTENING_CORRECT_COUNT,
  DEFAULT_LISTEN_EFFECTIVE_WPM,
  DEFAULT_LISTEN_WPM,
  DEFAULT_MAX_LEVEL,
  DEFAULT_PRACTICE_IFR_MODE,
  DEFAULT_PRACTICE_REVIEW_MISSES,
  DOT_THRESHOLD_MS,
  enqueueListenOverlearnLetters,
  ERROR_LOCKOUT_MS,
  getDeleteAccountErrorMessage,
  getGuidedPracticePool,
  getLevelForLetters,
  getListenOverlearnRepeats,
  getNextOrderedLetter,
  getSignInErrorMessage,
  GUIDED_TEACH_SUCCESS_COPY,
  initialConfig,
  INTER_CHAR_GAP_MS,
  INTRO_HINTS_KEY,
  isErrorWithCode,
  LEGACY_INTRO_HINTS_KEY,
  LEVELS,
  LISTEN_EFFECTIVE_WPM_MAX,
  LISTEN_EFFECTIVE_WPM_MIN,
  LISTEN_MAX_CONSECUTIVE_SAME,
  LISTEN_MIN_UNIT_MS,
  LISTEN_OVERLEARN_MAX_QUEUE_SIZE,
  LISTEN_OVERLEARN_STRONG_THRESHOLD_MS,
  LISTEN_OVERLEARN_THRESHOLD_MS,
  LISTEN_POST_REVEAL_PAUSE_MS,
  LISTEN_RECOGNITION_DISPLAY_MS,
  LISTEN_REVEAL_EXTRA_MS,
  LISTEN_REVEAL_FADE_OUT_MS,
  LISTEN_TTR_EMA_ALPHA,
  LISTEN_TTR_MAX_MS,
  LISTEN_TTR_MAX_SAMPLES,
  LISTEN_WPM_MAX,
  LISTEN_WPM_MIN,
  LOCAL_PROGRESS_KEY,
  now,
  NUX_STATE_KEY,
  NUX_STATUS_KEY,
  PRACTICE_NEXT_LETTER_DELAY_MS,
  PRACTICE_REVIEW_DELAY_STEPS,
  PRACTICE_REVIEW_MAX_SIZE,
  PRACTICE_WORD_UNITS,
  PROGRESS_SAVE_DEBOUNCE_MS,
  pullNextListenOverlearnLetter,
  REFERENCE_LETTERS,
  REFERENCE_NUMBERS,
  REFERENCE_WPM,
  WORD_GAP_EXTRA_MS,
  WORD_GAP_MS,
} from './utils/appState'
export type {
  IntroHintStep,
  ListenPromptTiming,
  NuxStatus,
  NuxStep,
  TimeoutHandle,
} from './utils/appState'
