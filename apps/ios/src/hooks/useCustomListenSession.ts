import {
  getListenTiming,
  getListenPlaybackDurationMs,
  LISTEN_MIN_UNIT_MS,
  textToMorseCode,
  usePlatform,
} from '@dit/core'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getMorsePlaybackState,
  pauseMorseTone,
  playMorseTone,
  resumeMorseTone,
  stopMorseTone,
} from '../utils/tone'

const STORAGE_KEY = 'dit-ios-custom-listen-v1'
export type CustomListenPhase = 'setup' | 'playing' | 'paused' | 'reveal'

type Options = {
  characterWpm: number
  effectiveWpm: number
  toneFrequency: number
}

/** Local, unscored head-copy practice using the native playback clock. */
export function useCustomListenSession(options: Options) {
  const { storage } = usePlatform()
  const [text, setText] = useState('')
  const [typeAlong, setTypeAlong] = useState(true)
  const [typedCopy, setTypedCopy] = useState('')
  const [phase, setPhase] = useState<CustomListenPhase>('setup')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const operation = useRef(0)
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const encoded = useMemo(() => textToMorseCode(text), [text])
  const timing = getListenTiming(options.characterWpm, options.effectiveWpm, LISTEN_MIN_UNIT_MS)
  const durationMs = getListenPlaybackDurationMs(encoded.code, timing.unitMs, timing.interCharacterGapMs)

  useEffect(() => {
    let cancelled = false
    void storage.getItem(STORAGE_KEY).then((value) => {
      if (cancelled) return
      if (value) {
        try {
          const saved = JSON.parse(value)
          if (typeof saved.text === 'string') setText(textToMorseCode(saved.text).normalized)
          setTypeAlong(saved.typeAlong !== false)
        } catch { /* A damaged local draft does not prevent a new exercise. */ }
      }
      setReady(true)
    }).catch(() => { if (!cancelled) setReady(true) })
    return () => { cancelled = true }
  }, [storage])

  const stop = useCallback(async () => {
    operation.current += 1
    phaseRef.current = 'setup'
    setPhase('setup')
    setElapsedMs(0)
    await stopMorseTone()
  }, [])

  useEffect(() => () => {
    operation.current += 1
    void stopMorseTone()
  }, [])

  useEffect(() => {
    if (phase !== 'playing') return
    const timer = setInterval(() => {
      const clock = getMorsePlaybackState()
      setElapsedMs(clock.elapsedMs)
      if (clock.finished) {
        phaseRef.current = 'reveal'
        setPhase('reveal')
      }
    }, 60)
    return () => clearInterval(timer)
  }, [phase])

  const save = useCallback(async (nextText: string, nextTypeAlong: boolean) => {
    await stop()
    const normalized = textToMorseCode(nextText).normalized
    setText(normalized)
    setTypeAlong(nextTypeAlong)
    setTypedCopy('')
    setError(null)
    try {
      await storage.setItem(STORAGE_KEY, JSON.stringify({ text: normalized, typeAlong: nextTypeAlong }))
    } catch {
      setError('This text could not be saved on this device. You can still listen to it now.')
    }
  }, [stop, storage])

  const play = useCallback(async () => {
    if (!encoded.code) return
    const id = ++operation.current
    await stopMorseTone()
    if (id !== operation.current) return
    setTypedCopy('')
    setElapsedMs(0)
    setError(null)
    try {
      await playMorseTone({ code: encoded.code, characterWpm: options.characterWpm, effectiveWpm: options.effectiveWpm, frequency: options.toneFrequency })
      if (id !== operation.current) return
      phaseRef.current = 'playing'
      setPhase('playing')
    } catch {
      if (id !== operation.current) return
      setError('Could not play the text. Try Play again.')
      setPhase('setup')
    }
  }, [encoded.code, options])

  const pause = useCallback(async () => {
    if (phaseRef.current !== 'playing') return
    try {
      await pauseMorseTone()
      setElapsedMs(getMorsePlaybackState().elapsedMs)
      phaseRef.current = 'paused'
      setPhase('paused')
    } catch {
      setError('Could not pause playback. Try End and Play again.')
    }
  }, [])

  const resume = useCallback(async () => {
    if (phaseRef.current !== 'paused') return
    try {
      await resumeMorseTone()
      phaseRef.current = 'playing'
      setPhase('playing')
    } catch {
      setError('Could not resume playback. Try Restart.')
    }
  }, [])

  const reveal = useCallback(async () => {
    operation.current += 1
    setElapsedMs(getMorsePlaybackState().elapsedMs)
    await stopMorseTone()
    phaseRef.current = 'reveal'
    setPhase('reveal')
  }, [])

  return { ready, text, typeAlong, typedCopy, setTypedCopy, phase, elapsedMs, durationMs,
    encoded, timing, error, save, play, pause, resume, reveal, stop }
}
