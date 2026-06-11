export const DASH_THRESHOLD = 200
export const UNIT_TIME_MS = DASH_THRESHOLD
export const INTER_LETTER_UNITS = 1
export const INTER_WORD_UNITS = 7
export const AUDIO_FREQUENCY = 600
export const TONE_FREQUENCY_RANGE = {
  min: 400,
  max: 800,
  step: 20,
} as const
/** Default Morse sidetone / Listen playback level (0–1 sine amplitude). */
export const AUDIO_VOLUME = 0.75
/** Upper cap keeps pure tones loud enough to practice with but below harsh clipping. */
export const AUDIO_VOLUME_MAX = 0.9
export const DEBOUNCE_DELAY = 800
export const DEFAULT_CHARACTER_WPM = 12
export const DEFAULT_EFFECTIVE_WPM = 8
export const WPM_RANGE = {
  min: 10,
  max: 30,
} as const
export const EFFECTIVE_WPM_RANGE = {
  min: 6,
  max: 30,
} as const
