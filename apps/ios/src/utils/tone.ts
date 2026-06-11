import {
  AUDIO_FREQUENCY,
  getFarnsworthUnitMs,
  getListenUnitMs,
  resolveToneVolume,
} from '@dit/core'
import { requireNativeModule } from 'expo-modules-core'

const DitNative = requireNativeModule('DitNative')

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
  return DitNative.playMorseSequence(
    code,
    characterUnitMs,
    farnsworthUnitMs,
    frequency ?? AUDIO_FREQUENCY,
    resolveToneVolume(volume),
  )
}

export async function stopMorseTone() {
  return DitNative.stopMorseSequence()
}
