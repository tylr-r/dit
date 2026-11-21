import assert from 'node:assert/strict'
import test from 'node:test'
import { createQso, fixtureReply, qsoPlan } from '../modules/web/qso.mjs'
const last=(events,k)=>events.filter(e=>e.startsWith(k+':')).at(-1)?.slice(k.length+1)
const flush=()=>new Promise(resolve=>setImmediate(resolve))
const begin=(qso,direction)=>qso.start(direction)&&qso.confirm(true)
function fake(reply=fixtureReply,host={}){
 const audio=[],events=[],requests=[],timers=new Map()
 let id=0
 const qso=createQso({project:s=>events.push(s),reply:payload=>{requests.push(payload);return reply(payload)},
   play:host.play ?? ((text,done,fail,progress)=>audio.push({text,done,fail,progress})),stop:()=>{},pause:host.pause ?? (async()=>{}),resume:host.resume ?? (async()=>{}),
   setTimer: (fn,ms)=>{timers.set(++id,{fn,ms});return id},clearTimer:key=>timers.delete(key)})
 return {qso,audio,events,requests,timers}
}
test('silent receive entry, completes without revealing, and explicit handoff inserts exactly once',async()=>{
 const {qso,audio,events,requests}=fake()
 qso.enter()
 assert.equal(requests.length,0)
 begin(qso,'receive')
 await flush()
 assert.equal(audio[0].text,'CQ K')
 qso.copy('CQ X')
 assert.equal(last(events,'qso-rx-text'),'')
 audio[0].done()
 assert.equal(last(events,'qso-phase'),'rx-ready')
 assert.equal(last(events,'qso-transcript'),'')
 qso.check()
 assert.equal(last(events,'qso-rx-text'),'CQ K')
 assert.equal(last(events,'qso-copy-summary'),'3/4 matched · 1 missed · 1 extra')
 qso.startTurn()
 assert.equal(last(events,'qso-transcript'),'Station: CQ K')
 qso.replay();audio[1].done();qso.startTurn()
 assert.equal(last(events,'qso-transcript'),'Station: CQ K')
 assert.ok(!JSON.stringify(requests).includes('CQ X'))
})
test('draft handles actual symbols, fresh auto-space/backspace and only deliberate Send enters payload',async()=>{
 const {qso,events,requests,timers}=fake()
 qso.enter();begin(qso,'send')
 assert.equal(last(events,'qso-phase'),'tx')
 qso.key('.')
 const marker=[...timers.values()].at(-1)
 assert.equal(marker.ms,1200)
 marker.fn()
 assert.equal(last(events,'qso-draft'),'E ')
 qso.backspace()
 assert.equal(last(events,'qso-draft'),'')
 qso.key('-')
 qso.clear()
 qso.send()
 assert.equal(requests.length,0)
 qso.key('.')
 qso.send()
 await flush()
 assert.equal(requests[0].outgoing,'E')
 assert.equal(last(events,'qso-transcript'),'You: E')
})
test('retry same failed turn without adding a duplicate, and stale response after End never plays',async()=>{
 let reject,resolve
 const {qso,audio,events,requests}=fake(()=>new Promise((yes,no)=>{reject=no;resolve=yes}))
 qso.enter();begin(qso,'send');qso.key('.');qso.send()
 reject(Error('synthetic failure'));await flush()
 assert.equal(last(events,'qso-phase'),'error')
 qso.retry()
 assert.deepEqual(requests[1],requests[0])
 qso.end()
 resolve('R K');await flush()
 assert.equal(audio.length,0)
 assert.equal(last(events,'qso-transcript'),'You: E')
})
test('audio retry reuses already accepted fixture response without another station call',async()=>{
 const {qso,audio,requests}=fake()
 qso.enter();begin(qso,'receive')
 await flush();audio[0].fail();qso.retry()
 assert.equal(audio[1].text,audio[0].text)
 assert.equal(requests.length,1)
 qso.leave();audio[1].done()
})
test('standalone AR is joined, AR within word keeps the normal character gap',()=>{
 const joined=qsoPlan('AR',12)
 assert.deepEqual(joined.slice(0,3),[[0,100],[200,500],[600,700]])
 const inside=qsoPlan('EAR',12)
 assert.deepEqual(inside.slice(0,4),[[0,100],[400,500],[600,900],[1200,1300]])
})


test('Replay restarts copy, synchronous audio failure is retryable, and no station request repeats',async()=>{
 let playCount=0
 const {qso,events,requests}=fake(undefined,{play:()=>{
   if(++playCount===1)throw Error('cannot construct audio')
 }})
 qso.enter();begin(qso,'receive');await flush()
 assert.equal(last(events,'qso-phase'),'error')
 assert.equal(qso.retry(),true)
 assert.equal(requests.length,1)
 assert.equal(last(events,'qso-phase'),'receiving')
 qso.copy('unpersisted local copy')
 qso.replay()
 assert.equal(last(events,'qso-copy'),'')
})

test('stale pause rejection and queued completion cannot revive an ended contact',async()=>{
 let reject
 const {qso,audio,events}=fake(undefined,{pause:()=>new Promise((_,no)=>{reject=no})})
 qso.enter();begin(qso,'receive');await flush()
 const pause=qso.pause()
 qso.end()
 reject(Error('stale platform suspend'));await pause
 audio[0].done()
 assert.equal(last(events,'qso-phase'),'ended')
 assert.equal(last(events,'qso-transcript'),'Station: CQ K')
})

test('generated standalone prosigns and draft decode match the shipped source',async()=>{
 const {execFileSync}=await import('node:child_process')
 const bun='/Users/tylr/Code/exact-spike-toolchain/.spike-tools/bun-darwin-aarch64/bun'
 const source='/Users/tylr/Code/dit/packages/core/src/utils/conversationMorse.ts'
 const messages=['CQ K','AR BK SK','EAR K1AR','  et  E! 🐰 ', 'BT AS HH']
 const codes=['.-.-.','-.-.-','-...-','-.-','.......']
 const expected=JSON.parse(execFileSync(bun,['-e',`
   import {textToConversationMorseCode as encode,decodeConversationMorseCode as decode} from '${source}';
   const [messages,codes]=JSON.parse(process.argv[1]);
   console.log(JSON.stringify({send:messages.map(x=>encode(x)),key:codes.map(x=>decode(x))}));
 `,JSON.stringify([messages,codes])],{encoding:'utf8'}))
 const {textToConversationMorseCode:encode,decodeConversationMorseCode:decode}=await import('../modules/web/qso-codec.generated.mjs')
 assert.deepEqual({send:messages.map(x=>encode(x)),key:codes.map(x=>decode(x))},expected)
})

test('End closes playback and keying; only New begins a fresh contact',async()=>{
 const {qso,audio,events}=fake()
 qso.enter();begin(qso,'receive');await flush()
 qso.end()
 assert.equal(qso.replay(),false)
 assert.equal(qso.startTurn(),false)
 assert.equal(qso.send(),false)
 assert.equal(audio.length,1)
 assert.equal(last(events,'qso-phase'),'ended')
 qso.new()
 assert.equal(last(events,'qso-phase'),'idle')
 assert.equal(begin(qso,'send'),true)
 assert.equal(last(events,'qso-phase'),'tx')
})


test('local consent cancels without creating a station; Allow scopes only this contact',async()=>{
 const {qso,events,requests}=fake()
 qso.enter()
 assert.equal(qso.start('receive'),true)
 assert.equal(last(events,'qso-phase'),'consent')
 assert.equal(last(events,'qso-callsign'),'')
 assert.equal(requests.length,0)
 assert.equal(qso.confirm(false),true)
 assert.equal(last(events,'qso-phase'),'idle')
 assert.equal(requests.length,0)
 qso.start('receive');qso.confirm(true);await flush()
 assert.equal(requests.length,1)
 qso.end();qso.new();qso.start('receive')
 assert.equal(last(events,'qso-phase'),'consent')
 assert.equal(requests.length,1)
})
test('live letters follow the audio clock and reveal a joined prosign only at completion',async()=>{
 const {qso,audio,events}=fake(async()=> 'AR')
 qso.enter();qso.setLive(true);begin(qso,'receive');await flush()
 audio[0].progress(1299,12)
 assert.equal(last(events,'qso-live'),'')
 await qso.pause()
 audio[0].progress(1300,12)
 assert.equal(last(events,'qso-live'),'')
 await qso.resume()
 audio[0].progress(1300,12)
 assert.equal(last(events,'qso-live'),'AR')
 assert.equal(last(events,'qso-transcript'),'')
 qso.replay()
 assert.equal(last(events,'qso-live'),'')
 audio[0].progress(2000,12)
 assert.equal(last(events,'qso-live'),'')
})
test('typed copy remains editable and checkable in TX without entering outgoing fixture payload',async()=>{
 const {qso,audio,events,requests}=fake()
 qso.enter();begin(qso,'receive');await flush()
 qso.copy('CQ X')
 audio[0].done();qso.startTurn()
 assert.notEqual(last(events,'qso-copy'),'')
 qso.copy('CQ Y')
 assert.equal(qso.check(),true)
 assert.equal(last(events,'qso-copy-summary'),'3/4 matched · 1 missed · 1 extra')
 qso.key('.');qso.send();await flush()
 assert.equal(requests.at(-1).outgoing,'E')
 assert.ok(!JSON.stringify(requests).includes('CQ Y'))
})

test('leaving a pending consent gate invalidates a late approval',async()=>{
 const {qso,events,requests}=fake()
 qso.enter();qso.start('receive')
 qso.leave()
 assert.equal(qso.confirm(true),false)
 qso.enter()
 assert.equal(qso.confirm(true),false)
 await flush()
 assert.equal(requests.length,0)
 assert.equal(last(events,'qso-callsign'),'')
})

test('progressive joined-prosign boundaries agree with shipped receive helper',async()=>{
 const {execFileSync}=await import('node:child_process')
 const bun='/Users/tylr/Code/exact-spike-toolchain/.spike-tools/bun-darwin-aarch64/bun'
 const src='/Users/tylr/Code/dit/packages/core/src/utils/conversationMorse.ts'
 const samples=[0,299,300,1299,1300,1999,2000,2700,5000]
 const expected=JSON.parse(execFileSync(bun,['-e',`
   import {textToConversationMorseCode as e,getReceivedConversationTextAtElapsedMs as rx} from '${src}';
   const t='AR K'; const k=e(t).code;
   console.log(JSON.stringify(JSON.parse(process.argv[1]).map(ms=>rx(t,k,100,ms,300,700))));
 `,JSON.stringify(samples)],{encoding:'utf8'}))
 const {qso,audio,events}=fake(async()=> 'AR K')
 qso.enter();qso.setLive(true);begin(qso,'receive');await flush()
 const observed=samples.map(ms=>{audio[0].progress(ms,12);return last(events,'qso-live')})
 assert.deepEqual(observed,expected)
})
