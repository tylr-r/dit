// Real Contract and bundled Apple reducer, local Chrome, synthetic output clock.
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
import {chromium} from '/Users/tylr/Code/exact-spike-toolchain/node_modules/playwright-core/index.mjs'
import {wordPlan} from '../modules/web/words.mjs'
import {installAppleContractFixture} from './apple-contract-fixture.mjs'
import {seedReturning} from './seed-returning.mjs'
import {createBuildServer} from './serve-build.mjs'

const dist = resolve(import.meta.dirname,'../target/audio-check-dist')
const server = await createBuildServer(dist)
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve))
let browser
try {
  browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true})
  const page = await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce',colorScheme:'dark'})
  page.setDefaultTimeout(7000)
  const errors = []
  page.on('pageerror',error => errors.push(String(error)))
  await installAppleContractFixture(page,dist)
  await seedReturning(page,{legacyPractice:false})
  await page.addInitScript(() => {
    if (localStorage.getItem('dit.exact-spike.practice.v1') === null) {
      const selection = {kind:'custom',letters:[...'TENRA']}
      localStorage.setItem('dit.exact-spike.practice.v1',JSON.stringify({version:1,settings:{selection},scores:{},history:[]}))
    }
  })
  await page.goto('http://127.0.0.1:'+server.address().port+'/app')
  const id = name => page.getByTestId(name)
  const capture = async name => {
    if (!process.env.DIT_EVIDENCE) return
    await mkdir(process.env.DIT_EVIDENCE,{recursive:true})
    await page.screenshot({path:resolve(process.env.DIT_EVIDENCE,'words-'+name+'-contract-chrome.png')})
  }
  await page.getByRole('combobox', {name:'Choose a practice mode'}).selectOption('listen')
  await id('listen-words').click()
  await id('word-prompt').waitFor()
  assert.equal(await id('word-prompt').innerText(),'Ready when you are')
  assert.equal(await id('word-pool-toggle').count(),0)
  assert.equal(await page.getByRole('radiogroup',{name:'Listen content'}).count(),1)
  assert.equal(await id('word-wave').count(),1)
  await id('word-vocabulary').selectOption('q-codes')
  await page.getByText('More characters needed',{exact:true}).waitFor()
  assert.ok(await id('word-start').isDisabled())
  await id('word-vocabulary').selectOption('common')
  await page.getByText('Ready when you are',{exact:true}).waitFor()
  await capture('ready')
  await id('word-start').click()
  await id('word-concealed').waitFor()
  assert.equal((await id('word-concealed').innerText()).match(/…/g)?.length,4)
  assert.equal(await id('word-option-1').count(),0)
  assert.equal(await id('word-concealed').getAttribute('aria-hidden'),'true')
  assert.ok(await id('word-replay').isDisabled())
  await capture('playing')
  await page.evaluate(() => { window.fixtureTail = 696 })
  await page.getByText('Choose what you heard',{exact:true}).waitFor()
  const presented = await page.evaluate(() => window.fixtureTone.plan)
  const options = []
  for (let i=1;i<=4;i++) options.push(await id('word-option-'+i).innerText())
  const correct = options.find(o => JSON.stringify(wordPlan(o,12,8)) === JSON.stringify(presented))
  assert.ok(correct)
  await id('word-option-'+(options.findIndex(o => o !== correct)+1)).click()
  await id('word-target').waitFor()
  assert.equal(await id('word-feedback').innerText(),'The word was')
  assert.equal(await id('word-target').innerText(),correct)
  assert.ok(await page.getByRole('button',{name:'Answer '+correct+', correct',exact:true}).isDisabled())
  assert.equal(await id('word-count').innerText(),'0 / 1 correct')
  await capture('answered')
  await id('word-replay').click()
  await id('word-concealed').waitFor()
  assert.equal(await id('word-target').count(),0)
  await page.evaluate(() => { window.fixtureTail = 696 })
  await id('word-target').waitFor()
  assert.equal(await id('word-target').innerText(),correct)
  assert.equal(await id('word-count').innerText(),'0 / 1 correct')
  await id('word-next').click()
  await id('word-concealed').waitFor()
  await page.reload()
  await page.getByRole('combobox', {name:'Choose a practice mode'}).selectOption('listen')
  await id('word-start').waitFor()
  assert.equal(await id('word-count').count(),0)
  await id('word-start').click()
  await id('word-concealed').waitFor()
  assert.equal(await id('word-count').innerText(),'0 / 0 correct')
  assert.deepEqual(errors,[])
  console.log('PASS Chrome at 390 × 844, Apple bundle with synthetic presentation clock: scope-filtered Q codes, quiet ready, four concealed placeholders, disabled Replay, four choices, wrong answer names target, replay restores grade, Next, cold reload restores Words and resets count.')
} finally {
  await browser?.close()
  await new Promise(resolve => server.close(resolve))
}
