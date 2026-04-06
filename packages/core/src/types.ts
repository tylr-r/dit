import type { Letter } from './data/morse'

export type ScoreRecord = Record<Letter, number>

export type LearnerProfile = 'beginner' | 'known'

export type GuidedPhase = 'teach' | 'practice' | 'listen' | 'complete'

export type GuidedLetterCounts = Partial<Record<Letter, number>>

export type GuidedLessonProgress = {
  teachCounts: GuidedLetterCounts
  practiceAttempts: number
  practiceCorrect: number
  practiceLetterCorrect: GuidedLetterCounts
  listenAttempts: number
  listenCorrect: number
  listenLetterCorrect: GuidedLetterCounts
}

export type ListenTtrEntry = {
  averageMs: number
  samples: number
}

export type ListenTtrRecord = Partial<Record<Letter, ListenTtrEntry>>

export type Progress = {
  listenWpm?: number
  listenEffectiveWpm?: number
  listenAutoTightening?: boolean
  listenAutoTighteningCorrectCount?: number
  listenTtr?: ListenTtrRecord
  maxLevel?: number
  showMnemonic?: boolean
  practiceWordMode?: boolean
  practiceAutoPlay?: boolean
  practiceLearnMode?: boolean
  practiceIfrMode?: boolean
  practiceReviewMisses?: boolean
  learnerProfile?: LearnerProfile
  guidedCourseActive?: boolean
  guidedPackIndex?: number
  guidedPhase?: GuidedPhase
  guidedProgress?: GuidedLessonProgress
  scores?: ScoreRecord
  showHint?: boolean
  wordMode?: boolean
}

export type ProgressSnapshot = {
  listenWpm: number
  listenEffectiveWpm?: number
  listenAutoTightening?: boolean
  listenAutoTighteningCorrectCount?: number
  listenTtr?: ListenTtrRecord
  maxLevel: number
  practiceWordMode: boolean
  practiceAutoPlay?: boolean
  practiceLearnMode?: boolean
  practiceIfrMode?: boolean
  practiceReviewMisses?: boolean
  scores: ScoreRecord
  showHint: boolean
  showMnemonic: boolean
  wordMode: boolean
  learnerProfile?: LearnerProfile
  guidedCourseActive?: boolean
  guidedPackIndex?: number
  guidedPhase?: GuidedPhase
  guidedProgress?: GuidedLessonProgress
}

export type ParseProgressOptions = {
  listenWpmMin: number
  listenWpmMax: number
  listenEffectiveWpmMin?: number
  listenEffectiveWpmMax?: number
  levelMin?: number
  levelMax?: number
}
