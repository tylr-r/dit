import {seedReturning} from './seed-returning.mjs'
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
 await seedReturning(page)
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.addInitScript(()=>{window.__events=[];document.addEventListener('dit-key-event',e=>window.__events.push(e.detail))})
 const external=[]
 const requests=[]
 await page.route('**/*',route=>{const req=route.request();const u=new URL(req.url());requests.push({url:req.url(),method:req.method(),body:req.postData()});if(u.hostname!=='127.0.0.1'){external.push(req.url());return route.abort()}return route.continue()})
 await page.addInitScript(()=>{window.__audioContexts=[];window.__nodes=[];const Base=window.AudioContext;window.AudioContext=class extends Base {constructor(...args){super(...args);window.__audioContexts.push(this)} createOscillator(){const n=super.createOscillator();const record={};window.__nodes.push(record);const start=n.start.bind(n),stop=n.stop.bind(n);n.start=t=>{record.start=t;return start(t)};n.stop=t=>{if(Number.isFinite(t))record.stop=t;return stop(t)};return n}}})
 const base=`http://127.0.0.1:${server.address().port}`
 const response=await page.goto(base+'/app/qso?dit-key-trace=1')
 const id=n=>page.getByTestId(n)
 const assert=async(n,want)=>{const got=n==='transcript'?await id(n).textContent():await id(n).innerText();if(got!==want)throw Error(`${n}: expected ${want}, got ${got}; trace=${JSON.stringify(await page.evaluate(()=>window.__events))}`)}
 const input=async(code)=>{for(const symbol of code){const k=symbol==='.'?'ControlLeft':'ControlRight';await page.keyboard.down(k);await page.waitForTimeout(15);await page.keyboard.up(k);await page.waitForTimeout(symbol==='.'?125:325)}await page.waitForTimeout(220)}
 if(response.status()!==200)throw Error('declared QSO deep link not served '+response.status())
 await id('qso-send-first').waitFor({state:'visible'})
 if(await id('morse-key').count()!==1)throw Error('duplicate key host on direct route')
 if(await page.evaluate(()=>window.__nodes.length))throw Error('direct route autoplay')
 await page.evaluate(()=>localStorage.setItem('dit-progress','production-sentinel'))
 await page.getByRole('button',{name:'Settings',exact:true}).click();await id('pitch-up').click();await page.getByRole('button',{name:'Close',exact:true}).click()
 const before=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)))
 await id('qso-receive-first').click();await id('qso-consent-allow').click();await id('qso-copy').waitFor({state:'visible'});await id('qso-copy').fill('LOCAL ROUTE COPY')
 await page.reload();await id('qso-send-first').waitFor({state:'visible'})
 if(!page.url().includes('/app/qso'))throw Error('reload lost route')
 if(await page.evaluate(()=>window.__nodes.length))throw Error('reload resurrected audio')
 await id('mode-practice').click();await page.waitForURL(base+'/app')
 await id('mode-conversation').click();await page.waitForURL(base+'/app/qso')
 await id('qso-send-first').click();await id('qso-consent-allow').click();await id('morse-key').focus();await input('.')
 await page.keyboard.down('ControlRight');await page.waitForTimeout(30)
 await page.goBack();await page.waitForURL(base+'/app');await page.keyboard.up('ControlRight');await page.waitForTimeout(600)
 await page.goForward();await page.waitForURL(base+'/app/qso');await id('qso-send-first').waitFor({state:'visible'})
 if(await id('morse-key').count()!==1)throw Error('history duplicated key host')
 const contexts=await page.evaluate(()=>window.__audioContexts.length)
 if(contexts>1)throw Error('history created duplicate AudioContexts')
 await id('qso-send-first').click();await id('qso-consent').waitFor({state:'visible'});await id('qso-consent-cancel').click()
 await page.getByRole('button',{name:'Settings',exact:true}).click()
 await page.goBack();await page.waitForURL(base+'/app')
 if(await page.getByRole('dialog').isVisible())throw Error('old settings dialog survived browser Back')
 await page.goForward();await page.waitForURL(base+'/app/qso');await id('qso-send-first').waitFor({state:'visible'})
 await page.goto(base+'/app');await id('target').waitFor({state:'visible'})
 if(await page.evaluate(()=>window.__nodes.length))throw Error('direct study route autoplay')
 const after=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)))
 if(JSON.stringify(before)!==JSON.stringify(after))throw Error('history changed local data '+JSON.stringify({before,after}))
 const trace=await page.evaluate(()=>window.__events)
 if(JSON.stringify(trace).includes('LOCAL ROUTE COPY'))throw Error('copy leaked')
 if(external.length||requests.some(r=>r.method!=='GET'||r.body))throw Error('external/payload request')
 if(errors.length)throw Error(errors.join('; '))
 await page.screenshot({path:resolve(import.meta.dirname,'../.exact/conversation-route.png')})
 await page.goto(base+'/');await id('mode-freestyle').click();await id('mode-practice').click()
 await page.waitForTimeout(120);await id('morse-key').focus();await input('-')
 const pendingFeedback=await id('feedback').innerText()
 if(pendingFeedback!=='Correct')throw Error('same-mode fixture did not reach pending feedback: '+pendingFeedback)
 await page.goBack();await page.waitForTimeout(1400)
 const sameModeTarget=await id('target').innerText()
 const sameModeFeedback=await id('feedback').innerText()
 if(sameModeTarget!=='T'||sameModeFeedback.trim()!=='')throw Error('prior route feedback timer survived: '+JSON.stringify({sameModeTarget,sameModeFeedback,url:page.url()}))
 const result={pass:true,pendingFeedback,sameModeTarget,sameModeFeedback,scope:'manifest-served direct QSO, silent reload, real mode/history navigation, held-key cancellation, single audio owner, fresh consent and retained local settings',routes:manifest.routes,contexts,before,after,external,errors}
 await writeFile(resolve(import.meta.dirname,'../.exact/route-browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2))
}catch(error){console.error(error);throw error}finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
