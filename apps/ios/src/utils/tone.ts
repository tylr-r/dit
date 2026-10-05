import {
  AUDIO_FREQUENCY,
  DEFAULT_CHARACTER_WPM,
  getFarnsworthUnitMs,
  getListenUnitMs,
  resolveToneVolume,
} from '@dit/core'
import { requireNativeModule } from 'expo-modules-core'

const DitNative = requireNativeModule('DitNative')

export type MorsePlaybackState = {
  elapsedMs: number
  durationMs: number
  finished: boolean
  paused: boolean
}

let playbackOperation = 0
let completionTimer: ReturnType<typeof setInterval> | null = null
const clearCompletionTimer = () => {
  if (completionTimer !== null) clearInterval(completionTimer)
  completionTimer = null
}

export function getMorsePlaybackState(): MorsePlaybackState {
  return DitNative.getMorsePlaybackState()
}

export async function pauseMorseTone() {
  if (!await DitNative.pauseMorseSequence()) throw new Error('Could not pause playback')
}

export async function resumeMorseTone() {
  if (!await DitNative.resumeMorseSequence()) throw new Error('Could not resume playback')
}

type ToneDefaults = {
  frequency?: number
  volume?: number
}

export async function prepareToneEngine() {
  return DitNative.prepareToneEngine()
}

export async function setHapticsEnabled(enabled: boolean) {
  if (typeof DitNative.setHapticsEnabled !== 'function') {
    return false
  }
  return DitNative.setHapticsEnabled(enabled)
}

export async function startTone({ frequency, volume }: ToneDefaults = {}) {
  return DitNative.startTone(
    frequency ?? AUDIO_FREQUENCY,
    resolveToneVolume(volume),
  )
}

export async function stopTone() {
  return DitNative.stopTone()
}

export async function playMorseTone({
  code,
  characterWpm = DEFAULT_CHARACTER_WPM,
  effectiveWpm,
  minUnitMs = 40,
  frequency,
  volume,
  onComplete,
}: {
  onComplete?: () => void
  code: string
  characterWpm?: number
  effectiveWpm?: number
  minUnitMs?: number
  frequency?: number
  volume?: number
}) {
  const characterUnitMs = getListenUnitMs(characterWpm, minUnitMs)
  const resolvedEffectiveWpm = Math.min(
    characterWpm,
    effectiveWpm ?? characterWpm,
  )
  const farnsworthUnitMs = getFarnsworthUnitMs(
    characterWpm,
    resolvedEffectiveWpm,
    minUnitMs,
  )
  const operation = ++playbackOperation
  clearCompletionTimer()
  const started = await DitNative.playMorseSequence(
    code,
    characterUnitMs,
    farnsworthUnitMs,
    frequency ?? AUDIO_FREQUENCY,
    resolveToneVolume(volume),
  )
  if (operation !== playbackOperation) return
  if (!started) throw new Error('Could not play Morse audio')
  if (onComplete) {
    completionTimer = setInterval(() => {
      if (!getMorsePlaybackState().finished) return
      clearCompletionTimer()
      onComplete()
    }, 40)
  }
}

export async function stopMorseTone() {
  playbackOperation += 1
  clearCompletionTimer()
  return DitNative.stopMorseSequence()
}
