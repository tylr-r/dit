import type {
  ChangeEvent,
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
  ListenWavePlayback,
  StreakState,
} from '@dit/core'

export interface ListenControlsProps {
  listenStatus: 'idle' | 'success' | 'error'
  onReplay: () => void
  onSubmitAnswer: (value: Letter) => void
  useCustomKeyboard: boolean
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
}

export interface StageDisplayProps {
  freestyleDisplay: string
  hasFreestyleDisplay: boolean
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
  listenWpm: number
  listenWpmMax: number
  listenWpmMin: number
  practiceWordMode: boolean
  toneFrequency: number
  toneFrequencyMin: number
  toneFrequencyMax: number
  toneFrequencyStep: number
  onToneFrequencyChange: (event: ChangeEvent<HTMLSelectElement>) => void
  onListenWpmChange: (event: ChangeEvent<HTMLSelectElement>) => void
  onPracticeWordModeChange: (event: ChangeEvent<HTMLInputElement>) => void
  onShowAbout: () => void
  onShowHintChange: (event: ChangeEvent<HTMLInputElement>) => void
  onShowMnemonicChange: (event: ChangeEvent<HTMLInputElement>) => void
  onSoundCheck: () => void
  onWordModeChange: (event: ChangeEvent<HTMLInputElement>) => void
  showHint: boolean
  showMnemonic: boolean
  soundCheckStatus: 'idle' | 'playing'
  practiceAutoPlay: boolean
  practiceLearnMode: boolean
  practiceIfrMode: boolean
  practiceReviewMisses: boolean
  guidedCourseActive: boolean
  onPracticeAutoPlayChange: (event: ChangeEvent<HTMLInputElement>) => void
  onPracticeLearnModeChange: (event: ChangeEvent<HTMLInputElement>) => void
  onPracticeIfrModeChange: (event: ChangeEvent<HTMLInputElement>) => void
  onPracticeReviewMissesChange: (event: ChangeEvent<HTMLInputElement>) => void
  onUseRecommended: () => void
  onShowLearning: () => void
  onReplayNux?: () => void
  user: FirebaseUser | null
  userLabel: string
  userInitial: string
  authReady: boolean
  onSignIn: () => void
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
  letterAccuracy?: LetterAccuracyRecord
  courseProgress?: ReferenceCourseProgress | null
}
