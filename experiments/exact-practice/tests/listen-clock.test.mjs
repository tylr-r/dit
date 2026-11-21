import assert from 'node:assert/strict'
import test from 'node:test'
import { create } from '../core/apple-session.mjs'
import { createListen } from '../modules/web/listen.mjs'
import { tempoTiming } from '../modules/web/tempo.mjs'

test('an answer after the active set changes cannot record a time for the retired target', () => {
  let pool = ['E']
  const recorded = []
  const listen = createListen({
    getPool: () => pool, pick: () => pool[0],
    play: (_, scheduled) => scheduled(400, () => 1600), stop() {}, project() {},
    setTimer() {}, clearTimer() {}, record: (...values) => recorded.push(values),
  })
  listen.enter()
  pool = ['T']
  assert.equal(listen.answer('T'), false)
  assert.deepEqual(recorded, [])
  listen.replay()
  assert.equal(listen.answer('T'), true)
  assert.deepEqual(recorded, [['T',true,1200]])
})

test('Apple Listen measures the replayed prompt only and drops unavailable presentation times', () => {
  const files = new Map()
  const messages = []
  const requests = []
  const tails = new Map()
  const app = create({
    read: k => files.has(k) ? ['ok', files.get(k)] : ['missing'],
    write(k,v) { files.set(k,v); return true },
    project: e => messages.push(e), schedule() {}, cancelTimer() {}, stop() {}, cancelInput() {},
    play(plan, pitch, id) { requests.push({plan, id}); return true },
    promptTailMs: id => tails.get(id) ?? -1, warm() {}, outputVolume: () => 1,
    syncReminder() {}, cancelReminderRequest() {},
  })
  const props = {mode:'boot',blocked:'false','pref-token':'0','answer-token':'0','warm-token':'0','listen-content':'characters'}
  const set = patch => { Object.assign(props,patch); app.setProps({...props}) }
  const saved = () => JSON.parse(files.get('dit.exact-spike.practice.v1')).listenTtr
  set({})
  app.bootstrap()
  set({mode:'nux'})
  set({'nux-command':'skip','nux-token':'1'})
  set({mode:'practice','pref-command':'scope-custom:E','pref-token':'1'})
  set({mode:'listen'})
  const currentPrompt = () => messages.filter(e => e.startsWith('listen-prompt:')).at(-1).slice(14)
  const firstPrompt = currentPrompt()
  const first = requests.at(-1).id
  const {characterGapMs} = tempoTiming(12,8)
  tails.set(first, characterGapMs + 975)
  set({'warm-token':'1', 'answer-token':'1', 'answer-value':'E', 'answer-prompt':firstPrompt})
  assert.deepEqual(saved(), {})
  set({'answer-token':'2'})
  assert.deepEqual(saved(), {})
  const replay = requests.at(-1).id
  assert.ok(first > 0 && replay > first, 'each Listen playback needs its own presentation identity')
  tails.set(replay, characterGapMs + 425)
  set({'answer-token':'3','answer-prompt':currentPrompt()})
  assert.deepEqual(saved(), {E:{averageMs:425,samples:1}})
  assert.ok(messages.includes('listen-recognition:0.4s'))
  app.interrupt(true)
  app.interrupt(false)
  set({'warm-token':'2'})
  set({'answer-token':'4','answer-prompt':currentPrompt()})
  assert.deepEqual(saved(), {E:{averageMs:425,samples:1}})
  assert.equal(messages.filter(m=>m.startsWith('listen-recognition:')).at(-1), 'listen-recognition:')
  app.dispose()
})
