import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8')

test('installed Apple app starts at the gated practice route and opens the private learner directory independently of the widget group', () => {
  assert.equal(JSON.parse(read('app.json')).start_url, '/app',
    'a new Apple install must enter the onboarding gate before displaying the desk')
  const swift = read('modules/apple/DitKey.swift')
  assert.match(swift, /let data = DitLegacyStore\.sessionDirectory\(hostData: clock\.data, privateSupport: support, bundleID: bundleID, agent: clock\.agent\)/)
  assert.match(swift, /var sessionData = data\s+var sessionLegacy = legacyDirectory/)
  assert.match(swift, /sessionData = fixture\.directory\s+sessionLegacy = nil/)
  assert.match(swift, /DitAppleSession\(directory: sessionData, legacyDirectory: sessionLegacy/)
  assert.match(swift, /session\?\.bootstrap\(\)/)
  assert.match(swift, /session\?\.input\("sequence", output\)/)
})
