import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { STORE_KEY } from '../modules/web/practice-store.mjs'
import { INTER_CHAR_GAP_MS, WORD_GAP_EXTRA_MS } from '../modules/web/recognition.generated.mjs'

const bundle = readFileSync(new URL('../assets/dit-apple-session.js', import.meta.url), 'utf8')
const dit = runInNewContext(bundle + '\nDitSession')

function open(t) {
  const fields = new Map()
  const timers = new Map()
  const files = new Map([
    [STORE_KEY, JSON.stringify({ version: 1, settings: { words: true } })],
    ['dit.exact-spike.onboarding.v1', JSON.stringify({ version: 1, status: 'skipped', step: 'welcome' })],
  ])
  let now = 0
  const app = dit.create({
    read: key => files.has(key) ? ['ok', files.get(key)] : ['missing'],
    write(key, value) { files.set(key, value); return true },
    project(message) {
      const i = message.indexOf(':')
      fields.set(message.slice(0, i), message.slice(i + 1))
    },
    monotonicMs: () => now,
    schedule: (id, ms) => timers.set(id, now + ms),
    cancelTimer: id => timers.delete(id),
    cancelInput() {}, stop() {}, warm() {}, syncReminder() {}, outputVolume: () => 1,
  })
  t.after(() => app.dispose())
  const props = { mode: 'boot', blocked: 'false', 'clear-token': '0' }
  app.setProps(props)
  app.bootstrap()
  app.setProps({ ...props, mode: 'freestyle' })
  function advance(ms) {
    const end = now + ms
    while (true) {
      const next = [...timers].sort((a, b) => a[1] - b[1])[0]
      if (!next || next[1] > end) break
      now = next[1]
      timers.delete(next[0])
      app.timer(next[0])
    }
    now = end
  }
  function enter(code) {
    for (const symbol of code) {
      app.input('down', '')
      app.input('symbol', symbol)
    }
    advance(INTER_CHAR_GAP_MS)
    app.input('sequence', code)
  }
  return { app, fields, timers, advance, enter, clear: () => app.setProps({ ...props, mode: 'freestyle', 'clear-token': '1' }) }
}

test('a key held across the Freestyle word deadline starts a new word on release', t => {
  const f = open(t)
  f.enter('.')
  f.advance(WORD_GAP_EXTRA_MS - 100)
  f.app.input('down', '')
  f.advance(99)
  assert.equal(f.fields.get('transcript'), 'E')
  f.advance(1)
  assert.equal(f.fields.get('transcript'), 'E ')
  f.advance(200)
  f.app.input('symbol', '-')
  f.advance(INTER_CHAR_GAP_MS)
  f.app.input('sequence', '-')
  assert.equal(f.fields.get('transcript'), 'E T')
})

test('a released symbol still awaiting decode prevents the intervening word space', t => {
  const f = open(t)
  f.enter('.')
  f.advance(WORD_GAP_EXTRA_MS - 200)
  f.app.input('down', '')
  f.advance(50)
  f.app.input('symbol', '.')
  f.advance(150)
  assert.equal(f.fields.get('transcript'), 'E')
  f.advance(INTER_CHAR_GAP_MS - 150)
  f.app.input('sequence', '.')
  assert.equal(f.fields.get('transcript'), 'EE')
  f.advance(WORD_GAP_EXTRA_MS)
  assert.equal(f.fields.get('transcript'), 'EE ')
})

test('an unmatched sequence leaves the last valid letter’s word deadline intact', t => {
  const f = open(t)
  f.enter('.')
  f.enter('......')
  assert.equal(f.fields.get('feedback'), 'No match')
  assert.equal(f.fields.get('transcript'), 'E')
  f.advance(WORD_GAP_EXTRA_MS - INTER_CHAR_GAP_MS)
  assert.equal(f.fields.get('transcript'), 'E ')
})

test('Freestyle retains the beginning of a long local transcript and Clear cancels its pending space', t => {
  const f = open(t)
  f.enter('-')
  for (let i = 0; i < 1001; i++) f.enter('.')
  assert.equal(f.fields.get('transcript'), 'T' + 'E'.repeat(1001))
  const pending = [...f.timers.keys()]
  f.clear()
  for (const id of pending) f.app.timer(id)
  assert.equal(f.fields.get('transcript'), '')
  assert.equal(f.fields.get('feedback'), '')
  f.enter('-')
  assert.equal(f.fields.get('transcript'), 'T')
})

test('Clear removes a partial Freestyle letter and ignores the former word deadline after fresh input', t => {
  const f = open(t)
  f.enter('.')
  const old = [...f.timers.keys()]
  f.app.input('down', '')
  f.app.input('symbol', '-')
  assert.equal(f.fields.get('freestyleInput'), '-')
  f.clear()
  assert.equal(f.fields.get('freestyleInput'), '')
  f.enter('.')
  for (const id of old) f.app.timer(id)
  assert.equal(f.fields.get('transcript'), 'E')
})

test('the pending input keeps its full sequence until an unmatched letter is submitted', t => {
  const f = open(t)
  const sequence = '-' + '.'.repeat(64)
  for (const symbol of sequence) f.app.input('symbol', symbol)
  assert.equal(f.fields.get('freestyleInput'), sequence)
  f.advance(INTER_CHAR_GAP_MS)
  f.app.input('sequence', sequence)
  assert.equal(f.fields.get('feedback'), 'No match')
  assert.equal(f.fields.get('freestyleInput'), '')
  assert.equal(f.fields.get('transcript'), '')
})
