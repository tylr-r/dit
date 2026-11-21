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
 const external=[]
 const requests=[]
 await page.route('**/*',route=>{const req=route.request();const u=new URL(req.url());requests.push({url:req.url(),method:req.method(),body:req.postData()});if(u.hostname!=='127.0.0.1'){external.push(req.url());return route.abort()}return route.continue()})
 await page.addInitScript(()=>{window.__audioContexts=[];const Base=window.AudioContext;window.AudioContext=class extends Base {constructor(...args){super(...args);window.__audioContexts.push(this)}}})
 await page.goto(`http://127.0.0.1:${server.address().port}/?dit-key-trace=1`)
 const id=n=>page.getByTestId(n)
 const assert=async(n,want)=>{const got=n==='transcript'?await id(n).textContent():await id(n).innerText();if(got!==want)throw Error(`${n}: expected ${want}, got ${got}; trace=${JSON.stringify(await page.evaluate(()=>window.__events))}`)}
 const input=async(code)=>{for(const symbol of code){const k=symbol==='.'?'ControlLeft':'ControlRight';await page.keyboard.down(k);await page.waitForTimeout(15);await page.keyboard.up(k);await page.waitForTimeout(symbol==='.'?125:325)}await page.waitForTimeout(220)}


 await page.waitForTimeout(450)
 await page.evaluate(()=>localStorage.setItem('dit-listen-custom-text-v1','production-sentinel'))
 await id('mode-listen').click();await id('listen-custom').click()
 await id('custom-source').fill('  et  E! 🐰 ')
 await id('custom-save').click()
 if(await id('custom-source').isVisible())throw Error('editor not hidden after save')
 await id('custom-play').click();await page.waitForTimeout(100)
 if(await id('custom-reveal').isVisible())throw Error('source exposed while playing')
 await id('custom-copy').fill('ET T')
 await id('custom-pause').click()
 if(await id('custom-copy').isEnabled())throw Error('copy editable while paused')
 const paused=await page.evaluate(()=>window.__audioContexts.map(c=>({state:c.state,time:c.currentTime})))
 await page.waitForTimeout(4500)
 const pausedAfter=await page.evaluate(()=>window.__audioContexts.map(c=>({state:c.state,time:c.currentTime})))
 if(!paused.length||paused.some((c,i)=>c.state!=='suspended'||Math.abs(pausedAfter[i].time-c.time)>0.01))throw Error('audio clock did not actually pause')
 if(await id('custom-check').isVisible())throw Error('paused audio ended on wall time')
 await id('custom-resume').click()
 await id('custom-check').waitFor({state:'visible',timeout:30000})
 if(await id('custom-reveal').isVisible())throw Error('source automatically revealed')
 await id('custom-copy').fill('ET T')
 await id('custom-check').click()
 await assert('custom-reveal','ET E')
 const summary=await id('custom-summary').innerText()
 if(summary!=='3/4 matched · 1 missed · 1 extra')throw Error('diff did not match shipped LCS: '+summary)
 await page.screenshot({path:resolve(import.meta.dirname,'../.exact/custom-diff.png')})
 await id('custom-replay').click()
 if(await id('custom-copy').inputValue()!=='')throw Error('Replay retained typed copy')
 await id('custom-pause').click();await id('custom-end').click()
 await assert('custom-reveal','ET E')
 await id('mode-practice').click()
 await id('morse-key').focus();await page.keyboard.down('Space');await page.waitForTimeout(120);await id('mode-freestyle').click();await page.keyboard.up('Space')
 if(await page.evaluate(()=>window.__audioContexts.at(-1).state)!=='running')throw Error('paused End left later key audio suspended')
 await page.reload();await page.waitForTimeout(450)
 await id('mode-listen').click();await id('listen-custom').click()
 await id('custom-play').waitFor({state:'visible'})
 if(await id('custom-source').isVisible())throw Error('saved active custom did not restore hidden Setup')
 await id('custom-play').click()
 if(await id('custom-copy').inputValue()!=='')throw Error('typed copy persisted after reload')
 await id('mode-practice').click();await page.waitForTimeout(5000)
 await id('mode-listen').click();await id('listen-custom').click()
 if(await id('custom-reveal').isVisible())throw Error('late completion revealed after leave')
 const allStorage=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)))
 if(allStorage['dit-listen-custom-text-v1']!=='production-sentinel')throw Error('production namespace changed')
 if(Object.values(allStorage).some(v=>v.includes('ET T')))throw Error('typed copy saved')
 if(JSON.parse(allStorage['dit.exact-spike.practice.v1']??'null')?.history?.length)throw Error('Custom copy polluted character score history')
 if(external.length)throw Error('external requests attempted: '+external.join(','))
 if(requests.some(r=>r.method!=='GET'||r.body))throw Error('text may have been transmitted')
 const result={pass:true,scope:'synthetic local custom passage, real pause/resume/completion, manual reveal, source diff, transient copy, local-only network and reload',summary,paused,pausedAfter,allStorage,external,requests,errors,physicalAudioMeasured:false,events:await page.evaluate(()=>window.__events)}
 if(errors.length)throw Error(errors.join('; '))
 await writeFile(resolve(import.meta.dirname,'../.exact/custom-browser.json'),JSON.stringify(result,null,2))
 console.log(JSON.stringify(result,null,2))
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
