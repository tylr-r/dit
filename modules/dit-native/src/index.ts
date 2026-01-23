import { requireNativeModule } from 'expo-modules-core'

export type DitNativeModule = {
  getHello: () => string
}

const DitNative = requireNativeModule<DitNativeModule>('DitNative')

export default DitNative
