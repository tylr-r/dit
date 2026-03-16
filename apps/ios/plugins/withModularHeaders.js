const { withDangerousMod } = require('expo/config-plugins')
const fs = require('fs')
const path = require('path')

/** Adds `use_modular_headers!` to the Podfile so Firebase Swift pods can resolve modules. */
module.exports = function withModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile',
      )
      let podfile = fs.readFileSync(podfilePath, 'utf8')

      if (!podfile.includes('use_modular_headers!')) {
        podfile = podfile.replace(
          "prepare_react_native_project!\n",
          "prepare_react_native_project!\nuse_modular_headers!\n",
        )
        fs.writeFileSync(podfilePath, podfile)
      }

      return config
    },
  ])
}
