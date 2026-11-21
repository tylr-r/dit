import assert from 'node:assert/strict'
import test from 'node:test'
import {create,convertLegacy} from '../core/apple-session.mjs'

test('cold-open saved guided Listen starts on Practice and returns to its earned round on request',()=>{
  const progress={learnerProfile:'beginner',guidedCourseActive:true,guidedPackIndex:0,guidedPhase:'listen',maxLevel:1,
    guidedProgress:{teachCounts:{E:2,T:2},practiceAttempts:10,practiceCorrect:10,practiceLetterCorrect:{E:5,T:5},
      listenAttempts:1,listenCorrect:1,listenLetterCorrect:{E:1}}}
  const files=new Map(Object.entries(convertLegacy({'dit-nux-status':'completed','dit-progress':JSON.stringify(progress)})))
  const view={},tones=[]
  const app=create({
    read:k=>files.has(k)?['ok',files.get(k)]:['missing'],write:(k,v)=>{files.set(k,v);return true},
    project:message=>{const n=message.indexOf(':'); view[message.slice(0,n)]=message.slice(n+1)},
    play:(plan,pitch,id)=>{tones.push({plan,id});return true},stop(){},warm(){},schedule(){},cancelTimer(){},cancelInput(){},syncReminder(){},outputVolume:()=>1,
  })
  let props={mode:'boot',blocked:'false','pref-token':'0'}
  const set=p=>{props={...props,...p};app.setProps(props)}
  set({});app.bootstrap()
  assert.equal(view['nux-enter'],'practice')
  assert.equal(view['course-lesson-mode'],'listen')
  assert.equal(view['listen-course'],'1')
  const before=files.get('dit.exact-spike.guided.v1')
  set({mode:'practice'});assert.equal(view['study-pool'],'E,T')
  assert.equal(tones.filter(x=>x.id).length,0)
  set({mode:'freestyle'});set({mode:'guided'})
  assert.equal(view['guide-phase'],'listen')
  assert.equal(tones.at(-1).plan[0][1],300,'next required letter is T; E already has credit')
  assert.equal(files.get('dit.exact-spike.guided.v1'),before)
  set({mode:'practice',blocked:'true','settings-open':'true'})
  set({'pref-token':'1','pref-command':'course-open'})
  assert.equal(view['listen-course'],'0')
  assert.equal(view['study-pool'].split(',').length,26)
  app.dispose()
})
