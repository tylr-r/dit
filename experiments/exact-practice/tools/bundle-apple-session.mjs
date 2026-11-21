import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = new URL('../', import.meta.url)
const asset = new URL('assets/dit-apple-session.js', root)
const {outputFiles} = await build({
  absWorkingDir: fileURLToPath(root),
  entryPoints: ['core/apple-session.mjs'],
  bundle: true, write: false, platform: 'neutral', format: 'iife', globalName: 'DitSession',
  target: 'safari16.4', legalComments: 'none',
  banner: {js:'// Generated from core/apple-session.mjs by tools/bundle-apple-session.mjs.'},
})
if (process.argv.includes('--check')) {
  assert.equal(await readFile(asset, 'utf8'), outputFiles[0].text, 'Apple session bundle is stale')
} else await writeFile(asset, outputFiles[0].text)

