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


 await page.waitForTimeout(450);await id('mode-listen').click();await page.waitForTimeout(100)
 for(let i=0;i<12;i++){
   const target=await page.evaluate(()=>window.__events.filter(s=>s.startsWith('listen-audio:')).at(-1).slice(13))
   await id('listen-answer-'+target).click()
   if(i<11)await page.waitForTimeout(2250)
 }
 await page.getByRole('button',{name:'Settings',exact:true}).click()
 await assert('effective-value','10 effective WPM')
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('dit.exact-spike.practice.v1')))
 if(saved.settings.autoCorrect!==12||!saved.settings.autoTighten)throw Error('auto12 count invalid')
 const result={pass:true,scope:'12 real Character Listen answers advance auto spacing to stage2',saved,errors,events:await page.evaluate(()=>window.__events)}
 if(errors.length)throw Error(errors.join('; '))
 await writeFile(resolve(import.meta.dirname,'../.exact/auto-speed-browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2))
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
