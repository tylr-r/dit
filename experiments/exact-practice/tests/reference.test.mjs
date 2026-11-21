import assert from 'node:assert/strict'
import test from 'node:test'
import {initialSession,stepSession} from '../modules/web/session.mjs'
import { buildReference, referencePattern } from '../modules/web/reference.mjs'
import {loadPractice,savePractice,STORE_KEY} from '../modules/web/practice-store.mjs'

test('all 36 real characters are present, old truncated history never claims mastery',()=>{
 const state=initialSession({scores:{E:100},history:Array.from({length:10},(_,i)=>({letter:'E',correct:true,atMs:i}))})
 const m=buildReference(state)
 assert.equal(m.mastered.length,0)
 assert.equal(m.learning.length,0)
 assert.equal(m.noEvidence.length,36)
 assert.equal(m.recentSend,10)
 assert.equal(m.recentListen,0)
 assert.equal(referencePattern('Q'),'--.-')
 assert.equal(referencePattern('0'),'-----')
 assert.equal(referencePattern('!'),null)
})
test('real forward scored Practice and Listen attempts collect durable per-character last ten',()=>{
 let s=stepSession(initialSession(),{type:'mode',mode:'guided'}).state
 for(let i=0;i<9;i++)s=stepSession(s,{type:'guidedScore',letter:'E',correct:true,mode:'practice',atMs:i}).state
 assert.deepEqual(buildReference(s).learning,['E'])
 s=stepSession(s,{type:'guidedScore',letter:'E',correct:false,mode:'listen',atMs:9}).state
 assert.deepEqual(buildReference(s).mastered,['E'])
 assert.equal(buildReference(s).recentListen,1)
 assert.equal(buildReference(s).recentSend,9)
 for(let i=10;i<13;i++)s=stepSession(s,{type:'guidedScore',letter:'E',correct:false,mode:'listen',atMs:i}).state
 assert.equal(s.letterAccuracy.E.recent.length,10)
 assert.deepEqual(buildReference(s).mastered,[])
 assert.deepEqual(buildReference(s).learning,['E'])
 const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}
 assert.equal(savePractice(storage,s),'saved')
 const current=loadPractice(storage)
 assert.equal(current.status,'saved')
 assert.deepEqual(current.data.letterAccuracy,s.letterAccuracy)
 assert.ok(map.get(STORE_KEY).includes('letterAccuracy'))
})
test('older valid snapshots hydrate optional accuracy empty and remain unmodified',()=>{
 const raw='{"version":1,"settings":{"speed":12},"scores":{"E":12},"history":[]}'
 const storage={getItem:k=>k===STORE_KEY?raw:null,setItem(){assert.fail('read must not save')}}
 const current=loadPractice(storage)
 assert.equal(current.status,'saved')
 assert.deepEqual(current.data.letterAccuracy,{})
 assert.equal(buildReference(initialSession(current.data)).noEvidence.length,36)
})

test('global history churn cannot erase an untouched complete character window',()=>{
 let s=stepSession(initialSession(),{type:'mode',mode:'guided'}).state
 for(let i=0;i<10;i++)s=stepSession(s,{type:'guidedScore',letter:'E',correct:i<8,mode:'practice',atMs:i}).state
 const oldE=s.letterAccuracy.E
 for(let i=0;i<201;i++)s=stepSession(s,{type:'guidedScore',letter:'T',correct:true,mode:'practice',atMs:100+i}).state
 assert.equal(s.history.length,200)
 assert.equal(s.history.some(item=>item.letter==='E'),false)
 assert.deepEqual(s.letterAccuracy.E,oldE)
 assert.deepEqual(buildReference(s).mastered,['E','T'])
})

test('mixed malformed old data retains valid accuracy, while additive future subfields are protected',()=>{
 const map=new Map()
 const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}
 const envelope={version:1,settings:{},scores:{E:2,T:3},history:[],letterAccuracy:{E:{recent:[true,'no']},T:{recent:[true]}}}
 map.set(STORE_KEY,JSON.stringify(envelope))
 assert.deepEqual(loadPractice(storage).data.letterAccuracy,{T:{recent:[true]}})
 const future=JSON.stringify({...envelope,letterAccuracy:{T:{recent:[true],futureCounter:88}}})
 map.set(STORE_KEY,future)
 assert.equal(loadPractice(storage).status,'newer')
 assert.equal(savePractice(storage,initialSession()),'newer')
 assert.equal(map.get(STORE_KEY),future)
 const newer=JSON.stringify({...envelope,version:2})
 map.set(STORE_KEY,newer)
 assert.equal(savePractice(storage,initialSession()),'newer')
 assert.equal(map.get(STORE_KEY),newer)
})

test('classifications and patterns match direct shipped source across onset and mastery thresholds',async()=>{
 const {execFileSync}=await import('node:child_process')
 const bun='/Users/tylr/Code/exact-spike-toolchain/.spike-tools/bun-darwin-aarch64/bun'
 const source='/Users/tylr/Code/dit/packages/core/src'
 const golden=JSON.parse(execFileSync(bun,['-e',`
   import {classifyLetter} from '${source}/utils/retention.ts';
   import {MORSE_DATA as data} from '${source}/data/morse.ts';
   const outcomes=[[],[true],...([7,8,9,10].map(n=>Array.from({length:10},(_,i)=>i<n)))];
   const criteria=[0,4,5,15].flatMap(score=>outcomes.map(recent=>[score,recent,classifyLetter({scores:{E:score},letterAccuracy:{E:{recent}}},'E')]));
   console.log(JSON.stringify({criteria,codes:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,v.code]))}));
 `],{encoding:'utf8'}))
 for(const [char,code] of Object.entries(golden.codes))assert.equal(referencePattern(char),code)
 for(const [score,recent,status] of golden.criteria){
   const model=buildReference(initialSession({scores:{E:score},letterAccuracy:{E:{recent}}}))
   const group={mastered:'mastered',learning:'learning','not-yet':'noEvidence'}[status]
   assert.ok(model[group].includes('E'))
 }
})

test('reference audio replaces within active dialog and cancels on focus or route boundary, without scoring',async()=>{
 const {setProps}=await import('../modules/web/index.js')
 const seen=[]
 const h={
   mode:'practice',routeBoundary:'1',externalBlocked:false,locked:false,guideLocked:false,
   wordsOn:false,customOn:false,
   attempt:{cancel:()=>seen.push('cancel input'),configure:()=>{}},
   audio:{stop:()=>seen.push('stop audio'),replay:plan=>seen.push(plan)},
   session:{dispatch:event=>seen.push(event.type),current:()=>({settings:{speed:12,pitch:600}})},
   sessionReference:(char,pattern,duration)=>seen.push([char,pattern,duration]),
   guide:{isListening:()=>false},
 }
 const apply=(open,token,char,route='1')=>setProps(h,JSON.stringify({
   mode:'practice',blocked:open,'route-boundary':route,'reference-open':open,
   'reference-token':token,'reference-char':char,
 }))
 apply(true,0,'')
 seen.length=0
 apply(true,1,'E')
 assert.deepEqual(seen.filter(Array.isArray),[['E','.',100],[[0,100]]])
 assert.ok(!seen.includes('stop audio'))
 apply(true,1,'E')
 assert.equal(seen.filter(Array.isArray).length,2)
 apply(true,2,'!')
 assert.equal(seen.filter(Array.isArray).length,2)
 apply(true,3,'T','2') // route boundary must discard a queued old dialog action
 assert.ok(seen.includes('stop audio'))
 assert.equal(seen.filter(Array.isArray).length,2)
 seen.length=0
 apply(false,3,'T','2')
 assert.ok(seen.includes('stop audio'))
 assert.ok(!seen.includes('sequence'))
})
