import assert from 'node:assert/strict'
import test from 'node:test'
import { readNux, createNux, NUX_KEY } from '../modules/web/nux.mjs'

function fixture(entries=[]){
 const map=new Map(entries),events=[],timers=new Map(),audio=[]
 let next=0
 const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}
 const nux=createNux({storage,project:s=>events.push(s),play:()=>audio.push('dit'),stop:()=>{},warm:()=>events.push('warm-before-tutorial'),
   setTimer:(fn,ms)=>{timers.set(++next,{fn,ms});return next},clearTimer:id=>timers.delete(id)})
 return {nux,map,events,timers,audio,storage}
}
const last=(events,key)=>events.filter(e=>e.startsWith(key+':')).at(-1)?.slice(key.length+1)
function tutorial(nux, profile='beginner'){
 nux.act('start'); nux.act(profile)
 for(let i=0;i<3;i++)nux.act('continue')
 nux.act('play');nux.act('heard');nux.act('continue')
}
test('beginner traverses actual sound confirmation and three short plus three long inputs',()=>{
 const {nux,events,timers,audio,map}=fixture()
 nux.project()
 tutorial(nux)
 assert.deepEqual(audio,['dit'])
 assert.equal(last(events,'nux-step'),'button_tutorial')
 for(const symbol of '...--')nux.symbol(symbol)
 assert.equal(timers.size,0)
 nux.symbol('-')
 const timer=[...timers.values()].at(-1)
 assert.equal(timer.ms,600)
 timer.fn()
 assert.equal(last(events,'nux-step'),'beginner_stages')
 nux.act('continue');nux.act('continue')
 assert.equal(last(events,'nux-status'),'completed')
 assert.equal(last(events,'nux-enter'),'guided')
 assert.equal(JSON.parse(map.get(NUX_KEY)).profile,'beginner')
})
test('sound troubleshooting holds and back resets tutorial counters without synthetic completion',()=>{
 const {nux,events,timers}=fixture()
 nux.act('start');nux.act('known')
 nux.act('continue');nux.act('continue');nux.act('continue')
 nux.act('continue')
 assert.equal(last(events,'nux-step'),'sound_check')
 nux.act('play');nux.act('no-sound');nux.act('continue')
 assert.equal(last(events,'nux-step'),'sound_check')
 nux.act('play');nux.act('heard');nux.act('continue')
 for(const symbol of '...---')nux.symbol(symbol)
 const stale=[...timers.values()].at(-1).fn
 nux.act('back');stale()
 assert.equal(last(events,'nux-step'),'sound_check')
 nux.act('continue')
 assert.equal(last(events,'nux-taps'),'0')
 assert.equal(last(events,'nux-holds'),'0')
})
test('back/skip/replay and reload preserve explicit experiment NUX without touching a saved practice snapshot',()=>{
 const marker='{"version":1,"settings":{"speed":22}}'
 const progressKey='dit.exact-spike.practice.v1'
 const {nux,map,storage,events}=fixture([[progressKey,marker],['dit-progress','production sentinel']])
 assert.equal(readNux(storage).status,'skipped')
 assert.equal(map.has(NUX_KEY),false)
 nux.act('replay');tutorial(nux,'known');nux.symbol('.')
 assert.equal(readNux(storage).status,'pending')
 assert.equal(readNux(storage).taps,1)
 nux.act('skip')
 assert.equal(readNux(storage).status,'skipped')
 assert.equal(last(events,'nux-enter'),'practice')
 assert.equal(map.get(progressKey),marker)
 assert.equal(map.get('dit-progress'),'production sentinel')
})
test('known path starts its tour only after real three taps and holds; completion enters Practice',()=>{
 const {nux,events,timers}=fixture()
 tutorial(nux,'known')
 for(const symbol of '...---')nux.symbol(symbol)
 ;[...timers.values()].at(-1).fn()
 assert.equal(last(events,'nux-step'),'known_tour')
 assert.equal(last(events,'nux-tour'),'0')
 nux.act('tour-next')
 assert.equal(last(events,'nux-tour'),'1')
 nux.act('tour-next')
 assert.equal(last(events,'nux-tour'),'2')
 assert.notEqual(last(events,'nux-status'),'completed')
 nux.act('tour-next')
 assert.equal(last(events,'nux-enter'),'practice')
})

test('explicit pending overrides legacy state, cold Welcome can resume exact saved step without a save',()=>{
 const raw=JSON.stringify({version:1,status:'pending',step:'button_tutorial',profile:'beginner',soundComplete:true,taps:2,holds:1})
 const {nux,map,events}=fixture([['dit.exact-spike.practice.v1','old choice'],[NUX_KEY,raw]])
 nux.project()
 assert.equal(last(events,'nux-status'),'pending')
 assert.equal(last(events,'nux-step'),'welcome')
 assert.equal(last(events,'nux-resume'),'1')
 assert.equal(last(events,'nux-taps'),'2')
 assert.equal(last(events,'nux-holds'),'1')
 assert.equal(map.get(NUX_KEY),raw)
 nux.act('resume')
 assert.equal(last(events,'nux-step'),'button_tutorial')
 assert.equal(map.get('dit.exact-spike.practice.v1'),'old choice')
})

test('denied reads or writes make setup visibly memory-only while users can keep going',()=>{
 for(const storage of [
  {getItem(){throw Error('denied read')},setItem(){throw Error('denied write')}},
  {getItem(){return null},setItem(){throw Error('denied write')}},
 ]){
  const events=[]
  const nux=createNux({storage,project:s=>events.push(s),play:()=>{},stop:()=>{},setTimer:()=>1,clearTimer:()=>{}})
  nux.project()
  nux.act('start')
  assert.equal(last(events,'nux-step'),'profile')
  assert.equal(last(events,'nux-storage'),'unavailable')
 }
})

test('a future onboarding schema is visibly protected and survives replay/skip byte-for-byte',()=>{
 const raw='{"version":400,"sentinel":"do not rewrite"}'
 const {nux,map,events}=fixture([[NUX_KEY,raw]])
 nux.project()
 assert.equal(last(events,'nux-storage'),'unsupported')
 nux.act('replay');nux.act('skip')
 assert.equal(last(events,'nux-storage'),'unsupported')
 assert.equal(map.get(NUX_KEY),raw)
})


test('known tour Back follows real stop order; Back from first resets key exercise',()=>{
 const {nux,events,timers,map}=fixture()
 tutorial(nux,'known')
 for(const symbol of '...---')nux.symbol(symbol)
 ;[...timers.values()].at(-1).fn()
 nux.act('tour-next');nux.act('tour-next')
 assert.equal(last(events,'nux-tour'),'2')
 nux.act('back')
 assert.equal(last(events,'nux-tour'),'1')
 assert.equal(JSON.parse(map.get(NUX_KEY)).tourIndex,undefined)
 nux.act('back')
 assert.equal(last(events,'nux-tour'),'0')
 nux.act('back')
 assert.equal(last(events,'nux-step'),'button_tutorial')
 assert.equal(last(events,'nux-taps'),'0')
 assert.equal(last(events,'nux-holds'),'0')
 assert.equal(last(events,'nux-status'),'pending')
})

test('a final-only storage denial reports unsaved setup after leaving onboarding',async()=>{
 const map=new Map(),events=[]
 let deny=false
 const storage={getItem:key=>map.get(key)??null,setItem:(key,value)=>{if(deny)throw Error('denied');map.set(key,value)}}
 const nux=createNux({storage,project:s=>events.push(s),play:()=>{},stop:()=>{},setTimer:()=>1,clearTimer:()=>{}})
 nux.act('start')
 assert.equal(readNux(storage).status,'pending')
 assert.equal(last(events,'nux-storage'),'saved')
 deny=true
 nux.act('skip')
 assert.equal(last(events,'nux-status'),'skipped')
 assert.equal(last(events,'nux-storage'),'unavailable')
 assert.equal(readNux(storage).status,'pending')
 const {readFile}=await import('node:fs/promises')
 const contract=await readFile(new URL('../app.contract',import.meta.url),'utf8')
 assert.match(contract,/if desk and nuxStorage == "unavailable"\n\s+text [^\n]+testId="nux-save-warning"/)
})


test('explicit known tour Back warms the cold audio graph before the real key becomes visible',()=>{
 const seed=JSON.stringify({version:1,status:'pending',step:'known_tour',profile:'known',soundComplete:true,taps:3,holds:3})
 const {nux,events}=fixture([[NUX_KEY,seed]])
 nux.project()
 assert.ok(!events.includes('warm-before-tutorial'))
 nux.act('resume')
 assert.ok(!events.includes('warm-before-tutorial'))
 nux.act('back')
 assert.deepEqual(events.filter(x=>x==='warm-before-tutorial'||x==='nux-step:button_tutorial'),
   ['warm-before-tutorial','nux-step:button_tutorial'])
})
