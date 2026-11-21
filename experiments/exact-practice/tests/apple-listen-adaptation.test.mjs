import assert from 'node:assert/strict'
import test from 'node:test'
import {create} from '../core/apple-session.mjs'

function launch(letters,listenTtr={}) {
  const key='dit.exact-spike.practice.v1', files=new Map([
    [key,JSON.stringify({version:1,settings:{selection:{kind:'custom',letters}},listenTtr,scores:{},history:[]})],
    ['dit.exact-spike.onboarding.v1',JSON.stringify({version:1,status:'skipped',step:'welcome'})],
  ])
  const view={}, pending=new Map(), tones=[]
  let tail=null
  const app=create({
    read:k=>files.has(k)?['ok',files.get(k)]:['missing'],write:(k,v)=>{files.set(k,v);return true},
    project:message=>{const i=message.indexOf(':');view[message.slice(0,i)]=message.slice(i+1)},
    play:(plan,pitch,id)=>{if(id) tones.push(plan);return true},promptTailMs:()=>tail,
    schedule:(id,ms)=>pending.set(id,ms),cancelTimer:id=>pending.delete(id),stop(){},cancelInput(){},warm(){},syncReminder(){},outputVolume:()=>1,
  })
  let props={mode:'boot',blocked:'false','listen-content':'characters','answer-token':'0'}
  const set=patch=>{props={...props,...patch};app.setProps(props)}
  const fire=ms=>{const e=[...pending].find(([,delay])=>delay===ms);assert.ok(e,'expected timer '+ms);pending.delete(e[0]);app.timer(e[0])}
  const answer=(value,ms)=>{tail=ms;set({'answer-value':value,'answer-prompt':view['listen-prompt'],'answer-token':String(1+Number(props['answer-token']))})}
  const current=()=>tones.at(-1).map(([start,end])=>end-start>190?'-':'.').join('')
  set({});app.bootstrap();set({mode:'listen'})
  return {app,set,answer,fire,current,saved:()=>JSON.parse(files.get(key))}
}
test('ordinary Apple Characters weights established slow recognition when presenting the initial prompt',t=>{
  t.mock.method(Math,'random',()=>0.4)
  const f=launch(['E','A','T'],{E:{averageMs:3000,samples:5}})
  assert.equal(f.current(),'.')
  f.app.dispose()
})
test('slow misses bring the sound back, with a three-prompt cap and a deferred repeat',t=>{
  t.mock.method(Math,'random',()=>0.01)
  const f=launch(['E','T'])
  assert.equal(f.current(),'.')
  for (const expected of ['.','.','-']) {
    f.answer('T',4000);f.fire(2000);f.fire(540)
    assert.equal(f.current(),expected,'slow E miss should repeat, then yield to T')
  }
  f.answer('T',800);f.fire(1650);f.fire(540);assert.equal(f.current(),'.')
  assert.equal(f.saved().history.length,4)
  assert.equal(f.saved().listenTtr.E.samples,3)
  f.app.dispose()
})
test('a miss without a presented tail gets no repeat or recognition sample',t=>{
  t.mock.method(Math,'random',()=>0.01)
  const f=launch(['E','T']);f.answer('T',-1);f.fire(2000);f.fire(540)
  assert.equal(f.current(),'-');assert.equal(f.saved().listenTtr.E,undefined)
  f.app.dispose()
})

test('a valid slow correct answer earns progress without scheduling a repeat',t=>{
  t.mock.method(Math,'random',()=>0.01)
  const f=launch(['E','T'])
  f.answer('E',4000);f.fire(1650);f.fire(540)
  assert.equal(f.current(),'-')
  assert.equal(f.saved().listenTtr.E.samples,1)
  assert.equal(f.saved().settings.autoCorrect,1)
  f.app.dispose()
})

test('leaving Characters clears unserved repeats while preserving the measured history',t=>{
  t.mock.method(Math,'random',()=>0.01)
  const f=launch(['E','T'])
  f.answer('T',4000);f.fire(2000);f.fire(540)
  assert.equal(f.current(),'.')
  f.set({mode:'freestyle'});f.set({mode:'listen'})
  f.answer('E',500);f.fire(1650);f.fire(540)
  assert.equal(f.current(),'-')
  assert.equal(f.saved().listenTtr.E.samples,2)
  f.app.dispose()
})
