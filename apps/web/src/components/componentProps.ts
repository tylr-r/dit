import type {
  KeyboardEvent,
  PointerEvent,
  ReactNode,
  RefObject,
} from 'react'
import type {
  FirebaseUser,
  HeroMetric,
  Letter,
  LetterAccuracyRecord,
  ListenTtrRecord,
  ListenWavePlayback,
  StreakState,
} from '@dit/core'

export interface ListenControlsProps {
  availableLetters: readonly Letter[]
  listenStatus: 'idle' | 'success' | 'error'
  onReplay: () => void
  onSubmitAnswer: (value: Letter) => void
  showShortcutHints: boolean
  onUseCustom?: () => void
}

export interface MorseButtonProps {
  buttonRef: RefObject<HTMLButtonElement | null>
  isPressing: boolean
  onBlur: () => void
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
  onKeyUp: (event: KeyboardEvent<HTMLButtonElement>) => void
  onPointerCancel: () => void
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void
  onPointerLeave: () => void
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void
  showShortcutHint?: boolean
  showTapHint?: boolean
}

export interface StageDisplayProps {
  freestyleDisplay: string
  hasFreestyleDisplay: boolean
  freestyleToneActive: boolean
  hintVisible: boolean
  isFreestyle: boolean
  isListen: boolean
  letter: Letter
  letterPlaceholder: boolean
  listenDisplay: string
  listenDisplayClass: string
  listenStatus: 'idle' | 'success' | 'error'
  listenStatusText: string
  listenTtrText: string | null
  listenWavePlayback: ListenWavePlayback | null
  /** When set, renders this playback in the stage wave slot instead of the normal listen wave. Used by custom-listen mode. */
  customListenPlayback: ListenWavePlayback | null
  /** Optional AudioContext-driven clock for the custom-listen wave. Passed to ListenSineWave to keep the wave in sync with audio across pause/resume. */
  customListenClockSource?: () => number | null
  pips: ReactNode
  practiceWord: string
  practiceWordIndex: number
  practiceWordMode: boolean
  practiceWpmText: string | null
  statusText: string
  target: string
}

export interface SettingsPanelProps {
  freestyleWordMode: boolean
  isFreestyle: boolean
  isListen: boolean
  isPractice: boolean
  listenWpm: number
  listenWpmMax: number
  listenWpmMin: number
  practiceWordMode: boolean
  toneFrequency: number
  toneFrequencyMin: number
  toneFrequencyMax: number
  toneFrequencyStep: number
  onToneFrequencyChange: (next: number) => void
  onListenWpmChange: (next: number) => void
  onPracticeWordModeChange: (next: boolean) => void
  onShowAbout: () => void
  onShowHintChange: (next: boolean) => void
  onShowMnemonicChange: (next: boolean) => void
  onSoundCheck: () => void
  onWordModeChange: (next: boolean) => void
  showHint: boolean
  showMnemonic: boolean
  soundCheckStatus: 'idle' | 'playing'
  practiceAutoPlay: boolean
  practiceLearnMode: boolean
  practiceIfrMode: boolean
  practiceReviewMisses: boolean
  guidedCourseActive: boolean
  onPracticeAutoPlayChange: (next: boolean) => void
  onPracticeLearnModeChange: (next: boolean) => void
  onPracticeIfrModeChange: (next: boolean) => void
  onPracticeReviewMissesChange: (next: boolean) => void
  onUseRecommended: () => void
  onShowLearning: () => void
  onReplayNux?: () => void
  /**
   * Fires when the user dismisses the modal (ESC, backdrop click, or close button).
   */
  onClose: () => void
  user: FirebaseUser | null
  userLabel: string
  userInitial: string
  authReady: boolean
  onShowSignIn: () => void
  onDeleteAccount: () => void
  isDeletingAccount: boolean
  onSignOut: () => void
}

export type MorseData = Record<Letter, { code: string }>

export interface ReferenceCourseProgress {
  packIndex: number
  totalPacks: number
  phase: string
  packLetters: readonly string[]
}

export interface ReferenceModalProps {
  letters: Letter[]
  morseData: MorseData
  numbers: Letter[]
  onClose: () => void
  onResetScores: () => void
  scores: Record<Letter, number>
  hero: HeroMetric
  streak?: StreakState
  todayCorrect: number
  streakAtRisk: boolean
  letterAccuracy?: LetterAccuracyRecord
  listenTtr?: ListenTtrRecord
  courseProgress?: ReferenceCourseProgress | null
  onPlayCharacter?: (char: Letter) => void
}

export interface LearningSheetProps {
  guidedCourseActive: boolean
  guidedPackIndex: number
  guidedMaxPackReached: number
  maxLevel: number
  customLetters: Letter[]
  onClose: () => void
  onSelectPack: (packIndex: number) => void
  onSelectTier: (level: number) => void
  onSelectCustomLetters: (letters: Letter[]) => void
  onSetGuidedCourseActive: (active: boolean) => void
}

export type EmailResult = { ok: true } | { ok: false; error: string }

export interface SignInSheetProps {
  onClose: () => void
  onSignInWithApple: () => Promise<void>
  onSignInWithGoogle: () => Promise<void>
  onSignInWithEmail: (email: string, password: string) => Promise<EmailResult>
  onCreateAccountWithEmail: (email: string, password: string) => Promise<EmailResult>
}
