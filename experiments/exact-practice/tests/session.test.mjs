import test from 'node:test'
import assert from 'node:assert/strict'
import { initialSession, stepSession, decode, replayPlan } from '../modules/web/session.mjs'
const seq = code => ({ type: 'sequence', code })
const elapsed = { type: 'feedbackElapsed' }
test('recognizes all shipped letters and digits without translating invalid patterns', () => {
  assert.equal(decode('---'), 'O')
  assert.equal(decode('-----'), '0')
  assert.equal(decode('----.'), '9')
  assert.equal(decode('......'), null)
  assert.equal(decode(''), null)
})
test('correct practice advances through five characters on the shipped feedback delay', () => {
  let s = initialSession()
  for (const [code, current, next] of [['-','T','E'],['.','E','N'],['-.','N','R'],['.-.','R','A'],['.-','A','T']]) {
    const r = stepSession(s, seq(code))
    assert.equal(r.state.target, current)
    assert.equal(r.state.feedback, 'Correct')
    assert.deepEqual(r.effects, [{ type:'scheduleFeedback', ms:1000 }])
    s = stepSession(r.state, elapsed).state
    assert.equal(s.target, next)
  }
  assert.equal(s.score, 5)
  assert.equal(s.scores.N, 1)
})
test('wrong stays on target without IFR, locks scoring, and advances with IFR', () => {
  const off = stepSession(initialSession(), {type:'ifr', enabled: false}).state
  const wrong = stepSession(off, seq('.'))
  assert.equal(wrong.state.feedback, 'Try again')
  assert.equal(wrong.state.score, -1)
  assert.equal(stepSession(wrong.state, seq('-')).state.score, -1)
  assert.equal(stepSession(wrong.state, elapsed).state.target, 'T')
  const ifr = stepSession(initialSession(), {type:'ifr', enabled: true}).state
  assert.equal(stepSession(stepSession(ifr, seq('.')).state, elapsed).state.target, 'E')
})
test('new accepted symbol supersedes a pending correct advance', () => {
  const correct = stepSession(initialSession(), seq('-')).state
  const symbol = stepSession(correct, { type: 'symbol' })
  assert.equal(symbol.state.feedback, '')
  assert.deepEqual(symbol.effects, [{type:'cancelFeedback'}])
  assert.equal(stepSession(symbol.state, elapsed).state.target, 'T')
})
test('freestyle decodes, separates words, refuses invalid input and clears cleanly', () => {
  let s = stepSession(initialSession(), {type:'mode', mode:'freestyle'}).state
  const letterOnly = stepSession(s, seq('-...')).state
  assert.equal(letterOnly.feedback, 'B')
  assert.equal(letterOnly.transcript, '')
  s = stepSession(s, {type:'words', enabled:true}).state
  let r = stepSession(s, seq('-...'))
  assert.equal(r.state.transcript, 'B')
  assert.deepEqual(r.effects, [{type:'scheduleWord', ms:1200}])
  s = stepSession(r.state,{type:'wordElapsed'}).state
  assert.equal(s.transcript,'B ')
  s = stepSession(s,seq('......')).state
  assert.equal(s.transcript,'B ')
  assert.equal(s.feedback,'No match')
  s = stepSession(s,seq('.....')).state
  assert.equal(s.transcript,'B 5')
  r = stepSession(s,{type:'clear'})
  assert.equal(r.state.transcript,'')
  assert.equal(r.state.feedback,'')
})
test('replay keeps realistic character speed and a full multi-element pattern', () => {
  assert.deepEqual(replayPlan('R', 100), [[0,100],[200,500],[600,700]])
  assert.deepEqual(replayPlan('N', 60), [[0,180],[240,300]])
})

test('Replay holds the current target and clears success and its pending advance', () => {
  const success = stepSession(initialSession(), seq('-')).state
  const replay = stepSession(success, {type:'replay'})
  assert.equal(replay.state.target, 'T')
  assert.equal(replay.state.feedback, '')
  assert.deepEqual(replay.effects, [{type:'cancelFeedback'}])
  assert.equal(stepSession(replay.state, elapsed).state.target, 'T')
})

test('Replay hides errors without shortening lockout or advancing an IFR miss', () => {
  const wrong = stepSession(initialSession(), seq('.')).state
  const replay = stepSession(wrong, {type:'replay'})
  assert.equal(replay.state.feedback, '')
  assert.deepEqual(replay.effects, [])
  assert.equal(stepSession(replay.state, seq('-')).state.score, -1)
  const unlocked = stepSession(replay.state, elapsed).state
  assert.equal(unlocked.target, 'T')
  assert.equal(stepSession(unlocked, seq('-')).state.score, 0)
})

test('mode changes clear Freestyle text, feedback, and scheduled word spacing', () => {
  let s = stepSession(initialSession(), {type:'mode', mode:'freestyle'}).state
  s = stepSession(s, {type:'words', enabled:true}).state
  s = stepSession(s, seq('-...')).state
  const switched = stepSession(s, {type:'mode', mode:'practice'})
  assert.equal(switched.state.transcript, '')
  assert.equal(switched.state.feedback, '')
  assert.ok(switched.effects.some(effect => effect.type === 'cancelWord'))
  assert.equal(stepSession(switched.state, {type:'mode', mode:'freestyle'}).state.transcript, '')
})

test('route boundary clears correct and IFR feedback without advancing or dropping durable results',()=>{
  for (const code of ['-', '.']) {
    const result = stepSession(initialSession(),seq(code)).state
    const reset = stepSession(result,{type:'routeBoundary'})
    assert.equal(reset.state.feedback,'')
    assert.equal(reset.state.outcome,null)
    assert.equal(reset.state.advance,false)
    assert.equal(reset.state.target,'T')
    assert.equal(reset.state.settings,result.settings)
    assert.equal(reset.state.scores,result.scores)
    assert.equal(reset.state.history,result.history)
    assert.deepEqual(reset.effects,[{type:'cancelFeedback'},{type:'cancelWord'}])
    assert.equal(stepSession(reset.state,elapsed).state.target,'T')
  }
})

test('route boundary unlocks rejected keying and makes an already queued feedback callback stale',async()=>{
  const {createSession}=await import('../modules/web/session.mjs')
  let queued
  const locks=[]
  const s=createSession({
    setTimer:fn=>{queued=fn;return 1},clearTimer:()=>{},project:()=>{},
    onLock:value=>locks.push(value),
  })
  s.dispatch(seq('.'))
  assert.deepEqual(locks,[true])
  s.dispatch({type:'routeBoundary'})
  queued()
  assert.deepEqual(locks,[true,false])
  assert.equal(s.current().target,'T')
  assert.equal(s.current().score,-1)
})

test('Freestyle reports pending manual input until decode and clears the draft on word-mode changes', () => {
  let state = stepSession(initialSession(), {type:'mode', mode:'freestyle'}).state
  const send = event => { state = stepSession(state, event).state }
  send({type:'symbol', symbol:'.'})
  send({type:'symbol', symbol:'-'})
  assert.equal(state.freestyleInput, '.-')
  send({type:'sequence', code:'.-'})
  assert.equal(state.feedback, 'A')
  assert.equal(state.freestyleInput, '')
  send({type:'words', enabled:true})
  assert.equal(state.feedback, '')
  send({type:'sequence', code:'.'})
  send({type:'symbol', symbol:'-'})
  assert.equal(state.transcript, 'E')
  send({type:'cancel'})
  assert.equal(state.freestyleInput, '')
  assert.equal(state.transcript, 'E')
  send({type:'words', enabled:false})
  send({type:'wordElapsed'})
  assert.equal(state.transcript, '')
  assert.equal(state.score, 0)
})
