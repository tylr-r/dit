import assert from 'node:assert/strict'
import {resolve} from 'node:path'
import {chromium} from '/Users/tylr/Code/exact-spike-toolchain/node_modules/playwright-core/index.mjs'
import {createBuildServer} from './serve-build.mjs'
import {installAppleContractFixture} from './apple-contract-fixture.mjs'

const dist = resolve(import.meta.dirname,'../target/audio-check-dist')
const server = await createBuildServer(dist)
await new Promise(done => server.listen(0,'127.0.0.1',done))
let browser
try {
  browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true})
  const page = await browser.newPage({viewport:{width:402,height:874},reducedMotion:'reduce'})
  await installAppleContractFixture(page,dist)
  await page.addInitScript(() => localStorage.setItem('dit.exact-spike.onboarding.v1',JSON.stringify({version:1,status:'skipped',step:'welcome'})))
  await page.goto('http://127.0.0.1:'+server.address().port+'/app')
  const progress=page.getByRole('button',{name:'Open progress',exact:true})
  await progress.click()
  const modal=page.locator('#apple-progress')
  await modal.waitFor({state:'visible'})
  const native=messages=>page.evaluate(messages=>{
    for (const detail of messages) window.dispatchEvent(new CustomEvent('fixture-project',{detail}))
  },messages)
  await native(['account-session:changed','account-sync:storage-unavailable','apple-session:failed'])
  await page.getByText('Dit could not open this session. Close and reopen the app to try again.').waitFor()
  assert.equal(await modal.isVisible(),false)
  assert.equal(await progress.isVisible(),false)
  await native(['account-session:changed','apple-session:ready','nux-status:pending'])
  await page.getByTestId('nux-welcome').waitFor()
  assert.equal(await modal.isVisible(),false)
  const fresh = await browser.newPage({viewport:{width:402,height:874},reducedMotion:'reduce'})
  await installAppleContractFixture(fresh,dist)
  await fresh.goto('http://127.0.0.1:'+server.address().port+'/app')
  await fresh.getByTestId('welcome-sign-in').click()
  assert.equal(await fresh.getByRole('button',{name:'Continue with Email'}).isDisabled(),true)
  await fresh.getByRole('button',{name:'Cancel sign-in'}).click()
  await fresh.evaluate(()=>window.dispatchEvent(new CustomEvent('fixture-project',{
    detail:'fixture-account:learner-a@example.invalid'
  })))
  await fresh.getByTestId('nux-beginner').waitFor()
  assert.equal(await fresh.getByTestId('welcome-sign-in').isVisible(),false)
  console.log('PASS signed-out provider sheet stays offline and an authenticated first learner advances to profile selection with Reduced Motion.')
  console.log('PASS Swift identity transition messages close the previous Progress sheet, gate a failed load and release the anonymous Welcome on sign-out.')
} finally {
  await browser?.close()
  await new Promise(done => server.close(done))
}
