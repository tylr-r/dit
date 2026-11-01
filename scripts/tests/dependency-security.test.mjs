import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

const require = createRequire(import.meta.url)

for (const [format, merge] of [['CommonJS', require('deepmerge')], ['UMD', require('deepmerge/dist/umd.js')]]) {
  test(`${format}: merging into a null-prototype object preserves a safe prototype`, () => {
    const target = Object.assign(Object.create(null), { keep: 1 })
    const result = merge(target, JSON.parse('{"__proto__":{"unexpected":true},"added":2}'))
    assert.equal(Object.getPrototypeOf(result), Object.prototype)
    assert.equal(result.unexpected, undefined)
    assert.deepEqual(result, { keep: 1, added: 2 })
  })

  test(`${format}: cloning into a null placeholder rejects prototype keys`, () => {
    const source = JSON.parse('{"nested":{"__proto__":{"unexpected":true},"keep":3}}')
    const result = merge({ nested: null }, source)
    assert.equal(Object.getPrototypeOf(result.nested), Object.prototype)
    assert.equal(result.nested.unexpected, undefined)
    assert.deepEqual(result.nested, { keep: 3 })
  })

  test(`${format}: copying the target does not copy its prototype key`, () => {
    const target = JSON.parse('{"__proto__":{"unexpected":true},"keep":4}')
    const result = merge(target, { added: 5 })
    assert.equal(Object.getPrototypeOf(result), Object.prototype)
    assert.equal(result.unexpected, undefined)
    assert.deepEqual(result, { keep: 4, added: 5 })
  })

  test(`${format}: cloned array elements retain their ordinary prototype`, () => {
    const source = JSON.parse('{"items":[{"__proto__":{"unexpected":true},"keep":6}]}')
    const result = merge({ items: [] }, source)
    assert.equal(Object.getPrototypeOf(result.items[0]), Object.prototype)
    assert.equal(result.items[0].unexpected, undefined)
    assert.deepEqual(result.items, [{ keep: 6 }])
  })

  test(`${format}: custom merge and array merge options still work`, () => {
    const result = merge({ label: 'left', items: [1], nested: { first: true } },
      { label: 'right', items: [2], nested: { second: true } }, {
        customMerge: (key) => key === 'nested' ? (a, b) => ({ ...a, ...b, custom: true }) : undefined,
        arrayMerge: (_target, source) => source,
      })
    assert.deepEqual(result, { label: 'right', items: [2], nested: { first: true, second: true, custom: true } })
  })

  test(`${format}: clone false preserves explicitly requested references`, () => {
    const source = { items: [{ keep: 7 }] }
    const result = merge({ items: [] }, source, { clone: false })
    assert.equal(result.items[0], source.items[0])
  })
}

// Exercise both API generations used by Expo and Jest after the bounded overrides.
test('modern and legacy glob consumers keep matching files correctly', { timeout: 5000 }, async (t) => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'dit-security-glob-'))
  t.after(() => rm(fixture, { recursive: true, force: true }))
  await mkdir(path.join(fixture, 'nested'))
  await Promise.all(['main.ts', 'nested/entry.ts', 'nested/skip.txt'].map((name) =>
    writeFile(path.join(fixture, name), 'fixture')))

  const expoRequire = createRequire(require.resolve('@expo/cli/package.json'))
  const modernGlob = expoRequire('glob')
  assert.deepEqual(modernGlob.globSync('**/*.ts', { cwd: fixture }).sort(), ['main.ts', 'nested/entry.ts'])

  const jestRequire = createRequire(require.resolve('jest-runtime/package.json'))
  const legacyGlob = jestRequire('glob')
  assert.deepEqual(legacyGlob.sync('**/*.ts', { cwd: fixture }).sort(), ['main.ts', 'nested/entry.ts'])
  const matches = await new Promise((resolve, reject) => legacyGlob('**/*.ts', { cwd: fixture },
    (error, files) => error ? reject(error) : resolve(files)))
  assert.deepEqual(matches.sort(), ['main.ts', 'nested/entry.ts'])
})

test('upstream Xcode project identifiers retain the required format', { timeout: 5000 }, async (t) => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'dit-security-xcode-'))
  t.after(() => rm(fixture, { recursive: true, force: true }))
  const projectFile = path.join(fixture, 'project.pbxproj')
  await writeFile(projectFile, '// !$*UTF8*$!\n{ archiveVersion = 1; classes = {}; objectVersion = 54; objects = {}; rootObject = 000000000000000000000000; }\n')
  const project = require('xcode').project(projectFile).parseSync()
  const first = project.generateUuid()
  const second = project.generateUuid()
  assert.match(first, /^[A-F0-9]{24}$/)
  assert.match(second, /^[A-F0-9]{24}$/)
  assert.notEqual(first, second)
})
