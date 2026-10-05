import { useConversationSession } from '@dit/core'
import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { createConversation } from '../lib/conversationAi'
import { getMorsePlaybackState, pauseMorseTone, playMorseTone, prepareToneEngine, resumeMorseTone, startTone, stopMorseTone, stopTone } from '../utils/tone'

type Options = { active: boolean; blocked: boolean; characterWpm: number; toneFrequency: number }

/** Connects shared QSO learning to native audio and foreground interruption handling. */
export function useIosConversationSession(options: Options) {
  const available = useRef(false)
  available.current = options.active && !options.blocked && AppState.currentState === 'active'
  const session = useConversationSession({
    createConversation,
    canInteract: () => available.current,
    characterWpm: options.characterWpm,
    toneFrequency: options.toneFrequency,
    prepareToneEngine: async () => { await prepareToneEngine() },
    playMorseTone,
    stopMorseTone: async () => { await stopMorseTone() },
    startTone: async (tone) => { await startTone(tone) },
    stopTone: async () => { await stopTone() },
    pauseAudioContext: pauseMorseTone,
    resumeAudioContext: resumeMorseTone,
    restoreAudioOnEnd: false,
    getPlaybackElapsedMs: () => getMorsePlaybackState().elapsedMs,
    isPlaybackComplete: () => getMorsePlaybackState().finished,
  })
  const current = useRef(session)
  current.current = session
  useEffect(() => {
    if (!options.active || !options.blocked) return
    if (!['idle', 'ended'].includes(current.current.phase)) current.current.end()
  }, [options.active, options.blocked])
  useEffect(() => {
    if (!options.active) return
    const listener = AppState.addEventListener('change', (next) => {
      available.current = next === 'active' && !options.blocked
      if (next !== 'active' && !['idle', 'ended'].includes(current.current.phase)) current.current.end()
    })
    return () => listener.remove()
  }, [options.active, options.blocked])
  return session
}
