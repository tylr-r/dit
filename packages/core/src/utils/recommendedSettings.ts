import type { LearnerProfile } from '../types'
import {
  DEFAULT_LISTEN_AUTO_TIGHTENING,
  DEFAULT_LISTEN_AUTO_TIGHTENING_CORRECT_COUNT,
  DEFAULT_LISTEN_EFFECTIVE_WPM,
  DEFAULT_LISTEN_WPM,
  DEFAULT_MAX_LEVEL,
  DEFAULT_PRACTICE_IFR_MODE,
  DEFAULT_PRACTICE_REVIEW_MISSES,
} from './appState'

export type RecommendedSettings = {
  showHint: boolean
  showMnemonic: boolean
  maxLevel: number
  practiceLearnMode: boolean
  practiceAutoPlay: boolean
  practiceIfrMode: boolean
  practiceReviewMisses: boolean
  listenWpm: number
  listenEffectiveWpm: number
  listenAutoTightening: boolean
  listenAutoTighteningCorrectCount: number
}

const KNOWN_LEARNER_RECOMMENDED: RecommendedSettings = {
  showHint: false,
  showMnemonic: false,
  maxLevel: DEFAULT_MAX_LEVEL,
  practiceLearnMode: true,
  practiceAutoPlay: true,
  practiceIfrMode: DEFAULT_PRACTICE_IFR_MODE,
  practiceReviewMisses: DEFAULT_PRACTICE_REVIEW_MISSES,
  listenWpm: DEFAULT_LISTEN_WPM,
  listenEffectiveWpm: DEFAULT_LISTEN_EFFECTIVE_WPM,
  listenAutoTightening: DEFAULT_LISTEN_AUTO_TIGHTENING,
  listenAutoTighteningCorrectCount: DEFAULT_LISTEN_AUTO_TIGHTENING_CORRECT_COUNT,
}

const BEGINNER_LEARNER_RECOMMENDED: RecommendedSettings = {
  showHint: true,
  showMnemonic: true,
  maxLevel: 1,
  practiceLearnMode: true,
  practiceAutoPlay: true,
  practiceIfrMode: false,
  practiceReviewMisses: false,
  listenWpm: DEFAULT_LISTEN_WPM,
  listenEffectiveWpm: DEFAULT_LISTEN_EFFECTIVE_WPM,
  listenAutoTightening: DEFAULT_LISTEN_AUTO_TIGHTENING,
  listenAutoTighteningCorrectCount: DEFAULT_LISTEN_AUTO_TIGHTENING_CORRECT_COUNT,
}

/** Practice and playback defaults for Use recommended settings, keyed by learner profile. */
export const getRecommendedSettings = (
  learnerProfile: LearnerProfile | null | undefined,
): RecommendedSettings =>
  learnerProfile === 'known'
    ? KNOWN_LEARNER_RECOMMENDED
    : BEGINNER_LEARNER_RECOMMENDED
