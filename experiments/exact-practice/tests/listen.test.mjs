import assert from 'node:assert/strict'
import test from 'node:test'
import { createListen } from '../modules/web/listen.mjs'

function fixture(pick = target => target === undefined ? 'T' : target === 'T' ? 'E' : 'N') {
  let now = 0
  let id = 0
  const pending = new Map()
  const calls = []
  const listen = createListen({
    now: () => now,
    setTimer: (fn, delay) => { pending.set(++id, { fn, at:now + delay }); return id },
    clearTimer: index => pending.delete(index),
    play: (target, scheduled) => { calls.push('audio:' + target); (() => { const start=now; scheduled(300,()=>now-start) })() },
    stop: () => calls.push('stop'),
    project: message => calls.push(message),
    record: (letter, correct, sample) => calls.push([letter,correct,sample]),
    pick,
  })
  function advance(to) {
    for (;;) {
      const item = [...pending.entries()].sort((a,b) => a[1].at - b[1].at)[0]
      if (!item || item[1].at > to) break
      const [index, {fn,at}] = item
      pending.delete(index); now = at; fn()
    }
    now = to
  }
  return { listen, calls, advance }
}
test('auto-plays on entry, scores once, then hides before next automatic prompt', () => {
  const {listen,calls,advance} = fixture()
  listen.enter()
  assert.ok(calls.includes('audio:T'))
  advance(500)
  assert.equal(listen.answer('Z'), false)
  assert.equal(listen.answer('t'),true)
  assert.equal(listen.answer('T'),false)
  assert.equal(listen.replay(),false)
  assert.ok(calls.includes('listen-reveal:T'))
  assert.ok(calls.includes('listen-recognition:0.2s'))
  assert.deepEqual(calls.find(Array.isArray), ['T',true,200])
  advance(2149)
  assert.ok(!calls.includes('listen-phase:gap'))
  advance(2150)
  assert.ok(calls.includes('listen-phase:gap'))
  advance(2689)
  assert.ok(!calls.includes('audio:E'))
  advance(2690)
  assert.ok(calls.includes('audio:E'))
})
test('Replay repeats the same prompt and wrong feedback holds for 2000ms', () => {
  const {listen,calls,advance} = fixture()
  listen.enter()
  advance(500)
  listen.replay()
  assert.deepEqual(calls.filter(v => String(v).startsWith('audio:')), ['audio:T','audio:T'])
  advance(650)
  assert.equal(listen.answer('E'),true)
  assert.ok(calls.includes('listen-recognition:0.0s'))
  assert.deepEqual(calls.find(Array.isArray),['T',false,0])
  assert.ok(calls.includes('listen-feedback:Incorrect'))
  advance(2649)
  assert.ok(!calls.includes('listen-phase:gap'))
  advance(2650)
  assert.ok(calls.includes('listen-phase:gap'))
})
test('leaving mode or suspending prevents stale next playback', () => {
  const {listen,calls,advance} = fixture()
  listen.enter()
  listen.answer('T')
  advance(1650)
  listen.suspend()
  advance(4000)
  assert.deepEqual(calls.filter(v => String(v).startsWith('audio:')), ['audio:T'])
  assert.equal(listen.answer('T'), false)
  listen.exit()
  assert.equal(listen.replay(), false)
})


test('enter chooses a fresh weighted candidate without revealing it first', () => {
  const draws = ['N', 'A']
  const {listen,calls} = fixture(previous => {
    assert.equal(previous, undefined)
    return draws.shift()
  })
  listen.enter()
  listen.exit()
  listen.enter()
  assert.deepEqual(calls.filter(v => String(v).startsWith('audio:')), ['audio:N', 'audio:A'])
  assert.ok(!calls.includes('listen-reveal:N'))
  assert.ok(!calls.includes('listen-reveal:A'))
})
test('samples scheduled clock on miss, not wall time; replay invalidates previous clock', () => {
  const callbacks=[], records=[]
  const listen=createListen({now:()=>99999,setTimer:()=>0,clearTimer(){},play:(_,fn)=>callbacks.push(fn),stop(){},project(){},record:(...entry)=>records.push(entry),pick:()=> 'T'})
  listen.enter()
  listen.replay()
  callbacks[0](300,()=>900)
  callbacks[1](300,()=>450)
  listen.answer('E')
  assert.deepEqual(records,[['T',false,150]])
})
test('unavailable or stale prompt clock never becomes a zero measurement', () => {
  const pending=[], records=[]
  const listen=createListen({setTimer:()=>0,clearTimer(){},play:(_,fn)=>pending.push(fn),stop(){},project(){},record:(...entry)=>records.push(entry),pick:()=> 'T'})
  listen.enter()
  listen.suspend()
  listen.replay()
  pending[0](300,()=>900)
  pending[1](300,()=>null)
  listen.answer('T')
  assert.deepEqual(records,[['T',true,null]])
})
test('live feedback displays the raw elapsed latency while persistence owns its clamp', () => {
  const records=[], messages=[]
  const listen=createListen({setTimer:()=>0,clearTimer(){},play:(_,fn)=>fn(300,()=>20300),stop(){},project:v=>messages.push(v),record:(...entry)=>records.push(entry),pick:()=> 'T'})
  listen.enter()
  listen.answer('T')
  assert.ok(messages.includes('listen-recognition:20.0s'))
  assert.deepEqual(records,[['T',true,20000]])
})
