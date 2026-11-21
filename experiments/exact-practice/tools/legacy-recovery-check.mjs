import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '/Users/tylr/Code/exact-spike-toolchain/node_modules/playwright-core/index.mjs'
import { createBuildServer } from './serve-build.mjs'

// The Swift fixture owns conversion. This checks the built Contract's response
// to its specific hold message without mounting a real device or storage host.
const server = await createBuildServer(resolve(import.meta.dirname,'../target/audio-check-dist'))
await new Promise(done => server.listen(0,'127.0.0.1',done))
const base = 'http://127.0.0.1:' + server.address().port
let browser
try {
  browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true})
  const page = await browser.newPage({viewport:{width:390,height:844},colorScheme:'dark',reducedMotion:'reduce'})
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.origin !== base) return route.abort()
    if (url.pathname === '/modules/index.js') return route.fulfill({
      contentType:'text/javascript', body:`
        export const abi=1, roster={'dit-key':{snapshot:false},'dit-reminder-wheel':{snapshot:false},'dit-mode-selector':{snapshot:false},'dit-intro-artwork':{snapshot:false},'dit-listen-wave':{snapshot:false}}
        export function create(tag,el,json,event){
          if(tag==='dit-key')queueMicrotask(()=>event(8,'apple-session:legacy-held'))
          return {}
        }
        export function setProps(){} export function destroy(){}
      `})
    return route.continue()
  })
  await page.goto(base + '/app')
  await page.getByText('Dit couldn’t restore your saved progress. Reopen the app to try again.',{exact:true}).waitFor()
  for (const id of ['nux-start','target','guided-phase']) assert.equal(await page.getByTestId(id).count(),0)
  if (process.env.DIT_EVIDENCE) {
    await mkdir(process.env.DIT_EVIDENCE,{recursive:true})
    await page.screenshot({path:resolve(process.env.DIT_EVIDENCE,'legacy-recovery-chrome.png')})
  }
  console.log('PASS built Contract displays legacy recovery and keeps onboarding, practice and the course behind the launch gate. Chrome 390 × 844, synthetic native message.')
} finally {
  await browser?.close()
  await new Promise(done => server.close(done))
}
