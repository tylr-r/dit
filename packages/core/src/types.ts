import type { Letter } from './data/morse'

export type ScoreRecord = Record<Letter, number>

export type Progress = {
  listenWpm?: number
  maxLevel?: number
  showMnemonic?: boolean
  practiceWordMode?: boolean
  practiceIfrMode?: boolean
  practiceReviewMisses?: boolean
  scores?: ScoreRecord
  showHint?: boolean
  wordMode?: boolean
}

export type ProgressSnapshot = {
  listenWpm: number
  maxLevel: number
  practiceWordMode: boolean
  practiceIfrMode?: boolean
  practiceReviewMisses?: boolean
  scores: ScoreRecord
  showHint: boolean
  showMnemonic: boolean
  wordMode: boolean
}

export type ParseProgressOptions = {
  listenWpmMin: number
  listenWpmMax: number
  levelMin?: number
  levelMax?: number
}
