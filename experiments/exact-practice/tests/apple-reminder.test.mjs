import assert from 'node:assert/strict'
import test from 'node:test'
import { create } from '../core/apple-session.mjs'
import { NUX_KEY } from '../modules/web/nux.mjs'

function atStep(profile, step, saved) {
  const files = new Map([[NUX_KEY, JSON.stringify({version:1,status:'pending',step,profile,
    soundComplete:true,taps:3,holds:3})]])
  if (saved) files.set('dit.exact-spike.reminder.v1', JSON.stringify(saved))
  const values = new Map(), timers = new Map(), requests = [], plans = []
  const host = {
    read: key => files.has(key) ? ['ok',files.get(key)] : ['missing'],
    write(key,value) { files.set(key,value); return true },
    schedule(id,ms) { timers.set(id,ms) }, cancelTimer(id) { timers.delete(id) },
    play:()=>true, warm(){}, stop(){}, cancelInput(){}, outputVolume:()=>1,
    project(event) { const i=event.indexOf(':'); values.set(event.slice(0,i),event.slice(i+1)) },
    requestReminder: id => requests.push(id), cancelReminderRequest(){},
    syncReminder: (id,seconds,body) => plans.push({id,seconds,body}),
  }
  const app = create(host)
  const props = {mode:'boot',blocked:'false','route-boundary':'1','nux-token':'0','reduce-motion':'true'}
  const set = patch => { Object.assign(props,patch); app.setProps({...props}) }
  app.setProps({...props})
  app.bootstrap()
  set({mode:'nux'})
  const act = command => set({'nux-token':String(+props['nux-token']+1),'nux-command':command})
  act('resume')
  return {values,timers,files,requests,plans,act,app,set}
}

test('Apple beginner reaches the optional reminder before entering E/T; Skip never asks permission', () => {
  const f=atStep('beginner','beginner_intro')
  f.act('continue')
  assert.equal(f.values.get('nux-step'),'reminder')
  assert.equal(f.values.get('nux-status'),'pending')
  assert.deepEqual(f.requests,[])
  f.act('reminder-skip')
  assert.equal(f.values.get('nux-enter'),'guided')
  assert.equal(f.values.get('nux-status'),'completed')
  assert.deepEqual(f.requests,[])
})

const reminderKey = 'dit.exact-spike.reminder.v1'
const saved = f => JSON.parse(f.files.get(reminderKey))

test('known learner Back resets the tutorial and the first tour stop returns to the reminder', () => {
  const f=atStep('known','reminder')
  f.act('reminder-time:08:07')
  f.act('back')
  assert.equal(f.values.get('nux-step'),'button_tutorial')
  assert.equal(f.values.get('nux-taps'),'0')
  assert.equal(f.values.get('nux-holds'),'0')
  for(const ch of '...---') f.app.input('symbol',ch)
  const id=[...f.timers].find(([,ms])=>ms===600)[0]
  f.app.timer(id)
  assert.equal(f.values.get('nux-step'),'reminder')
  assert.equal(f.values.get('nux-reminder-label'),'8:07 AM')
  f.act('reminder-skip')
  assert.equal(f.values.get('nux-step'),'known_tour')
  f.act('back')
  assert.equal(f.values.get('nux-step'),'reminder')
  assert.equal(f.files.has(reminderKey),false)
  assert.deepEqual(f.requests,[])
})

test('skip preserves a configured reminder; a denial saves the selected time with notifications off', () => {
  const prior={version:1,enabled:true,time:'06:00'}
  const f=atStep('known','reminder',prior)
  assert.equal(f.values.get('nux-reminder-time'),'19:00')
  f.act('reminder-skip')
  assert.deepEqual(saved(f),prior)
  f.act('back')
  f.act('reminder-time:21:05')
  f.act('reminder-enable')
  f.act('reminder-enable')
  assert.equal(f.requests.length,1)
  f.app.permissionResult(f.requests[0],'denied')
  assert.equal(f.values.get('nux-step'),'known_tour')
  assert.deepEqual(saved(f),{version:1,enabled:false,time:'21:05'})
  assert.equal(f.plans.at(-1).seconds,0)
})

test('normal-motion exit can be cancelled; a late permission answer cannot commit after Back', () => {
  const f=atStep('beginner','reminder')
  f.set({'reduce-motion':'false'})
  f.act('reminder-enable')
  assert.equal(f.requests.length,0)
  const id=[...f.timers].find(([,ms])=>ms===280)[0]
  f.act('back')
  f.app.timer(id)
  assert.equal(f.values.get('nux-step'),'beginner_intro')
  assert.equal(f.requests.length,0)
  f.act('continue');f.act('reminder-enable')
  f.app.timer([...f.timers].find(([,ms])=>ms===280)[0])
  assert.equal(f.requests.length,1)
  f.act('back')
  f.app.permissionResult(f.requests[0],'granted')
  assert.equal(f.files.has(reminderKey),false)
  assert.equal(f.values.get('nux-step'),'beginner_intro')
})

test('authorization, relaunch, foreground and Settings time edits reconcile without additional prompts', () => {
  const f=atStep('beginner','reminder')
  f.act('reminder-time:07:45');f.act('reminder-enable')
  f.app.permissionResult(f.requests[0],'granted')
  assert.equal(f.values.get('nux-enter'),'guided')
  assert.deepEqual(saved(f),{version:1,enabled:true,time:'07:45'})
  assert.ok(f.plans.at(-1).seconds>Date.now())
  const count=f.plans.length
  f.app.foreground()
  assert.equal(f.plans.length,count+1)
  const relaunch=atStep('known','reminder',saved(f))
  assert.equal(relaunch.requests.length,0)
  assert.ok(relaunch.plans[0].seconds>Date.now())
  f.set({mode:'practice','settings-open':'true',blocked:'true','pref-token':'0'})
  f.set({'pref-command':'reminder-time:12:15','pref-token':'1'})
  assert.equal(saved(f).time,'12:15')
  f.set({'pref-command':'reminder-off','pref-token':'2'})
  assert.equal(saved(f).enabled,false)
  assert.equal(f.plans.at(-1).seconds,0)
  assert.equal(f.requests.length,1)
  f.set({'settings-open':'false','pref-command':'reminder-on','pref-token':'3'})
  assert.equal(f.requests.length,1)
})

test('storage and permission failures leave Skip usable; unknown reminder data is untouched', () => {
  const f=atStep('known','reminder',{version:2,time:'10:00',future:true})
  f.act('reminder-enable')
  assert.equal(f.requests.length,0)
  assert.deepEqual(f.plans,[])
  assert.match(f.values.get('reminder-error'),/unavailable/)
  f.act('reminder-skip')
  assert.equal(saved(f).version,2)
  const retry=atStep('beginner','reminder')
  retry.act('reminder-enable')
  retry.app.permissionResult(retry.requests[0],'error')
  assert.equal(retry.values.get('nux-reminder-exiting'),'0')
  assert.equal(retry.values.get('nux-step'),'reminder')
  retry.act('reminder-skip')
  assert.equal(retry.values.get('nux-enter'),'guided')
})
