const { getDefaultConfig } = require('expo/metro-config')
const { withStorybook } = require('@storybook/react-native/metro/withStorybook')

const config = getDefaultConfig(__dirname)

config.resolver.sourceExts.push('cjs')
config.resolver.unstable_enablePackageExports = false

module.exports = withStorybook(config, {
  enabled: process.env.EXPO_PUBLIC_STORYBOOK_ENABLED === 'true',
  configPath: require('path').resolve(__dirname, '.rnstorybook'),
})
