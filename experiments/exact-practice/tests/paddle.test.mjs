import assert from 'node:assert/strict'
import test from 'node:test'
import { createPaddleState, stepPaddle } from '../core/paddle.mts'

const setup = () => {
  let state = createPaddleState()
  let pending
  return (event, settings = { unitMs: 100, canStart: true }) => {
    const result = stepPaddle(state, event.type === 'tick' ? { ...event, type: 'timer', id: pending?.id } : event, settings)
    state = result.state
    for (const effect of result.effects) {
      if (effect.type === 'schedule') pending = effect
      if (effect.type === 'cancelTimer' && effect.id === pending?.id) pending = undefined
    }
    return result.effects
  }
}
const press = (symbol, atMs) => ({ type: 'press', symbol, atMs })
const release = (symbol, atMs) => ({ type: 'release', symbol, atMs })
const tick = atMs => ({ type: 'tick', atMs })
const schedule = (id, atMs) => ({ type: 'schedule', id, atMs })
const start = [{ type: 'toneStart' }]
const stop = symbol => [{ type: 'toneStop' }, { type: 'symbol', symbol }]

test('short release completes the timed dah, then does not repeat', () => {
  const dispatch = setup()
  assert.deepEqual(dispatch(press('-', 0)), [...start, schedule(1, 300)])
  assert.deepEqual(dispatch(release('-', 20)), [])
  assert.deepEqual(dispatch(tick(300)), stop('-'))
  assert.deepEqual(dispatch(tick(400)), [])
})

test('held dit repeats after one unit of silence and repeats with current speed', () => {
  const dispatch = setup()
  assert.deepEqual(dispatch(press('.', 0)), [...start, schedule(1, 100)])
  assert.deepEqual(dispatch(tick(100), { unitMs: 50, canStart: true }), [...stop('.'), schedule(2, 200)])
  assert.deepEqual(dispatch(tick(200), { unitMs: 50, canStart: true }), [...start, schedule(3, 250)])
})

test('switching during a tone completes it and chooses the latest held paddle', () => {
  const dispatch = setup()
  dispatch(press('.', 0))
  assert.deepEqual(dispatch(press('-', 20)), [])
  assert.deepEqual(dispatch(release('.', 30)), [])
  assert.deepEqual(dispatch(tick(100)), [...stop('.'), schedule(2, 200)])
  assert.deepEqual(dispatch(tick(200)), [...start, schedule(3, 500)])
})

test('fresh press during the inter-element gap interrupts the pending repeat', () => {
  const dispatch = setup()
  dispatch(press('.', 0))
  dispatch(tick(100))
  assert.deepEqual(dispatch(press('-', 120)), [{ type: 'cancelTimer', id: 2 }, ...start, schedule(3, 420)])
  assert.deepEqual(dispatch({ type: 'timer', id: 2, atMs: 200 }), [])
})

test('release during the gap disarms the repeat', () => {
  const dispatch = setup()
  dispatch(press('.', 0))
  dispatch(tick(100))
  assert.deepEqual(dispatch(release('.', 120)), [{ type: 'cancelTimer', id: 2 }])
  assert.deepEqual(dispatch({ type: 'timer', id: 2, atMs: 200 }), [])
})

test('cancel stops the active sidetone, drops its symbol, and rejects stale callbacks', () => {
  const dispatch = setup()
  dispatch(press('-', 0))
  assert.deepEqual(dispatch({ type: 'cancel', atMs: 30 }), [{ type: 'cancelTimer', id: 1 }, { type: 'toneStop' }])
  assert.deepEqual(dispatch(press('.', 40)), [...start, schedule(2, 140)])
  assert.deepEqual(dispatch({ type: 'timer', id: 1, atMs: 100 }), [])
  assert.deepEqual(dispatch(tick(140)), [...stop('.'), schedule(3, 240)])
})

test('permission gates starts, not a tone already started', () => {
  const dispatch = setup()
  const blocked = { unitMs: 100, canStart: false }
  assert.deepEqual(dispatch(press('.', 0), blocked), [])
  dispatch(press('.', 10))
  assert.deepEqual(dispatch(tick(110), blocked), [...stop('.'), schedule(2, 210)])
  assert.deepEqual(dispatch(tick(210), blocked), [])
})

test('early delivery cannot terminate a tone or consume its deadline', () => {
  const dispatch = setup()
  dispatch(press('-', 0))
  assert.deepEqual(dispatch(tick(299)), [schedule(1, 300)])
  assert.deepEqual(dispatch(tick(300)), [...stop('-'), schedule(2, 400)])
})

test('acceptance distinguishes an effectless switch and release from ignored input', () => {
  const settings = { unitMs: 100, canStart: true }
  const first = stepPaddle(createPaddleState(), press('.', 0), settings)
  assert.equal(first.accepted, true)
  const switched = stepPaddle(first.state, press('-', 20), settings)
  assert.equal(switched.accepted, true)
  assert.deepEqual(switched.effects, [])
  const releasedOld = stepPaddle(switched.state, release('.', 30), settings)
  assert.equal(releasedOld.accepted, true)
  assert.equal(releasedOld.state.held, '-')
  assert.equal(stepPaddle(releasedOld.state, press('.', 40), { ...settings, canStart: false }).accepted, false)
  const releasedHeld = stepPaddle(releasedOld.state, release('-', 50), settings)
  assert.equal(releasedHeld.accepted, true)
  assert.equal(stepPaddle(releasedHeld.state, release('-', 60), settings).accepted, false)
})

test('duplicate delivery of an already consumed timer emits nothing', () => {
  const dispatch = setup()
  dispatch(press('.', 0))
  dispatch(tick(100))
  assert.deepEqual(dispatch({ type: 'timer', id: 1, atMs: 101 }), [])
  assert.deepEqual(dispatch(tick(200)), [...start, schedule(3, 300)])
})

test('cancel in the gap does not stop a silent tone; cancel idle emits nothing', () => {
  const dispatch = setup()
  assert.deepEqual(dispatch({ type: 'cancel', atMs: 0 }), [])
  dispatch(press('.', 10))
  dispatch(tick(110))
  assert.deepEqual(dispatch({ type: 'cancel', atMs: 120 }), [{ type: 'cancelTimer', id: 2 }])
  assert.deepEqual(dispatch({ type: 'timer', id: 2, atMs: 210 }), [])
})

test('a fresh press after a refused repeat resumes; old callbacks do not', () => {
  const dispatch = setup()
  dispatch(press('.', 0))
  dispatch(tick(100))
  assert.deepEqual(dispatch(tick(200), { unitMs: 100, canStart: false }), [])
  assert.deepEqual(dispatch({ type: 'timer', id: 2, atMs: 210 }), [])
  assert.deepEqual(dispatch(press('-', 220)), [...start, schedule(3, 520)])
})
