import assert from 'node:assert/strict'
import test from 'node:test'
import { convertLegacy, create } from '../core/apple-session.mjs'

const practice = 'dit.exact-spike.practice.v1'
const onboarding = 'dit.exact-spike.onboarding.v1'
const receipt = 'dit.exact-spike.legacy.v1'

function open(files) {
  const plans = [], messages = []
  const session = create({
    read:k => files.has(k) ? ['ok', files.get(k)] : ['missing'],
    write(k,v) { files.set(k,v); return true }, play:plan=>{ plans.push(plan); return true },
    project:m=>messages.push(m), outputVolume:()=>1, schedule(){},cancelTimer(){},warm(){},stop(){},cancelInput(){},syncReminder(){},
  })
  let props = {mode:'boot',blocked:'false','settings-open':'false','warm-token':'0','pref-token':'0'}
  const set = patch => { props={...props,...patch}; session.setProps(props) }
  set({}); session.bootstrap(); set({mode:'practice'})
  return {plans,messages,set,session}
}

test('disabled Dit auto-play survives offline import and restart, while explicit Play still plays', () => {
  const files = new Map(Object.entries(convertLegacy({'dit-nux-status':'skipped','dit-progress':'{"practiceAutoPlay":false}'})))
  const one = open(files)
  assert.equal(one.plans.length,0)
  one.set({'warm-token':'1'})
  assert.equal(one.plans.length,1)
  one.set({blocked:'true','settings-open':'true'})
  one.set({'pref-token':'1','pref-command':'autoplay-on'})
  one.set({blocked:'false','settings-open':'false'})
  assert.equal(one.plans.length,2)
  one.session.dispose()
  const two = open(files)
  assert.equal(two.plans.length,1)
  assert.equal(JSON.parse(files.get(practice)).settings.autoPlay,true)
  two.session.dispose()
})

test('an earlier Exact import retains its Dit opt-out without overriding a newer explicit setting', () => {
  const files = new Map([[onboarding,JSON.stringify({version:1,status:'skipped',step:'welcome'})],
    [receipt,JSON.stringify({version:1,preserved:{practiceAutoPlay:false}})]])
  const one = open(files)
  assert.equal(one.plans.length,0)
  one.session.dispose()
  files.set(practice,JSON.stringify({version:1,settings:{autoPlay:true},scores:{},history:[]}))
  const two = open(files)
  assert.equal(two.plans.length,1)
  two.session.dispose()
})
