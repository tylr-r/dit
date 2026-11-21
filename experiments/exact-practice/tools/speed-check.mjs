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
 await page.addInitScript(()=>{window.__nodes=[];const Base=window.AudioContext;window.AudioContext=class extends Base {createOscillator(){const n=super.createOscillator();const record={};window.__nodes.push(record);const start=n.start.bind(n),stop=n.stop.bind(n);n.start=(t)=>{record.start=t;return start(t)};n.stop=(t)=>{if(Number.isFinite(t))record.stop=t;return stop(t)};return n}}})
 await page.goto(`http://127.0.0.1:${server.address().port}/?dit-key-trace=1`)
 const id=n=>page.getByTestId(n)
 const assert=async(n,want)=>{const got=n==='transcript'?await id(n).textContent():await id(n).innerText();if(got!==want)throw Error(`${n}: expected ${want}, got ${got}; trace=${JSON.stringify(await page.evaluate(()=>window.__events))}`)}
 const input=async(code)=>{for(const symbol of code){const k=symbol==='.'?'ControlLeft':'ControlRight';await page.keyboard.down(k);await page.waitForTimeout(15);await page.keyboard.up(k);await page.waitForTimeout(symbol==='.'?125:325)}await page.waitForTimeout(220)}


 await page.waitForTimeout(450)
 const settings=async()=>page.getByRole('button',{name:'Settings',exact:true}).click()
 const close=async()=>page.getByRole('button',{name:'Close',exact:true}).click()
 await settings();await assert('effective-value','8 effective WPM');await close()
 await id('mode-listen').click();await id('listen-custom').click()
 await id('custom-source').fill('ET E');await id('custom-save').click()
 const measure=async()=>{
   await id('custom-play').click();await id('custom-check').waitFor({state:'visible',timeout:20000})
   const duration=await page.evaluate(()=>{const n=window.__nodes.filter(n=>Number.isFinite(n.start)&&Number.isFinite(n.stop)).at(-1);return n.stop-n.start})
   return duration
 }
 const slow=await measure()
 await settings();for(let i=0;i<4;i++)await id('effective-up').click()
 await assert('effective-value','12 effective WPM')
 if(!(await id('auto-tighten-toggle').innerText()).toLowerCase().includes('off'))throw Error('manual effective change did not turn auto off')
 await close()
 const fast=await measure()
 if(Math.abs(slow-2.87)>0.005||Math.abs(fast-1.55)>0.005)throw Error('wrong audio-clock budgets '+JSON.stringify({slow,fast}))
 await settings();await id('speed-down').click();await id('speed-down').click()
 await assert('effective-value','10 effective WPM')
 await close()
 const stored=await page.evaluate(()=>localStorage.getItem('dit.exact-spike.practice.v1'))
 await page.reload();await page.waitForTimeout(450);await settings();await assert('effective-value','10 effective WPM')
 const after=await page.evaluate(()=>localStorage.getItem('dit.exact-spike.practice.v1'))
 if(stored!==after)throw Error('speed state changed at reload')
 await id('auto-tighten-toggle').click();await assert('effective-value','6 effective WPM')
 await page.screenshot({path:resolve(import.meta.dirname,'../.exact/speed-settings.png')})
 const result={pass:true,scope:'real UI independent effective speed, manual disables auto, clamping, local reload and measured scheduled WebAudio pulse budgets',slow,fast,stored,after,errors,physicalLatencyMeasured:false}
 if(errors.length)throw Error(errors.join('; '))
 await writeFile(resolve(import.meta.dirname,'../.exact/speed-browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2))
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
