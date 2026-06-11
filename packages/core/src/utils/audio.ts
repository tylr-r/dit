import { AUDIO_VOLUME, AUDIO_VOLUME_MAX } from '../constants'
import { LISTEN_MIN_UNIT_MS } from './appState'

/**
 * Resolve a Morse tone volume for Web Audio or the native sine engine.
 * Uses the shared default when no override is passed.
 */
export const resolveToneVolume = (volume?: number) =>
  Math.min(AUDIO_VOLUME_MAX, Math.max(0, volume ?? AUDIO_VOLUME))

type PlaybackToneSettings = {
  listenWpm: number
  listenEffectiveWpm?: number | null
  toneFrequency: number
}

/**
 * Build `playMorseTone` options from the global playback settings in Settings.
 * Use this for reference chart taps, sound check, and any other Dit-initiated playback
 * outside the main session controller paths.
 */
export const buildPlaybackToneRequest = (
  code: string,
  { listenWpm, listenEffectiveWpm, toneFrequency }: PlaybackToneSettings,
) => ({
  code,
  characterWpm: listenWpm,
  effectiveWpm: listenEffectiveWpm ?? listenWpm,
  minUnitMs: LISTEN_MIN_UNIT_MS,
  frequency: toneFrequency,
})
