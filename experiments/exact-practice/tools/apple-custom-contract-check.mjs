import assert from 'node:assert/strict'
import {resolve} from 'node:path'
import {chromium} from '/Users/tylr/Code/exact-spike-toolchain/node_modules/playwright-core/index.mjs'
import {installAppleContractFixture} from './apple-contract-fixture.mjs'
import {seedReturning} from './seed-returning.mjs'
import {createBuildServer} from './serve-build.mjs'

const dist = resolve(import.meta.dirname,'../target/audio-check-dist')
const server = await createBuildServer(dist)
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve))
let browser
try {
  browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true})
  const page = await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'})
  page.setDefaultTimeout(7000)
  await installAppleContractFixture(page,dist)
  await seedReturning(page)
  await page.goto('http://127.0.0.1:'+server.address().port+'/app')
  const id = name => page.getByTestId(name)
  await page.getByRole('combobox', {name:'Choose a practice mode'}).selectOption('listen')
  await id('listen-custom').click()
  await id('custom-discard').click()
  await id('listen-custom').click()
  await page.getByRole('dialog',{name:'Custom text'}).waitFor()
  await id('custom-source').fill('e#t e')
  await page.getByText('4 / 2000 chars · 1 ignored · about 4 seconds',{exact:true}).waitFor()
  await id('custom-save').click()
  await id('custom-ready').waitFor()
  assert.equal(await id('custom-ready').innerText(),'4 chars · 2 words ready')
  await id('custom-play').click()
  await id('custom-copy').fill('ET T')
  await id('custom-pause').click()
  assert.ok(await id('custom-copy').isDisabled())
  await id('custom-resume').click()
  await page.evaluate(()=>{window.fixturePassage.position=-2})
  await id('custom-summary').waitFor()
  assert.equal(await id('custom-summary').innerText(),'3 / 4 matched · 1 missed · 1 extra')
  if (process.env.DIT_CAPTURE) await page.screenshot({path:process.env.DIT_CAPTURE})
  await page.reload()
  await page.getByRole('combobox', {name:'Choose a practice mode'}).selectOption('listen')
  await id('custom-clear').click()
  await id('listen-custom').waitFor()
  console.log('PASS built Contract and Apple bundle with synthetic output: empty Discard, Save, Play, copy, Pause/Resume, natural Reveal, restore, Clear returns to Characters.')
} finally {
  await browser?.close()
  await new Promise(resolve=>server.close(resolve))
}
