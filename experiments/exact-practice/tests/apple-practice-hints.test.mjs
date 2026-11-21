import assert from 'node:assert/strict'
import test from 'node:test'
import {beginGuide} from '../modules/web/guided.mjs'
import { create } from '../core/apple-session.mjs'

const hintKey = 'dit.exact-spike.intro-hint.v1'
function launch(files, status = 'skipped') {
  files.set('dit.exact-spike.onboarding.v1', JSON.stringify({ version: 1, status, step: 'welcome' }))
  const events = [], plays = []
  const app = create({
    read: k => files.has(k) ? ['ok', files.get(k)] : ['missing'],
    write(k, value) { files.set(k, value); return true },
    project: value => events.push(value), play: plan => { plays.push(plan); return true },
    schedule() {}, cancelTimer() {}, cancelInput() {}, stop() {}, warm() {}, outputVolume: () => 1, syncReminder() {},
  })
  let props = {mode:'boot', blocked:'false', 'settings-open':'false', 'warm-token':'0'}
  function set(patch) { props = {...props,...patch}; app.setProps(props) }
  set({})
  app.bootstrap()
  set({mode:'practice'})
  const hint = () => events.filter(e => e.startsWith('intro-hint:')).at(-1)
  return {app, plays, set, hint}
}

test('Practice Play keeps the first-key instruction and the first accepted down advances it once', () => {
  const files = new Map()
  const f = launch(files)
  assert.equal(f.hint(), 'intro-hint:morse')
  const count = f.plays.length
  f.set({'warm-token':'1'})
  assert.equal(f.plays.length, count + 1)
  assert.equal(f.hint(), 'intro-hint:morse')
  f.set({blocked:'true'})
  f.app.input('down','')
  assert.equal(files.has(hintKey), false)
  f.set({blocked:'false'})
  f.app.input('down','')
  assert.equal(files.get(hintKey), 'settings')
  f.app.input('down','')
  assert.equal(f.hint(), 'intro-hint:settings')
  f.app.dispose()
  const restored = launch(files)
  assert.equal(restored.hint(), 'intro-hint:settings')
  restored.set({'settings-open':'true', blocked:'true'})
  assert.equal(files.get(hintKey), 'done')
  restored.app.dispose()
})

test('completed onboarding and future stored instructions do not reintroduce a first-key hint', () => {
  const f = launch(new Map(), 'completed')
  assert.equal(f.hint(), 'intro-hint:done')
  f.app.dispose()
  const files = new Map([[hintKey,'future']])
  const newer = launch(files)
  assert.equal(newer.hint(), 'intro-hint:done')
  newer.app.input('down','')
  assert.equal(files.get(hintKey),'future')
  newer.app.dispose()
})

test('restored mixed Practice keeps the first-key instruction through Play and consumes it on accepted down', () => {
  const data = {...beginGuide(2), phase:'practice', maxPackReached:4}
  const files = new Map([
    ['dit.exact-spike.guided.v1', JSON.stringify({version:1,data})],
    ['dit.exact-spike.method.v1', 'guided'],
    [hintKey, 'morse'],
  ])
  const f = launch(files)
  f.set({mode:'guided'})
  assert.equal(f.app.configuration().enabled,true)
  f.set({'warm-token':'1'})
  assert.equal(f.hint(),'intro-hint:morse')
  f.set({blocked:'true'})
  f.app.input('down','')
  assert.equal(files.get(hintKey),'morse')
  f.set({blocked:'false'})
  f.app.input('down','')
  assert.equal(files.get(hintKey),'settings')
  f.set({'settings-open':'true',blocked:'true'})
  assert.equal(files.get(hintKey),'done')
  f.app.dispose()
})
