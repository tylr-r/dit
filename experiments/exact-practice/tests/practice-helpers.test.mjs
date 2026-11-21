import test from 'node:test'
import assert from 'node:assert/strict'
import {convertLegacy, create} from '../core/apple-session.mjs'
import {STORE_KEY} from '../modules/web/practice-store.mjs'
import {NUX_KEY} from '../modules/web/nux.mjs'

const receipt = 'dit.exact-spike.legacy.v1'
function open(files) {
  const messages = []
  const session = create({
    read:key => files.has(key) ? ['ok',files.get(key)] : ['missing'],
    write(key,value) { files.set(key,value); return true },
    project:m=>messages.push(m), schedule(){}, cancelTimer(){}, stop(){}, warm(){},
    play:()=>true, cancelInput(){}, outputVolume:()=>1, syncReminder(){},
  })
  let props = {mode:'boot',blocked:'false','settings-open':'false','pref-token':'0'}
  const set = patch => {props={...props,...patch};session.setProps(props)}
  set({});session.bootstrap();set({mode:'practice'})
  return {session, messages, set}
}
test('imported explicit visual hints suppress independent Practice scoring while the target and feedback still work',()=>{
  const files = new Map(Object.entries(convertLegacy({'dit-nux-status':'skipped','dit-progress':JSON.stringify({
    showHint:true, showMnemonic:true, customLetters:['E'], scores:{E:4}
  })})))
  const app=open(files)
  const correct=()=>{app.session.input('symbol','.');app.session.input('sequence','.')}
  correct()
  assert.equal(app.messages.includes('feedback:Correct'),true)
  assert.equal(JSON.parse(files.get(STORE_KEY)).scores.E,4)
  assert.equal(JSON.parse(files.get(STORE_KEY)).history.length,0)
  assert.equal(app.messages.includes('helper-code:.'),true)
  assert.equal(app.messages.includes('helper-mnemonic:eh?'),true)
  app.set({blocked:'true','settings-open':'true'})
  app.set({'pref-token':'1','pref-command':'hint-off'})
  app.set({blocked:'false','settings-open':'false'})
  correct()
  const saved=JSON.parse(files.get(STORE_KEY))
  assert.equal(saved.scores.E,5)
  assert.equal(saved.history.length,1)
  assert.equal(saved.settings.showHint,false)
  assert.equal(saved.settings.showMnemonic,true)
  app.session.dispose()
})
test('old Exact receipt fills absent helper settings without overriding an explicit off or modifying the receipt',()=>{
  const preserved=JSON.stringify({version:1,preserved:{showHint:true,showMnemonic:true}})
  const files=new Map([[receipt,preserved],[NUX_KEY,JSON.stringify({version:1,status:'skipped',step:'welcome'})],
    [STORE_KEY,JSON.stringify({version:1,settings:{showMnemonic:false},scores:{},history:[]})]])
  const app=open(files)
  assert.ok(app.messages.includes('showHint:true'))
  assert.ok(app.messages.includes('showMnemonic:false'))
  assert.equal(files.get(receipt),preserved)
  app.session.dispose()
})
