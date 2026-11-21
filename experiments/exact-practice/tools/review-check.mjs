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
try{
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true})
 const page=await browser.newPage({viewport:{width:390,height:844},colorScheme:'dark'})
 await seedReturning(page)
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.addInitScript(()=>{window.__events=[];document.addEventListener('dit-key-event',e=>window.__events.push(e.detail))})
 await page.goto(`http://127.0.0.1:${server.address().port}/?dit-key-trace=1`)
 const id=n=>page.getByTestId(n)
 const assert=async(n,want)=>{const got=n==='transcript'?await id(n).textContent():await id(n).innerText();if(got!==want)throw Error(`${n}: expected ${want}, got ${got}; trace=${JSON.stringify(await page.evaluate(()=>window.__events))}`)}
 const input=async(code)=>{for(const symbol of code){const k=symbol==='.'?'ControlLeft':'ControlRight';await page.keyboard.down(k);await page.waitForTimeout(15);await page.keyboard.up(k);await page.waitForTimeout(symbol==='.'?125:325)}await page.waitForTimeout(220)}

 await page.waitForTimeout(450)
 await page.getByRole('button',{name:'Settings',exact:true}).click()
 if((await id('strategy-toggle').innerText()).toLowerCase().includes('weighted'))await id('strategy-toggle').click()
 await page.getByRole('button',{name:'Close',exact:true}).click()
 await assert('target','T')
 await input('.');await assert('feedback','Try again');await page.waitForTimeout(1050);await assert('target','E')
 await input('.');await assert('feedback','Correct');await page.waitForTimeout(1050);await assert('target','N')
 await input('-.');await assert('feedback','Correct');await page.waitForTimeout(1050);await assert('target','T')
 const result={pass:true,scope:'real Chrome deferred review overrides sequential draw after three selections',physicalAudioMeasured:false,errors,events:await page.evaluate(()=>window.__events)}
 if(errors.length)throw Error(errors.join('; '))
 await writeFile(resolve(import.meta.dirname,'../.exact/review-browser.json'),JSON.stringify(result,null,2))
 await page.screenshot({path:resolve(import.meta.dirname,'../.exact/review-browser.png')})
 console.log(JSON.stringify(result,null,2))
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
