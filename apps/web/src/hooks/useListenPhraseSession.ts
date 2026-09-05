import {
  LISTEN_MIN_UNIT_MS,
  LISTEN_PHRASES,
  createListenPhraseRound,
  getEligibleListenPhrases,
  getListenTiming,
  textToMorseCode,
  type Letter,
  type ListenPhrase,
  type ListenPhraseRound,
  type ListenWavePlayback,
} from '@dit/core'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type PlayMorseToneOptions = {
  code: string
  characterWpm: number
  effectiveWpm: number
  frequency?: number
  onComplete?: () => void
}

export type UseListenPhraseSessionOptions = {
  isActive: boolean
  availableLetters: readonly Letter[]
  characterWpm: number
  effectiveWpm: number
  toneFrequency: number
  playMorseTone: (options: PlayMorseToneOptions) => Promise<void>
  stopMorseTone: () => Promise<void>
  phrases?: readonly ListenPhrase[]
  random?: () => number
}

export type ListenPhraseStatus = 'idle' | 'success' | 'error'

export type UseListenPhraseSessionResult = {
  isAvailable: boolean
  round: ListenPhraseRound | null
  status: ListenPhraseStatus
  selectedPhraseId: string | null
  attemptCount: number
  correctCount: number
  playback: ListenWavePlayback | null
  isPlaying: boolean
  start: () => Promise<void>
  submitAnswer: (phraseId: string) => Promise<void>
  replay: () => Promise<void>
  next: () => Promise<void>
  release: () => void
  stop: () => Promise<void>
}

/** Owns the round, feedback, score, and playback state for web Listen Phrases. */
export const useListenPhraseSession = (
  options: UseListenPhraseSessionOptions,
): UseListenPhraseSessionResult => {
  const {
    availableLetters,
    isActive,
    characterWpm,
    effectiveWpm,
    toneFrequency,
    playMorseTone,
    stopMorseTone,
    phrases = LISTEN_PHRASES,
    random,
  } = options
  const [round, setRound] = useState<ListenPhraseRound | null>(null)
  const [status, setStatus] = useState<ListenPhraseStatus>('idle')
  const [selectedPhraseId, setSelectedPhraseId] = useState<string | null>(null)
  const [attemptCount, setAttemptCount] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [playback, setPlayback] = useState<ListenWavePlayback | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const isPlayingRef = useRef(false)
  const playbackSequenceRef = useRef(0)
  const playbackOperationRef = useRef(0)
  const lastTargetIdRef = useRef<string | null>(null)

  const eligiblePhrases = useMemo(
    () => getEligibleListenPhrases(phrases, availableLetters),
    [availableLetters, phrases],
  )
  const isAvailable = eligiblePhrases.length >= 4

  const playRound = useCallback(
    async (nextRound: ListenPhraseRound, resetFeedback: boolean) => {
      playbackOperationRef.current += 1
      const operation = playbackOperationRef.current
      // Conceal synchronously, before stopping or preparing the audio graph.
      isPlayingRef.current = true
      setIsPlaying(true)
      await stopMorseTone()
      if (operation !== playbackOperationRef.current) {
        return
      }
      if (resetFeedback) {
        setStatus('idle')
        setSelectedPhraseId(null)
      }
      const { code } = textToMorseCode(nextRound.target.text)
      const timing = getListenTiming(characterWpm, effectiveWpm, LISTEN_MIN_UNIT_MS)
      playbackSequenceRef.current += 1
      setPlayback({
        sequence: playbackSequenceRef.current,
        code,
        unitMs: timing.unitMs,
        interCharacterGapMs: timing.interCharacterGapMs,
      })
      await playMorseTone({
        code,
        characterWpm,
        effectiveWpm,
        frequency: toneFrequency,
        onComplete: () => {
          if (operation !== playbackOperationRef.current) return
          isPlayingRef.current = false
          setIsPlaying(false)
        },
      })
    },
    [characterWpm, effectiveWpm, playMorseTone, stopMorseTone, toneFrequency],
  )

  const start = useCallback(async () => {
    const nextRound = createListenPhraseRound(eligiblePhrases, {
      previousTargetId: lastTargetIdRef.current ?? undefined,
      random,
    })
    if (!nextRound) {
      return
    }
    lastTargetIdRef.current = nextRound.target.id
    setRound(nextRound)
    await playRound(nextRound, true)
  }, [eligiblePhrases, playRound, random])

  const submitAnswer = useCallback(
    async (phraseId: string) => {
      if (
        isPlayingRef.current ||
        status !== 'idle' ||
        !round ||
        !round.options.some((phrase) => phrase.id === phraseId)
      ) {
        return
      }
      playbackOperationRef.current += 1
      await stopMorseTone()
      setPlayback(null)
      const isCorrect = phraseId === round.target.id
      setSelectedPhraseId(phraseId)
      setStatus(isCorrect ? 'success' : 'error')
      setAttemptCount((count) => count + 1)
      if (isCorrect) {
        setCorrectCount((count) => count + 1)
      }
    },
    [round, status, stopMorseTone],
  )

  const replay = useCallback(async () => {
    if (!round) {
      return
    }
    await playRound(round, false)
  }, [playRound, round])

  const next = useCallback(async () => {
    const nextRound = createListenPhraseRound(eligiblePhrases, {
      previousTargetId: lastTargetIdRef.current ?? undefined,
      random,
    })
    if (!nextRound) {
      return
    }
    lastTargetIdRef.current = nextRound.target.id
    setRound(nextRound)
    await playRound(nextRound, true)
  }, [eligiblePhrases, playRound, random])

  const stop = useCallback(async () => {
    playbackOperationRef.current += 1
    isPlayingRef.current = false
    setIsPlaying(false)
    await stopMorseTone()
    setPlayback(null)
    setRound(null)
    setStatus('idle')
    setSelectedPhraseId(null)
  }, [stopMorseTone])

  const release = useCallback(() => {
    playbackOperationRef.current += 1
    isPlayingRef.current = false
    setIsPlaying(false)
    setPlayback(null)
    setRound(null)
    setStatus('idle')
    setSelectedPhraseId(null)
  }, [])

  useEffect(() => () => {
    playbackOperationRef.current += 1
  }, [])

  useEffect(() => {
    if (!round) {
      return
    }
    const eligibleIds = new Set(eligiblePhrases.map((phrase) => phrase.id))
    const roundIsEligible =
      isAvailable &&
      eligibleIds.has(round.target.id) &&
      round.options.every((phrase) => eligibleIds.has(phrase.id))
    if (roundIsEligible) {
      return
    }
    let cancelled = false
    void (async () => {
      playbackOperationRef.current += 1
      await stopMorseTone()
      if (cancelled) {
        return
      }
      setPlayback(null)
      if (!isActive || !isAvailable) {
        isPlayingRef.current = false
        setIsPlaying(false)
        setRound(null)
        setStatus('idle')
        setSelectedPhraseId(null)
        return
      }
      const nextRound = createListenPhraseRound(eligiblePhrases, {
        previousTargetId: lastTargetIdRef.current ?? undefined,
        random,
      })
      if (!nextRound) {
        return
      }
      lastTargetIdRef.current = nextRound.target.id
      setRound(nextRound)
      await playRound(nextRound, true)
    })()
    return () => {
      cancelled = true
    }
  }, [eligiblePhrases, isActive, isAvailable, playRound, random, round, stopMorseTone])

  return {
    isAvailable,
    round,
    status,
    selectedPhraseId,
    attemptCount,
    correctCount,
    playback,
    isPlaying,
    start,
    submitAnswer,
    replay,
    next,
    release,
    stop,
  }
}
