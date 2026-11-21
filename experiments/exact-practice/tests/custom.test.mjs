import assert from 'node:assert/strict'
import test from 'node:test'
import { createCustom, customPlan, CUSTOM_KEY } from '../modules/web/custom.mjs'
const fake = (clock = {}) => {
  const map=new Map([['dit-progress','sentinel']])
  const jobs=[]
  const events=[]
  const mp={getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)}
  const custom=createCustom({storage:mp,project:s=>events.push(s),play:(text,done,fail)=>jobs.push({text,done,fail}),stop:()=>{},pause:clock.pause ?? (()=>Promise.resolve()),resume:clock.resume ?? (()=>Promise.resolve())})
  return {custom,jobs,events,map}
}
const last = (events,key) => events.filter(value=>value.startsWith(key+':')).at(-1)?.slice(key.length+1)
test('custom plan distinguishes intra-character, Farnsworth character, and seven-unit word gaps',()=>{
  assert.deepEqual(customPlan('ET E',12,8),[[0,100],[796,1096],[2720,2820]])
  assert.deepEqual(customPlan('E T',12,12),[[0,100],[800,1100]])
})
test('sanitizes/saves passage, hides until explicit Reveal, never persists copy',()=>{
  const {custom,jobs,events,map}=fake()
  custom.enter()
  custom.save(' et!\t  e ')
  assert.equal(last(events,'custom-phase'),'setup')
  assert.equal(last(events,'custom-reveal'),'')
  assert.equal(JSON.parse(map.get(CUSTOM_KEY)).text,'ET E')
  custom.play()
  custom.copy('ET X')
  jobs[0].done()
  assert.equal(last(events,'custom-phase'),'ended')
  assert.equal(last(events,'custom-reveal'),'')
  custom.reveal()
  assert.equal(last(events,'custom-reveal'),'ET E')
  assert.equal(last(events,'custom-summary'),'3/4 matched · 1 missed · 1 extra')
  assert.equal(map.get(CUSTOM_KEY).includes('ET X'),false)
  assert.equal(map.get('dit-progress'),'sentinel')
})
test('pause blocks copy, resume continues same operation, and restart invalidates stale completion',async()=>{
  const {custom,jobs,events}=fake()
  custom.enter();custom.save('ET');custom.play()
  custom.copy('E')
  await custom.pause()
  assert.equal(last(events,'custom-phase'),'paused')
  assert.equal(custom.copy('WRONG'),false)
  await custom.resume()
  assert.equal(last(events,'custom-phase'),'playing')
  assert.equal(jobs.length,1)
  custom.play()
  jobs[0].done()
  assert.equal(last(events,'custom-phase'),'playing')
  assert.equal(last(events,'custom-copy'),'')
  custom.leave()
  jobs[1].done()
  assert.notEqual(last(events,'custom-phase'),'ended')
})
test('listen-only Reveal skips typed scoring and saved passage is cleared deliberately',()=>{
  const {custom,jobs,events,map}=fake()
  custom.enter();custom.save('ET',false);custom.play()
  assert.equal(custom.copy('ET'),false)
  jobs[0].done();custom.reveal()
  assert.equal(last(events,'custom-summary'),'')
  custom.clear()
  assert.equal(JSON.parse(map.get(CUSTOM_KEY)).text,'')
})


test('an old pause rejection cannot disarm a newer pause',async()=>{
  const pending=[]
  const {custom,events}=fake({pause:()=>new Promise((resolve,reject)=>pending.push({resolve,reject}))})
  custom.enter();custom.save('ET');custom.play()
  const first=custom.pause()
  await custom.resume()
  const second=custom.pause()
  pending[0].reject(new Error('earlier operation failed'))
  await first
  assert.equal(last(events,'custom-phase'),'paused')
  pending[1].resolve()
  await second
  assert.equal(last(events,'custom-phase'),'paused')
})

test('generated sanitizer and LCS diff agree with shipped helpers on Unicode, clipping and errors',async()=>{
  const {execFileSync}=await import('node:child_process')
  const bun='/Users/tylr/Code/exact-spike-toolchain/.spike-tools/bun-darwin-aarch64/bun'
  const utils='/Users/tylr/Code/dit/packages/core/src/utils'
  const cases=[' A!🐰  B\né ','ABC '.repeat(800),'  et  E! 🐰 ', 'A\tB\rC']
  const pairs=[['ET E','ET T'],['ABBC','ABC!'],['EEE','E'],['','X']]
  const payload=JSON.stringify({cases,pairs})
  const expected=JSON.parse(execFileSync(bun,['-e',`
    import {normalizeCustomText as normalize} from '${utils}/customListenText.ts';
    import {customListenDiff as diff} from '${utils}/customListenDiff.ts';
    const {cases,pairs}=JSON.parse(process.argv[1]);
    console.log(JSON.stringify({normal:cases.map(x=>normalize(x)),diff:pairs.map(x=>diff(...x))}));
  `,payload],{encoding:'utf8'}))
  const {normalizeCustomText:normalize}=await import('../modules/web/custom-text.generated.mjs')
  const {customListenDiff:diff}=await import('../modules/web/custom-diff.generated.mjs')
  assert.deepEqual({normal:cases.map(x=>normalize(x)),diff:pairs.map(x=>diff(...x))},expected)
})
