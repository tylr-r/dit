import {
  EventEmitter,
  requireOptionalNativeModule,
  type EventSubscription,
} from 'expo-modules-core'

type DitNativeEvents = {
  onLowPowerModeChanged: (event: {
    isLowPowerModeEnabled: boolean
  }) => void
  onExternalMorseKey: (event: ExternalMorseKeyEvent) => void
}

export type ExternalMorseKeyEvent = {
  symbol: '.' | '-'
  phase: 'down' | 'up'
}

export type DitNativeModule = {
  getLowPowerModeEnabled?: () => boolean | Promise<boolean>
  setExternalMorseKeyCaptureEnabled?: (
    enabled: boolean
  ) => boolean | Promise<boolean>
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

const noopSubscription: EventSubscription = {
  remove() {},
}

const getEventEmitter = () => {
  if (!DitNative) {
    return null
  }

  return new EventEmitter<DitNativeEvents>(DitNative as never)
}

const isExternalMorseKeyEvent = (event: ExternalMorseKeyEvent) => {
  return (
    (event.symbol === '.' || event.symbol === '-') &&
    (event.phase === 'down' || event.phase === 'up')
  )
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
  const emitter = getEventEmitter()
  if (!emitter) {
    return noopSubscription
  }

  return emitter.addListener('onLowPowerModeChanged', (event) => {
    listener(Boolean(event.isLowPowerModeEnabled))
  })
}

export const setExternalMorseKeyCaptureEnabled = async (enabled: boolean) => {
  if (!DitNative?.setExternalMorseKeyCaptureEnabled) {
    return false
  }

  return Boolean(await DitNative.setExternalMorseKeyCaptureEnabled(enabled))
}

export const addExternalMorseKeyListener = (
  listener: (event: ExternalMorseKeyEvent) => void
): EventSubscription => {
  const emitter = getEventEmitter()
  if (!emitter) {
    return noopSubscription
  }

  return emitter.addListener('onExternalMorseKey', (event) => {
    if (isExternalMorseKeyEvent(event)) {
      listener(event)
    }
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
