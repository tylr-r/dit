import {
  EventEmitter,
  requireOptionalNativeModule,
  type EventSubscription,
} from 'expo-modules-core'

type DitNativeEvents = {
  onLowPowerModeChanged: (event: {
    isLowPowerModeEnabled: boolean
  }) => void
}

export type DitNativeModule = {
  getHello?: () => string
  getLowPowerModeEnabled?: () => boolean | Promise<boolean>
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
  copyAssetToAppGroup?: (
    sourceUri: string,
    appGroup: string,
    filename: string
  ) => Promise<string | null>
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

export const copyAssetToAppGroup = async (
  sourceUri: string,
  appGroup: string,
  filename: string
): Promise<string | null> => {
  if (!DitNative?.copyAssetToAppGroup) return null
  return DitNative.copyAssetToAppGroup(sourceUri, appGroup, filename)
}

export default DitNative
