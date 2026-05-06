import {
  getListenPlaybackDurationMs,
  getListenTiming,
  LISTEN_MIN_UNIT_MS,
  textToMorseCode,
  type TextToMorseResult,
} from '@dit/core'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export type CustomListenPhase = 'inactive' | 'setup' | 'playing' | 'paused' | 'reveal'

export type CustomListenWorkflow = 'typealong' | 'listenonly'

export const TEXT_KEY = 'dit-listen-custom-text-v1'
export const TYPEALONG_KEY = 'dit-listen-custom-typealong-v1'
export const ACTIVE_KEY = 'dit-listen-custom-active-v1'

type PlayMorseToneOptions = {
  code: string
  characterWpm: number
  effectiveWpm: number
  frequency?: number
}

export type UseCustomListenSessionOptions = {
  isListenMode: boolean
  characterWpm: number
  effectiveWpm: number
  toneFrequency: number
  playMorseTone: (opts: PlayMorseToneOptions) => Promise<void>
  stopMorseTone: () => Promise<void>
  pauseAudioContext: () => Promise<void>
  resumeAudioContext: () => Promise<void>
}

export type SaveInput = {
  text: string
  typeAlong: boolean
}

export type UseCustomListenSessionResult = {
  phase: CustomListenPhase
  text: string
  workflow: CustomListenWorkflow
  encoded: TextToMorseResult
  typedCopy: string
  /** Total playback duration in ms for the current saved text. */
  playDurationMs: number
  save: (input: SaveInput) => void
  clear: () => void
  play: () => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  stop: () => Promise<void>
  reveal: () => Promise<void>
  restart: () => Promise<void>
  replay: () => Promise<void>
  setTypedCopy: (next: string) => void
}

const readActive = () => {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(ACTIVE_KEY) === 'true'
}

const readText = () => {
  if (typeof localStorage === 'undefined') return ''
  return localStorage.getItem(TEXT_KEY) ?? ''
}

const readWorkflow = (): CustomListenWorkflow => {
  if (typeof localStorage === 'undefined') return 'typealong'
  return localStorage.getItem(TYPEALONG_KEY) === 'off' ? 'listenonly' : 'typealong'
}

const writeStorage = (text: string, workflow: CustomListenWorkflow, active: boolean) => {
  if (typeof localStorage === 'undefined') return
  if (text) {
    localStorage.setItem(TEXT_KEY, text)
  } else {
    localStorage.removeItem(TEXT_KEY)
  }
  localStorage.setItem(TYPEALONG_KEY, workflow === 'typealong' ? 'on' : 'off')
  localStorage.setItem(ACTIVE_KEY, active ? 'true' : 'false')
}

/** Manages a custom-text Listen session: phase state machine, persistence, and playback control. */
export const useCustomListenSession = (
  options: UseCustomListenSessionOptions,
): UseCustomListenSessionResult => {
  const {
    isListenMode,
    characterWpm,
    effectiveWpm,
    toneFrequency,
    playMorseTone,
    stopMorseTone,
    pauseAudioContext,
    resumeAudioContext,
  } = options

  const [phase, setPhase] = useState<CustomListenPhase>('inactive')
  const [text, setText] = useState('')
  const [workflow, setWorkflow] = useState<CustomListenWorkflow>('typealong')
  const [typedCopy, setTypedCopy] = useState('')

  const hydratedRef = useRef(false)

  // Hydrate the first time we land on Listen with an active flag set.
  useEffect(() => {
    if (!isListenMode || hydratedRef.current) return
    hydratedRef.current = true
    if (!readActive()) return
    const savedText = readText()
    if (!savedText) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional one-time hydration from localStorage on mount; no external subscription needed
    setText(savedText)
    setWorkflow(readWorkflow())
    setPhase('setup')
  }, [isListenMode])

  const encoded = useMemo(() => textToMorseCode(text), [text])

  const playDurationMs = useMemo(() => {
    if (encoded.code.length === 0) return 0
    const timing = getListenTiming(characterWpm, effectiveWpm, LISTEN_MIN_UNIT_MS)
    return getListenPlaybackDurationMs(encoded.code, timing.unitMs, timing.interCharacterGapMs)
  }, [encoded.code, characterWpm, effectiveWpm])

  const save = useCallback(({ text: nextText, typeAlong }: SaveInput) => {
    const { normalized } = textToMorseCode(nextText)
    const nextWorkflow: CustomListenWorkflow = typeAlong ? 'typealong' : 'listenonly'
    setText(normalized)
    setWorkflow(nextWorkflow)
    setTypedCopy('')
    if (normalized.length === 0) {
      setPhase('inactive')
      writeStorage('', nextWorkflow, false)
      return
    }
    setPhase('setup')
    writeStorage(normalized, nextWorkflow, true)
  }, [])

  const clear = useCallback(() => {
    setText('')
    setTypedCopy('')
    setPhase('inactive')
    writeStorage('', workflow, false)
  }, [workflow])

  const play = useCallback(async () => {
    if (encoded.code.length === 0) return
    setPhase('playing')
    setTypedCopy('')
    await playMorseTone({
      code: encoded.code,
      characterWpm,
      effectiveWpm,
      frequency: toneFrequency,
    })
  }, [
    encoded.code,
    characterWpm,
    effectiveWpm,
    toneFrequency,
    playMorseTone,
  ])

  const pause = useCallback(async () => {
    if (phase !== 'playing') return
    await pauseAudioContext()
    setPhase('paused')
  }, [phase, pauseAudioContext])

  const resume = useCallback(async () => {
    if (phase !== 'paused') return
    setPhase('playing')
    await resumeAudioContext()
  }, [phase, resumeAudioContext])

  const stop = useCallback(async () => {
    await stopMorseTone()
    setPhase('setup')
  }, [stopMorseTone])

  const reveal = useCallback(async () => {
    await stopMorseTone()
    if (phase === 'paused') {
      await resumeAudioContext()
    }
    setPhase('reveal')
  }, [phase, stopMorseTone, resumeAudioContext])

  const restart = useCallback(async () => {
    if (phase !== 'playing' && phase !== 'paused') return
    await play()
  }, [phase, play])

  const replay = useCallback(async () => {
    await play()
  }, [play])

  return {
    phase,
    text,
    workflow,
    encoded,
    typedCopy,
    playDurationMs,
    save,
    clear,
    play,
    pause,
    resume,
    stop,
    reveal,
    restart,
    replay,
    setTypedCopy,
  }
}
