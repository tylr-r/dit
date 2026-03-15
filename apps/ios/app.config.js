/* global module, process, require */

const appJson = require('./app.json')

const clone = (value) => JSON.parse(JSON.stringify(value))

module.exports = () => {
  const expoConfig = clone(appJson.expo)
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
