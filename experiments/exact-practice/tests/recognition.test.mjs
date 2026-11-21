import assert from 'node:assert/strict'
import test from 'node:test'
import {initialSession,stepSession} from '../modules/web/session.mjs'
import {buildRecognition} from '../modules/web/reference.mjs'
import {loadPractice,savePractice,STORE_KEY} from '../modules/web/practice-store.mjs'

test('recognition is only from timed Characters / guided Listen, matches shipped EMA and mastery-only summary', async () => {
  // Project checkout is the shipped behavioral oracle, independent of the bundled fixture.
  const {execFileSync}=await import('node:child_process')
  const bun='/Users/tylr/Code/exact-spike-toolchain/.spike-tools/bun-darwin-aarch64/bun'
  const source='/Users/tylr/Code/dit/packages/core/src/utils'
  const attempts=[['E',true,0],['E',false,2600],['E',true,12500],['T',false,900],['T',true,null]]
  const golden=JSON.parse(execFileSync(bun,['-e',`
    import {applyListenTtrSample} from '${source}/appState.ts';
    import {getRecognitionFillRatio} from '${source}/retention.ts';
    let result={};
    for(const [letter,correct,ms] of ${JSON.stringify(attempts)}.concat([['A',false,400]]))
      if(ms!==null) result=applyListenTtrSample(result,letter,ms);
    console.log(JSON.stringify({result,fill:Math.round(Math.max(.05,getRecognitionFillRatio(result.E.averageMs))*100)}));
  `],{encoding:'utf8'}))
  const data={scores:{E:12},letterAccuracy:{E:{recent:Array(10).fill(true)}}}
  let state=stepSession(initialSession(data),{type:'mode',mode:'listen'}).state
  for(const [letter,correct,sample] of attempts)
    state=stepSession(state,{type:'listenScore',letter,correct,sample}).state
  state=stepSession(state,{type:'mode',mode:'guided'}).state
  state=stepSession(state,{type:'guidedScore',letter:'A',correct:true,mode:'practice',sample:400}).state
  state=stepSession(state,{type:'guidedScore',letter:'A',correct:false,mode:'listen',sample:400}).state
  assert.deepEqual(state.listenTtr,golden.result)
  const summary=buildRecognition(state)
  assert.equal(summary.average,golden.result.E.averageMs)
  assert.equal(summary.bars.find(row=>row.letter==='E').fill,golden.fill)
  assert.equal(buildRecognition(initialSession()).average,null)
})
test('optional old recognition data is unknown; supported samples survive saves and newer fields stay protected', () => {
  let raw=JSON.stringify({version:1,settings:{},scores:{E:5},history:[]})
  const store={getItem:key=>key===STORE_KEY?raw:null,setItem:(key,value)=>{assert.equal(key,STORE_KEY);raw=value}}
  const original=raw
  const old=loadPractice(store)
  assert.deepEqual(old.data.listenTtr,{})
  assert.equal(old.status,'saved')
  assert.equal(raw,original)
  assert.equal(savePractice(store,{...old.data,listenTtr:{E:{averageMs:140,samples:2}}}),'saved')
  assert.deepEqual(loadPractice(store).data.listenTtr,{E:{averageMs:140,samples:2}})
  const future=JSON.parse(raw);future.listenTtr.E.alternate=true;raw=JSON.stringify(future)
  const protectedRaw=raw
  assert.equal(savePractice(store,old.data),'newer')
  assert.equal(raw,protectedRaw)
})

test('slow recognition has a five-percent floor only for mastered letters', () => {
  const summary = buildRecognition({
    scores: { E: 5, T: 4 },
    letterAccuracy: { E: { recent: Array(10).fill(true) }, T: { recent: [true] } },
    listenTtr: { E: { averageMs: 2200, samples: 10 }, T: { averageMs: 2200, samples: 1 } },
  })
  assert.deepEqual(summary.bars.map(({letter, fill}) => [letter, fill]), [['E', 5], ['T', 0]])
})
