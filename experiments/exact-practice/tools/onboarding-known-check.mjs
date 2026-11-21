import {createBuildServer} from './serve-build.mjs'
import {readFile,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {chromium} from '/Users/tylr/Code/exact-spike-toolchain/node_modules/playwright-core/index.mjs'
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
 if(!localStorage.getItem('dit.exact-spike.onboarding.v1'))localStorage.setItem('dit.exact-spike.onboarding.v1',JSON.stringify({version:1,status:'pending',step:'known_tour',profile:'known',soundComplete:true,taps:3,holds:3}))
 if(!localStorage.getItem('dit-progress'))localStorage.setItem('dit-progress','production-sentinel')
})
 const response=await page.goto(base+'/app/qso?dit-key-trace=1')
 const id=n=>page.getByTestId(n)
 const assert=async(n,want)=>{const got=n==='transcript'?await id(n).textContent():await id(n).innerText();if(got!==want)throw Error(`${n}: expected ${want}, got ${got}; trace=${JSON.stringify(await page.evaluate(()=>window.__events))}`)}
 await id('nux-start').waitFor({state:'visible'});await page.waitForURL(base+'/app')
 await id('nux-resume').click()
 const check=async(title,target)=>{
  if(await id('nux-tour-title').innerText()!==title)throw Error('wrong tour stop '+title)
  if(!await id(target).isVisible())throw Error('tour target not real visible control '+target)
  const highlight=await id(target).evaluate(el=>getComputedStyle(el).boxShadow)
  if(highlight==='none')throw Error('target not highlighted '+target)
 }
 await check('Modes','nux-target-modes')
 if(await id('mode-listen').isEnabled())throw Error('underlying modes active during tour')
 await id('nux-tour-next').click();await check('Settings','nux-target-settings')
 await id('nux-tour-back').click();await check('Modes','nux-target-modes')
 await id('nux-tour-back').click()
 await id('nux-taps').waitFor({state:'visible'})
 if(!(await id('nux-taps').innerText()).includes('0/3')||!(await id('nux-holds').innerText()).includes('0/3'))throw Error('tour Back did not reset keying gates')
 await page.evaluate(()=>{window.__keys=[];for(const name of ['keydown','keyup'])document.addEventListener(name,e=>window.__keys.push({name,code:e.code,at:performance.now(),target:e.target?.getAttribute('data-testid')}),true)})
 await page.waitForTimeout(150)
 for(const duration of [40,40,40,300,300,300]){await id('morse-key').focus();await page.keyboard.down('Space');await page.waitForTimeout(duration);await page.keyboard.up('Space');await page.waitForTimeout(240)}
 const strokes=await page.evaluate(()=>({keys:window.__keys,store:JSON.parse(localStorage.getItem('dit.exact-spike.onboarding.v1'))}));
 if(strokes.store.taps!==3||strokes.store.holds!==3)throw Error('cold tutorial input misclassified '+JSON.stringify(strokes));
 await id('nux-tour-title').waitFor({state:'visible',timeout:10000});await check('Modes','nux-target-modes')
 await id('nux-tour-next').click();await check('Settings','nux-target-settings')
 await id('nux-tour-next').click();await check('Progress','nux-target-progress')
 await page.screenshot({path:resolve(import.meta.dirname,'../.exact/onboarding-known-tour.png')})
 await id('nux-tour-next').click();await id('target').waitFor({state:'visible'})
 const saved=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)))
 const nux=JSON.parse(saved['dit.exact-spike.onboarding.v1'])
 if(nux.status!=='completed'||nux.profile!=='known'||nux.tourIndex!==undefined)throw Error('known completion wrong '+JSON.stringify(nux))
 if(saved['dit-progress']!=='production-sentinel')throw Error('production key changed')
 if(JSON.parse(saved['dit.exact-spike.practice.v1']??'null')?.history?.length)throw Error('tutorial scored')
 if(external.length||requests.some(r=>r.method!=='GET'||r.body))throw Error('external request')
 if(errors.length)throw Error(errors.join('; '))
 const result={pass:true,strokes,scope:'source ordered known tour on real controls, inert underlying UI, Back resets tutorial, actual 3+3, Finish and local-only persistence',saved,external,errors}
 await writeFile(resolve(import.meta.dirname,'../.exact/onboarding-known-browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2))
}catch(error){console.error(error);throw error}finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
