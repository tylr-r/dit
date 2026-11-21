import assert from 'node:assert/strict'
import test from 'node:test'
import {answer} from '../app.ts'
function fixture() {
  const records=new Map()
  const fs={
    readFile:async k=>{if(!records.has(k))throw Object.assign(new Error('missing'),{code:'ENOENT'});return records.get(k)},
    atomicWriteFile:async(k,b)=>records.set(k,new Uint8Array(b).buffer),
  }
  return {fs,records}
}
test('only widget aggregates survive publication; a new calendar day clears today without losing mastery or streak',async()=>{
  const {fs,records}=fixture(),when=new Date(2026,10,20,18).getTime(),date='2026-11-20'
  const props={showArtwork:true,known:false,mastered:3,bestWpm:11.7,streak:4,today:6,goal:15}
  const {showArtwork,...args}=props
  const sync=(name,a)=>answer(name,a,{}, {fs})
  assert.deepEqual((await sync('ditProgress',[when]))[0].props,{showArtwork:false,known:false,mastered:0,bestWpm:0,streak:0,today:0,goal:15})
  assert.deepEqual(await sync('saveDitWidget',[JSON.stringify({...args,day:date,privateCopy:'never retained'})]),{ok:true})
  assert.equal(records.size,1)
  assert.ok(!new TextDecoder().decode([...records.values()][0]).includes('privateCopy'))
  const result=await sync('ditProgress',[when])
  assert.deepEqual(result[0],{date:when,props})
  assert.equal(result[1].date,new Date(2026,10,21).getTime())
  assert.deepEqual(result[1].props,{...props,today:0})
  assert.deepEqual((await sync('ditProgress',[result[1].date]))[0].props,result[1].props)
  await assert.rejects(()=>sync('saveDitWidget',[JSON.stringify({...args,day:date,mastered:99})]))
  assert.deepEqual((await sync('ditProgress',[when]))[0].props,props)
})
test('a learner switch clears the previous widget projection before another account loads',async()=>{
  const {fs}=fixture()
  const use=(name,args)=>answer(name,args,{}, {fs})
  const date=new Date(2026,10,20).getTime()
  const empty=await use('ditProgress',[date])
  await use('saveDitWidget',[JSON.stringify({known:true,mastered:3,bestWpm:21,streak:8,today:6,goal:15,day:'2026-11-20'})])
  await use('saveDitWidget',['null'])
  assert.deepEqual(await use('ditProgress',[date]),empty)
})
