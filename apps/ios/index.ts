import { registerRootComponent } from 'expo'
import type { ComponentType } from 'react'

let App: ComponentType

if (process.env.EXPO_PUBLIC_STORYBOOK_ENABLED === 'true') {
  const { view } = require('./.rnstorybook/storybook.requires')
  const AsyncStorage = require('@react-native-async-storage/async-storage').default
  App = view.getStorybookUI({
    storage: {
      getItem: AsyncStorage.getItem,
      setItem: AsyncStorage.setItem,
    },
  })
} else {
  App = require('./App').default
}

registerRootComponent(App)
