module.exports = ({ config }) => {
  const expoConfig = { ...config }
  const enableDevClient = process.env.DIT_ENABLE_DEV_CLIENT !== '0'
  const plugins = expoConfig.plugins ?? []

  expoConfig.plugins = enableDevClient
    ? plugins
    : plugins.filter((plugin) => {
        const pluginName = Array.isArray(plugin) ? plugin[0] : plugin
        return pluginName !== 'expo-dev-client'
      })

  return expoConfig
}
