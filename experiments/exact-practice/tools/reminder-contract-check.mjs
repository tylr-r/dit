// Contract-only reminder UI check. Browser time input and notification fakes.
import assert from 'node:assert/strict'
import {installAppleContractFixture} from './apple-contract-fixture.mjs'
import {mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
import {chromium} from '/Users/tylr/Code/exact-spike-toolchain/node_modules/playwright-core/index.mjs'
import {createBuildServer} from './serve-build.mjs'

const root=resolve(import.meta.dirname,'..')
const dist=resolve(root,'target/audio-check-dist')
const server=await createBuildServer(dist)
await new Promise(r=>server.listen(0,'127.0.0.1',r))
let browser
try {
  browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true})
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce',colorScheme:'dark'})
  page.setDefaultTimeout(7000)
  const issues=[]
  page.on('pageerror',err=>issues.push(String(err)))
  await installAppleContractFixture(page,dist)
  await page.addInitScript(()=>{
    window.fixtureRequests=0
    localStorage.setItem('dit.exact-spike.onboarding.v1',JSON.stringify({version:1,status:'pending',step:'reminder',profile:'known',soundComplete:true,taps:3,holds:3}))
  })
  await page.goto('http://127.0.0.1:'+server.address().port+'/app')
  // Shipped cold launch retains accomplishments but re-enters through profile.
  const restoreKnownPath = async () => {
    await page.getByTestId('nux-start').click()
    await page.getByRole('button',{name:'Quick tour for experienced users'}).click()
    for (let i=0;i<3;i++) await page.getByTestId('nux-continue').click()
    await page.getByText('Sound works',{exact:true}).waitFor()
    await page.getByTestId('nux-continue').click()
    await page.getByText('Daily nudge',{exact:true}).waitFor()
  }
  await restoreKnownPath()
  assert.equal(await page.getByTestId('nux-step').innerText(),'Daily nudge')
  const input=page.getByTestId('nux-reminder-time').locator('input')
  assert.equal(await input.inputValue(),'19:00')
  assert.equal(await page.evaluate(()=>window.fixtureRequests),0)
  const fitsColumn=await page.getByTestId('nux-reminder-enable').evaluate(el=>
    el.getBoundingClientRect().width <= el.parentElement.getBoundingClientRect().width + 1)
  assert.ok(fitsColumn,'CTA padding extends past the onboarding column')
  if(process.env.DIT_EVIDENCE){
    await mkdir(process.env.DIT_EVIDENCE,{recursive:true})
    await page.screenshot({path:resolve(process.env.DIT_EVIDENCE,'reminder-contract-chrome.png')})
  }
  await page.setViewportSize({width:320,height:568})
  await page.evaluate(()=>{document.documentElement.style.fontSize='53px'})
  await page.getByTestId('nux-reminder-enable').scrollIntoViewIfNeeded()
  for (const id of ['nux-step','nux-reminder-time','nux-reminder-skip','nux-reminder-enable']) {
    const box=await page.getByTestId(id).boundingBox()
    assert.ok(box && box.x>=-1 && box.x+box.width<=321, 'Enlarged-text control outside viewport: '+id)
  }
  await page.getByTestId('nux-reminder-enable').click({trial:true})
  await page.evaluate(()=>{document.documentElement.style.removeProperty('font-size')})
  await page.setViewportSize({width:390,height:844})
  await input.fill('08:25')
  await page.getByText('8:25 AM',{exact:true}).waitFor()
  await page.getByTestId('nux-reminder-skip').click()
  await page.getByTestId('nux-tour-back').click()
  assert.equal(await input.inputValue(),'08:25')
  await page.getByTestId('nux-reminder-enable').click()
  for(let i=0;i<3;i++)await page.getByTestId('nux-tour-next').click()
  await page.getByRole('button',{name:'Settings',exact:true}).click()
  const toggle=page.getByTestId('reminder-toggle')
  assert.equal(await toggle.isChecked(),true)
  const time=page.getByTestId('reminder-setting-time')
  await time.fill('21:17')
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('dit.exact-spike.reminder.v1')).time==='21:17')
  await toggle.uncheck()
  await page.waitForFunction(()=>window.fixtureDeadline===0)
  assert.equal(await page.evaluate(()=>window.fixtureRequests),1)
  await page.reload()
  await restoreKnownPath()
  const copy=await page.getByText("Pick a time and we'll remind you to practice.",{exact:false}).boundingBox()
  assert.ok(copy)
  const x=copy.x+copy.width*0.8,y=copy.y+3
  await page.mouse.move(x,y);await page.mouse.down()
  await page.mouse.move(x-55,y+75,{steps:5});await page.mouse.up()
  assert.equal(await page.getByTestId('nux-step').innerText(),'Daily nudge')
  await page.mouse.move(x,y);await page.mouse.down()
  await page.mouse.move(x-65,y+2,{steps:5});await page.mouse.up()
  await page.getByText('Meet the Morse key',{exact:true}).waitFor()
  assert.equal(await page.getByTestId('nux-taps').getAttribute('aria-label'),'Taps 0 of 3')
  assert.equal(await page.evaluate(()=>window.fixtureRequests),0)
  const tutorialHaptics = page.getByTestId('tutorial-haptics')
  assert.equal(await tutorialHaptics.isChecked(),true)
  await tutorialHaptics.uncheck()
  await page.waitForFunction(()=>localStorage.getItem('dit.exact-spike.haptics.v1')==='false')
  const capture = async name => {
    if (!process.env.DIT_HAPTICS_EVIDENCE) return
    await mkdir(process.env.DIT_HAPTICS_EVIDENCE,{recursive:true})
    await page.screenshot({path:resolve(process.env.DIT_HAPTICS_EVIDENCE,name+'-contract-chrome.png')})
  }
  await capture('haptics-tutorial-off')
  for (const symbol of ['.','.','.','-','-','-']) {
    await page.evaluate(s=>window.dispatchEvent(new CustomEvent('fixture-symbol',{detail:s})),symbol)
  }
  await page.getByTestId('nux-reminder-skip').click()
  for(let i=0;i<3;i++)await page.getByTestId('nux-tour-next').click()
  await page.getByRole('button',{name:'Settings',exact:true}).click()
  const settingsHaptics = page.getByTestId('settings-haptics')
  assert.equal(await settingsHaptics.isChecked(),false)
  await settingsHaptics.check()
  await page.waitForFunction(()=>localStorage.getItem('dit.exact-spike.haptics.v1')==='true')
  await capture('haptics-settings-on')
  console.log('PASS Apple Contract haptics: tutorial starts on, turning off persists in Settings, turning on updates the same preference; recording host in Chrome.')
  assert.deepEqual(issues,[])
  console.log('PASS Chrome Contract at 390 × 844 with Reduce Motion: default time, changed time label, Skip, tour Back, one explicit enable, Settings edit/disable, directional swipe Back and reset tutorial. 320 × 568 at 53 px: controls fit horizontally and enable is reachable. Fake notifications; no UIKit or native wheel rendering.')
} finally {
  await browser?.close()
  await new Promise(r=>server.close(r))
}
