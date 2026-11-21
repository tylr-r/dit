import assert from 'node:assert/strict'
import test from 'node:test'
import {initialSession,stepSession} from '../modules/web/session.mjs'

test('custom selection preserves ordered click set, cancels stale work and filters review without touching progress',()=>{
 let s=initialSession({scores:{E:5},settings:{selection:{kind:'tier',level:3}}})
 const d=(state,event)=>stepSession(state,event)
 s=d(s,{type:'sequence',code:'-'}).state
 s={...s,reviewQueue:[{letter:'T',remaining:1},{letter:'J',remaining:2}]}
 const result=d(s,{type:'selection',selection:{kind:'custom',letters:['J','Z','T']}})
 assert.equal(result.state.studyPool,'JZT')
 assert.equal(result.state.target,'T')
 assert.equal(result.state.outcome,null)
 assert.deepEqual(result.state.reviewQueue,[{letter:'T',remaining:1},{letter:'J',remaining:2}])
 assert.deepEqual(result.effects.map(e=>e.type),['cancelFeedback','cancelWord'])
 assert.equal(result.state.scores,s.scores)
 const noDraft=d(result.state,{type:'selection',selection:{kind:'custom',letters:[]}})
 assert.equal(noDraft.state,result.state)
 const tier=d(result.state,{type:'selection',selection:{kind:'tier',level:1}})
 assert.equal(tier.state.studyPool,'AEIMNT')
 assert.deepEqual(tier.state.reviewQueue,[{letter:'T',remaining:1}])
})

test('source ordered tiers compare to shipped helper and clean installs differ from unchanged legacy',async()=>{
 const {execFileSync}=await import('node:child_process')
 const {tierPool}=await import('../modules/web/selection.mjs')
 const bun='/Users/tylr/Code/exact-spike-toolchain/.spike-tools/bun-darwin-aarch64/bun'
 const expected=JSON.parse(execFileSync(bun,['-e',`
   import {getLettersForLevel} from '/Users/tylr/Code/dit/packages/core/src/utils/morseUtils.ts';
   console.log(JSON.stringify([1,2,3,4].map(level=>getLettersForLevel(level).join(''))))
 `],{encoding:'utf8'}))
 assert.deepEqual([1,2,3,4].map(tierPool),expected)
 assert.deepEqual(expected.map(pool=>pool.length),[6,14,26,36])
 assert.equal(initialSession({}).studyPool,'TENRA')
 assert.equal(initialSession({},false,true,.99).target,'Z')
 assert.equal(initialSession({},false,true).studyPool,expected[2])
 const fresh=stepSession(initialSession({},false,true),{type:'freshBeginnerDefaults'}).state
 assert.equal(fresh.studyPool,expected[0])
 assert.deepEqual(fresh.settings.selection,{kind:'tier',level:1})
 assert.equal(fresh.settings.ifr,false)
 assert.equal(fresh.settings.reviewMisses,false)
})

test('persist valid custom order, reject empty/duplicate/invalid replacements and protect unsupported schema',async()=>{
 const {scopeCommand}=await import('../modules/web/selection.mjs')
 const {loadPractice,savePractice,STORE_KEY}=await import('../modules/web/practice-store.mjs')
 const entries=new Map([[STORE_KEY,JSON.stringify({version:1,settings:{},scores:{},history:[]})]])
 const storage={getItem:key=>entries.get(key)??null,setItem:(key,value)=>entries.set(key,value)}
 const old=entries.get(STORE_KEY)
 const local=loadPractice(storage)
 assert.equal(local.status,'saved')
 assert.equal(local.data.settings.selection,undefined)
 assert.equal(entries.get(STORE_KEY),old)
 const selected=stepSession(initialSession(local.data),{type:'selection',selection:scopeCommand('scope-custom:ZJ9')}).state
 assert.equal(selected.target,'Z')
 assert.equal(selected.studyPool,'ZJ9')
 assert.equal(savePractice(storage,selected),'saved')
 assert.deepEqual(loadPractice(storage).data.settings.selection,{kind:'custom',letters:['Z','J','9']})
 for(const invalid of ['scope-custom:','scope-custom:ZZ','scope-custom:ZA!', 'scope-tier:0','scope-tier:12'])
   assert.equal(scopeCommand(invalid),null)
 const future=JSON.parse(entries.get(STORE_KEY))
 future.settings.selection.layout='future'
 const raw=JSON.stringify(future)
 entries.set(STORE_KEY,raw)
 assert.equal(savePractice(storage,selected),'newer')
 assert.equal(entries.get(STORE_KEY),raw)
 assert.equal(stepSession(selected,{type:'courseComplete'}).state,selected)
 assert.equal(initialSession(selected,true).studyPool,'ZJ9')
})

test('Words Current letters follows effective scope while explicit All remains an override',async()=>{
 const {createWords}=await import('../modules/web/words.mjs')
 let scope='J', events=[]
 const words=createWords({getPool:()=>scope,project:e=>events.push(e),play(){},stop(){},random:()=>0})
 words.enter()
 assert.ok(events.includes('word-ready:0'))
 assert.equal(words.start(),false)
 scope='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
 words.suspend()
 assert.equal(events.filter(v=>v.startsWith('word-ready:')).at(-1),'word-ready:1')
 scope='J'
 words.pool(true)
 assert.equal(events.filter(v=>v.startsWith('word-ready:')).at(-1),'word-ready:1')
})
