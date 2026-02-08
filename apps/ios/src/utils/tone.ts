import { AUDIO_FREQUENCY, AUDIO_VOLUME } from '@dit/core'
import { requireNativeModule } from 'expo-modules-core'

const DitNative = requireNativeModule('DitNative')

type ToneDefaults = {
  frequency?: number
  volume?: number
}

const clampVolume = (value: number) => Math.min(1, Math.max(0.4, value))

export async function prepareToneEngine() {
  return DitNative.prepareToneEngine()
}

export async function startTone({ frequency, volume }: ToneDefaults = {}) {
  const resolvedVolume = clampVolume(volume ?? AUDIO_VOLUME)
  return DitNative.startTone(frequency ?? AUDIO_FREQUENCY, resolvedVolume)
}

export async function stopTone() {
  return DitNative.stopTone()
}

export async function playMorseTone({
  code,
  characterWpm = 20,
  effectiveWpm,
  minUnitMs = 40,
  frequency,
  volume,
}: {
  code: string
  characterWpm?: number
  effectiveWpm?: number
  minUnitMs?: number
  frequency?: number
  volume?: number
}) {
  const characterUnitMs = Math.max(Math.round(1200 / characterWpm), minUnitMs)
  const resolvedEffectiveWpm = Math.min(
    characterWpm,
    effectiveWpm ?? characterWpm,
  )
  const effectiveUnitMs = Math.max(
    Math.round(1200 / resolvedEffectiveWpm),
    minUnitMs,
  )
  const resolvedVolume = clampVolume(volume ?? AUDIO_VOLUME)
  return DitNative.playMorseSequence(
    code,
    characterUnitMs,
    effectiveUnitMs,
    frequency ?? AUDIO_FREQUENCY,
    resolvedVolume,
  )
}

export async function stopMorseTone() {
  return DitNative.stopMorseSequence()
}
