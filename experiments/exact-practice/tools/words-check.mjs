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
 await id('mode-listen').click();await id('listen-words').click();await page.waitForTimeout(120)
 const played=async()=>page.evaluate(()=>window.__events.filter(x=>String(x).startsWith('word-audio:')))
 if((await played()).length)throw Error('Words entry not silent')
 await id('word-start').click()
 await page.waitForTimeout(80)
 if(await id('word-option-1').isVisible())throw Error('answer exposed while playing')
 const first=(await played()).at(-1)?.slice(11)
 if(!first)throw Error('missing real word playback')
 await page.keyboard.press('1')
 await id('word-option-1').waitFor({state:'visible',timeout:30000})
 const choose=async(correct)=>{
   const target=(await played()).at(-1)?.slice(11)
   for(let i=1;i<=4;i++){
     const text=await id('word-option-'+i).innerText()
     if(text.replace(/^[1-4]\s*/, '').trim()===target ? correct : !correct){await id('word-option-'+i).click();return target}
   }
   throw Error('no matching choice for '+target)
 }
 await choose(true)
 const countAfter=await id('word-count').innerText()
 if(countAfter!=='1/1')throw Error('early key or correct answer miscounted: '+countAfter)
 const feedbackAfter=await id('word-feedback').innerText()
 if(!feedbackAfter)throw Error('no scored feedback')
 await id('word-replay').click();await page.waitForTimeout(80)
 if(await id('word-option-1').isVisible())throw Error('Replay exposed answered options')
 await id('word-option-1').waitFor({state:'visible',timeout:30000})
 if((await played()).at(-1)!==`word-audio:${first}`)throw Error('Replay changed word')
 if(await id('word-count').innerText()!==countAfter||await id('word-feedback').innerText()!==feedbackAfter)throw Error('Replay lost answer')
 await id('word-next').click()
 await id('word-option-1').waitFor({state:'visible',timeout:30000})
 if((await played()).at(-1)===`word-audio:${first}`)throw Error('Next repeated target')
 await choose(false)
 await page.screenshot({path:resolve(import.meta.dirname,'../.exact/words-feedback.png')})
 await id('word-qcodes').click()
 if(await id('word-start').isEnabled())throw Error('Q codes not filtered by TENRA')
 await id('word-pool-toggle').click()
 await id('word-start').click()
 await id('word-option-1').waitFor({state:'visible',timeout:30000})
 await choose(true)
 const finalCount=await id('word-count').innerText()
 if(finalCount!=='2/3')throw Error('wrong/replay/bank counts: '+finalCount)
 await id('word-next').click();await page.waitForTimeout(80)
 await id('mode-practice').click()
 const leaveEvents=(await played()).length
 await page.waitForTimeout(8000)
 if((await played()).length!==leaveEvents)throw Error('stale phrase after exit')
 await id('mode-listen').click();await page.waitForTimeout(120)
 if(await id('word-option-1').isVisible())throw Error('stale completion exposed options on reentry')
 if(await id('word-count').innerText()!==finalCount)throw Error('session count lost on mode reentry')
 const scoreStore=JSON.parse(await page.evaluate(()=>localStorage.getItem('dit.exact-spike.practice.v1')))
 if(scoreStore?.history?.length)throw Error('Words polluted character history')
 if(await page.evaluate(()=>localStorage.getItem('dit-progress'))!=='production-sentinel')throw Error('production namespace changed')
 const result={pass:true,scope:'real Chrome Words/Q code playback-completion gating, Replay, answer, Next, eligibility and cancellation',first,countAfter,finalCount,errors,physicalAudioMeasured:false,events:await page.evaluate(()=>window.__events)}
 if(errors.length)throw Error(errors.join('; '))
 await writeFile(resolve(import.meta.dirname,'../.exact/words-browser.json'),JSON.stringify(result,null,2))
 console.log(JSON.stringify(result,null,2))
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
