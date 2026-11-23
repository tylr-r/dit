import test from 'node:test'
import assert from 'node:assert/strict'
import {convertLegacy, accountPayload, applyAccountPatch} from '../core/apple-legacy.mjs'
import {STORE_KEY} from '../modules/web/practice-store.mjs'
import {GUIDED_KEY} from '../modules/web/guided.mjs'
import {NUX_KEY} from '../modules/web/nux.mjs'

test('remote changes preserve local history, private text, high water and completed onboarding', () => {
  const local = convertLegacy({'dit-nux-status':'completed','dit-progress':JSON.stringify({
    scores:{E:3},toneFrequency:620,guidedPackIndex:2,guidedMaxPackReached:4,guidedCourseActive:true
  })})
  const practice = JSON.parse(local[STORE_KEY])
  practice.history.push({letter:'E',correct:true,atMs:100})
  local[STORE_KEY] = JSON.stringify(practice)
  local['dit.exact-spike.custom.v1'] = 'private synthetic passage'
  const next = applyAccountPatch(local,{updatedAt:1500,scores:{E:7},guidedMaxPackReached:1,nuxCompleted:false})
  assert.deepEqual(JSON.parse(next[STORE_KEY]).history,practice.history)
  assert.equal(JSON.parse(next[GUIDED_KEY]).data.maxPackReached,4)
  assert.equal(JSON.parse(next[NUX_KEY]).status,'completed')
  assert.equal(next['dit.exact-spike.custom.v1'],local['dit.exact-spike.custom.v1'])
  const wire = accountPayload(next)
  assert.deepEqual(wire.scores,{E:7})
  assert.equal(wire.toneFrequency,620)
  assert.equal(wire.nuxCompleted,true)
  assert.ok(!JSON.stringify(wire).includes('private synthetic'))
  assert.ok(!('history' in wire))
})

test('a remote preference preserves a pending tutorial, real completion skips it', () => {
  const local = convertLegacy({'dit-nux-status':'pending','dit-nux-state':JSON.stringify({
    step:'button_tutorial',learnerProfile:'known',didCompleteSoundCheck:true,tutorialTapCount:2
  })})
  assert.equal(applyAccountPatch(local,{hapticsEnabled:false})[NUX_KEY],local[NUX_KEY])
  assert.equal(JSON.parse(applyAccountPatch(local,{nuxCompleted:true})[NUX_KEY]).status,'skipped')
  assert.throws(()=>applyAccountPatch({...local,[STORE_KEY]:'{"version":2}'},{scores:{E:9}}))
  assert.throws(()=>applyAccountPatch(local,{scores:{E:'broken'}}))
  assert.throws(()=>applyAccountPatch(local,{futureField:123}))
})
test('returning remote profile can supersede a different tutorial without creating an unreadable account', () => {
  const records = convertLegacy({'dit-nux-status':'pending','dit-nux-state':JSON.stringify({
    step:'known_tour',learnerProfile:'known',didCompleteSoundCheck:true,tutorialTapCount:3,tutorialHoldCount:3
  })})
  const resumed = applyAccountPatch(records,{learnerProfile:'beginner',scores:{E:1}})
  assert.equal(accountPayload(resumed).learnerProfile,'beginner')
  assert.equal(JSON.parse(resumed[NUX_KEY]).status,'skipped')
})

test('a remote character speed change retains manual Farnsworth speed within its new bounds', () => {
  const records = convertLegacy({'dit-progress':JSON.stringify({listenWpm:20,listenEffectiveWpm:12,listenAutoTightening:false})})
  for (const [speed,effective] of [[24,12],[10,10]]) {
    const updated = accountPayload(applyAccountPatch(records,{listenWpm:speed}))
    assert.equal(updated.listenWpm,speed)
    assert.equal(updated.listenEffectiveWpm,effective)
  }
})

test('the outbound account snapshot has the shipped score shape, timestamp and falsy settings',async () => {
  const {shippedProgressCalls}=await import('./progress-database-oracle.mjs')
  const {createAccountSession}=await import('../core/apple-account.mjs')
  const records=convertLegacy({'dit-progress':JSON.stringify({updatedAt:1000,scores:{E:4},hapticsEnabled:false,bestWpm:0})})
  records['dit.exact-spike.custom.v1']='PRIVATE FIXTURE'
  const requests=[]
  const app=createAccountSession({
    project(){},schedule(){},cancelTimer(){},accountCommit:()=>true,
    accountRequest(...args){requests.push(args)},
  },()=>({bootstrap(){},dispose(){}}),JSON.stringify({version:1,records,dirty:true,updatedAt:1000}))
  app.bootstrap()
  app.accountResult(requests[0][0],'ok','r1','{"updatedAt":500,"toneFrequency":720}')
  app.timer(-1)
  const expected=(await shippedProgressCalls())[1].value
  assert.deepEqual(JSON.parse(requests[1][3]),expected)
  app.dispose()
})
