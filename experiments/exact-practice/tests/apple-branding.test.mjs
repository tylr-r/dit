import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'

const local = new URL('../',import.meta.url)
const original = new URL('../../../apps/ios/',import.meta.url)
const json = file => JSON.parse(readFileSync(file,'utf8'))

test('the isolated Apple app uses the shipped name and Icon Composer layers', () => {
  const expected = json(new URL('app.json',original)).expo
  const actual = json(new URL('app.json',local))
  assert.equal(actual.app.name,expected.name)
  assert.equal(actual.app.id,'com.tylerobinson.dit.exactspike')
  const icon = new URL(actual.host.ios.icon+'/',local)
  const source = new URL(expected.ios.icon+'/',original)
  const document = json(new URL('icon.json',source))
  assert.deepEqual(json(new URL('icon.json',icon)),document)
  const images = document.groups.flatMap(group=>group.layers.map(layer=>layer['image-name']).filter(Boolean))
  assert.ok(images.length)
  for (const image of images) assert.deepEqual(readFileSync(new URL('Assets/'+image,icon)),readFileSync(new URL('Assets/'+image,source)))
})
test('Apple exposes the shipped key instruction as the primary accessibility label', () => {
  const pinned = readFileSync(new URL('../../packages/core/src/components/morseButton/labels.ts',local),'utf8')
  const instruction = pinned.match(/MORSE_BUTTON_A11Y_LABEL = '([^']+)'/)[1]
  const view = readFileSync(new URL('modules/apple/DitKey.swift',local),'utf8')
  assert.equal(view.match(/input\.accessibilityLabel = "([^"]+)"/)[1],instruction)
  assert.ok(view.includes('input.accessibilityIdentifier = "dit-native-morse-key"'))
})
