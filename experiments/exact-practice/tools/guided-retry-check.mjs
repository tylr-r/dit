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
 await page.evaluate(()=>localStorage.setItem('dit-progress','production-sentinel'))
 const start=async()=>{await page.getByRole('button',{name:'Settings',exact:true}).click();await id('guided-start').click();await page.waitForTimeout(250)}
 const keyTarget=async()=>{const t=await id('target').innerText();if(!['E','T'].includes(t))throw Error('unexpected first-pack target '+t);await input(t==='E'?'.':'-');await page.waitForTimeout(1080);return t}
 const saved=async()=>JSON.parse(await page.evaluate(()=>localStorage.getItem('dit.exact-spike.guided.v1')))
 await start()
 const teachTarget=await id('target').innerText()
 await input(teachTarget==='E'?'-':'.');await page.waitForTimeout(1100)
 if(await id('target').innerText()!==teachTarget)throw Error('Teach miss incorrectly advanced')
 await keyTarget()
 const beforeReload=await saved()
 const firstEvents=await page.evaluate(()=>window.__events)
 await page.reload();await page.waitForTimeout(450)
 const afterReload=await saved()
 if(JSON.stringify(beforeReload)!==JSON.stringify(afterReload))throw Error('reload changed saved guided progress')
 await start()
 for(let i=0;i<3;i++)await keyTarget()
 const practiceAfterTeach=JSON.parse(await page.evaluate(()=>localStorage.getItem('dit.exact-spike.practice.v1')))
 if(practiceAfterTeach&&practiceAfterTeach.history.length)throw Error('Teach polluted scored history')
 await id('guided-continue').click();await page.waitForTimeout(200)
 for(let i=0;i<10;i++)await keyTarget()
 await id('guided-continue').click();await page.waitForTimeout(120)
 for(let i=0;i<6;i++){
   const target=await page.evaluate(()=>window.__events.filter(x=>String(x).startsWith('listen-audio:')).at(-1)?.split(':')[1])
   await id('listen-answer-'+(target==='E'?'T':'E')).click()
   await page.waitForTimeout(i===5?2100:2650)
 }
 const retry=await saved()
 if(retry.data.phase!=='gate-retry')throw Error('failed Listen did not earn retry')
 await id('guided-continue').click();await page.waitForTimeout(100)
 const retryStart=await saved()
 if(retryStart.data.progress.practiceAttempts||retryStart.data.progress.listenAttempts||retryStart.data.progress.teachCounts.E!==2)throw Error('retry reset wrong counters')
 for(let i=0;i<10;i++)await keyTarget()
 await id('guided-continue').click();await page.waitForTimeout(120)
 for(let i=0;i<6;i++){
   const target=await page.evaluate(()=>window.__events.filter(x=>String(x).startsWith('listen-audio:')).at(-1)?.split(':')[1])
   if(!['E','T'].includes(target))throw Error('bad guided Listen target '+target)
   await id('listen-answer-'+(i===0?(target==='E'?'T':'E'):target)).click()
   await page.waitForTimeout(i===5?1750:i===0?2650:2300)
 }
 const atUnlock=await saved()
 await page.screenshot({path:resolve(import.meta.dirname,'../.exact/guided-retry-unlock.png')})
 await id('guided-continue').click();await page.waitForTimeout(250)
 if(!['A','N'].includes(await id('target').innerText()))throw Error('next pack not connected')
 for(let i=0;i<4;i++){
   const letter=await id('target').innerText()
   await input(letter==='A'?'.-':'-.');await page.waitForTimeout(1080)
 }
 await id('guided-continue').click();await page.waitForTimeout(150)
 const final=await saved()
 if(final.data.pack!==1||final.data.phase!=='practice')throw Error('next-pack real keying did not reach Practice')
 if(await page.evaluate(()=>localStorage.getItem('dit-progress'))!=='production-sentinel')throw Error('production key changed')
 const result={pass:true,scope:'real paddle Teach and Practice, real Listen answers, first-pack unlock, isolated mid-Teach reload/resume',beforeReload,afterReload,retry,retryStart,atUnlock,final,errors,physicalAudioMeasured:false,events:[...firstEvents,...await page.evaluate(()=>window.__events)]}
 if(errors.length)throw Error(errors.join('; '))
 await writeFile(resolve(import.meta.dirname,'../.exact/guided-retry-browser.json'),JSON.stringify(result,null,2))
 console.log(JSON.stringify(result,null,2))
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
