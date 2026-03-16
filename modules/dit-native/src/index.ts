import {
  EventEmitter,
  requireOptionalNativeModule,
  type EventSubscription,
} from 'expo-modules-core'
import { Vibration } from 'react-native'

type DitNativeEvents = {
  onLowPowerModeChanged: (event: {
    isLowPowerModeEnabled: boolean
  }) => void
}

export type DitNativeModule = {
  getHello?: () => string
  getLowPowerModeEnabled?: () => boolean | Promise<boolean>
  triggerHaptics?: (pattern: number | number[]) => boolean | Promise<boolean>
  startTone?: (frequency: number, volume: number) => boolean | Promise<boolean>
  stopTone?: () => boolean | Promise<boolean>
  signInWithApple?: () => Promise<{
    idToken?: string
    rawNonce?: string
    authorizationCode?: string
    email?: string
    givenName?: string
    familyName?: string
  }>
  prepareAppleAccountDeletion?: (userId: string) => Promise<{
    idToken?: string
    rawNonce?: string
    authorizationCode?: string
  }>
  revokeAppleTokenForAccountDeletion?: (
    authorizationCode: string,
    userId: string
  ) => Promise<void>
  signInWithGoogle?: () => Promise<{
    idToken?: string
    accessToken?: string
    email?: string
  }>
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

export const getLowPowerModeEnabled = async () => {
  if (!DitNative?.getLowPowerModeEnabled) {
    return false
  }

  return Boolean(await DitNative.getLowPowerModeEnabled())
}

export const addLowPowerModeListener = (
  listener: (isLowPowerModeEnabled: boolean) => void
): EventSubscription => {
  if (!DitNative) {
    return {
      remove() {},
    }
  }

  const emitter = new EventEmitter<DitNativeEvents>(DitNative as never)

  return emitter.addListener('onLowPowerModeChanged', (event) => {
    listener(Boolean(event.isLowPowerModeEnabled))
  })
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

export const startTone = async (frequency: number, volume: number) => {
  if (DitNative?.startTone) {
    const handled = await DitNative.startTone(frequency, volume)
    if (handled) {
      return true
    }
  }

  return false
}

export const stopTone = async () => {
  if (DitNative?.stopTone) {
    const handled = await DitNative.stopTone()
    if (handled) {
      return true
    }
  }

  return false
}

export default DitNative
