import {
  getLettersForLevel,
  getWordsForLetters,
  type GuidedLessonProgress,
  type GuidedPhase,
  type Letter,
  type LearnerProfile,
  type ListenTtrRecord,
  type Progress,
  type ProgressSnapshot,
} from '@dit/core'
import type { User } from '@firebase/auth'
import type { Database } from '@firebase/database'
import { useCallback, useEffect, type Dispatch, type SetStateAction } from 'react'
import { type Mode } from '../components/ModeSwitcher'
import { useFirebaseSync } from './useFirebaseSync'
import { useProgressPersistence } from './useProgressPersistence'
import {
  LEVELS,
  LISTEN_EFFECTIVE_WPM_MAX,
  LISTEN_EFFECTIVE_WPM_MIN,
  LISTEN_WPM_MAX,
  LISTEN_WPM_MIN,
  PROGRESS_SAVE_DEBOUNCE_MS,
  clearTimer,
} from '../utils/appState'
import { getAutoEffectiveWpm, normalizeListenSpeeds } from '../utils/listenSpeed'
import { filterReviewQueue, type PracticeReviewItem } from '../utils/practiceReviewQueue'

type RefValue<T> = {
  current: T
}

type Setter<T> = Dispatch<SetStateAction<T>>

type UseProgressSyncControllerOptions = {
  database: Database
  user: User | null
  progressSnapshot: ProgressSnapshot
  state: {
    setScores: Setter<ProgressSnapshot['scores']>
    setListenTtr: Setter<ListenTtrRecord>
    setShowHint: Setter<boolean>
    setShowMnemonic: Setter<boolean>
    setPracticeIfrMode: Setter<boolean>
    setPracticeReviewMisses: Setter<boolean>
    setLearnerProfile: Setter<LearnerProfile | null>
    setGuidedCourseActive: Setter<boolean>
    setGuidedPackIndex: Setter<number>
    setGuidedPhase: Setter<GuidedPhase>
    setGuidedProgress: Setter<GuidedLessonProgress>
    setPracticeAutoPlay: Setter<boolean>
    setPracticeLearnMode: Setter<boolean>
    setFreestyleWordMode: Setter<boolean>
    setFreestyleResult: Setter<string | null>
    setFreestyleInput: Setter<string>
    setFreestyleWord: Setter<string>
    setListenWpm: Setter<number>
    setListenEffectiveWpm: Setter<number>
    setListenAutoTightening: Setter<boolean>
    setListenAutoTighteningCorrectCount: Setter<number>
    setMaxLevel: Setter<(typeof LEVELS)[number]>
    setPracticeWordMode: Setter<boolean>
    setPracticeWpm: Setter<number | null>
  }
  refs: {
    scoresRef: RefValue<ProgressSnapshot['scores']>
    listenTtrRef: RefValue<ListenTtrRecord>
    practiceAutoPlayRef: RefValue<boolean>
    practiceLearnModeRef: RefValue<boolean>
    practiceIfrModeRef: RefValue<boolean>
    practiceReviewMissesRef: RefValue<boolean>
    practiceReviewQueueRef: RefValue<PracticeReviewItem[]>
    errorLockoutUntilRef: RefValue<number>
    learnerProfileRef: RefValue<LearnerProfile | null>
    guidedCourseActiveRef: RefValue<boolean>
    guidedPackIndexRef: RefValue<number>
    guidedPhaseRef: RefValue<GuidedPhase>
    guidedProgressRef: RefValue<GuidedLessonProgress>
    freestyleWordModeRef: RefValue<boolean>
    wordSpaceTimeoutRef: RefValue<ReturnType<typeof setTimeout> | null>
    listenWpmRef: RefValue<number>
    listenEffectiveWpmRef: RefValue<number>
    listenAutoTighteningRef: RefValue<boolean>
    listenAutoTighteningCorrectCountRef: RefValue<number>
    modeRef: RefValue<Mode>
    listenStatusRef: RefValue<'idle' | 'success' | 'error'>
    maxLevelRef: RefValue<(typeof LEVELS)[number]>
    practiceWordModeRef: RefValue<boolean>
    practiceWordStartRef: RefValue<number | null>
    letterRef: RefValue<Letter>
  }
  helpers: {
    syncGuidedLevel: (packIndex: number) => void
    setNextListenLetter: (nextLetters: Letter[], currentLetter?: Letter) => Letter
    setNextLetterForLevel: (nextLetters: Letter[], currentLetter?: Letter) => Letter
    setPracticeWordFromList: (words: string[], avoidWord?: string) => void
    playListenSequenceForLetter: (
      letter: Letter,
      overrides?: {
        characterWpm?: number
        effectiveWpm?: number
      },
    ) => void
  }
}

/** Applies persisted progress and coordinates local/remote progress syncing. */
export const useProgressSyncController = ({
  database,
  user,
  progressSnapshot,
  state,
  refs,
  helpers,
}: UseProgressSyncControllerOptions) => {
  const applyParsedProgress = useCallback(
    (progress: Progress) => {
      const resolvedMaxLevel =
        typeof progress.maxLevel === 'number' ? progress.maxLevel : refs.maxLevelRef.current

      if (progress.scores) {
        refs.scoresRef.current = progress.scores
        state.setScores(progress.scores)
      }

      if (progress.listenTtr) {
        refs.listenTtrRef.current = progress.listenTtr
        state.setListenTtr(progress.listenTtr)
      }

      if (typeof progress.showHint === 'boolean') {
        state.setShowHint(progress.showHint)
      }

      if (typeof progress.showMnemonic === 'boolean') {
        state.setShowMnemonic(progress.showMnemonic)
      }

      if (typeof progress.practiceAutoPlay === 'boolean') {
        refs.practiceAutoPlayRef.current = progress.practiceAutoPlay
        state.setPracticeAutoPlay(progress.practiceAutoPlay)
      }

      if (typeof progress.practiceLearnMode === 'boolean') {
        refs.practiceLearnModeRef.current = progress.practiceLearnMode
        state.setPracticeLearnMode(progress.practiceLearnMode)
      }

      if (typeof progress.practiceIfrMode === 'boolean') {
        refs.practiceIfrModeRef.current = progress.practiceIfrMode
        state.setPracticeIfrMode(progress.practiceIfrMode)
        if (!progress.practiceIfrMode) {
          refs.practiceReviewQueueRef.current = []
        } else {
          refs.errorLockoutUntilRef.current = 0
        }
      }

      if (typeof progress.practiceReviewMisses === 'boolean') {
        refs.practiceReviewMissesRef.current = progress.practiceReviewMisses
        state.setPracticeReviewMisses(progress.practiceReviewMisses)
        if (!progress.practiceReviewMisses) {
          refs.practiceReviewQueueRef.current = []
        }
      }

      if (progress.learnerProfile) {
        refs.learnerProfileRef.current = progress.learnerProfile
        state.setLearnerProfile(progress.learnerProfile)
      }

      if (typeof progress.guidedCourseActive === 'boolean') {
        refs.guidedCourseActiveRef.current = progress.guidedCourseActive
        state.setGuidedCourseActive(progress.guidedCourseActive)
      }

      if (typeof progress.guidedPackIndex === 'number') {
        refs.guidedPackIndexRef.current = progress.guidedPackIndex
        state.setGuidedPackIndex(progress.guidedPackIndex)
        helpers.syncGuidedLevel(progress.guidedPackIndex)
      }

      if (progress.guidedPhase) {
        refs.guidedPhaseRef.current = progress.guidedPhase
        state.setGuidedPhase(progress.guidedPhase)
      }

      if (progress.guidedProgress) {
        refs.guidedProgressRef.current = progress.guidedProgress
        state.setGuidedProgress(progress.guidedProgress)
      }

      if (typeof progress.wordMode === 'boolean') {
        if (refs.freestyleWordModeRef.current !== progress.wordMode) {
          refs.freestyleWordModeRef.current = progress.wordMode
          clearTimer(refs.wordSpaceTimeoutRef)
          state.setFreestyleWordMode(progress.wordMode)
          state.setFreestyleResult(null)
          state.setFreestyleInput('')
          state.setFreestyleWord('')
        }
      }

      let resolvedListenWpm = refs.listenWpmRef.current
      let resolvedListenEffectiveWpm = refs.listenEffectiveWpmRef.current
      let hasListenSpeedUpdate = false
      const incomingListenWpm = typeof progress.listenWpm === 'number' ? progress.listenWpm : null
      const incomingListenEffectiveWpm =
        typeof progress.listenEffectiveWpm === 'number' ? progress.listenEffectiveWpm : null

      if (
        incomingListenWpm !== null ||
        incomingListenEffectiveWpm !== null ||
        resolvedListenEffectiveWpm > resolvedListenWpm
      ) {
        const normalizedListenSpeeds = normalizeListenSpeeds(
          incomingListenWpm ?? resolvedListenWpm,
          incomingListenEffectiveWpm ?? resolvedListenEffectiveWpm,
        )
        resolvedListenWpm = normalizedListenSpeeds.characterWpm
        resolvedListenEffectiveWpm = normalizedListenSpeeds.effectiveWpm

        if (resolvedListenWpm !== refs.listenWpmRef.current) {
          state.setListenWpm(resolvedListenWpm)
          refs.listenWpmRef.current = resolvedListenWpm
          hasListenSpeedUpdate = true
        }

        if (resolvedListenEffectiveWpm !== refs.listenEffectiveWpmRef.current) {
          state.setListenEffectiveWpm(resolvedListenEffectiveWpm)
          refs.listenEffectiveWpmRef.current = resolvedListenEffectiveWpm
          hasListenSpeedUpdate = true
        }
      }

      if (typeof progress.listenAutoTightening === 'boolean') {
        state.setListenAutoTightening(progress.listenAutoTightening)
        refs.listenAutoTighteningRef.current = progress.listenAutoTightening
      }

      if (typeof progress.listenAutoTighteningCorrectCount === 'number') {
        const nextCorrectCount = Math.max(0, Math.round(progress.listenAutoTighteningCorrectCount))
        state.setListenAutoTighteningCorrectCount(nextCorrectCount)
        refs.listenAutoTighteningCorrectCountRef.current = nextCorrectCount
      }

      if (
        hasListenSpeedUpdate &&
        refs.modeRef.current === 'listen' &&
        refs.listenStatusRef.current === 'idle'
      ) {
        helpers.playListenSequenceForLetter(refs.letterRef.current, {
          characterWpm: resolvedListenWpm,
          effectiveWpm: resolvedListenEffectiveWpm,
        })
      }

      if (refs.listenAutoTighteningRef.current) {
        const autoEffectiveWpm = getAutoEffectiveWpm(
          resolvedListenWpm,
          refs.listenAutoTighteningCorrectCountRef.current,
        )
        if (autoEffectiveWpm !== refs.listenEffectiveWpmRef.current) {
          state.setListenEffectiveWpm(autoEffectiveWpm)
          refs.listenEffectiveWpmRef.current = autoEffectiveWpm
          if (refs.modeRef.current === 'listen' && refs.listenStatusRef.current === 'idle') {
            helpers.playListenSequenceForLetter(refs.letterRef.current, {
              characterWpm: resolvedListenWpm,
              effectiveWpm: autoEffectiveWpm,
            })
          }
        }
      }

      if (typeof progress.maxLevel === 'number' && !progress.guidedCourseActive) {
        refs.maxLevelRef.current = progress.maxLevel as (typeof LEVELS)[number]
        const nextLetters = getLettersForLevel(progress.maxLevel)
        refs.practiceReviewQueueRef.current = filterReviewQueue(
          refs.practiceReviewQueueRef.current,
          nextLetters,
        )
        const nextLetter =
          refs.modeRef.current === 'listen'
            ? helpers.setNextListenLetter(nextLetters, refs.letterRef.current)
            : helpers.setNextLetterForLevel(nextLetters, refs.letterRef.current)
        state.setMaxLevel(progress.maxLevel as (typeof LEVELS)[number])
        if (refs.modeRef.current === 'listen' && refs.listenStatusRef.current === 'idle') {
          helpers.playListenSequenceForLetter(nextLetter)
        }
      }

      if (typeof progress.practiceWordMode === 'boolean') {
        refs.practiceWordModeRef.current = progress.practiceWordMode
        refs.practiceWordStartRef.current = null
        const resolvedPracticeWordMode = refs.guidedCourseActiveRef.current
          ? false
          : progress.practiceWordMode
        state.setPracticeWordMode(resolvedPracticeWordMode)
        if (!resolvedPracticeWordMode) {
          state.setPracticeWpm(null)
        }
        if (resolvedPracticeWordMode) {
          const nextLetters = getLettersForLevel(resolvedMaxLevel)
          helpers.setPracticeWordFromList(getWordsForLetters(nextLetters))
        }
      }
    },
    [
      helpers.playListenSequenceForLetter,
      helpers.setNextLetterForLevel,
      helpers.setNextListenLetter,
      helpers.setPracticeWordFromList,
      helpers.syncGuidedLevel,
      refs.errorLockoutUntilRef,
      refs.freestyleWordModeRef,
      refs.guidedCourseActiveRef,
      refs.guidedPackIndexRef,
      refs.guidedPhaseRef,
      refs.guidedProgressRef,
      refs.learnerProfileRef,
      refs.letterRef,
      refs.listenAutoTighteningCorrectCountRef,
      refs.listenAutoTighteningRef,
      refs.listenEffectiveWpmRef,
      refs.listenStatusRef,
      refs.listenTtrRef,
      refs.listenWpmRef,
      refs.practiceAutoPlayRef,
      refs.practiceLearnModeRef,
      refs.maxLevelRef,
      refs.modeRef,
      refs.practiceIfrModeRef,
      refs.practiceReviewMissesRef,
      refs.practiceReviewQueueRef,
      refs.practiceWordModeRef,
      refs.practiceWordStartRef,
      refs.scoresRef,
      refs.wordSpaceTimeoutRef,
      state.setFreestyleInput,
      state.setFreestyleResult,
      state.setFreestyleWord,
      state.setFreestyleWordMode,
      state.setGuidedCourseActive,
      state.setGuidedPackIndex,
      state.setGuidedPhase,
      state.setGuidedProgress,
      state.setLearnerProfile,
      state.setListenAutoTightening,
      state.setListenAutoTighteningCorrectCount,
      state.setListenEffectiveWpm,
      state.setListenTtr,
      state.setListenWpm,
      state.setMaxLevel,
      state.setPracticeAutoPlay,
      state.setPracticeIfrMode,
      state.setPracticeLearnMode,
      state.setPracticeReviewMisses,
      state.setPracticeWordMode,
      state.setPracticeWpm,
      state.setScores,
      state.setShowHint,
      state.setShowMnemonic,
    ],
  )

  const {
    progressUpdatedAt,
    onRemoteProgress,
    pendingRemoteSyncTick,
    consumePendingRemoteSync,
    clearLocalProgress,
    flushPendingSave,
  } = useProgressPersistence({
    progressSnapshot,
    progressSaveDebounceMs: PROGRESS_SAVE_DEBOUNCE_MS,
    applyProgress: applyParsedProgress,
    listenWpmMin: LISTEN_WPM_MIN,
    listenWpmMax: LISTEN_WPM_MAX,
    listenEffectiveWpmMin: LISTEN_EFFECTIVE_WPM_MIN,
    listenEffectiveWpmMax: LISTEN_EFFECTIVE_WPM_MAX,
    levelMin: LEVELS[0],
    levelMax: LEVELS[LEVELS.length - 1],
  })

  const { remoteLoaded, saveNow, deleteRemoteProgress } = useFirebaseSync({
    database,
    user,
    onRemoteProgress,
    progressSaveDebounceMs: PROGRESS_SAVE_DEBOUNCE_MS,
    progressSnapshot,
    progressUpdatedAt,
  })

  useEffect(() => {
    if (!remoteLoaded || !user) {
      return
    }
    const payload = consumePendingRemoteSync()
    if (!payload) {
      return
    }
    saveNow(payload, payload.updatedAt)
  }, [consumePendingRemoteSync, pendingRemoteSyncTick, remoteLoaded, saveNow, user])

  return {
    clearLocalProgress,
    deleteRemoteProgress,
    flushPendingSave,
  }
}
