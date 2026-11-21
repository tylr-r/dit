import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {deploymentTargets, moduleTripleFor, infoPlist, designCompatible} from '../.exact/checkout/host/apple/build.mjs'

const manifest = JSON.parse(readFileSync(new URL('../app.json',import.meta.url)))
const app = {manifest, id:manifest.id, displayName:manifest.name}
const shipped=JSON.parse(readFileSync(new URL('../../../apps/ios/app.json',import.meta.url)))
assert.equal(shipped.expo.userInterfaceStyle,'dark')
assert.equal(manifest.userInterfaceStyle,shipped.expo.userInterfaceStyle,'match shipped native appearance')
assert.equal(deploymentTargets(app).ios,'26.0')
assert.equal(designCompatible(app,'ios'),false)
for (const device of [false,true]) {
  const triple = moduleTripleFor(app,true,device)
  assert.match(triple,device ? /^arm64-apple-ios26\.0$/ : /-apple-ios26\.0-simulator$/)
  assert.match(infoPlist(app,device,{executable:'ExactPractice'}),/<key>MinimumOSVersion<\/key>\s*<string>26\.0<\/string>/)
  assert.match(infoPlist(app,device,{executable:'ExactPractice'}),/<key>UIUserInterfaceStyle<\/key>\s*<string>Dark<\/string>/)
  console.log(triple, 'MinimumOSVersion=26.0 UIUserInterfaceStyle=Dark')
}
