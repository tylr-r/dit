import assert from 'node:assert/strict'
import test from 'node:test'
import { initialSession, stepSession } from '../modules/web/session.mjs'

test('streak credits only real correct character answers and resets local today at midnight without losing yesterday',()=>{
 const stamp=(day,hour=12)=>new Date(2026,10,day,hour,0).getTime()
 let s=stepSession(initialSession({history:[{letter:'E',correct:true,atMs:stamp(18)}]}),{type:'mode',mode:'guided'}).state
 assert.equal(s.streak,undefined)
 assert.equal(s.dailyActivity,undefined)
 const attempt=(atMs,correct,mode='practice')=>{s=stepSession(s,{type:'guidedScore',letter:'E',mode,correct,atMs}).state}
 attempt(stamp(18),false)
 assert.equal(s.streak,undefined)
 for(let i=0;i<14;i++)attempt(stamp(18,23),true)
 assert.equal(s.streak.current,0)
 attempt(stamp(18,23),true,'listen')
 assert.deepEqual(s.dailyActivity['2026-11-18'],{correct:15,modes:['practice','listen']})
 assert.equal(s.streak.current,1)
 assert.equal(s.letterAccuracy.E.recent.length,10)
 attempt(stamp(19,0),true)
 assert.equal(s.dailyActivity['2026-11-19'].correct,1)
 assert.equal(s.streak.current,1)
 for(let i=1;i<15;i++)attempt(stamp(19),true)
 assert.equal(s.streak.current,2)
 for(let i=0;i<15;i++)attempt(stamp(21),true)
 assert.equal(s.streak.current,1)
 assert.equal(s.streak.longest,2)
})

test('cold old snapshot stays byte-identical with unknown activity; known activity persists, future metrics protected',async()=>{
 const {loadPractice,savePractice,STORE_KEY}=await import('../modules/web/practice-store.mjs')
 const map=new Map([[STORE_KEY,JSON.stringify({version:1,settings:{},scores:{T:5},history:[{letter:'T',correct:true,atMs:42}]})]])
 const storage={getItem:key=>map.get(key)??null,setItem:(key,v)=>map.set(key,v)}
 const old=map.get(STORE_KEY)
 const loaded=loadPractice(storage)
 assert.equal(loaded.status,'saved')
 assert.equal(loaded.data.dailyActivity,undefined)
 assert.equal(loaded.data.streak,undefined)
 assert.equal(map.get(STORE_KEY),old)
 const next=stepSession(initialSession(loaded.data),{type:'sequence',code:'-',atMs:new Date(2026,10,19,12).getTime()}).state
 assert.equal(savePractice(storage,next),'saved')
 assert.deepEqual(loadPractice(storage).data.dailyActivity,next.dailyActivity)
 assert.deepEqual(loadPractice(storage).data.streak,next.streak)
 const future=JSON.parse(map.get(STORE_KEY))
 future.dailyActivity['2026-11-19'].energy=1
 const raw=JSON.stringify(future)
 map.set(STORE_KEY,raw)
 assert.equal(savePractice(storage,next),'newer')
 assert.equal(map.get(STORE_KEY),raw)
})

test('midnight projection uses injected local clock without changing or writing durable counters',async()=>{
 const {createSession,millisecondsUntilLocalMidnight}=await import('../modules/web/session.mjs')
 let now=new Date(2026,10,19,23,59,59,500).getTime()
 const events=[], writes=[]
 const session=createSession({wallNow:()=>now,setTimer:()=>1,clearTimer(){},project:x=>events.push(x),onLock(){},onChange:x=>writes.push(x),
   data:{dailyActivity:{'2026-11-19':{correct:16,modes:['listen']}},streak:{current:1,longest:2,lastCountedDate:'2026-11-19'}}})
 session.projectDaily()
 assert.deepEqual(events,['ref-streak-today:15/15','ref-day-label:Today counted','ref-day-fill:100%','ref-streak-current:1','ref-streak-best:2','ref-streak-risk:0'])
 assert.equal(millisecondsUntilLocalMidnight(now),500)
 now+=500
 session.projectDaily()
 assert.deepEqual(events.slice(-6),['ref-streak-today:0/15','ref-day-label:0 / 15 today','ref-day-fill:0%','ref-streak-current:1','ref-streak-best:2','ref-streak-risk:1'])
 assert.equal(writes.length,0)
 assert.equal(session.current().dailyActivity['2026-11-19'].correct,16)
})

test('local calendar source goldens span UTC day split, DST, skipped dates and future-date retention',async()=>{
 const {execFileSync}=await import('node:child_process')
 const bun='/Users/tylr/Code/exact-spike-toolchain/.spike-tools/bun-darwin-aarch64/bun'
 const shipped='/Users/tylr/Code/dit/packages/core/src/utils/retention.ts'
 const experimental=new URL('../modules/web/session.mjs',import.meta.url).pathname
 const env={...process.env,TZ:'America/Denver'}
 const result=execFileSync(bun,['-e',`
   import assert from 'node:assert/strict';
   import {dateKey,recordCorrectAnswer} from '${shipped}';
   import {initialSession,stepSession,millisecondsUntilLocalMidnight} from '${experimental}';
   let state=stepSession(initialSession({dailyActivity:{'2026-12-01':{correct:1,modes:['practice']},'2026-01-01':{correct:1,modes:['practice']}}}),{type:'mode',mode:'guided'}).state;
   let source={dailyActivity:state.dailyActivity};
   for(const at of ['2026-11-01T05:59:00Z','2026-11-01T06:00:00Z','2026-11-03T09:00:00Z']){
     for(let i=0;i<15;i++){
       const mode=i===0?'listen':'practice';
       state=stepSession(state,{type:'guidedScore',letter:'T',correct:true,mode,atMs:Date.parse(at)}).state;
       source=recordCorrectAnswer(source,{letter:'T',mode,at:new Date(at)});
     }
     for(const field of ['dailyActivity','letterAccuracy','streak'])assert.deepEqual(state[field],source[field]);
   }
   const dst=new Date('2026-11-01T06:00:00Z')
   assert.equal(dateKey(new Date('2026-11-01T05:59:00Z')),'2026-10-31');
   assert.equal(millisecondsUntilLocalMidnight(+dst),25*60*60*1000);
   assert.ok(state.dailyActivity['2026-12-01']);
   assert.ok(!state.dailyActivity['2026-01-01']);
   console.log('source matched');
 `],{encoding:'utf8',env})
 assert.match(result,/source matched/)
})
