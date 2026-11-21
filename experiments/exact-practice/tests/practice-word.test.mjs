import test from 'node:test'
import assert from 'node:assert/strict'
import {initialSession, stepSession} from '../modules/web/session.mjs'
import {convertLegacy} from '../core/apple-session.mjs'
import {STORE_KEY, loadPractice} from '../modules/web/practice-store.mjs'

function open(options={}) {
  let state=initialSession({settings:{selection:{kind:'custom',letters:['A','E','T']},strategy:'sequential',...options}})
  const act=(type,fields={})=>{ state=stepSession(state,{type,roll:0,...fields}).state; return state }
  act('preference',{command:'practice-words-on'})
  return {act,get state(){return state}}
}
test('Practice Words selects from shipped words, advances each correct letter immediately and times from the first symbol',()=>{
  const app=open()
  assert.equal(app.state.practiceWord,'TEA')
  assert.equal(app.state.target,'T')
  app.act('toneStart',{monoMs:800})
  app.act('symbol',{monoMs:1000})
  app.act('sequence',{code:'-',atMs:50000,monoMs:1700})
  assert.equal(app.state.target,'E')
  assert.equal(app.state.practiceIndex,1)
  app.act('sequence',{code:'.',atMs:50100,monoMs:2300})
  assert.equal(app.state.target,'A')
  app.act('sequence',{code:'.-',atMs:50200,monoMs:4000})
  assert.equal(app.state.practiceWord,'EAT')
  assert.equal(app.state.practiceIndex,0)
  assert.equal(app.state.practiceWpm,12)
  assert.equal(app.state.bestWpm,12)
  assert.equal(app.state.history.length,3)
  assert.equal(app.state.settings.words,false)
})
test('first-symbol clock cancels at a boundary; IFR retry or timeout advances exactly the intended letter',()=>{
  const app=open({ifr:true})
  app.act('symbol',{monoMs:100})
  app.act('sequence',{code:'.',atMs:1,monoMs:200})
  assert.equal(app.state.practiceIndex,0)
  app.act('symbol',{monoMs:260})
  assert.equal(app.state.outcome,null)
  app.act('feedbackElapsed',{monoMs:1200})
  assert.equal(app.state.practiceIndex,0)
  app.act('sequence',{code:'.',atMs:2,monoMs:1500})
  app.act('feedbackElapsed',{monoMs:2500})
  assert.equal(app.state.practiceIndex,1)
  app.act('cancel')
  app.act('sequence',{code:'.',monoMs:3000})
  app.act('sequence',{code:'.-',monoMs:3500})
  assert.equal(app.state.bestWpm,undefined)
  const slow=open({ifr:false})
  slow.act('sequence',{code:'.'})
  slow.act('feedbackElapsed')
  assert.equal(slow.state.target,'T')
  slow.act('selection',{selection:{kind:'custom',letters:['Z']}})
  assert.equal(slow.state.practiceWord,'Z')
  slow.act('mode',{mode:'guided'})
  assert.equal(slow.state.settings.practiceWords,false)
})
test('imports independent Freestyle and Practice word settings and existing best WPM losslessly',()=>{
  const files=convertLegacy({'dit-nux-status':'skipped','dit-progress':JSON.stringify({wordMode:false,practiceWordMode:true,bestWpm:19.7})})
  const saved=loadPractice({getItem:key=>files[key]??null})
  assert.equal(saved.status,'saved')
  assert.equal(saved.data.settings.practiceWords,true)
  assert.equal(saved.data.settings.words,false)
  assert.equal(saved.data.bestWpm,19.7)
  assert.equal(JSON.parse(files[STORE_KEY]).bestWpm,19.7)
})

test('Apple immediately sounds the next word letter and restores older imported word settings without lowering best WPM',async()=>{
  const {create}=await import('../core/apple-session.mjs')
  const saved=new Map([
    ['dit.exact-spike.onboarding.v1',JSON.stringify({version:1,status:'completed',step:'welcome',profile:'known'})],
    ['dit.exact-spike.legacy.v1',JSON.stringify({version:1,preserved:{practiceWordMode:true,bestWpm:22.8}})],
    [STORE_KEY,JSON.stringify({version:1,settings:{selection:{kind:'custom',letters:['A','E','T']}},scores:{},history:[]})],
  ])
  const messages=[],tones=[]
  const session=create({
    read:k=>saved.has(k)?['ok',saved.get(k)]:['missing'],write:(k,v)=>{saved.set(k,v);return true},
    play:plan=>{tones.push(plan);return true},monotonicMs:()=>1000,project:m=>messages.push(m),
    stop(){},warm(){},cancelInput(){},schedule(){},cancelTimer(){},outputVolume:()=>1,syncReminder(){},
  })
  session.setProps({mode:'boot',blocked:'false'})
  session.bootstrap()
  session.setProps({mode:'practice',blocked:'false'})
  const word=messages.filter(x=>x.startsWith('practiceWord:')).at(-1).slice(13)
  assert.ok(['TEA','EAT'].includes(word))
  const code=word[0]==='E'?'.':'-'
  const before=tones.length
  session.input('symbol',code);session.input('sequence',code)
  assert.equal(tones.length,before+1)
  assert.equal(JSON.parse(saved.get(STORE_KEY)).bestWpm,22.8)
  session.dispose()
})
