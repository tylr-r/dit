import test from 'node:test'
import assert from 'node:assert/strict'
import {create,convertLegacy} from '../core/apple-session.mjs'

test('Apple offline restoration publishes only widget aggregates and refreshes them on foreground',()=>{
  const files=convertLegacy({'dit-nux-status':'completed','dit-progress':JSON.stringify({
    learnerProfile:'known',bestWpm:12.5,updatedAt:1000,streak:{current:3,longest:5,lastCountedDate:'2026-11-19'},
    dailyActivity:{'2026-11-20':{correct:21,modes:['practice']}},
  })})
  let now=new Date(2026,10,20,16).getTime()
  const received=[]
  const app=create({
    read:key=>Object.hasOwn(files,key)?['ok',files[key]]:['missing'],
    write:(key,value)=>{files[key]=value;return true},wallNow:()=>now,
    project:message=>{if(message.startsWith('widget-summary:'))received.push(JSON.parse(message.slice(15)))},
    schedule(){},cancelTimer(){},syncReminder(){},play(){return true},stop(){},warm(){},cancelInput(){},outputVolume:()=>1,
  })
  app.bootstrap()
  assert.deepEqual(received.at(-1),{known:true,mastered:0,bestWpm:12.5,streak:3,today:15,goal:15,day:'2026-11-20'})
  now=new Date(2026,10,21,9).getTime()
  app.foreground()
  assert.deepEqual(received.at(-1),{known:true,mastered:0,bestWpm:12.5,streak:3,today:0,goal:15,day:'2026-11-21'})
  app.dispose()
})
