import { Asset } from 'expo-asset'
import { copyAssetToAppGroup } from '@dit/dit-native'

const APP_GROUP = 'group.com.tylerobinson.dit'
const ICON_FILENAME = 'widget-brand-icon.png'

let cachedUri: string | null = null
let pending: Promise<string | null> | null = null

const resolve = async (): Promise<string | null> => {
  const asset = Asset.fromModule(require('../../assets/splash-icon.png'))
  if (!asset.localUri) {
    await asset.downloadAsync()
  }
  const source = asset.localUri
  if (!source) return null
  return copyAssetToAppGroup(source, APP_GROUP, ICON_FILENAME)
}

export const ensureBrandIconUri = (): Promise<string | null> => {
  if (cachedUri) return Promise.resolve(cachedUri)
  if (!pending) {
    pending = resolve().then((uri) => {
      cachedUri = uri
      return uri
    })
  }
  return pending
}

export const getBrandIconUri = (): string | null => cachedUri
