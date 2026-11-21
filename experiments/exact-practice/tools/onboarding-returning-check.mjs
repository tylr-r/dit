import {createBuildServer} from './serve-build.mjs'
import {createServer} from 'node:http'
import {readFile,writeFile} from 'node:fs/promises'
import {resolve,extname} from 'node:path'
import {chromium} from '/Users/tylr/Code/exact-spike-toolchain/node_modules/playwright-core/index.mjs'
import {qsoPlan} from '../modules/web/qso.mjs'
const root=resolve(import.meta.dirname,'../target/audio-check-dist')
const manifest=JSON.parse(await readFile(resolve(root,'routes.json'),'utf8'))
const server=await createBuildServer(root)
await new Promise(r=>server.listen(0,'127.0.0.1',r))
let browser
try{
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true})
 const page=await browser.newPage({viewport:{width:390,height:844},colorScheme:'dark'})
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.addInitScript(()=>{window.__events=[];document.addEventListener('dit-key-event',e=>window.__events.push(e.detail))})
 const external=[]
 const requests=[]
 await page.route('**/*',route=>{const req=route.request();const u=new URL(req.url());requests.push({url:req.url(),method:req.method(),body:req.postData()});if(u.hostname!=='127.0.0.1'){external.push(req.url());return route.abort()}return route.continue()})
 await page.addInitScript(()=>{window.__audioContexts=[];window.__nodes=[];const Base=window.AudioContext;window.AudioContext=class extends Base {constructor(...args){super(...args);window.__audioContexts.push(this)} createOscillator(){const n=super.createOscillator();const record={};window.__nodes.push(record);const start=n.start.bind(n),stop=n.stop.bind(n);n.start=t=>{record.start=t;return start(t)};n.stop=t=>{if(Number.isFinite(t))record.stop=t;return stop(t)};return n}}})
 const base=`http://127.0.0.1:${server.address().port}`
 await page.addInitScript(()=>{
 const key='dit.exact-spike.practice.v1'
 if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({version:1,settings:{speed:23,effectiveSpeed:19,autoTighten:false,autoCorrect:8,pitch:720,ifr:true,words:true,strategy:'weighted',reviewMisses:true},scores:{T:7},history:[{letter:'T',correct:true,atMs:123}]}))
 if(!localStorage.getItem('dit-progress'))localStorage.setItem('dit-progress','production-sentinel')
})
 const response=await page.goto(base+'/app/qso?dit-key-trace=1')
 const id=n=>page.getByTestId(n)
 const assert=async(n,want)=>{const got=n==='transcript'?await id(n).textContent():await id(n).innerText();if(got!==want)throw Error(`${n}: expected ${want}, got ${got}; trace=${JSON.stringify(await page.evaluate(()=>window.__events))}`)}
 const input=async(code)=>{for(const symbol of code){const k=symbol==='.'?'ControlLeft':'ControlRight';await page.keyboard.down(k);await page.waitForTimeout(15);await page.keyboard.up(k);await page.waitForTimeout(symbol==='.'?125:325)}await page.waitForTimeout(220)}
 await id('qso-send-first').waitFor({state:'visible'})
 if(await id('nux-start').isVisible())throw Error('returning experiment user forced into setup')
 const before=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)))
 if(before['dit.exact-spike.onboarding.v1']!==undefined)throw Error('implicit legacy return wrote onboarding migration')
 await page.getByRole('button',{name:'Settings',exact:true}).click();await id('nux-replay').click()
 await id('nux-start').waitFor({state:'visible'});await page.waitForURL(base+'/app')
 await page.goto(base+'/app/qso');await id('nux-start').waitFor({state:'visible'});await page.waitForURL(base+'/app')
 if(await page.evaluate(()=>window.__nodes.length))throw Error('pending replay deep-link started audio')
 await id('nux-skip').click();await id('mode-conversation').click();await id('qso-send-first').waitFor({state:'visible'})
 const skipped=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)))
 if(skipped['dit.exact-spike.practice.v1']!==before['dit.exact-spike.practice.v1']||skipped['dit-progress']!==before['dit-progress'])throw Error('replay/skip overwrote existing preferences or progress')
 await page.evaluate(()=>localStorage.setItem('dit.exact-spike.onboarding.v1','{"version":999,"sentinel":"preserve"}'))
 await page.reload();await id('qso-send-first').waitFor({state:'visible'})
 const future=await page.evaluate(()=>localStorage.getItem('dit.exact-spike.onboarding.v1'))
 if(future!=='{"version":999,"sentinel":"preserve"}')throw Error('future onboarding overwritten')
 await page.getByRole('button',{name:'Settings',exact:true}).click();await id('nux-replay').click();await id('nux-start').waitFor({state:'visible'})
 const protectedMessage=await id('nux-storage').innerText()
 if(!protectedMessage.includes('protected'))throw Error('future schema did not disclose temporary setup')
 if(await page.evaluate(()=>localStorage.getItem('dit.exact-spike.onboarding.v1'))!==future)throw Error('future schema overwritten by replay')
 await page.evaluate(()=>localStorage.removeItem('dit.exact-spike.onboarding.v1'))
 await page.reload();await page.waitForTimeout(350)
 await page.getByRole('button',{name:'Settings',exact:true}).click();await id('nux-replay').click()
 await id('nux-start').waitFor({state:'visible'})
 const beforeFinal=await page.evaluate(()=>localStorage.getItem('dit.exact-spike.onboarding.v1'))
 await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('Synthetic final-save quota','QuotaExceededError')}})
 await id('nux-skip').click()
 const unavailableMessage=await id('nux-save-warning').innerText()
 if(!/saved|save/.test(unavailableMessage))throw Error('final save failure hidden')
 if(await page.evaluate(()=>localStorage.getItem('dit.exact-spike.onboarding.v1'))!==beforeFinal)throw Error('failed final save damaged snapshot')
 if(await page.evaluate(()=>localStorage.getItem('dit.exact-spike.practice.v1'))!==before['dit.exact-spike.practice.v1'])throw Error('failed setup damaged existing progress')
 if(external.length||requests.some(r=>r.method!=='GET'||r.body))throw Error('unexpected external/payload request')
 if(errors.length)throw Error(errors.join('; '))
 const result={pass:true,scope:'seeded legacy return, explicit pending overrides, skipped choices preserved, future schema untouched',before,skipped,future,protectedMessage,unavailableMessage,external,errors}
 await writeFile(resolve(import.meta.dirname,'../.exact/onboarding-returning-browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2))
}catch(error){console.error(error);throw error}finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
