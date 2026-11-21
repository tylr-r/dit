import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeTempo, tempoStep, tempoTiming } from '../modules/web/tempo.mjs'
import { initialSession, stepSession } from '../modules/web/session.mjs'
import { loadPractice, STORE_KEY } from '../modules/web/practice-store.mjs'

test('defaults and migration preserve 12/8 baseline and clamp independent effective speed',()=>{
  assert.deepEqual(normalizeTempo({}),{speed:12,effectiveSpeed:8,autoTighten:true,autoCorrect:0})
  const storage={getItem:key=> key===STORE_KEY ? JSON.stringify({version:1,settings:{speed:17},scores:{T:3},history:[]}) : null}
  const {data,status}=loadPractice(storage)
  assert.equal(status,'saved')
  assert.equal(data.settings.effectiveSpeed,13)
  assert.deepEqual(data.scores,{T:3})
  assert.equal(normalizeTempo({speed:10,effectiveSpeed:29,autoTighten:false}).effectiveSpeed,10)
})
test('manual controls preserve the independently selected setting unless clamped and disable auto',()=>{
  let settings=normalizeTempo({})
  settings=tempoStep(settings,'speed-up')
  assert.equal(settings.speed,13)
  assert.equal(settings.effectiveSpeed,8)
  assert.equal(settings.autoTighten,false)
  settings=tempoStep(settings,'effective-down')
  assert.equal(settings.effectiveSpeed,7)
  settings=tempoStep(settings,'effective-down')
  assert.equal(tempoStep(settings,'effective-down'),settings)
})
test('auto tightens only eligible correct character/guide listen attempts at 12 and 24',()=>{
  let s=stepSession(initialSession(),{type:'mode',mode:'listen'}).state
  const score=(correct=true)=>{s=stepSession(s,{type:'listenScore',letter:'T',correct}).state}
  for(let i=0;i<11;i++)score()
  score(false)
  assert.equal(s.settings.effectiveSpeed,8)
  score()
  assert.equal(s.settings.effectiveSpeed,10)
  for(let i=0;i<12;i++)score()
  assert.equal(s.settings.effectiveSpeed,12)
  assert.equal(s.settings.autoCorrect,24)
  const manual=stepSession(s,{type:'preference',command:'effective-down'}).state
  assert.equal(manual.settings.autoTighten,false)
  s=manual;score()
  assert.equal(s.settings.autoCorrect,24)
  s=stepSession(s,{type:'preference',command:'toggle-auto-tighten'}).state
  assert.equal(s.settings.effectiveSpeed,12)
  s=stepSession(s,{type:'mode',mode:'guided'}).state
  s=stepSession(s,{type:'guidedScore',letter:'E',correct:true,mode:'listen'}).state
  assert.equal(s.settings.autoCorrect,25)
  s=stepSession(s,{type:'guidedScore',letter:'E',correct:true,mode:'practice'}).state
  assert.equal(s.settings.autoCorrect,25)
})
test('Farnsworth speeds alter only scheduled character and word spacing, never character pulses',()=>{
  assert.deepEqual(tempoTiming(12,8),{unitMs:100,characterGapMs:696,wordGapMs:1624})
  assert.deepEqual(tempoTiming(12,12),{unitMs:100,characterGapMs:300,wordGapMs:700})
  assert.equal(tempoTiming(17,10).unitMs,71)
})


test('auto boundaries and all ear timing units match unchanged shipped helpers',async()=>{
  const {execFileSync}=await import('node:child_process')
  const bun='/Users/tylr/Code/exact-spike-toolchain/.spike-tools/bun-darwin-aarch64/bun'
  const source='/Users/tylr/Code/dit/packages/core/src/utils/listenSpeed.ts'
  const expected=JSON.parse(execFileSync(bun,['-e',`
    import {getAutoEffectiveWpm as auto,getListenUnitMs as unit,getFarnsworthUnitMs as spacing} from '${source}';
    const rows=[10,12,17,30].flatMap(speed=>[0,11,12,23,24,25].map(count=>{
      const e=auto(speed,count);
      return [speed,count,e,unit(speed,40),spacing(speed,e,40)];
    }));
    console.log(JSON.stringify(rows));
  `],{encoding:'utf8'}))
  for (const [speed,autoCorrect,effective,unit,spacing] of expected) {
    assert.equal(normalizeTempo({speed,autoCorrect}).effectiveSpeed,effective)
    assert.deepEqual(tempoTiming(speed,effective),{unitMs:unit,characterGapMs:spacing*3,wordGapMs:spacing*7})
  }
})
