import assert from 'node:assert/strict'
import {resolve} from 'node:path'
import {chromium} from '/Users/tylr/Code/exact-spike-toolchain/node_modules/playwright-core/index.mjs'
import {installAppleContractFixture} from './apple-contract-fixture.mjs'
import {createBuildServer} from './serve-build.mjs'

const dist = resolve(import.meta.dirname, '../target/audio-check-dist')
const server = await createBuildServer(dist)
await new Promise(done => server.listen(0, '127.0.0.1', done))
let browser
try {
  browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true})
  const page = await browser.newPage({viewport:{width:402,height:874}})
  await installAppleContractFixture(page, dist)
  await page.addInitScript(() => {
    localStorage.setItem('dit.exact-spike.onboarding.v1', JSON.stringify({version:1,status:'completed',profile:'known',step:'welcome',soundComplete:true,taps:3,holds:3}))
  })
  page.setDefaultTimeout(8000)
  await page.goto('http://127.0.0.1:' + server.address().port + '/app/qso')
  const title = page.getByRole('heading',{name:'Do you want to send or receive first?'})
  const alert = page.getByRole('alertdialog',{name:'Start a local contact?'})
  await title.waitFor()
  for (const action of ['Send first','Receive first']) {
    await page.getByRole('button',{name:action,exact:true}).click()
    await alert.waitFor()
    assert.equal(await alert.getByText(/typed copy stay here/).count(),1)
    await alert.getByRole('button',{name:'Cancel',exact:true}).click()
    await alert.waitFor({state:'hidden'})
    await title.waitFor()
  }
  await page.getByRole('button',{name:'Send first',exact:true}).click()
  await alert.getByRole('button',{name:'Allow',exact:true}).click()
  const draft = page.getByTestId('qso-draft')
  await draft.waitFor()
  assert.equal(await draft.textContent(),'Reply')
  for (const id of ['qso-clear','qso-send','qso-backspace']) assert.equal(await page.getByTestId(id).isDisabled(),true)
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('fixture-sequence',{detail:'.'})))
  await page.getByTestId('qso-send').and(page.locator(':enabled')).waitFor()
  await page.getByTestId('qso-backspace').click()
  assert.equal(await page.getByTestId('qso-send').isDisabled(),true)
  await page.getByRole('button',{name:'End QSO',exact:true}).click()
  await page.getByRole('button',{name:'New QSO',exact:true}).click()
  await title.waitFor()
  await page.getByRole('button',{name:'Receive first',exact:true}).click()
  await alert.getByRole('button',{name:'Allow',exact:true}).click()
  await page.waitForFunction(() => window.fixturePassage?.position === 0)
  await page.getByRole('textbox',{name:'Type what you hear'}).fill('cq')
  assert.equal(await page.getByTestId('qso-copy').inputValue(),'CQ')
  await page.getByTestId('qso-pause').click()
  await page.getByTestId('qso-copy').fill('cq k')
  await page.getByTestId('qso-resume').click()
  await page.evaluate(() => {window.fixturePassage.position=-2})
  await page.getByRole('button',{name:'Reply',exact:true}).waitFor()
  assert.equal(await page.getByTestId('qso-progress').getAttribute('aria-valuenow'),'100')
  await page.getByTestId('qso-start-turn').click()
  const history=page.getByTestId('qso-transcript')
  const reveal=history.getByRole('button',{name:'Reveal received message'})
  await reveal.waitFor()
  assert.equal(await history.getByText('CQ K',{exact:true}).count(),0)
  await reveal.click()
  await history.getByText('CQ K',{exact:true}).waitFor()
  console.log('PASS Apple Contact consent, reply controls, draft editing and concealed incoming history until explicit Reveal.')
} finally {
  await browser?.close()
  await new Promise(done => server.close(done))
}
