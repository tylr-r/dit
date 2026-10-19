import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
const require = createRequire(import.meta.url)
const withFirebaseAppCheck = require('../../plugins/withFirebaseAppCheck.js')
const { configureAppCheck } = withFirebaseAppCheck
const { modifySwiftAppDelegate, withFirebaseAppDelegate } = require(join(dirname(require.resolve('@react-native-firebase/app/package.json')), 'plugin/build/ios/appDelegate.js'))
const source = 'import Expo\nclass AppDelegate {\n func launch() {\n factory.startReactNative(\n )\n }\n}'
const sceneSource = readFileSync(join(import.meta.dirname, '../fixtures/Expo58AppDelegate.swift'), 'utf8')

const expectValidConfiguration = (generated: string) => {
  expect(generated.match(/FirebaseApp.configure\(\)/g)).toHaveLength(1)
  expect(generated.match(/RNFBAppCheckModule.sharedInstance\(\)/g)).toHaveLength(1)
  expect(generated.indexOf('RNFBAppCheckModule.sharedInstance()')).toBeLessThan(generated.indexOf('FirebaseApp.configure()'))
}

describe('App Check native initialization', () => {
  it('initializes Firebase before Expo starts the scene lifecycle', () => {
    const generated = configureAppCheck(sceneSource)
    expectValidConfiguration(generated)
    expect(generated).toContain('import RNFBAppCheck')
    expect(generated.indexOf('FirebaseApp.configure()')).toBeLessThan(generated.indexOf('return super.application'))
    expect(configureAppCheck(generated)).toBe(generated)
  })

  it('composes with the Firebase app transform and stays idempotent', () => {
    const generated = configureAppCheck(modifySwiftAppDelegate(source))
    expectValidConfiguration(generated)
    expect(configureAppCheck(modifySwiftAppDelegate(generated))).toBe(generated)
  })

  it('registers App Check before Firebase exactly once through the actual Expo mod stack', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'dit-app-check-'))
    try {
      const nativeDirectory = join(projectRoot, 'ios', 'Dit')
      mkdirSync(nativeDirectory, { recursive: true })
      const delegatePath = join(nativeDirectory, 'AppDelegate.swift')
      const headerPath = join(nativeDirectory, 'Dit-Bridging-Header.h')
      writeFileSync(delegatePath, sceneSource)
      writeFileSync(headerPath, '// Bridging header\n#import <RNFBAppCheckModule.h>\n')
      // Same order as app.json. Later dangerous mods execute first.
      const config = withFirebaseAppCheck(withFirebaseAppDelegate({ name: 'Dit', slug: 'dit-ios' }))
      const execute = () => config.mods.ios.dangerous({ ...config, modRequest: {
        projectRoot, platformProjectRoot: join(projectRoot, 'ios'), projectName: 'Dit', platform: 'ios', modName: 'dangerous',
      } })
      await execute()
      const generated = readFileSync(delegatePath, 'utf8')
      expectValidConfiguration(generated)
      expect(generated).toContain('import RNFBAppCheck')
      expect(readFileSync(headerPath, 'utf8')).not.toContain('RNFBAppCheckModule.h')
      await execute()
      expect(readFileSync(delegatePath, 'utf8')).toBe(generated)
      expect(readFileSync(headerPath, 'utf8')).not.toContain('RNFBAppCheckModule.h')
    } finally { rmSync(projectRoot, { recursive: true, force: true }) }
  })
})
