import assert from 'node:assert/strict'
import test from 'node:test'
import { create } from '../core/apple-session.mjs'

test('Apple Conversation gates each local contact, drives RX from presented audio and keeps typed copy local', async () => {
  const state = new Map(), timers = new Map(), files = new Map()
  let received, position = 0
  const session = create({
    read:key => key.endsWith('onboarding.v1') ? ['ok','{"version":1,"status":"skipped"}'] : ['missing'],
    write:(key,value) => { files.set(key,value); return true },
    schedule:(id,ms) => timers.set(id,ms),cancelTimer:id => timers.delete(id),
    project(message) { const i=message.indexOf(':'); state.set(message.slice(0,i),message.slice(i+1)) },
    stop(){},warm(){},cancelInput(){},syncReminder(){},outputVolume:()=>1,play:()=>true,
    passageStart(plan,pitch,gap) { received={plan,pitch,gap}; position=0;return true },
    passagePosition:()=>position,passageControl:()=>true,
  })
  let props={mode:'boot',blocked:'false','qso-token':'0','route-boundary':'1'}
  const set=patch=>{props={...props,...patch};session.setProps(props)}
  const command=action=>set({'qso-token':String(+props['qso-token']+1),'qso-command':action})
  const phase=value=>assert.equal(state.get('qso-phase'),value)
  set({});session.bootstrap();set({mode:'conversation'})
  command('receive-first');phase('consent')
  command('consent-cancel');phase('idle');assert.equal(received,undefined)
  command('receive-first');command('consent-allow');await Promise.resolve();phase('receiving')
  assert.equal(received.gap,300);assert.equal(received.pitch,600)
  assert.equal(session.configuration().enabled,false)
  const poll=()=>{const entry=[...timers].find(([,ms])=>ms===50);assert.ok(entry);timers.delete(entry[0]);session.timer(entry[0])}
  set({'qso-copy-value':'MY LOCAL COPY'})
  command('pause');await Promise.resolve();phase('paused')
  command('resume');await Promise.resolve();phase('receiving')
  position=(received.plan.at(-1)[1]+received.gap)/2
  poll();phase('receiving');assert.equal(state.get('qso-percent'),'50')
  position=-2;poll();phase('rx-ready')
  command('check');assert.equal(state.get('qso-rx-text'),'CQ K')
  assert.equal(state.get('qso-percent'),'100')
  set({'qso-copy-value':'CQ K'})
  assert.match(state.get('qso-copy-summary'),/^4\/4 matched/)
  command('start-turn');phase('tx');assert.equal(session.configuration().enabled,true)
  assert.equal(state.get('qso-transcript'),'Station: CQ K')
  session.input('down','');session.input('sequence','.')
  assert.equal(state.get('qso-draft'),'E')
  command('replay');phase('receiving')
  assert.equal(state.get('qso-percent'),'0')
  position=-2;poll();phase('rx-ready')
  command('start-turn');phase('tx');assert.equal(state.get('qso-draft'),'E')
  command('send');await Promise.resolve();phase('receiving')
  assert.equal(state.get('qso-transcript'),'Hidden:1\nYou: E')
  session.interrupt(true);phase('error');command('retry');phase('error')
  session.interrupt(false);command('retry');phase('receiving')
  set({mode:'practice'});assert.ok(![...timers.values()].includes(50))
  set({mode:'conversation'});phase('idle');command('send-first');phase('consent')
  assert.ok(!JSON.stringify([...files]).includes('MY LOCAL COPY'))
  session.dispose()
})
