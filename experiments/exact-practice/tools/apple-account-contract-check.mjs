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
  const native=messages=>page.evaluate(messages=>{
    for (const detail of messages) window.dispatchEvent(new CustomEvent('fixture-project',{detail}))
  },messages)
  const settings=page.getByRole('button',{name:'Settings',exact:true})
  const sheet=page.locator('#apple-settings')
  const remove=sheet.getByRole('button',{name:'Delete account',exact:true})
  const confirm=page.locator('#delete-account')
  await page.evaluate(()=>{
    window.fixtureCommands=[]
    window.addEventListener('fixture-account-command',e=>window.fixtureCommands.push(e.detail))
  })
  await settings.waitFor({state:'visible'})
  await settings.click()
  await sheet.getByRole('button',{name:'Reset app',exact:true}).click()
  const signedOut=page.locator('#reset-local-app')
  await signedOut.getByText('This clears progress, settings, onboarding state, and saved local data on this device.',{exact:true}).waitFor()
  await signedOut.getByRole('button',{name:'Cancel',exact:true}).click()
  await native(['fixture-account:learner-a@example.invalid'])
  const reset=sheet.getByRole('button',{name:'Reset app',exact:true})
  const first=page.getByRole('alertdialog',{name:'Reset App?',exact:true})
  const offline=page.getByRole('alertdialog',{name:'No internet connection',exact:true})
  const resetError=page.getByRole('alertdialog',{name:'Could Not Reset App',exact:true})
  const email='learner-a@example.invalid'
  const commands=()=>page.evaluate(()=>window.fixtureCommands.slice())
  await reset.click()
  await first.getByText(/If Dit can reach the server/).waitFor({timeout:2500})
  await first.getByRole('button',{name:'Cancel',exact:true}).click()
  assert.deepEqual(await commands(),[])
  assert.equal(await sheet.isVisible(),true)
  for (const [connection,choice] of [['offline','cancel'],['offline','device'],['online','online']]) {
    const before=(await commands()).length
    await reset.click()
    await first.getByRole('button',{name:'Reset App',exact:true}).click()
    await page.waitForFunction(n=>window.fixtureCommands.length===n,before+1)
    assert.equal((await commands()).at(-1),'reset-check:'+email)
    assert.equal(await sheet.isVisible(),true)
    await native(['account-reset:'+connection+':'+email])
    if(connection==='offline') {
      await offline.getByText(/server will not be cleared while you are offline/).waitFor()
      if(process.env.DIT_RESET_CAPTURE) await page.screenshot({path:process.env.DIT_RESET_CAPTURE})
      await offline.getByRole('button',{name:choice==='cancel'?'Cancel':'Reset Device',exact:true}).click()
      if(choice==='cancel') {
        assert.equal(await sheet.isVisible(),true)
        assert.equal((await commands()).length,before+1)
        continue
      }
    } else assert.equal(await offline.isVisible(),false)
    await sheet.waitFor({state:'hidden'})
    await page.waitForFunction(n=>window.fixtureCommands.length===n,before+2)
    assert.equal((await commands()).at(-1),'reset-'+choice+':'+email)
    if(choice==='online'){
      await native(['local-reset:error'])
      await resetError.getByText('Some local data could not be cleared. Relaunch Dit and try again.').waitFor()
      await resetError.getByRole('button',{name:'OK'}).click()
    }
    await settings.click()
  }
  await reset.click()
  await first.getByRole('button',{name:'Reset App',exact:true}).click()
  const lastProbe=(await commands()).length
  await sheet.getByRole('button',{name:'Close settings',exact:true}).click()
  await settings.click()
  await native(['account-reset:online:'+email])
  assert.equal(await sheet.isVisible(),true)
  assert.equal((await commands()).length,lastProbe)
  console.log('PASS signed-out wording and Cancel, dismissed Settings ignores a late reachability result.')
  console.log('PASS signed-in reset copy, two cancellation boundaries, post-confirmation network check, offline device-only command, online command and local error alert.')
  await page.evaluate(()=>{window.fixtureCommands=[]})
  await remove.click({timeout:4000})
  await confirm.getByText('This permanently deletes your Dit account, synced progress, and local progress on this device.').waitFor()
  if (process.env.DIT_DELETE_CAPTURE) await page.screenshot({path:process.env.DIT_DELETE_CAPTURE})
  await confirm.getByRole('button',{name:'Cancel',exact:true}).click()
  assert.equal(await sheet.isVisible(),true)
  assert.equal(await confirm.isVisible(),false)
  assert.deepEqual(await page.evaluate(()=>window.fixtureCommands),[])
  await remove.click()
  await confirm.getByRole('button',{name:'Delete Account',exact:true}).click()
  await sheet.waitFor({state:'hidden'})
  await page.waitForFunction(()=>window.fixtureCommands.length===1)
  assert.deepEqual(await page.evaluate(()=>window.fixtureCommands),['delete:learner-a@example.invalid'])
  await native(['account-deletion:recent-login'])
  const error=page.locator('#delete-account-error')
  await error.getByText('For security, sign in again and retry account deletion.').waitFor()
  await error.getByRole('button',{name:'OK'}).click()
  await settings.click()
  await remove.click()
  await confirm.getByRole('button',{name:'Delete Account',exact:true}).click()
  await native(['account-deletion:cancelled'])
  assert.equal(await error.isVisible(),false)
  await sheet.waitFor({state:'hidden'})
  console.log('PASS Delete Account confirmation, Cancel keeps Settings, confirmation dismisses Settings, recent-login alert and silent provider cancellation.')
  for (const [result,copy] of [
    ['apple-mismatch','Sign in with the same Apple account tied to this Dit account, then try again.'],
    ['user-mismatch','Sign in with the same account you used for Dit, then try again.'],
    ['network','A network error interrupted account deletion. Try again on a stable connection.'],
    ['failed','We could not delete your account. Please try again.'],
  ]) {
    await settings.click()
    await remove.click()
    await confirm.getByRole('button',{name:'Delete Account',exact:true}).click()
    await native(['account-deletion:'+result])
    await error.getByText(copy).waitFor()
    await error.getByRole('button',{name:'OK'}).click()
  }
  const warning=page.locator('#delete-account-cleanup')
  for (const result of ['deleted','cleanup']) {
    await native(['fixture-account:learner-a@example.invalid'])
    await settings.click()
    await remove.click()
    await confirm.getByRole('button',{name:'Delete Account',exact:true}).click()
    await native(['fixture-learners:B','fixture-account:','account-deletion:'+result])
    if(result==='cleanup'){
      await warning.getByText('Your account was deleted, but local cleanup did not finish cleanly. Relaunch the app if any old progress remains.').waitFor()
      await warning.getByRole('button',{name:'OK'}).click()
    }
    assert.equal(await warning.isVisible(),false)
    assert.equal(await error.isVisible(),false)
    await settings.click()
    await sheet.getByRole('button',{name:'Sign in',exact:true}).waitFor()
    assert.equal(await remove.isVisible(),false)
    await sheet.getByRole('button',{name:'Close settings',exact:true}).click()
  }
  console.log('PASS no command on Cancel, one identity-bound command on confirm, five error copies, silent success, cleanup warning and signed-out row visibility.')
  await progress.click()
  const modal=page.locator('#apple-progress')
  await modal.waitFor({state:'visible'})
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
  const emailProvider=fresh.getByRole('button',{name:'Continue with Email'})
  assert.equal(await emailProvider.isEnabled(),true,'Continue with Email should open the shipped form')
  await emailProvider.click()
  await fresh.getByRole('heading',{name:'Email sign-in'}).waitFor()
  await fresh.getByRole('button',{name:'Back to sign-in options'}).click()
  await fresh.getByRole('button',{name:'Cancel sign-in'}).click()
  await fresh.evaluate(()=>window.dispatchEvent(new CustomEvent('fixture-project',{
    detail:'fixture-account:learner-a@example.invalid'
  })))
  await fresh.getByTestId('nux-beginner').waitFor()
  assert.equal(await fresh.getByTestId('welcome-sign-in').isVisible(),false)
  console.log('PASS signed-out email form opens without a provider call and an authenticated first learner advances to profile selection with Reduced Motion.')
  console.log('PASS Swift identity transition messages close the previous Progress sheet, gate a failed load and release the anonymous Welcome on sign-out.')
} finally {
  await browser?.close()
  await new Promise(done => server.close(done))
}
