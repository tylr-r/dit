import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { setProps as setWebProps } from '../modules/web/index.js'
import { STORE_KEY } from '../modules/web/practice-store.mjs'
import { createSession } from '../modules/web/session.mjs'

const data = {
  settings: { practiceWords: true, autoPlay: false, selection: { kind: 'custom', letters: ['A', 'E', 'T'] } },
  scores: {}, history: [],
}
const asset = readFileSync(new URL('../assets/dit-apple-session.js', import.meta.url), 'utf8')
const dit = runInNewContext('Math.random = () => 0;\n' + asset + '\nDitSession')

function openApple(files) {
  let at = 0
  const fields = new Map(), plays = []
  const app = dit.create({
    read: key => files.has(key) ? ['ok', files.get(key)] : ['missing'],
    write(key, value) { files.set(key, value); return true },
    monotonicMs: () => at,
    project(message) {
      const at = message.indexOf(':')
      fields.set(message.slice(0, at), message.slice(at + 1))
    },
    play(plan) { plays.push(Array.from(plan, ([a, b]) => b - a)); return true },
    outputVolume: () => 1, cancelInput() {}, stop() {}, schedule() {}, cancelTimer() {}, syncReminder() {}, warm() {},
  })
  let props = { mode: 'boot', blocked: 'false', 'warm-token': '0' }
  function set(patch) { props = { ...props, ...patch }; app.setProps(props) }
  app.setProps(props)
  app.bootstrap()
  set({ mode: 'practice' })
  function symbol(code, time) { at = time; app.input('symbol', code) }
  function commit(code, time) { at = time; app.input('sequence', code) }
  return { app, fields, plays, set, symbol, commit }
}

function learner(bestWpm) {
  return new Map([
    [STORE_KEY, JSON.stringify({ version: 1, ...data, bestWpm })],
    ['dit.exact-spike.onboarding.v1', JSON.stringify({ version: 1, status: 'completed', step: 'welcome', profile: 'known' })],
  ])
}

for (const best of [6, 19.7]) {
  test('Apple Play on initial and middle letters preserves word timing and best ' + best, t => {
    const files = learner(best)
    const f = openApple(files)
    t.after(() => f.app.dispose())
    assert.equal(f.fields.get('practiceWord'), 'EAT')
    f.symbol('.', 1000)
    f.set({ 'warm-token': '1' })
    f.symbol('.', 1200)
    f.commit('.', 1700)
    f.set({ 'warm-token': '2' })
    assert.equal(f.fields.get('target'), 'A')
    assert.equal(JSON.parse(files.get(STORE_KEY)).history.length, 1)
    assert.deepEqual(f.plays, [[100], [100, 300]])
    f.symbol('.', 1900)
    f.symbol('-', 2200)
    f.commit('.-', 2500)
    f.symbol('-', 3700)
    f.commit('-', 4000)
    assert.equal(f.fields.get('practiceWpm'), '12', 'three characters in 3000 ms')
    const saved = JSON.parse(files.get(STORE_KEY))
    assert.equal(saved.bestWpm, Math.max(best, 12))
    assert.equal(saved.history.length, 3)
    const restored = openApple(files)
    t.after(() => restored.app.dispose())
    assert.equal(restored.fields.get('bestWpm'), Math.max(best, 12).toFixed(1))
    assert.equal(restored.fields.get('practiceWpm'), '')
    assert.equal(restored.fields.get('practice-prefix'), '')
  })
}

test('an interruption discards unfinished timing and a fresh word earns WPM independently', t => {
  const files = learner(6)
  const f = openApple(files)
  t.after(() => f.app.dispose())
  assert.equal(f.fields.get('practiceWord'), 'EAT')
  f.symbol('.', 1000)
  f.commit('.', 1700)
  f.app.interrupt(true)
  f.app.interrupt(false)
  f.symbol('.', 1900)
  f.symbol('-', 2200)
  f.commit('.-', 2500)
  f.symbol('-', 3700)
  f.commit('-', 4000)
  assert.equal(f.fields.get('practiceWpm'), '')
  assert.equal(JSON.parse(files.get(STORE_KEY)).bestWpm, 6)
  assert.equal(f.fields.get('practiceWord'), 'TEA')
  f.symbol('-', 10000)
  f.commit('-', 10400)
  f.symbol('.', 10700)
  f.commit('.', 11000)
  f.symbol('.', 11300)
  f.symbol('-', 11700)
  f.commit('.-', 12000)
  assert.equal(f.fields.get('practiceWpm'), '18')
  assert.equal(JSON.parse(files.get(STORE_KEY)).bestWpm, 18)
})

test('web Play cancels pending keying but keeps the same timed word', () => {
  let at = 1000, cancels = 0
  const tones = []
  const session = createSession({ data, random: () => 0, monotonicNow: () => at,
    setTimer() {}, clearTimer() {}, project() {}, onLock() {} })
  const h = { session, mode: 'practice', attempt: { configure() {}, cancel() { cancels++ } },
    audio: { stop() {}, replay(plan) { tones.push(plan) } }, guide: { isListening: () => false } }
  const set = token => setWebProps(h, JSON.stringify({ mode: 'practice', 'warm-token': token }))
  set('0')
  session.dispatch({ type: 'symbol', symbol: '-' })
  at = 1700
  session.dispatch({ type: 'sequence', code: '-' })
  set('1')
  assert.equal(cancels, 1)
  assert.deepEqual(tones, [[[0, 100]]])
  at = 2300
  session.dispatch({ type: 'sequence', code: '.' })
  at = 4000
  session.dispatch({ type: 'sequence', code: '.-' })
  assert.equal(session.current().practiceWpm, 12)
  assert.equal(session.current().bestWpm, 12)
  session.dispose()
})

test('restarting mid-word drops its prefix and clock, retaining scored letters and best WPM', t => {
  const files = learner(15)
  const first = openApple(files)
  first.symbol('.', 1000)
  first.commit('.', 1400)
  first.set({ 'warm-token': '1' })
  assert.equal(first.fields.get('practice-prefix'), 'E')
  first.app.dispose()
  const fresh = openApple(files)
  t.after(() => fresh.app.dispose())
  assert.equal(fresh.fields.get('practice-prefix'), '')
  assert.equal(fresh.fields.get('practiceWpm'), '')
  assert.equal(fresh.fields.get('bestWpm'), '15.0')
  assert.equal(JSON.parse(files.get(STORE_KEY)).history.length, 1)
  fresh.symbol('.', 100000)
  fresh.commit('.', 100400)
  fresh.symbol('.', 100500)
  fresh.symbol('-', 100900)
  fresh.commit('.-', 101100)
  fresh.symbol('-', 101700)
  fresh.commit('-', 102000)
  assert.equal(fresh.fields.get('practiceWpm'), '18')
  assert.equal(JSON.parse(files.get(STORE_KEY)).bestWpm, 18)
})
