import { registerRootComponent } from 'expo'
import type { ComponentType } from 'react'

let App: ComponentType

if (process.env.EXPO_PUBLIC_STORYBOOK_ENABLED === 'true') {
  const {
    default: StorybookUIRoot,
  } = require('./.rnstorybook/storybook.requires')
  App = StorybookUIRoot
} else {
  App = require('./App').default
}

registerRootComponent(App)
