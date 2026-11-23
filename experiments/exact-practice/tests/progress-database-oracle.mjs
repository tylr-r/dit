// Generate the expected calls with the pinned app's pure service and two synthetic identities.
import {createFirebaseProgressService} from '../../../packages/core/src/firebase/progress.ts'
import {pathToFileURL} from 'node:url'

export async function shippedProgressCalls() {
  const calls=[]
  const service=createFirebaseProgressService({
    read:async path => { calls.push({op:'read',path}); return null },
    write:async (path,value) => { calls.push({op:'write',path,value}) },
  })
  const scores=Object.fromEntries(Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', ch => [ch,ch==='E' ? 4 : 0]))
  await service.load('synthetic-A')
  await service.save('synthetic-A',{
    scores, listenWpm:12, maxLevel:3, practiceWordMode:false, showHint:false, showMnemonic:false,
    hapticsEnabled:false, wordMode:false, bestWpm:0, practiceAutoPlay:true, practiceLearnMode:true,
    practiceIfrMode:true, practiceReviewMisses:true, toneFrequency:600, listenEffectiveWpm:8,
    listenAutoTightening:true, listenAutoTighteningCorrectCount:0, listenTtr:{}, letterAccuracy:{},
    guidedCourseActive:false, guidedPhase:'teach', guidedPackIndex:0, guidedMaxPackReached:undefined,
    guidedProgress:{teachCounts:{},practiceAttempts:0,practiceCorrect:0,practiceLetterCorrect:{},
      listenAttempts:0,listenCorrect:0,listenLetterCorrect:{}}, dailyActivity:{},
    nuxCompleted:true, reminder:{time:'19:00',enabled:false}, learnerProfile:undefined,
  },1000)
  await service.load('synthetic-B')
  return calls
}

if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(await shippedProgressCalls()))
}
