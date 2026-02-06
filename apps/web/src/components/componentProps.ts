import type {
  ChangeEvent,
  KeyboardEvent,
  PointerEvent,
  ReactNode,
  RefObject,
} from 'react';
import type { FirebaseUser, Letter } from '@dit/core';

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
  listenDisplay: string
  listenDisplayClass: string
  listenStatusText: string
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
  levels: readonly number[]
  listenWpm: number
  listenWpmMax: number
  listenWpmMin: number
  maxLevel: number
  practiceWordMode: boolean
  onListenWpmChange: (event: ChangeEvent<HTMLSelectElement>) => void
  onMaxLevelChange: (event: ChangeEvent<HTMLSelectElement>) => void
  onPracticeWordModeChange: (event: ChangeEvent<HTMLInputElement>) => void
  onShowHintChange: (event: ChangeEvent<HTMLInputElement>) => void
  onShowMnemonicChange: (event: ChangeEvent<HTMLInputElement>) => void
  onShowReference: () => void
  onSoundCheck: () => void
  onWordModeChange: (event: ChangeEvent<HTMLInputElement>) => void
  showHint: boolean
  showMnemonic: boolean
  soundCheckStatus: 'idle' | 'playing'
  user: FirebaseUser | null
  userLabel: string
  userInitial: string
  authReady: boolean
  onSignIn: () => void
  onSignOut: () => void
}

export type MorseData = Record<Letter, { code: string }>

export interface ReferenceModalProps {
  letters: Letter[]
  morseData: MorseData
  numbers: Letter[]
  onClose: () => void
  onResetScores: () => void
  scores: Record<Letter, number>
}
