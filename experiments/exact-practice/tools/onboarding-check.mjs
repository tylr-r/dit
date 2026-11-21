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
 const response=await page.goto(base+'/app/qso?dit-key-trace=1')
 const id=n=>page.getByTestId(n)
 const assert=async(n,want)=>{const got=n==='transcript'?await id(n).textContent():await id(n).innerText();if(got!==want)throw Error(`${n}: expected ${want}, got ${got}; trace=${JSON.stringify(await page.evaluate(()=>window.__events))}`)}
 const input=async(code)=>{for(const symbol of code){const k=symbol==='.'?'ControlLeft':'ControlRight';await page.keyboard.down(k);await page.waitForTimeout(15);await page.keyboard.up(k);await page.waitForTimeout(symbol==='.'?125:325)}await page.waitForTimeout(220)}
 if(response.status()!==200)throw Error('direct QSO not served')
 await id('nux-start').waitFor({state:'visible'});await page.waitForURL(base+'/app')
 if(await page.evaluate(()=>window.__nodes.length))throw Error('pending onboarding started hidden audio')
 if(await id('qso-consent').isVisible())throw Error('pending onboarding exposed provider consent')
 await page.evaluate(()=>localStorage.setItem('dit-progress','production-sentinel'))
 const advanceToTutorial=async()=>{
  await id('nux-start').click();await id('nux-beginner').click()
  for(let i=0;i<3;i++)await id('nux-continue').click()
  await id('nux-sound-play').click();await id('nux-no-sound').click()
  if(await id('nux-continue').isEnabled())throw Error('No sound enabled Continue')
  await id('nux-sound-heard').click();await id('nux-continue').click()
  await id('nux-taps').waitFor({state:'visible'})
 }
 const key=async(ms)=>{await id('morse-key').focus();await page.keyboard.down('Space');await page.waitForTimeout(ms);await page.keyboard.up('Space');await page.waitForTimeout(240)}
 await advanceToTutorial()
 await key(65);await key(65);await key(300)
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('dit.exact-spike.onboarding.v1')))
 if(saved.taps!==2||saved.holds!==1)throw Error('real tutorial counts not saved '+JSON.stringify(saved))
 await page.reload();await id('nux-start').waitFor({state:'visible'})
 if(await page.evaluate(()=>window.__nodes.length))throw Error('reload resumed tutorial audio')
 await advanceToTutorial()
 if(!/2/.test(await id('nux-taps').innerText())||!/1/.test(await id('nux-holds').innerText()))throw Error('partial tutorial counts lost')
 await key(65);await key(300);await key(300)
 await id('nux-continue').waitFor({state:'visible',timeout:10000})
 await id('nux-continue').click();await id('nux-continue').click()
 await id('guided-phase').waitFor({state:'visible'})
 if(await id('target').innerText()!=='E')throw Error('completed beginner did not enter E Teach')
 const completed=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)))
 const record=JSON.parse(completed['dit.exact-spike.onboarding.v1'])
 if(record.status!=='completed'||record.profile!=='beginner')throw Error('beginner completion not stored')
 if(completed['dit-progress']!=='production-sentinel')throw Error('production namespace changed')
 if(JSON.parse(completed['dit.exact-spike.practice.v1']??'null')?.history?.length)throw Error('tutorial scored attempts')
 if(JSON.stringify(JSON.parse(completed['dit.exact-spike.practice.v1']).settings.selection)!=='{"kind":"tier","level":1}')throw Error('fresh beginner did not receive source six-letter scope')
 await page.screenshot({path:resolve(import.meta.dirname,'../.exact/onboarding-complete.png')})
 await page.reload();await page.waitForTimeout(500)
 if(await id('nux-start').isVisible())throw Error('completed returning user forced back into onboarding')
 await id('mode-conversation').click();await id('qso-send-first').waitFor({state:'visible'})
 await id('qso-send-first').click();await id('qso-consent').waitFor({state:'visible'});await id('qso-consent-cancel').click()
 await page.getByRole('button',{name:'Settings',exact:true}).click();await id('nux-replay').click()
 await id('nux-start').waitFor({state:'visible'});await page.waitForURL(base+'/app')
 await id('nux-skip').click();await id('mode-conversation').waitFor({state:'visible'})
 const afterSkip=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)))
 for(const k of ['dit-progress','dit.exact-spike.practice.v1','dit.exact-spike.guided.v1'])if(afterSkip[k]!==completed[k])throw Error('replay/skip changed existing choice '+k)
 if(external.length||requests.some(r=>r.method!=='GET'||r.body))throw Error('onboarding attempted external request')
 if(errors.length)throw Error(errors.join('; '))
 const result={pass:true,scope:'genuinely clean linked QSO ownership, sound confirmation, real 3+3 input with cold resume, beginner Teach, completed return and replay/skip privacy',saved,completed,afterSkip,external,errors}
 await writeFile(resolve(import.meta.dirname,'../.exact/onboarding-browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2))
}catch(error){console.error(error);throw error}finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
