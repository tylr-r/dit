const { withDangerousMod } = require('expo/config-plugins')
const fs = require('fs')
const path = require('path')

// RNFB 24's stock Swift plugin can configure Firebase twice. Register the
// provider exactly once before the existing app plugin configures Firebase.
// List this plugin before RNFB App: Expo runs dangerous mods last to first.
function configureAppCheck(contents) {
  if (contents.includes('RNFBAppCheckModule.sharedInstance()')) return contents
  if (!contents.includes('FirebaseApp.configure()')) {
    throw new Error('Firebase App must be configured before applying App Check')
  }
  return contents.replace('FirebaseApp.configure()', 'RNFBAppCheckModule.sharedInstance()\nFirebaseApp.configure()')
}

module.exports = function withFirebaseAppCheck(config) {
  return withDangerousMod(config, ['ios', (config) => {
    const directory = path.join(config.modRequest.platformProjectRoot, config.modRequest.projectName)
    const delegatePath = path.join(directory, 'AppDelegate.swift')
    fs.writeFileSync(delegatePath, configureAppCheck(fs.readFileSync(delegatePath, 'utf8')))
    const headerPath = path.join(directory, `${config.modRequest.projectName}-Bridging-Header.h`)
    const header = fs.readFileSync(headerPath, 'utf8')
    if (!header.includes('#import <RNFBAppCheckModule.h>')) {
      fs.writeFileSync(headerPath, `${header}\n#import <RNFBAppCheckModule.h>\n`)
    }
    return config
  }])
}
module.exports.configureAppCheck = configureAppCheck
