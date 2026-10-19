const { withDangerousMod } = require('expo/config-plugins')
const fs = require('fs')
const path = require('path')

// RNFB 24's app plugin only recognizes the old React Native startup block.
// Own initialization for the scene template, before RNFB's plugin runs.
// List this plugin after RNFB App: Expo runs dangerous mods last to first.
function configureAppCheck(contents) {
  if (!contents.includes('FirebaseApp.configure()')) {
    const launchReturn = 'return super.application(application, didFinishLaunchingWithOptions: launchOptions)'
    if (!contents.includes(launchReturn)) {
      throw new Error('Cannot find Expo app launch method for Firebase initialization')
    }
    contents = contents.replace(launchReturn, `FirebaseApp.configure()\n    ${launchReturn}`)
  }
  if (!contents.includes('RNFBAppCheckModule.sharedInstance()')) {
    contents = contents.replace('FirebaseApp.configure()', 'RNFBAppCheckModule.sharedInstance()\n    FirebaseApp.configure()')
  }
  for (const moduleName of ['FirebaseCore', 'RNFBAppCheck']) {
    if (!contents.includes(`import ${moduleName}`)) {
      contents = contents.replace('import Expo', `import Expo\nimport ${moduleName}`)
    }
  }
  return contents
}

module.exports = function withFirebaseAppCheck(config) {
  return withDangerousMod(config, ['ios', (config) => {
    const directory = path.join(config.modRequest.platformProjectRoot, config.modRequest.projectName)
    const delegatePath = path.join(directory, 'AppDelegate.swift')
    fs.writeFileSync(delegatePath, configureAppCheck(fs.readFileSync(delegatePath, 'utf8')))
    const headerPath = path.join(directory, `${config.modRequest.projectName}-Bridging-Header.h`)
    const header = fs.readFileSync(headerPath, 'utf8')
    // Swift imports the module directly, avoiding a cached Clang module in the PCH.
    fs.writeFileSync(headerPath, header.replace(/^#import <RNFBAppCheckModule.h>\r?\n?/gm, ''))
    return config
  }])
}
module.exports.configureAppCheck = configureAppCheck
