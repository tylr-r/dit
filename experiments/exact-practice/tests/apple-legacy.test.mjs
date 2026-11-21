import assert from 'node:assert/strict'
import test from 'node:test'
import { convertLegacy } from '../core/apple-legacy.mjs'
import { beginGuide, GUIDED_KEY } from '../modules/web/guided.mjs'
import { NUX_KEY } from '../modules/web/nux.mjs'
import { STORE_KEY } from '../modules/web/practice-store.mjs'

const convert = (progress,extra={}) => convertLegacy({'dit-progress':JSON.stringify(progress),...extra})
const data = (writes,k) => JSON.parse(writes[k])
test('offline import keeps unknown metrics absent, inferred onboarding and source timestamp separate', () => {
  const nominal = convert({updatedAt:1000})
  assert.equal(data(nominal,NUX_KEY).status,'pending')
  const practice = data(nominal,STORE_KEY)
  assert.deepEqual(practice.history,[])
  assert.equal(Object.hasOwn(practice,'streak'),false)
  assert.equal(Object.hasOwn(practice,'dailyActivity'),false)
  assert.equal(data(nominal,'dit.exact-spike.legacy.v1').sourceUpdatedAt,1000)
  const partial = convert({learnerProfile:'known',bestWpm:29})
  assert.equal(data(partial,NUX_KEY).status,'skipped')
  assert.equal(data(partial,'dit.exact-spike.legacy.v1').sourceUpdatedAt,null)
  assert.equal(data(partial,'dit.exact-spike.legacy.v1').preserved.bestWpm,29)
})

test('onboarding precedence and invalid pending steps preserve the source', () => {
  const pending = convert({scores:{E:8},nuxCompleted:true},{'dit-nux-status':'pending'})
  assert.equal(data(pending,NUX_KEY).status,'pending')
  assert.throws(()=>convert({}, {'dit-nux-status':'archived'}))
  assert.throws(()=>convert({}, {'dit-nux-status':'pending','dit-nux-state':'{"step":"future"}'}))
  assert.throws(()=>convert({}, {'dit-nux-status':'pending','dit-nux-state':'{"step":"reminder"}'}))
})

test('recognized course transition boundaries resume with earned counters and high-water intact', () => {
  const p = beginGuide().progress
  p.teachCounts = {E:2,T:2}
  const snapshot = {guidedCourseActive:true,guidedPackIndex:0,guidedMaxPackReached:4,guidedPhase:'teach',guidedProgress:p}
  const imported = () => data(convert(snapshot),GUIDED_KEY).data
  assert.equal(imported().phase,'gate-practice')
  snapshot.guidedPhase = 'practice'
  p.practiceAttempts = 10
  p.practiceCorrect = 8
  p.practiceLetterCorrect = {E:5,T:3}
  assert.equal(imported().phase,'gate-listen')
  snapshot.guidedPhase = 'listen'
  p.listenAttempts = 6
  p.listenCorrect = 4
  p.listenLetterCorrect = {E:3,T:1}
  assert.equal(imported().phase,'gate-next')
  assert.equal(imported().maxPackReached,4)
  assert.deepEqual(imported().progress,p)
  p.listenLetterCorrect = {E:4}
  assert.equal(imported().phase,'gate-retry')
})

test('inactive and graduated learners keep their course position without resuming active Study', () => {
  const parked = convert({guidedPackIndex:4,guidedMaxPackReached:8,guidedCourseActive:false})
  assert.equal(parked['dit.exact-spike.method.v1'],'open')
  assert.equal(data(parked,GUIDED_KEY).data.pack,4)
  const graduated = convert({guidedPackIndex:13,guidedMaxPackReached:14,
    guidedPhase:'complete',guidedCourseActive:false,guidedProgress:beginGuide().progress})
  assert.equal(data(graduated,GUIDED_KEY).data.phase,'complete')
})

test('records which would be silently trimmed, reset or partially discarded are held', () => {
  for (const value of [
    {updatedAt:'1000'}, {toneFrequency:641}, {customLetters:['E','E']}, {guidedPackIndex:null},
    {scores:{newSymbol:4}}, {letterAccuracy:{E:{recent:Array(11).fill(true)}}},
    {listenTtr:{T:{averageMs:50,samples:999}}}, {streak:{current:8,longest:2,lastCountedDate:'2026-11-18'}},
    {dailyActivity:{'2026-02-31':{correct:1,modes:['practice']}}}, {unexpectedFutureField:0},
    {guidedPhase:'listen',guidedPackIndex:2}, {reminder:{time:'19:00',enabled:'yes'}},
  ]) assert.throws(()=>convert(value),/Unsupported legacy progress/)
})

test('Dit restores the first-key hint independently of a completed onboarding flag', () => {
  const completed = convertLegacy({'dit-nux-status':'completed'})
  assert.equal(completed['dit.exact-spike.intro-hint.v1'], 'morse')
})
