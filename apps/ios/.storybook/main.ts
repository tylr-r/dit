import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.tsx'],
  addons: ['@storybook/addon-essentials'],
  framework: '@storybook/react-vite',
  viteFinal: (config) => {
    config.resolve ??= {}
    config.resolve.alias ??= {}

    const alias = config.resolve.alias as Record<string, string>
    alias['react-native'] = 'react-native-web'
    alias['react-native-svg'] = 'react-native-web'

    // Stub native-only modules that can't run in the browser
    alias['expo-glass-effect'] = require.resolve('./stubs/expo-glass-effect')
    alias['expo-symbols'] = require.resolve('./stubs/expo-symbols')
    alias['@expo/vector-icons'] = require.resolve('./stubs/expo-vector-icons')
    alias['@expo/ui/swift-ui'] = require.resolve('./stubs/expo-ui-swift')
    alias['@expo/ui/swift-ui/modifiers'] = require.resolve('./stubs/expo-ui-swift-modifiers')
    alias['@shopify/react-native-skia'] = require.resolve('./stubs/react-native-skia')
    alias['react-native-reanimated'] = require.resolve('./stubs/react-native-reanimated')

    return config
  },
}

export default config
