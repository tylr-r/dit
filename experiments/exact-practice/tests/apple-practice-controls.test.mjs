import assert from 'node:assert/strict'
import test from 'node:test'
import { initialSession, stepSession } from '../modules/web/session.mjs'
import { create } from '../core/apple-session.mjs'

test('Practice controls preserve queue, feedback and target according to the shipped control that changed', () => {
  const base = initialSession({settings:{strategy:'weighted', ifr:true, reviewMisses:true}})
  const active = {...base, target:base.studyPool.at(-1),feedback:'Try again',outcome:'wrong',reviewQueue:['E']}
  const change = (state, control, enabled) => stepSession(state, {type:'practiceControl',control,enabled})
  const ordered = change(active,'sequential',true)
  assert.equal(ordered.state.target,base.studyPool[0])
  assert.equal(ordered.state.settings.strategy,'sequential')
  assert.equal(ordered.state.outcome,null)
  assert.equal(ordered.effects[0].type,'cancelFeedback')
  assert.equal(change(ordered.state,'sequential',true).state,ordered.state)
  const word = {...active,settings:{...active.settings,practiceWords:true}}
  assert.equal(change(word,'sequential',true).state,word)
  const noReview = change(active,'review',false).state
  assert.deepEqual(noReview.reviewQueue,[])
  assert.equal(noReview.outcome,'wrong')
  const noRecovery = change(active,'ifr',false).state
  assert.equal(noRecovery.settings.ifr,false)
  assert.equal(noRecovery.settings.reviewMisses,true)
  assert.deepEqual(noRecovery.reviewQueue,[])
  assert.equal(noRecovery.outcome,null)
  assert.equal(change(noRecovery,'review',false).state,noRecovery)
  const listen={...active,mode:'listen'}
  assert.equal(change(listen,'sequential',true).state.target,listen.target)
})

test('Apple gates disabled, hidden and stale Practice settings commands and persists a user change', () => {
  const data = new Map(), key='dit.exact-spike.practice.v1'
  data.set('dit.exact-spike.onboarding.v1',JSON.stringify({version:1,status:'skipped',step:'welcome'}))
  data.set(key,JSON.stringify({version:1,settings:{ifr:true,reviewMisses:true,strategy:'weighted'},scores:{E:3},history:[]}))
  const session=create({read:k=>data.has(k)?['ok',data.get(k)]:['missing'],write:(k,v)=>{data.set(k,v);return true},
    project(){},outputVolume:()=>1,schedule(){},cancelTimer(){},warm(){},stop(){},cancelInput(){},syncReminder(){},play(){return true}})
  let props={mode:'boot',blocked:'false','settings-open':'false','pref-token':'0'}
  const patch=partial=>{props={...props,...partial};session.setProps(props)}
  const set=command=>patch({'pref-token':String(Number(props['pref-token'])+1),'pref-command':command})
  const saved=()=>JSON.parse(data.get(key)).settings
  patch({});session.bootstrap();patch({mode:'practice'})
  set('ifr-off');assert.equal(saved().ifr,true)
  patch({blocked:'true','settings-open':'true'})
  set('ifr-off');assert.equal(saved().ifr,false)
  set('review-off');assert.equal(saved().reviewMisses,true)
  set('ifr-on');set('review-off');assert.equal(saved().reviewMisses,false)
  set('practice-words-on');set('sequential-on');assert.equal(saved().strategy,'weighted')
  set('practice-words-off');set('sequential-on');assert.equal(saved().strategy,'sequential')
  patch({mode:'guided'});set('ifr-off');set('sequential-off');set('review-on')
  assert.equal(saved().ifr,true);assert.equal(saved().strategy,'sequential');assert.equal(saved().reviewMisses,false)
  assert.deepEqual(JSON.parse(data.get(key)).scores,{E:3})
  session.dispose()
})
