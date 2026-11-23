import assert from 'node:assert/strict'
import test from 'node:test'
import {create} from '../core/apple-session.mjs'

test('Apple saves a normalized passage, pauses its transport and reveals after presentation', () => {
  const files = new Map(), view = {}, timers = new Map(), requests = []
  let progress = 0, running = false
  const host = {
    read:k=>files.has(k)?['ok',files.get(k)]:['missing'], write:(k,v)=>{files.set(k,v);return true},
    project(m){const i=m.indexOf(':'); view[m.slice(0,i)]=m.slice(i+1)},
    schedule:(id,ms)=>timers.set(id,ms), cancelTimer:id=>timers.delete(id),
    stop(){},cancelInput(){},syncReminder(){},warm(){},play:()=>true,
    passageStart(plan,pitch,gap){requests.push({plan,pitch,gap});running=true;progress=0;return true},
    passageControl(action){running=action==='resume';return true},
    passagePosition:()=>progress,
  }
  const app=create(host)
  let props={mode:'boot','listen-content':'characters'}
  const set=p=>{props={...props,...p};app.setProps(props)}
  const command=(key,v)=>set({[key+'-command']:v,[key+'-token']:(props[key+'-token']||0)+1})
  set({});app.bootstrap();set({mode:'nux'});command('nux','skip');set({mode:'listen'})
  set({'listen-content':'custom','listen-choice-token':1,'custom-source-value':'  et E ','custom-type-value':'true'})
  set({'custom-source-value':'e#t e'})
  assert.equal(view['custom-estimate'],'4 / 2000 chars · 1 ignored · about 4 seconds')
  assert.equal(requests.length,0,'editing is silent')
  command('custom','save')
  assert.equal(view['custom-phase'],'setup','Apple Custom Save did not prepare the passage')
  assert.deepEqual(JSON.parse(files.get('dit.exact-spike.custom.v1')),{version:1,text:'ET E',typeAlong:true})
  command('custom','play')
  assert.deepEqual(requests.at(-1),{plan:[[0,100],[796,1096],[2720,2820]],pitch:600,gap:696})
  set({'custom-copy-value':'ET T'})
  const tick=()=>{const id=[...timers].find(([,ms])=>ms===60)[0]; timers.delete(id);app.timer(id)}
  progress=810;tick()
  command('custom','pause')
  assert.equal(running,false)
  assert.equal(view['custom-phase'],'paused')
  command('custom','resume')
  assert.equal(running,true)
  assert.equal(requests.length,1)
  progress=3515;tick();assert.equal(view['custom-phase'],'playing')
  progress=-2;tick();assert.equal(view['custom-phase'],'reveal')
  assert.equal(view['custom-reveal'],'ET E')
  assert.equal(view['custom-summary'],'3/4 matched · 1 missed · 1 extra')
  assert.ok([...files.values()].every(v=>!v.includes('ET T')))
  app.dispose()
})

test('Apple Custom Listen keeps the confirmed transport state and explains rejected controls', async () => {
  const files = new Map(), view = {}, phases = [], timers = new Map(), actions = []
  let rejected = '', starts = 0, elapsed = 123
  const app = create({
    read: key => files.has(key) ? ['ok', files.get(key)] : ['missing'],
    write(key, value) { files.set(key, value); return true },
    project(message) {
      const index = message.indexOf(':')
      view[message.slice(0, index)] = message.slice(index + 1)
      if (message.startsWith('custom-phase:')) phases.push(view['custom-phase'])
    },
    schedule(id, ms) { timers.set(id, ms) }, cancelTimer(id) { timers.delete(id) },
    stop() {}, cancelInput() {}, syncReminder() {}, warm() {}, play: () => true,
    passageStart() { starts++; elapsed = 0; return true },
    passageControl(action) { actions.push(action); return action !== rejected },
    passagePosition: () => elapsed,
  })
  let props = {mode:'boot', blocked:'false', 'listen-content':'characters'}
  const set = patch => { props = {...props, ...patch}; app.setProps(props) }
  const command = (channel, action) => set({[channel+'-command']:action, [channel+'-token']:(props[channel+'-token'] || 0) + 1})
  const activePolls = () => [...timers.values()].filter(ms => ms === 60).length
  try {
    set({}); app.bootstrap()
    set({mode:'nux'}); command('nux','skip'); set({mode:'listen'})
    set({'listen-content':'custom', 'listen-choice-token':1, 'custom-source-value':'ET E', 'custom-type-value':'true'})
    command('custom','save'); command('custom','play')
    set({'custom-copy-value':'ET T'})
    elapsed = 810
    rejected = 'pause'
    phases.length = 0
    command('custom','pause')
    await Promise.resolve()
    assert.equal(view['custom-phase'], 'playing')
    assert.equal(view['custom-control-error'], 'Could not pause playback. Try End and Play again.')
    assert.deepEqual(phases, [], 'Pause was rejected before the transport changed')
    assert.equal(activePolls(), 1)
    rejected = ''
    command('custom','pause')
    assert.equal(view['custom-phase'], 'paused')
    assert.equal(activePolls(), 0)
    rejected = 'resume'
    phases.length = 0
    command('custom','resume')
    await Promise.resolve()
    assert.equal(view['custom-phase'], 'paused')
    assert.equal(view['custom-control-error'], 'Could not resume playback. Try Restart.')
    assert.deepEqual(phases, [], 'Resume was rejected before the transport changed')
    assert.equal(activePolls(), 0)
    rejected = ''
    command('custom','resume')
    assert.equal(view['custom-phase'], 'playing')
    assert.equal(activePolls(), 1)
    assert.equal(starts, 1)
    command('custom','reveal')
    assert.equal(view['custom-summary'], '3/4 matched · 1 missed · 1 extra')
    command('custom','play')
    assert.equal(view['custom-control-error'], '')
    assert.equal(starts, 2)
    command('custom','pause'); rejected = 'resume'; command('custom','resume')
    set({mode:'freestyle'}); set({mode:'listen'})
    assert.equal(view['custom-control-error'], '')
    assert.equal(view['custom-phase'], 'setup')
    assert.ok([...files.values()].every(raw => !raw.includes('ET T')))
    assert.ok(actions.includes('stop'))
  } finally { app.dispose() }
})
