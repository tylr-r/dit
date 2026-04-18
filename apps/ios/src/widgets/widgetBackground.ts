import { Asset } from 'expo-asset'
import { copyAssetToAppGroup } from '@dit/dit-native'

const APP_GROUP = 'group.com.tylerobinson.dit'

type Entry = {
  filename: string
  module: number
  cachedUri: string | null
  pending: Promise<string | null> | null
}

const entries = {
  small: {
    filename: 'widget-bg-small.png',
    module: require('../../assets/images/widget-bg-small.png'),
    cachedUri: null,
    pending: null,
  } as Entry,
  medium: {
    filename: 'widget-bg-medium.png',
    module: require('../../assets/images/widget-bg-medium.png'),
    cachedUri: null,
    pending: null,
  } as Entry,
}

const resolve = async (entry: Entry): Promise<string | null> => {
  const asset = Asset.fromModule(entry.module)
  if (!asset.localUri) {
    await asset.downloadAsync()
  }
  const source = asset.localUri
  if (!source) return null
  return copyAssetToAppGroup(source, APP_GROUP, entry.filename)
}

const ensure = (entry: Entry): Promise<string | null> => {
  if (entry.cachedUri) return Promise.resolve(entry.cachedUri)
  if (!entry.pending) {
    entry.pending = resolve(entry).then((uri) => {
      entry.cachedUri = uri
      return uri
    })
  }
  return entry.pending
}

export const ensureWidgetBgSmallUri = () => ensure(entries.small)
export const getWidgetBgSmallUri = () => entries.small.cachedUri

export const ensureWidgetBgMediumUri = () => ensure(entries.medium)
export const getWidgetBgMediumUri = () => entries.medium.cachedUri
