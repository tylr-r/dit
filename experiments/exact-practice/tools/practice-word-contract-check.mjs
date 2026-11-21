import assert from 'node:assert/strict'
import {resolve} from 'node:path'
import {chromium} from '/Users/tylr/Code/exact-spike-toolchain/node_modules/playwright-core/index.mjs'
import {createBuildServer} from './serve-build.mjs'
import {installAppleContractFixture} from './apple-contract-fixture.mjs'
import {MORSE_DATA} from '../modules/web/reference-morse.generated.mjs'

const dist = resolve(import.meta.dirname,'../target/audio-check-dist')
const server = await createBuildServer(dist)
await new Promise(done=>server.listen(0,'127.0.0.1',done))
let browser
try {
  browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true})
  const page = await browser.newPage({viewport:{width:402,height:874},reducedMotion:'reduce'})
  await installAppleContractFixture(page,dist)
  page.setDefaultTimeout(7000)
  await page.addInitScript(()=>{
    if (localStorage.getItem('fixture-seeded')) return
    localStorage.setItem('fixture-seeded','1')
    localStorage.setItem('dit.exact-spike.onboarding.v1',JSON.stringify({version:1,status:'completed',profile:'known',step:'welcome',soundComplete:true,taps:3,holds:3}))
    localStorage.setItem('dit.exact-spike.practice.v1',JSON.stringify({version:1,settings:{selection:{kind:'custom',letters:['A','E','T']}},scores:{},history:[]}))
  })
  await page.goto('http://127.0.0.1:'+server.address().port+'/app')
  const button=name=>page.getByRole('button',{name,exact:true})
  const id=name=>page.getByTestId(name)
  await button('Settings').click()
  await page.getByLabel('Practice Words',{exact:true}).check()
  await button('Close settings').click()
  const current=async()=>(await id('practice-word').innerText()).replace(/\s+/g,'')
  const word=await current()
  assert.ok(['TEA','EAT'].includes(word),word)
  for (const [i,char] of [...word].entries()) {
    await page.getByText(`Letter ${i+1} of ${word.length}`,{exact:true}).waitFor()
    await page.evaluate(code=>{
      for (const symbol of code) window.dispatchEvent(new CustomEvent('fixture-symbol',{detail:symbol}))
      window.dispatchEvent(new CustomEvent('fixture-sequence',{detail:code}))
    },MORSE_DATA[char].code)
  }
  await id('practice-word-wpm').waitFor()
  assert.notEqual(await current(),word)
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('dit.exact-spike.practice.v1')))
  assert.equal(saved.history.length,3)
  assert.ok(saved.bestWpm > 0)
  await page.reload()
  await id('practice-word').waitFor()
  await button('Open progress').click()
  await page.getByText('Best WPM',{exact:true}).waitFor()
  assert.equal(await id('profile-best-wpm').innerText(),saved.bestWpm.toFixed(1))
  const panel=page.getByRole('dialog',{name:'Progress',exact:true})
  assert.equal(await panel.locator('[data-testid^="ref-char-"]').count(),36)
  await button('Reset scores').click()
  const alert=page.getByRole('alertdialog',{name:'Reset Progress'})
  await alert.getByRole('button',{name:'Cancel'}).click()
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('dit.exact-spike.practice.v1')).scores),saved.scores)
  await button('Reset scores').click()
  await alert.getByRole('button',{name:'Reset',exact:true}).click()
  await page.waitForFunction(()=>Object.values(JSON.parse(localStorage.getItem('dit.exact-spike.practice.v1')).scores).every(v=>v===0))
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('dit.exact-spike.practice.v1')))
  for (const field of ['history','bestWpm','letterAccuracy','dailyActivity','streak','settings']) assert.deepEqual(after[field],saved[field])
  await button('Close reference').click()
  await id('practice-word').waitFor()
  await button('Settings').click()
  await button('Increase playback character speed').click()
  await button('Use recommended settings').click()
  const recommended=await page.evaluate(()=>JSON.parse(localStorage.getItem('dit.exact-spike.practice.v1')))
  assert.equal(recommended.settings.speed,12)
  assert.equal(recommended.settings.practiceWords,false)
  assert.deepEqual(recommended.settings.selection,saved.settings.selection)
  assert.equal(recommended.bestWpm,saved.bestWpm)
  assert.deepEqual(recommended.history,saved.history)
  await button('Close settings').click()
  console.log('PASS recommended restores known profile and preserves custom letters, best WPM and history through Settings.')
  console.log('PASS confirmed reset changes scores only; Cancel preserves the fixture, all 36 cards accessible.')
  console.log('PASS three actual Apple-adapter word letters, immediate advance, saved best WPM, new word and returning learner hero.')
} finally {
  await browser?.close()
  await new Promise(done=>server.close(done))
}
