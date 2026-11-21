import assert from 'node:assert/strict'
import {resolve} from 'node:path'
import {chromium} from '/Users/tylr/Code/exact-spike-toolchain/node_modules/playwright-core/index.mjs'
import {convertLegacy} from '../core/apple-session.mjs'
import {createBuildServer} from './serve-build.mjs'
import {installAppleContractFixture} from './apple-contract-fixture.mjs'

const dist=resolve(import.meta.dirname,'../target/audio-check-dist')
const server=await createBuildServer(dist)
await new Promise(done=>server.listen(0,'127.0.0.1',done))
let browser
try {
  browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true})
  const page=await browser.newPage({viewport:{width:402,height:874},reducedMotion:'reduce'})
  page.setDefaultTimeout(8000)
  await installAppleContractFixture(page,dist)
  const progress={learnerProfile:'beginner',guidedCourseActive:true,guidedPackIndex:0,maxLevel:1,guidedPhase:'listen',
    guidedProgress:{teachCounts:{E:2,T:2},practiceAttempts:10,practiceCorrect:10,practiceLetterCorrect:{E:5,T:5},
      listenAttempts:5,listenCorrect:1,listenLetterCorrect:{E:1}}}
  const files=convertLegacy({'dit-nux-status':'completed','dit-progress':JSON.stringify(progress)})
  await page.addInitScript(seed=>{ for(const [key,value] of Object.entries(seed)) localStorage.setItem(key,value) },files)
  await page.goto('http://127.0.0.1:'+server.address().port+'/app')
  const id=name=>page.getByTestId(name)
  await page.getByRole('button',{name:'Return to guided lesson'}).click()
  await id('listen-answer-T').waitFor()
  assert.ok(await id('listen-answer-A').isDisabled())
  assert.equal(await page.evaluate(()=>localStorage.getItem('dit.exact-spike.guided.v1')),files['dit.exact-spike.guided.v1'])
  await id('listen-answer-E').click()
  await page.getByRole('dialog',{name:'Keep going'}).waitFor()
  assert.ok(await id('listen-keyboard').isVisible(),'pinned Listen keyboard remains visible under the retry dialog')
  assert.ok(await id('listen-play').isDisabled(),'a visible background cannot replay or change the earned round')
  await page.getByRole('button',{name:'Continue',exact:true}).click()
  await id('target').waitFor()
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('dit.exact-spike.guided.v1')))
  assert.equal(saved.data.phase,'practice')
  assert.deepEqual(saved.data.progress.teachCounts,{E:2,T:2})
  console.log('PASS cold Practice → saved T prompt → failed guided round → inert Listen behind retry → mixed Practice with Teach credits')
} finally {
  await browser?.close()
  await new Promise(done=>server.close(done))
}
