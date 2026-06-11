import { AUDIO_VOLUME, AUDIO_VOLUME_MAX } from '../constants'

/**
 * Resolve a Morse tone volume for Web Audio or the native sine engine.
 * Uses the shared default when no override is passed.
 */
export const resolveToneVolume = (volume?: number) =>
  Math.min(AUDIO_VOLUME_MAX, Math.max(0, volume ?? AUDIO_VOLUME))
