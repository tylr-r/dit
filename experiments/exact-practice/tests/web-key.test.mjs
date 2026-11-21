import test from 'node:test'
import assert from 'node:assert/strict'
import { createKeyController, createSidetone } from '../modules/web/key-controller.mjs'
function fixture(onMessage = () => {}) {
  let time = 0
  let next = 0
  const timers = new Map()
  const effects = []
  const controller = createKeyController({
    now: () => time,
    setTimer: (fn, delay) => { timers.set(++next, { fn, at: time + delay }); return next },
    clearTimer: id => timers.delete(id),
    audio: { start: frequency => effects.push(frequency), stop: () => effects.push('stop') },
    message: value => { effects.push(value); onMessage(value, controller) },
  })
  const advance = to => {
    for (;;) {
      const entry = [...timers.entries()].sort((a,b) => a[1].at - b[1].at)[0]
      if (!entry || entry[1].at > to) break
      const [id, { fn, at }] = entry
      timers.delete(id)
      time = at
      fn()
    }
    time = to
  }
  return { controller, advance, effects }
}
test('holds then releases a timed paddle and commits after the sequence gap', () => {
  const { controller, advance, effects } = fixture()
  assert.equal(controller.paddleDown('-'), true)
  advance(30)
  controller.paddleUp('-')
  advance(500)
  assert.deepEqual(effects, [600, 'active:on', 'stop', 'active:off', 'symbol:-', 'sequence:-'])
})
test('straight-key touch and Space can assemble one attempt', () => {
  const { controller, advance, effects } = fixture()
  controller.straightDown('pointer:1')
  advance(80)
  assert.equal(controller.straightUp('space'), false)
  controller.straightUp('pointer:1')
  advance(150)
  controller.straightDown('space')
  advance(350)
  controller.straightUp('space')
  advance(550)
  assert.deepEqual(effects.filter(v => typeof v === 'string' && v.startsWith('sequence:')), ['sequence:.-'])
})
test('synchronous cancellation on a symbol invalidates both repeat and commit', () => {
  const { controller, advance, effects } = fixture((v, c) => { if (v === 'symbol:.') c.cancel() })
  controller.paddleDown('.')
  advance(1000)
  assert.deepEqual(effects, [600, 'active:on', 'stop', 'active:off', 'symbol:.'])
})
test('blocking clears held tone and partial input; unblocking can start fresh', () => {
  const { controller, advance, effects } = fixture()
  controller.paddleDown('.')
  advance(10)
  controller.configure({ blocked: true })
  assert.equal(controller.paddleDown('-'), false)
  advance(1000)
  controller.configure({ blocked: false, frequency: 700 })
  controller.paddleDown('.')
  advance(1030)
  controller.paddleUp('.')
  advance(1400)
  assert.deepEqual(effects, [600, 'active:on', 'stop', 'active:off', 700, 'active:on', 'stop', 'active:off', 'symbol:.', 'sequence:.'])
})

test('late audio-context resume cannot restore a canceled note', async () => {
  const levels = []
  let releaseResume
  const ready = new Promise(resolve => { releaseResume = resolve })
  let context
  class FakeAudioContext {
    constructor() { context = this }
    state = 'suspended'
    currentTime = 1
    createGain() {
      return {
        connect() {},
        gain: {
          value: 0,
          cancelScheduledValues() {},
          setTargetAtTime: value => levels.push(value),
        },
      }
    }
    createOscillator() {
      return { start() {}, connect() {}, frequency: { setValueAtTime() {} } }
    }
    resume() { return ready }
    close() { return Promise.resolve() }
  }
  const audio = createSidetone({ AudioContext: FakeAudioContext })
  audio.start(600, 0.75)
  audio.stop()
  context.state = 'running'
  releaseResume()
  await ready
  assert.deepEqual(levels, [0])
  audio.start(700, 0.5)
  audio.stop()
  assert.deepEqual(levels, [0, 0.5, 0])
  audio.close()
})

test('target replay schedules complete tone pulses on audio time, then key-down supersedes replay', () => {
  const events = []
  class FakeAudioContext {
    state = 'running'
    currentTime = 3
    createGain() {
      return {
        connect() {},
        gain: {
          value: 0,
          cancelScheduledValues: t => events.push(['cancel',t]),
          setTargetAtTime: (value,t) => events.push([value,t]),
        },
      }
    }
    createOscillator() {
      return {
        start() {}, connect() {},
        frequency: { setValueAtTime: (value,t) => events.push(['pitch',value,t]) },
      }
    }
    close() { return Promise.resolve() }
  }
  const audio = createSidetone({ AudioContext: FakeAudioContext })
  audio.replay([[0,300],[400,500]], 620, 0.75)
  assert.deepEqual(events, [['pitch',620,3],['cancel',3],[0.75,3],[0,3.3],[0.75,3.4],[0,3.5]])
  audio.start(640, 0.5)
  assert.deepEqual(events.slice(-3), [['pitch',640,3],['cancel',3],[0.5,3]])
  audio.close()
})

test('browser paddle aliases match Dit Control and brackets including key fallback', async () => {
  const { getPaddleKey } = await import('../modules/web/index.js')
  for (const [code, key, symbol] of [
    ['ControlLeft','Control','.'], ['ControlRight','Control','-'],
    ['BracketLeft','[','.'], ['BracketRight',']','-'],
    ['Unidentified','[','.'], ['Unidentified',']','-'],
  ]) assert.equal(getPaddleKey({code,key}).symbol, symbol)
  assert.equal(getPaddleKey({code:'Space',key:' '}), null)
})

test('finite phrase reveal waits for audio onended and cancel suppresses delayed resume/ended', async () => {
  const sources = []
  const waiters = []
  let ctx
  class FakeAudioContext {
    state = 'suspended'
    currentTime = 4
    constructor() { ctx = this }
    createGain() {
      return {
        connect(){},disconnect(){},
        gain:{value:0,setValueAtTime(){},linearRampToValueAtTime(){}},
      }
    }
    createOscillator() {
      const node={
        frequency:{value:0},connect(){},disconnect(){},
        start(t){ node.started=t },stop(t){node.ends=t},
      }
      sources.push(node)
      return node
    }
    resume(){ return new Promise(resolve=>waiters.push(resolve)) }
    close(){ return Promise.resolve() }
  }
  const audio=createSidetone({AudioContext:FakeAudioContext})
  let complete=0
  const args=[[[0,100],[400,700]],600,0.75,()=>complete++]
  audio.playFinite(...args)
  assert.equal(sources.length,1) // warmed continuous key source only
  audio.stop()
  ctx.state='running'
  waiters.splice(0).forEach(resolve=>resolve())
  await Promise.resolve()
  assert.equal(sources.length,1)
  assert.equal(complete,0)
  audio.playFinite(...args)
  const first=sources[1]
  assert.equal(first.started,4.025)
  assert.ok(Math.abs(first.ends-4.775)<0.0001)
  assert.equal(complete,0)
  const queued=first.onended
  audio.stop()
  queued()
  assert.equal(complete,0)
  audio.playFinite(...args)
  sources[2].onended()
  assert.equal(complete,1)
  audio.close()
})

test('running-context phrase graph construction failures report a retryable audio error', () => {
  for (const failing of ['oscillator','gain']) {
    let oscCalls = 0, gainCalls = 0, failed = 0
    class FakeAudioContext {
      state = 'running'
      currentTime = 1
      createOscillator() {
        if (++oscCalls === 2 && failing === 'oscillator') throw Error('oscillator unavailable')
        return {frequency:{value:0},connect(){},disconnect(){},start(){},stop(){}}
      }
      createGain() {
        if (++gainCalls === 2 && failing === 'gain') throw Error('gain unavailable')
        return { gain:{value:0},connect(){},disconnect(){} }
      }
      close(){return Promise.resolve()}
    }
    const audio = createSidetone({AudioContext:FakeAudioContext})
    assert.doesNotThrow(() => audio.playFinite([[0,100]],600,.75,()=>assert.fail('should not complete'),()=>failed++))
    assert.equal(failed,1)
    audio.close()
  }
})

test('replay timing is anchored to actual schedule and permanently invalidated by cancellation or interruption', () => {
  let ctx, changed
  class FakeAudioContext {
    constructor(){ctx=this;this.state='running';this.currentTime=5}
    addEventListener(name,fn){assert.equal(name,'statechange');changed=fn}
    createGain(){return {connect(){},gain:{cancelScheduledValues(){},setTargetAtTime(){}}}}
    createOscillator(){return {start(){},connect(){},frequency:{setValueAtTime(){}}}}
  }
  const audio=createSidetone({AudioContext:FakeAudioContext})
  let reader
  const replay=()=>audio.replay([[0,100]],600,.5,(duration,read)=>{assert.equal(duration,100);reader=read})
  replay()
  assert.equal(reader(),0)
  ctx.currentTime=5.25
  assert.equal(reader(),250)
  ctx.state='suspended'; changed()
  assert.equal(reader(),null)
  ctx.state='running'; changed()
  assert.equal(reader(),null)
  replay()
  assert.equal(reader(),0)
  audio.stop()
  assert.equal(reader(),null)
})
