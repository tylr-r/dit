import {seedReturning} from './seed-returning.mjs'
import {createBuildServer} from './serve-build.mjs'
import {createServer} from 'node:http'
import {readFile,writeFile} from 'node:fs/promises'
import {resolve,extname} from 'node:path'
import {chromium} from '/Users/tylr/Code/exact-spike-toolchain/node_modules/playwright-core/index.mjs'
import {qsoPlan} from '../modules/web/qso.mjs'
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
 const external=[]
 const requests=[]
 await page.route('**/*',route=>{const req=route.request();const u=new URL(req.url());requests.push({url:req.url(),method:req.method(),body:req.postData()});if(u.hostname!=='127.0.0.1'){external.push(req.url());return route.abort()}return route.continue()})
 await page.addInitScript(()=>{window.__audioContexts=[];window.__nodes=[];const Base=window.AudioContext;window.AudioContext=class extends Base {constructor(...args){super(...args);window.__audioContexts.push(this)} createOscillator(){const n=super.createOscillator();const record={};window.__nodes.push(record);const start=n.start.bind(n),stop=n.stop.bind(n);n.start=t=>{record.start=t;return start(t)};n.stop=t=>{if(Number.isFinite(t))record.stop=t;return stop(t)};return n}}})
 await page.goto(`http://127.0.0.1:${server.address().port}/?dit-key-trace=1`)
 const id=n=>page.getByTestId(n)
 const assert=async(n,want)=>{const got=n==='transcript'?await id(n).textContent():await id(n).innerText();if(got!==want)throw Error(`${n}: expected ${want}, got ${got}; trace=${JSON.stringify(await page.evaluate(()=>window.__events))}`)}
 const input=async(code)=>{for(const symbol of code){const k=symbol==='.'?'ControlLeft':'ControlRight';await page.keyboard.down(k);await page.waitForTimeout(15);await page.keyboard.up(k);await page.waitForTimeout(symbol==='.'?125:325)}await page.waitForTimeout(220)}
 await page.waitForTimeout(450)
 await page.evaluate(()=>localStorage.setItem('dit-progress','production-sentinel'))
 const before=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)))
 await id('mode-conversation').click();await id('qso-receive-first').click()
 await id('qso-consent').waitFor({state:'visible'})
 if(await page.evaluate(()=>window.__audioContexts.length))throw Error('audio prepared before consent')
 await id('qso-consent-cancel').click()
 await id('qso-send-first').waitFor({state:'visible'})
 if(await page.evaluate(()=>window.__audioContexts.length))throw Error('cancel initialized audio')
 await id('qso-receive-first').click();await id('qso-consent-allow').click()
 await id('qso-live-toggle').click()
 await page.waitForFunction(()=>document.querySelector('[data-testid="qso-live-text"]')?.textContent==='C',{},{timeout:15000})
 await id('qso-pause').click()
 const partial=await id('qso-live-text').innerText()
 const paused=await page.evaluate(()=>window.__audioContexts.map(c=>({state:c.state,time:c.currentTime})))
 await page.waitForTimeout(1200)
 if(await id('qso-live-text').innerText()!==partial)throw Error('paused live reveal advanced')
 const pausedAfter=await page.evaluate(()=>window.__audioContexts.map(c=>({state:c.state,time:c.currentTime})))
 if(paused.some((c,i)=>Math.abs(pausedAfter[i].time-c.time)>0.01))throw Error('real audio clock advanced paused')
 await id('qso-resume').click()
 await id('qso-copy').fill('CQ X PRIVATE')
 await id('qso-start-turn').waitFor({state:'visible',timeout:20000})
 const complete=await id('qso-live-text').innerText()
 if(complete!=='CQ K')throw Error('live completion mismatch '+complete)
 await id('qso-start-turn').click()
 if(await id('qso-copy').inputValue()!=='CQ X PRIVATE')throw Error('handoff lost copy')
 await id('qso-copy-hide').click()
 if(await id('qso-copy').isVisible())throw Error('Hide did not collapse copy')
 await id('qso-copy-expand').click()
 if(await id('qso-copy').inputValue()!=='CQ X PRIVATE')throw Error('Hide cleared copy')
 await id('qso-check').click()
 await id('qso-prosign-toggle').click();await id('qso-prosigns').waitFor({state:'visible'})
 await id('morse-key').focus();await input('.')
 if(!(await id('qso-draft').innerText()).includes('E'))throw Error('prosign panel blocks keying')
 await page.screenshot({path:resolve(import.meta.dirname,'../.exact/conversation-local-ux.png')})
 await id('qso-clear').click();await id('qso-replay').click()
 if(await id('qso-copy').inputValue()!=='')throw Error('Replay retained copy')
 await id('qso-end').click();await id('qso-new').click();await id('qso-send-first').click()
 await id('qso-consent').waitFor({state:'visible'})
 await id('qso-consent-cancel').click()
 await id('mode-practice').click()
 const after=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)))
 if(JSON.stringify(before)!==JSON.stringify(after))throw Error('local Conversation changed persistence')
 const events=await page.evaluate(()=>window.__events)
 if(JSON.stringify(events).includes('CQ X PRIVATE'))throw Error('copy leaked to trace')
 if(external.length||requests.some(r=>r.method!=='GET'||r.body))throw Error('external or payload request attempted')
 if(errors.length)throw Error(errors.join('; '))
 const result={pass:true,scope:'simulated per-contact consent, actual audio-clock progressive reveal and pause, retained local copy, nonmodal reference, no provider/network',partial,complete,paused,pausedAfter,before,after,requests,external,errors}
 await writeFile(resolve(import.meta.dirname,'../.exact/conversation-ux-browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2))
}catch(error){console.error(error);throw error}finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
