import assert from 'node:assert/strict'
import test from 'node:test'
import { beginGuide, guideAttempt, continueGuide, GUIDED_PACKS, readGuide, saveGuide, GUIDED_KEY } from '../modules/web/guided.mjs'
const round = (state, letter, correct=true) => guideAttempt(state, letter, correct)
function taught() {
  let g = beginGuide()
  for (const letter of 'EETT') g = round(g,letter)
  return g
}
function practiced() {
  let g = continueGuide(taught())
  for (const letter of 'ETETETETET') g = round(g,letter)
  return g
}
test('Teach needs two correct attempts for every current letter, no shortcut', () => {
  let g = round(beginGuide(),'E',false)
  for (const letter of 'EEET') g = round(g,letter)
  assert.equal(g.phase,'teach')
  assert.equal(continueGuide(g),g)
  assert.equal(taught().phase,'gate-practice')
})
test('Practice needs 10 attempts, 8 correct and 2 correct per letter', () => {
  let g = continueGuide(taught())
  for (const letter of 'EEEEEEEEET') g = round(g,letter)
  assert.equal(g.phase,'practice')
  g = round(g,'T')
  assert.equal(g.phase,'gate-listen')
  assert.equal(practiced().phase,'gate-listen')
})
test('passing actual Listen gates unlocks the next shipped pack only after Continue', () => {
  let g = continueGuide(practiced())
  for (const letter of 'ETETET') g = round(g,letter)
  assert.equal(g.phase,'gate-next')
  assert.equal(g.pack,0)
  g = continueGuide(g)
  assert.equal(g.phase,'teach')
  assert.equal(g.pack,1)
  assert.deepEqual(GUIDED_PACKS[g.pack],['A','N'])
  assert.equal(g.progress.practiceAttempts,0)
})
test('failed Listen returns through a retry gate to fresh Practice and keeps Teach credit', () => {
  let g = continueGuide(practiced())
  for (const letter of 'EEEEEE') g = round(g,letter)
  assert.equal(g.phase,'gate-retry')
  g = continueGuide(g)
  assert.equal(g.phase,'practice')
  assert.deepEqual(g.progress.teachCounts,{E:2,T:2})
  assert.equal(g.progress.listenAttempts,0)
})
test('experimental guided store roundtrips a boundary and leaves other and newer data alone', () => {
  const map = new Map([['dit-progress','production fixture']])
  const db = {getItem: key => map.get(key) ?? null, setItem:(key,value) => map.set(key,value)}
  const g = practiced()
  assert.equal(saveGuide(db,g),'saved')
  assert.deepEqual(readGuide(db).data,g)
  assert.equal(map.get('dit-progress'),'production fixture')
  map.set(GUIDED_KEY,'{"version":999}')
  assert.equal(saveGuide(db,g),'unsupported')
  assert.equal(map.get(GUIDED_KEY),'{"version":999}')
})

test('guided source fixture matches all packs and each real gate on the first pack', async () => {
  const src = await import('/Users/tylr/Code/dit/packages/core/src/utils/beginnerCourse.ts')
  assert.deepEqual(GUIDED_PACKS, src.BEGINNER_COURSE_PACKS)
  const pack = src.BEGINNER_COURSE_PACKS[0]
  let expected = src.createGuidedLessonProgress()
  let actual = beginGuide()
  for (const letter of 'EETT') {
    expected = src.recordGuidedTeachSuccess(expected,letter)
    actual = guideAttempt(actual,letter,true)
    assert.equal(actual.phase === 'gate-practice', src.isGuidedTeachComplete(expected,pack))
  }
  actual = continueGuide(actual)
  for (const [i,letter] of [...'ETETETETETET'].entries()) {
    const correct = ![2,6,8].includes(i)
    expected = src.recordGuidedPracticeResult(expected,letter,correct)
    actual = guideAttempt(actual,letter,correct)
    assert.equal(actual.phase === 'gate-listen', src.isGuidedPracticeComplete(expected,pack))
    if (actual.phase === 'gate-listen') break
  }
  actual = continueGuide(actual)
  for (const [i,letter] of [...'ETETET'].entries()) {
    const correct = i !== 3
    expected = src.recordGuidedListenResult(expected,letter,correct)
    actual = guideAttempt(actual,letter,correct)
    assert.equal(actual.phase === 'gate-next', src.isGuidedListenComplete(expected,pack))
  }
  assert.deepEqual(actual.progress,expected)
})

test('interrupted Teach feedback resumes at the newly due letter', async () => {
  const { createGuide } = await import('../modules/web/guided.mjs')
  const map = new Map()
  const storage = {getItem:key => map.get(key) ?? null,setItem:(key,value) => map.set(key,value)}
  let timer
  const projected = []
  const g = createGuide({storage,
    setTimer:fn => { timer=fn; return 1 }, clearTimer:() => {},
    project:value => projected.push(value), decode:code => code==='.'?'E':'T',
    play:()=>{}, score:()=>{}, pick:pool=>pool[0], startListen:()=>{}, stopListen:()=>{}, lock:()=>{},
  })
  g.enter(true)
  g.accept('.')
  timer()
  g.accept('.')
  const stale = timer
  g.blocked(true)
  g.blocked(false)
  assert.equal(projected.filter(x=>x.startsWith('guide-target:')).at(-1),'guide-target:T')
  stale()
  assert.equal(projected.filter(x=>x.startsWith('guide-target:')).at(-1),'guide-target:T')
})

test('A/N review prior letters count for totals, not gates, and survive stored resume',()=>{
 let g=beginGuide(1)
 const initial=g
 assert.equal(round(g,'E'),initial)
 for(const letter of 'AANN')g=round(g,letter)
 g=continueGuide(g)
 assert.equal(round(g,'I'),g)
 for(const letter of 'ETETETETAA')g=round(g,letter)
 assert.equal(g.progress.practiceAttempts,10)
 assert.equal(g.phase,'practice')
 for(const letter of 'NN')g=round(g,letter)
 assert.equal(g.phase,'gate-listen')
 const accounts=new Map()
 const storage={getItem:k=>accounts.get(k)??null,setItem:(k,v)=>accounts.set(k,v)}
 assert.equal(saveGuide(storage,g),'saved')
 assert.deepEqual(readGuide(storage).data,g)
 g=continueGuide(g)
 for(const letter of 'ETETEA')g=round(g,letter)
 assert.equal(g.phase,'gate-retry')
 const retried=continueGuide(g)
 assert.equal(retried.progress.practiceAttempts,0)
 assert.equal(retried.progress.listenAttempts,0)
 assert.deepEqual(retried.progress.teachCounts,{A:2,N:2})
})

test('controller chooses prior Practice at .6 and current below, then Listen requires A,N before unlocked weighting', async()=>{
 const {createGuide}=await import('../modules/web/guided.mjs')
 let g=beginGuide(1)
 for(const letter of 'AANN')g=round(g,letter)
 g=continueGuide(g)
 const storageMap=new Map([[GUIDED_KEY,JSON.stringify({version:1,data:g})]])
 const storage={getItem:key=>storageMap.get(key)??null,setItem:(key,value)=>{storageMap.set(key,value)}}
 const output=[], draws=[], scores=[]
 let pending
 const random=[.6,.59999]
 const guide=createGuide({storage,setTimer:fn=>{pending=fn;return 1},clearTimer(){},project:v=>output.push(v),decode:x=>x,play(){},score:(...x)=>scores.push(x),pick:pool=>pool[0],
   random:()=>random.shift(),pickListenWeighted:(pool,previous)=>{draws.push([pool,previous]);return 'E'},
   startListen(){},stopListen(){},lock(){}})
 guide.enter(true)
 assert.equal(output.filter(x=>x.startsWith('guide-target:')).at(-1),'guide-target:E')
 guide.accept('E')
 pending()
 assert.equal(output.filter(x=>x.startsWith('guide-target:')).at(-1),'guide-target:A')
 assert.deepEqual(guide.pool(),['E','T','A','N'])
 assert.deepEqual(scores,[['E',true,'practice']])
 for(const letter of 'ETETANANAA')g=round(g,letter)
 assert.equal(g.phase,'gate-listen')
 const listenGuide=createGuide({storage:{...storage,getItem:()=>JSON.stringify({version:1,data:continueGuide(g)})},setTimer:()=>1,clearTimer(){},project(){},decode:x=>x,play(){},score:(...x)=>scores.push(x),pick:pool=>pool[0],
   pickListenWeighted:(pool,previous)=>{draws.push([pool,previous]);return 'E'},startListen(){},stopListen(){},lock(){}})
 listenGuide.enter(true)
 assert.equal(listenGuide.pickListen(), 'A')
 listenGuide.recordListen('I',true,2)
 assert.equal(scores.length,1)
 listenGuide.recordListen('A',false,100)
 assert.equal(listenGuide.pickListen('A'), 'A')
 listenGuide.recordListen('A',true,100)
 assert.equal(listenGuide.pickListen('A'), 'N')
 listenGuide.recordListen('N',true,100)
 assert.equal(listenGuide.pickListen('N'), 'E')
 assert.deepEqual(draws,[[['E','T','A','N'],'N']])
})

test('unlocked ordering and measured-latency weighting match direct shipped helpers',async()=>{
 const {execFileSync}=await import('node:child_process')
 const bun='/Users/tylr/Code/exact-spike-toolchain/.spike-tools/bun-darwin-aarch64/bun'
 const source='/Users/tylr/Code/dit/packages/core/src/utils'
 const {guideUnlocked,guidePracticePool}=await import('../modules/web/guided.mjs')
 const {pickLatencyAware}=await import('../modules/web/progression.mjs')
 const rolls=[0,.001,.08,.2,.4,.5,.6,.8,.99999]
 const scores={A:5,N:6,E:-3,T:-3}
 const ttr={A:{samples:5,averageMs:2300},E:{samples:4,averageMs:9999},T:{samples:40,averageMs:2100}}
 const result=JSON.parse(execFileSync(bun,['-e',`
   import {getGuidedPracticePool} from '${source}/appState.ts';
   import {getRandomLatencyAwareLetter} from '${source}/morseUtils.ts';
   const pools=Array.from({length:14},(_,i)=>getGuidedPracticePool(i));
   const draws=${JSON.stringify(rolls)}.map(r=>{
     Math.random=()=>r;return getRandomLatencyAwareLetter(pools[1].unlockedLetters,${JSON.stringify(scores)},${JSON.stringify(ttr)},'E');
   });console.log(JSON.stringify({pools,draws}));
 `],{encoding:'utf8'}))
 for(const [i,pool] of result.pools.entries()){
   const state=beginGuide(i)
   assert.deepEqual(guideUnlocked(state),pool.unlockedLetters)
   assert.deepEqual(guidePracticePool(state,.59999),pool.currentPack)
   assert.deepEqual(guidePracticePool(state,.6),i?pool.reviewPool:pool.currentPack)
 }
 assert.deepEqual(rolls.map(r=>pickLatencyAware(['E','T','A','N'],scores,ttr,'E',r)),result.draws)
})

test('saved A/N review counts reject future letters and prior Teach counts',()=>{
 let g=beginGuide(1)
 for(const letter of 'AANN')g=round(g,letter)
 g=continueGuide(g)
 g=round(g,'T')
 const parse=data=>readGuide({getItem:()=>JSON.stringify({version:1,data})})
 assert.equal(parse(g).status,'saved')
 assert.equal(parse({...g,progress:{...g.progress,practiceLetterCorrect:{I:1}}}).status,'damaged')
 assert.equal(parse({...g,progress:{...g.progress,teachCounts:{A:2,N:2,E:1}}}).status,'damaged')
})

test('final qualifying sixth Listen miss completes after normal reveal and clears lesson counters',async()=>{
 const {createGuide}=await import('../modules/web/guided.mjs')
 const last=GUIDED_PACKS.length-1
 let g=beginGuide(last)
 for(const letter of '6677889900')g=round(g,letter)
 g=continueGuide(g)
 for(const letter of '6677889900')g=round(g,letter)
 g=continueGuide(g)
 for(const letter of '67890')g=round(g,letter)
 g=round(g,'6',false)
 assert.equal(g.phase,'gate-next')
 const completed=continueGuide(g)
 assert.equal(completed.phase,'complete')
 assert.equal(completed.maxPackReached,14)
 assert.deepEqual(completed.progress,beginGuide(last).progress)
 const raw=new Map()
 const storage={getItem:k=>raw.get(k)??null,setItem:(k,v)=>raw.set(k,v)}
 assert.equal(saveGuide(storage,completed),'saved')
 assert.deepEqual(readGuide(storage).data,completed)
 // Prior experimental completed shape: actual validated populated counters.
 raw.set(GUIDED_KEY,JSON.stringify({version:1,data:{...g,phase:'complete'}}))
 assert.deepEqual(readGuide(storage).data,completed)
 // Wrong on sixth can still fail the per-current-letter minimum.
 raw.clear()
 let fail=beginGuide(last)
 for(const letter of '6677889900')fail=round(fail,letter)
 fail=continueGuide(fail)
 for(const letter of '6677889900')fail=round(fail,letter)
 fail=continueGuide(fail)
 for(const letter of '66789')fail=round(fail,letter)
 assert.equal(round(fail,'0',false).phase,'gate-retry')
})

for(const interrupted of [false,true])test('live final Listen records the sixth miss once and finalizes '+(interrupted?'after reveal interruption':'after normal reveal')+'; restored course never restarts',async()=>{
 const {createGuide}=await import('../modules/web/guided.mjs')
 const {createListen}=await import('../modules/web/listen.mjs')
 const last=GUIDED_PACKS.length-1
 let data=beginGuide(last)
 for(const letter of '6677889900')data=round(data,letter)
 data=continueGuide(data)
 for(const letter of '6677889900')data=round(data,letter)
 data=continueGuide(data)
 for(const letter of '67890')data=round(data,letter)
 const map=new Map([[GUIDED_KEY,JSON.stringify({version:1,data})]])
 const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}
 const events=[], records=[], pending=[]
 const timer={setTimer:(fn,ms)=>{pending.push({fn,ms});return fn},clearTimer(){}}
 const guide=createGuide({storage,...timer,project:v=>events.push(v),decode:x=>x,play(){},score:(...x)=>records.push(x),pick:pool=>pool[0],
   startListen:()=>listen.enter(),stopListen:()=>listen.exit(),lock(){},completed:()=>events.push('celebrate')})
 const listen=createListen({...timer,play:letter=>events.push('audio:'+letter),stop(){},project:v=>events.push(v),
   record:(...x)=>guide.recordListen(...x),pick:previous=>guide.pickListen(previous),getPool:()=>guide.pool(),
   isGuided:()=>true,onRoundEnd:()=>guide.finishListenRound()})
 guide.enter(true)
 assert.equal(listen.answer('7'),true) // Known first unlocked target E, distractor7.
 assert.equal(records[0][0],'E')
 assert.deepEqual(records,[['E',false,'listen',null]])
 assert.ok(!events.includes('celebrate'))
 const reveal=pending.find(t=>t.ms===2000)
 assert.ok(reveal)
 if(interrupted){
   guide.blocked(true)
   reveal.fn()
   assert.ok(!events.includes('celebrate'))
   guide.blocked(false)
 }
 reveal.fn();reveal.fn()
 assert.equal(events.filter(e=>e==='celebrate').length,1)
 assert.deepEqual(events.filter(e=>e.startsWith('audio:')),['audio:E'])
 const saved=readGuide(storage)
 assert.equal(saved.data.maxPackReached,14)
 assert.equal(saved.migrated,undefined)
 const restored=createGuide({storage,...timer,project:v=>events.push(v),completed:()=>events.push('unexpected')})
 assert.equal(restored.completed(),true)
 assert.equal(restored.enter(true),false)
 assert.ok(!events.includes('unexpected'))
})

test('completed course enables 36 regular Practice and Listen symbols without changing scores or settings',async()=>{
 const {initialSession,stepSession}=await import('../modules/web/session.mjs')
 const before=initialSession({scores:{E:5},settings:{pitch:620}})
 const complete=stepSession(before,{type:'courseComplete'}).state
 assert.equal(new Set(complete.studyPool).size,36)
 assert.ok(complete.studyPool.includes('J'))
 assert.strictEqual(complete.scores,before.scores)
 assert.deepEqual(complete.settings,{...before.settings,selection:{kind:"tier",level:4}})
 let listening=stepSession(complete,{type:'mode',mode:'listen'}).state
 listening=stepSession(listening,{type:'listenScore',letter:'J',correct:true,sample:250}).state
 assert.equal(listening.scores.J,1)
 assert.equal(listening.listenTtr.J.averageMs,250)
 assert.equal(new Set(initialSession({},true).studyPool).size,36)
})

test('all source packs can be selected, any selection resets lesson only and preserves high-water',async()=>{
 const {selectGuidePack,guideReached}=await import('../modules/web/guided.mjs')
 const initial=continueGuide(practiced())
 const skip=selectGuidePack(initial,13)
 assert.equal(skip.pack,13)
 assert.equal(skip.phase,'teach')
 assert.deepEqual(skip.progress,beginGuide(13).progress)
 assert.equal(guideReached(skip),13)
 const lower=selectGuidePack(round(skip,'6'),1)
 assert.equal(lower.pack,1)
 assert.equal(guideReached(lower),13)
 assert.deepEqual(selectGuidePack(round(lower,'A'),1).progress,beginGuide(1).progress)
 assert.strictEqual(selectGuidePack(lower,14),lower)
 const storage={getItem:()=>JSON.stringify({version:1,data:lower})}
 assert.deepEqual(readGuide(storage).data,lower)
})

test('reselection cancels a stale guided callback and Resume keeps the selected pack progress',async()=>{
 const {createGuide}=await import('../modules/web/guided.mjs')
 const map=new Map()
 const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}
 let stale
 const log=[]
 const create=()=>createGuide({storage,setTimer:fn=>{stale=fn;return 1},clearTimer(){},project:v=>log.push(v),
   decode:letter=>letter,play(){},score(){throw Error('Teach cannot score')},pick:pool=>pool[0],startListen(){},stopListen(){},lock(){}})
 let g=create()
 g.enter(true)
 g.accept('E')
 const callback=stale
 assert.equal(g.selectPack(1),true)
 callback()
 assert.equal(log.filter(x=>x.startsWith('guide-target:')).at(-1),'guide-target:A')
 assert.deepEqual(readGuide(storage).data.progress.teachCounts,{})
 g.accept('A')
 stale()
 const prior=map.get(GUIDED_KEY)
 g.leave()
 g=create()
 g.enter(true)
 assert.equal(map.get(GUIDED_KEY),prior)
 assert.deepEqual(readGuide(storage).data.progress.teachCounts,{A:1})
 assert.equal(log.filter(x=>x.startsWith('guide-target:')).at(-1),'guide-target:A')
})

test('course high-water validates old inferred progress and prevents replay revoking graduation',async()=>{
 const {guideReached,selectGuidePack}=await import('../modules/web/guided.mjs')
 const raw=data=>({getItem:()=>JSON.stringify({version:1,data})})
 const legacy=beginGuide(5)
 const restored=readGuide(raw(legacy))
 assert.equal(restored.status,'saved')
 assert.equal(guideReached(restored.data),5)
 assert.equal(Object.hasOwn(restored.data,'maxPackReached'),false)
 assert.equal(readGuide(raw({...legacy,maxPackReached:4})).status,'damaged')
 assert.equal(readGuide(raw({...legacy,maxPackReached:15})).status,'damaged')
 const replay=selectGuidePack({pack:13,phase:'complete',maxPackReached:14},1)
 assert.equal(readGuide(raw(replay)).data.maxPackReached,14)
 assert.equal(guideReached(replay),14)
})

test('unknown guide v1 phase and nested structural fields survive attempting pack selection byte-for-byte',async()=>{
 const {createGuide}=await import('../modules/web/guided.mjs')
 for(const customize of [
   snapshot=>{snapshot.data.phase='future-phase'},
   snapshot=>{snapshot.meta={origin:'future'}},
   snapshot=>{snapshot.data.unlockRules={review:true}},
   snapshot=>{snapshot.data.progress.extendedAttempts=25},
 ]){
   const snapshot={version:1,data:beginGuide(1)}
   customize(snapshot)
   const original=JSON.stringify(snapshot,null,2)
   let bytes=original
   let writes=0
   const storage={getItem:()=>bytes,setItem:(_,next)=>{writes++;bytes=next}}
   assert.equal(readGuide(storage).status,'unsupported')
   const guide=createGuide({storage,project(){},clearTimer(){},lock(){}})
   guide.enter(true)
   assert.equal(guide.selectPack(0),true)
   assert.equal(writes,0)
   assert.equal(bytes,original)
 }
})
