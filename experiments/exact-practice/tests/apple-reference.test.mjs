import assert from 'node:assert/strict'
import test from 'node:test'
import { create } from '../core/apple-session.mjs'

test('Reference plays each deliberate tap at the saved tempo and pitch while keying is blocked', () => {
  const files = new Map([['dit.exact-spike.onboarding.v1', JSON.stringify({version:1,status:'skipped',step:'welcome'})],
    ['dit.exact-spike.practice.v1', JSON.stringify({version:1,settings:{speed:24,pitch:640},scores:{},history:[]})]])
  const calls = []
  const app = create({
    read:k => files.has(k) ? ['ok',files.get(k)] : ['missing'],
    write:(k,v) => { files.set(k,v); return true },
    project(){}, play:(plan,pitch,id) => { calls.push({plan,pitch,id}); return true },
    schedule(){},cancelTimer(){},cancelInput(){},stop(){},warm(){},outputVolume:()=>1,syncReminder(){},
  })
  let props = {mode:'boot',blocked:'false','reference-open':'false','reference-token':'0'}
  const set = patch => { props={...props,...patch}; app.setProps(props) }
  set({}); app.bootstrap(); set({mode:'practice'})
  set({blocked:'true','reference-open':'true'})
  const initial = calls.length
  const progress = files.get('dit.exact-spike.practice.v1')
  const tap = (token,letter) => set({'reference-token':String(token),'reference-char':letter})
  tap(1,'A')
  assert.equal(calls.length, initial+1)
  assert.deepEqual(calls.at(-1),{plan:[[0,50],[100,250]],pitch:640,id:0})
  set({})
  tap(2,'A')
  tap(3,'?')
  assert.equal(calls.length,initial+2)
  app.interrupt(true); tap(4,'T'); app.interrupt(false)
  set({'reference-open':'false'}); tap(5,'T')
  assert.equal(calls.length,initial+2)
  assert.equal(files.get('dit.exact-spike.practice.v1'),progress)
  app.dispose()
})

test('Settings sound check plays A with the saved tone and ignores stale actions after dismissal', () => {
  const calls = []
  let props = {mode:'boot',blocked:'false','settings-open':'false','pref-token':'0'}
  const app = create({
    read(k) {
      if (k.endsWith('onboarding.v1')) return ['ok','{"version":1,"status":"skipped","step":"welcome"}']
      if (k.endsWith('practice.v1')) return ['ok','{"version":1,"settings":{"speed":24,"pitch":720},"scores":{},"history":[]}']
      return ['missing']
    },
    write:()=>true, project(){}, play:(plan,pitch)=>{calls.push([plan,pitch]);return true},
    schedule(){},cancelTimer(){},cancelInput(){},stop(){},warm(){},outputVolume:()=>1,syncReminder(){},
  })
  const set = patch => { props={...props,...patch};app.setProps(props) }
  set({});app.bootstrap();set({mode:'practice'})
  set({blocked:'true','settings-open':'true'})
  const before = calls.length
  set({'pref-token':'1','pref-command':'test-sound'})
  assert.deepEqual(calls.slice(before),[[[[0,50],[100,250]],720]])
  set({'settings-open':'false','pref-token':'2'})
  assert.equal(calls.length,before+1)
  app.dispose()
})

test('confirmed Reference reset clears only sending/listening scores and refreshes accessible cards', () => {
  const key='dit.exact-spike.practice.v1'
  const files=new Map([[key,JSON.stringify({version:1,settings:{pitch:720},scores:{A:9},
    history:[{letter:'A',correct:true,atMs:10}],letterAccuracy:{A:{recent:Array(10).fill(true)}},
    listenTtr:{A:{averageMs:320,samples:4}},bestWpm:21.4})]])
  const seen=new Map()
  const app=create({
    read:k=>files.has(k)?['ok',files.get(k)]:['missing'],write:(k,v)=>{files.set(k,v);return true},
    project:m=>{const sep=m.indexOf(':');if(sep>0) seen.set(m.slice(0,sep),m.slice(sep+1))},
    schedule(){},cancelTimer(){},cancelInput(){},stop(){},play(){return true},syncReminder(){},warm(){},
  })
  let props={mode:'boot',blocked:'false','pref-token':'0','reference-open':'false'}
  const set=patch=>{props={...props,...patch};app.setProps(props)}
  set({});app.bootstrap();set({mode:'practice'})
  const before=JSON.parse(files.get(key))
  set({'pref-token':'1','pref-command':'reset-scores'})
  assert.equal(JSON.parse(files.get(key)).scores.A,9)
  set({blocked:'true','reference-open':'true'})
  assert.match(seen.get('ref-cards-mastered') ?? '', /A, mastered, dit dah, score plus 9, recognition 320 milliseconds/)
  assert.equal(JSON.parse(files.get(key)).scores.A,9)
  set({'pref-token':'2','pref-command':'reset-scores'})
  const saved=JSON.parse(files.get(key))
  assert.equal(saved.scores.A ?? 0,0)
  for(const field of ['history','letterAccuracy','listenTtr','bestWpm']) assert.deepEqual(saved[field],before[field])
  assert.equal(saved.settings.pitch,720)
  assert.equal(seen.get('ref-cards-mastered'),'')
  assert.match(seen.get('ref-cards-learning'),/A, learning, recognition 320 milliseconds/)
  app.dispose()
})
