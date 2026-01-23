import { requireOptionalNativeModule } from 'expo-modules-core'
import { Vibration } from 'react-native'

export type DitNativeModule = {
  getHello?: () => string
  triggerHaptics?: (pattern: number | number[]) => boolean | Promise<boolean>
  playTone?: (
    frequency: number,
    durationMs: number,
    volume: number
  ) => boolean | Promise<boolean>
}

const DitNative = requireOptionalNativeModule<DitNativeModule>('DitNative')

export const getHello = () => {
  return DitNative?.getHello?.() ?? 'Dit native module not available'
}

export const triggerHaptics = async (pattern: number | number[]) => {
  if (DitNative?.triggerHaptics) {
    const payload = Array.isArray(pattern) ? pattern : [pattern]
    const handled = await DitNative.triggerHaptics(payload)
    if (handled) {
      return true
    }
  }

  Vibration.vibrate(pattern)
  return true
}

export const playTone = async (
  frequency: number,
  durationMs: number,
  volume: number
) => {
  if (DitNative?.playTone) {
    const handled = await DitNative.playTone(frequency, durationMs, volume)
    if (handled) {
      return true
    }
  }

  return false
}

export default DitNative
