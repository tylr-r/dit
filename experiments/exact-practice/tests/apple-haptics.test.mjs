import test from 'node:test'
import assert from 'node:assert/strict'
import { create } from '../core/apple-session.mjs'

const key = 'dit.exact-spike.haptics.v1'

function fixture(files, overrides = {}) {
  const events = []
  const app = create({
    read: k => files.has(k) ? ['ok', files.get(k)] : ['missing'],
    write(k, v) { files.set(k, v); return true },
    project: e => events.push(e), schedule() {}, cancelTimer() {}, stop() {}, cancelInput() {},
    play: () => true, warm() {}, outputVolume: () => 1, syncReminder() {}, cancelReminderRequest() {},
    ...overrides,
  })
  const props = { mode: 'boot', blocked: 'false', 'pref-token': '0', 'settings-open': 'false', 'nux-token': '0' }
  const set = patch => { Object.assign(props, patch); app.setProps({...props}) }
  const settings = () => set({mode: 'practice', blocked: 'true', 'settings-open': 'true'})
  const toggle = enabled => set({'pref-token': String(Number(props['pref-token']) + 1),
    'pref-command': enabled ? 'haptics-on' : 'haptics-off'})
  set({})
  app.bootstrap()
  return { app, events, settings, toggle }
}

test('Apple key has the shipped default-on haptic preference and restores off before first input', () => {
  const files = new Map()
  const {app, events, settings, toggle} = fixture(files)
  assert.equal(app.configuration().hapticsEnabled, true)
  assert.ok(events.includes('haptics-enabled:1'))
  toggle(false)
  assert.equal(app.configuration().hapticsEnabled, true)
  assert.equal(files.has(key), false)
  settings()
  toggle(false)
  assert.equal(app.configuration().hapticsEnabled, false)
  app.dispose()
  const relaunched = fixture(files)
  assert.equal(relaunched.app.configuration().hapticsEnabled, false)
  assert.ok(relaunched.events.includes('haptics-enabled:0'))
  relaunched.app.dispose()
})

test('future and unreadable haptics settings protect original bytes and permit explicit in-session changes', () => {
  for (const unreadable of [false, true]) {
    const files = new Map([[key, 'future-format']])
    const host = unreadable ? {read:k => k === key ? ['error'] : ['missing']} : {}
    const {app, events, settings, toggle} = fixture(files, host)
    assert.equal(app.configuration().hapticsEnabled, false)
    settings()
    toggle(true)
    assert.equal(app.configuration().hapticsEnabled, true)
    assert.ok(events.includes('haptics-saved:0'))
    assert.equal(files.get(key), 'future-format')
    app.dispose()
  }
})

test('failed write keeps haptics disabled for this session and reports the storage failure', () => {
  const files = new Map([[key, 'true']])
  const {app, events, settings, toggle} = fixture(files, {write: () => false})
  settings()
  toggle(false)
  assert.equal(app.configuration().hapticsEnabled, false)
  assert.equal(files.get(key), 'true')
  assert.equal(events.filter(e => e.startsWith('haptics-saved:')).at(-1), 'haptics-saved:0')
  app.dispose()
})
