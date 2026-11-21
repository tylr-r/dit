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
