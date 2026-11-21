import test from 'node:test'
import assert from 'node:assert/strict'
import { pickWeighted, pullReview, enqueueReview } from '../modules/web/progression.mjs'
import { STORE_KEY, loadPractice, savePractice } from '../modules/web/practice-store.mjs'
import { initialSession, stepSession } from '../modules/web/session.mjs'

const letter = code => ({ type:'sequence', code, atMs:123 })
const choose = roll => ({type:'feedbackElapsed', roll})
const storage = (entries = []) => {
  const map = new Map(entries)
  return {
    map,
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
  }
}

test('weighted source baseline gives a wider draw interval to deficient scores and skips immediate repeat', () => {
  assert.equal(pickWeighted('TEN', { T: 5, E: 5, N: -5 }, 'T', 0), 'E')
  assert.equal(pickWeighted('TEN', { T: 5, E: 5, N: -5 }, 'T', 0.5), 'N')
  assert.equal(pickWeighted('TEN', { T: 0, E: 0, N: 0 }, 'E', 0.5), 'N')
})
test('miss review returns on third subsequent target selection and duplicate preserves the earlier due date', () => {
  let queue = enqueueReview([], 'T')
  let r = pullReview(queue)
  assert.equal(r.letter, null)
  queue = enqueueReview(r.queue, 'T')
  assert.deepEqual(queue, [{letter:'T', remaining:2}])
  r = pullReview(queue)
  assert.equal(r.letter, null)
  r = pullReview(r.queue)
  assert.equal(r.letter, 'T')
  assert.deepEqual(r.queue, [])
})
test('the due review overrides sequential/weighted selection but review-disabled skips scheduling', () => {
  let s = stepSession(initialSession(), {type:'preference', command:'toggle-strategy'}).state
  s = stepSession(s, letter('.')).state // miss T, IFR enabled
  assert.equal(s.reviewQueue[0].letter, 'T')
  s = stepSession(s, choose(0)).state
  assert.equal(s.target, 'E')
  s = stepSession(stepSession(s, letter('.')).state, choose(0.95)).state
  assert.equal(s.target, 'A')
  s = stepSession(stepSession(s, letter('.-')).state, choose(0.95)).state
  assert.equal(s.target, 'T')
  const off = stepSession(initialSession(), {type:'preference', command:'toggle-review'}).state
  assert.deepEqual(stepSession(off, letter('.')).state.reviewQueue, [])
})
test('only the isolated key round-trips settings, signed scores, and bounded attempt history', () => {
  const db = storage([['dit-practice','UNCHANGED']])
  const settings = {speed:18,effectiveSpeed:14,autoTighten:true,autoCorrect:0,pitch:640,words:true,ifr:false,strategy:'sequential',reviewMisses:false}
  const state = {settings, scores:{T:-2,E:8}, history:Array.from({length:210}, (_, i) => ({letter:'T',correct:false,atMs:i}))}
  assert.equal(savePractice(db,state), 'saved')
  assert.equal(db.map.get('dit-practice'),'UNCHANGED')
  assert.ok(db.map.has(STORE_KEY))
  const loaded = loadPractice(db)
  assert.equal(loaded.status, 'saved')
  assert.deepEqual(loaded.data.settings, settings)
  assert.deepEqual(loaded.data.scores, {T:-2,E:8})
  assert.equal(loaded.data.history.length, 200)
  assert.equal(loaded.data.history[0].atMs,10)
})
test('corruption can recover on explicit use; unknown versions or unavailable storage never get overwritten', () => {
  const invalid = storage([[STORE_KEY,'{']])
  assert.equal(loadPractice(invalid).status,'reset')
  const future = storage([[STORE_KEY,JSON.stringify({version:2})]])
  assert.equal(loadPractice(future).status,'newer')
  assert.equal(savePractice(future,initialSession()),'newer')
  assert.equal(future.map.get(STORE_KEY),'{"version":2}')
  const blocked = {getItem() {throw Error('blocked')},setItem() {throw Error('blocked')}}
  assert.equal(loadPractice(blocked).status,'unavailable')
  assert.equal(savePractice(blocked,initialSession()),'unavailable')
  const quota = {getItem() {return null},setItem() {throw Error('quota')}}
  assert.equal(savePractice(quota,initialSession()),'unavailable')
})
test('sanitize damaged records without accepting forged fields or unsafe preferences', () => {
  const db = storage([[STORE_KEY, JSON.stringify({version:1,settings:{speed:1000,pitch:500,ifr:'false',strategy:'hacked'}, scores:{T:-4,E:1.5,"!":9},history:[{letter:'N',correct:true,atMs:18},{letter:'!',correct:true,atMs:18},{letter:'E',correct:'yes',atMs:20}]})]])
  const {data} = loadPractice(db)
  assert.equal(data.settings.speed,12)
  assert.equal(data.settings.pitch,500)
  assert.equal(data.settings.ifr,true)
  assert.equal(data.settings.strategy,'sequential')
  assert.deepEqual(data.scores,{T:-4})
  assert.deepEqual(data.history,[{letter:'N',correct:true,atMs:18}])
})

test('oversized local data is preserved, not mistaken for recoverable corruption', () => {
  const raw = 'x'.repeat(100001)
  const db = storage([[STORE_KEY, raw]])
  assert.equal(loadPractice(db).status,'oversized')
  assert.equal(savePractice(db,initialSession()),'oversized')
  assert.equal(db.map.get(STORE_KEY),raw)
})

test('default practice is sequential and off-grid pitch falls back to 600Hz', () => {
  assert.equal(initialSession().settings.strategy,'sequential')
  const db = storage([[STORE_KEY, JSON.stringify({version:1,settings:{pitch:401}})]])
  assert.equal(loadPractice(db).data.settings.pitch,600)
})
