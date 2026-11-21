import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { transformSync } from 'esbuild'
import * as retention from '../modules/web/reference-retention.generated.mjs'
import { nextReminder } from '../core/apple-reminder.mjs'

test('pending notification matches the shipped scheduler across clock, DST, streak and goal boundaries', async () => {
  let scheduled
  const notifications = {
    getPermissionsAsync:async()=>({granted:true}),
    cancelScheduledNotificationAsync:async()=>{},
    scheduleNotificationAsync:async request=>{ scheduled=request },
    SchedulableTriggerInputTypes:{TIME_INTERVAL:'interval'},
  }
  const source=readFileSync(new URL('../../../apps/ios/src/notifications/reminder.ts',import.meta.url),'utf8')
  const {code}=transformSync(source,{loader:'ts',format:'cjs'})
  const module={exports:{}}
  runInNewContext(code,{module,Date,require:id=>id==='@dit/core'?retention:notifications})
  for(const now of [new Date(2026,2,7,20),new Date(2026,2,8,0),new Date(2026,9,31,22),new Date(2026,10,1,0),new Date(2026,10,19,19)]) {
    const day=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-')
    for(const time of ['00:00','01:30','02:30','19:00','23:59']) {
      for(const correct of [0,14,15,16]) {
        const progress={dailyActivity:{[day]:{correct,modes:['practice']}},streak:{current:correct>0?3:0}}
        await module.exports.rescheduleReminder({...progress,reminder:{enabled:true,time}},now)
        const plan=nextReminder(time,progress,now)
        assert.equal(scheduled.identifier,'dit-daily-reminder')
        assert.equal(scheduled.trigger.repeats,false)
        assert.equal(scheduled.content.sound,false)
        assert.equal(scheduled.content.title,'Dit')
        assert.equal(plan.body,scheduled.content.body)
        assert.equal(Math.round((plan.at-now.getTime())/1000),scheduled.trigger.seconds)
      }
    }
  }
})
