import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { create,convertLegacy } from '../core/apple-session.mjs'
import { loadPractice } from '../modules/web/practice-store.mjs'

const source = new URL('../../../packages/core/src/utils/recommendedSettings.ts',import.meta.url)
const {outputFiles} = await build({entryPoints:[fileURLToPath(source)],bundle:true,write:false,format:'esm'})
const {getRecommendedSettings} = await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'))

const key='dit.exact-spike.practice.v1'
const onboarding='dit.exact-spike.onboarding.v1'
function open(files){
  const session=create({read:k=>files.has(k)?['ok',files.get(k)]:['missing'],write:(k,v)=>{files.set(k,v);return true},project(){},schedule(){},cancelTimer(){},warm(){},stop(){},play(){return true},cancelInput(){},syncReminder(){},outputVolume:()=>1})
  let props={mode:'boot',blocked:'false','settings-open':'false','pref-token':'0'}
  const set=p=>{props={...props,...p};session.setProps(props)}
  const command=c=>set({'pref-token':String(+props['pref-token']+1),'pref-command':c})
  set({});session.bootstrap();set({mode:'practice'})
  return {session,set,command}
}
for(const profile of ['beginner','known',null]){
  test('explicit recommended settings preserve a custom pool and progress for profile '+profile,()=>{
    const files=new Map(Object.entries(convertLegacy({'dit-nux-status':'completed','dit-progress':JSON.stringify({maxLevel:4,customLetters:['A','Z'],scores:{A:8},bestWpm:17,practiceAutoPlay:false})})))
    files.set(onboarding,JSON.stringify({version:1,status:'completed',step:'welcome',profile}))
    const original=JSON.parse(files.get(key))
    Object.assign(original.settings,{pitch:520,words:true,practiceWords:true,speed:18,effectiveSpeed:9,autoTighten:false,autoCorrect:5})
    files.set(key,JSON.stringify(original))
    let app=open(files)
    app.command('recommended')
    assert.equal(JSON.parse(files.get(key)).settings.speed,18)
    app.set({blocked:'true','settings-open':'true'})
    app.command('recommended')
    const after=JSON.parse(files.get(key)),s=after.settings,known=profile==='known'
    assert.deepEqual({
      showHint:s.showHint,showMnemonic:s.showMnemonic,maxLevel:s.maxLevel,
      practiceLearnMode:s.strategy==='sequential',practiceAutoPlay:s.autoPlay,practiceIfrMode:s.ifr,
      practiceReviewMisses:s.reviewMisses,listenWpm:s.speed,listenEffectiveWpm:s.effectiveSpeed,
      listenAutoTightening:s.autoTighten,listenAutoTighteningCorrectCount:s.autoCorrect,
    },getRecommendedSettings(profile))
    assert.equal(s.practiceWords,false);assert.equal(s.words,true);assert.equal(s.pitch,520)
    assert.deepEqual(s.selection,{kind:'custom',letters:['A','Z']});assert.equal(s.maxLevel,known?3:1)
    assert.deepEqual(after.scores,original.scores);assert.equal(after.bestWpm,17)
    assert.equal(loadPractice({getItem:k=>files.get(k)}).status,'saved')
    app.command('practice-words-on')
    const before=files.get(key)
    app.command('recommended');assert.equal(files.get(key),before,'already at recommended ignores word mode')
    app.session.dispose();app=open(files)
    app.set({blocked:'true','settings-open':'true'});app.command('recommended');assert.equal(files.get(key),before)
    app.set({mode:'guided'});app.command('speed-up');const guided=files.get(key)
    app.command('recommended');assert.equal(files.get(key),guided)
    app.session.dispose()
  })
}
