import {seedReturning} from './seed-returning.mjs'
import {createBuildServer} from './serve-build.mjs'
import {createServer} from 'node:http'
import {readFile,writeFile} from 'node:fs/promises'
import {resolve,extname} from 'node:path'
import {chromium} from '/Users/tylr/Code/exact-spike-toolchain/node_modules/playwright-core/index.mjs'
const root=resolve(import.meta.dirname,'../target/audio-check-dist')
const server=await createBuildServer(root)
await new Promise(r=>server.listen(0,'127.0.0.1',r))
let browser
const {mkdtemp,rm}=await import("node:fs/promises")
const {tmpdir}=await import("node:os")
const profile=await mkdtemp(resolve(tmpdir(),"dit-exact-storage-"))
try{
 const launch=()=>chromium.launchPersistentContext(profile,{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,viewport:{width:390,height:844}})
 const url=`http://127.0.0.1:${server.address().port}/?dit-key-trace=1`
 const key='dit.exact-spike.practice.v1'
 browser=await launch();let page=browser.pages()[0]||await browser.newPage()
 await seedReturning(page)
 await page.goto(url);await page.waitForTimeout(350)
 await page.evaluate(()=>localStorage.setItem('dit-progress','DO-NOT-IMPORT-TEST-SENTINEL'))
 await page.getByRole('button',{name:'Settings',exact:true}).click()
 await page.getByTestId('speed-up').click();await page.getByTestId('pitch-up').click()
 await page.getByTestId('strategy-toggle').click();await page.getByTestId('word-mode-toggle').click()
 await page.getByTestId('ifr-toggle').click();await page.getByTestId('review-misses-toggle').click()
 await page.getByRole('button',{name:'Close',exact:true}).click()
 await page.getByTestId('morse-key').hover();await page.mouse.down();await page.waitForTimeout(280);await page.mouse.up()
 await page.waitForTimeout(1550)
 const read=()=>page.evaluate(k=>({raw:localStorage.getItem(k),production:localStorage.getItem('dit-progress')}),key)
 const before=await read(),saved=JSON.parse(before.raw)
 if(saved.settings.speed!==13||saved.settings.pitch!==620)throw Error('settings not persisted')
 if(saved.scores.T!==1||saved.history.length!==1)throw Error('attempt/history not persisted')
 if(before.production!=='DO-NOT-IMPORT-TEST-SENTINEL')throw Error('production namespace changed')
 await page.reload();await page.waitForTimeout(500)
 await page.getByRole('button',{name:'Open progress',exact:true}).click()
 if(!(await page.getByTestId('score').innerText()).includes('1'))throw Error('score lost on reload')
 if(!(await page.getByTestId('history-count').innerText()).includes('1'))throw Error('history count lost on reload')
 await page.getByRole('button',{name:'Close',exact:true}).click()
 await browser.close();browser=await launch();page=browser.pages()[0]||await browser.newPage()
 await seedReturning(page)
 await page.goto(url);await page.waitForTimeout(500)
 const restarted=await read()
 if(restarted.raw!==before.raw)throw Error('stored snapshot changed on restart without input')
 await page.getByRole('button',{name:'Settings',exact:true}).click()
 const settingsText=await page.locator('body').innerText()
 if(!settingsText.includes('13 WPM')||!settingsText.includes('620 Hz'))throw Error('settings not restored to UI')
 await page.getByRole('button',{name:'Close',exact:true}).click()
 await page.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('Test quota failure','QuotaExceededError')}})
 await page.reload();await page.waitForTimeout(400)
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByTestId('speed-up').click();await page.waitForTimeout(1000)
 if((await read()).raw!==before.raw)throw Error('failed save damaged persisted snapshot')
 const failedStatus=await page.getByTestId('storage-status').innerText()
 if(!/unavailable|not saved|error|failed|memory/i.test(failedStatus))throw Error('failed write not surfaced: '+failedStatus)
 await browser.close();browser=await launch();page=browser.pages()[0]||await browser.newPage()
 await seedReturning(page)
 await page.goto(url);await page.waitForTimeout(300)
 await page.evaluate(k=>localStorage.setItem(k,'{"version":999,"sentinel":"preserve"}'),key)
 await page.reload();await page.waitForTimeout(600)
 if((await read()).raw!=='{"version":999,"sentinel":"preserve"}')throw Error('unknown version overwritten on load')
 const result={pass:true,checks:['settings and attempt saved','reload score','actual browser restart','restored settings UI','production namespace untouched','write failure preserves snapshot and is visible','unknown version preserved'],saved,physicalDevice:false}
 await writeFile(resolve(import.meta.dirname,'../.exact/persistence-browser.json'),JSON.stringify(result,null,2))
 console.log(JSON.stringify(result,null,2))
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));await rm(profile,{recursive:true,force:true})}
