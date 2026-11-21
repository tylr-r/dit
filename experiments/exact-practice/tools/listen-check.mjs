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
 await id('mode-listen').click();await page.waitForTimeout(80)
 await assert('listen-reveal','')
 const played=async()=>page.evaluate(()=>window.__events.filter(x=>String(x).startsWith('listen-audio:')))
 const first=(await played()).at(-1)?.split(':')[1]
 if(!first)throw Error('entry did not autoplay')
 await id(`listen-answer-${first}`).click()
 await assert('listen-reveal',first)
 await page.screenshot({path:resolve(import.meta.dirname,'../.exact/listen-reveal.png')})
 const count=(await played()).length
 await id('listen-play').click({force:true});await page.waitForTimeout(150)
 if((await played()).length!==count)throw Error('replay accepted during feedback')
 await page.waitForTimeout(2300)
 await assert('listen-reveal','')
 const second=(await played()).at(-1)?.split(':')[1]
 if(!second||second===first)throw Error('did not advance/autoplay next')
 await id('listen-play').click();await page.waitForTimeout(80)
 if((await played()).at(-1)!==`listen-audio:${second}`)throw Error('replay changed target')
 const wrong=[...'TENRA'].find(x=>x!==second)
 await page.keyboard.press(wrong)
 await assert('listen-reveal',second)
 await page.waitForTimeout(2700)
 await assert('listen-reveal','')
 await page.getByRole('button',{name:'Settings',exact:true}).click()
 const beforePause=(await played()).length
 await page.waitForTimeout(2800)
 if((await played()).length!==beforePause)throw Error('audio continued in settings')
 await page.getByRole('button',{name:'Close',exact:true}).click()
 await id('mode-practice').click();const beforeMode=(await played()).length
 await page.waitForTimeout(2800)
 if((await played()).length!==beforeMode)throw Error('late listen after mode leave')
 if(await page.evaluate(()=>localStorage.getItem('dit-progress'))!=='production-sentinel')throw Error('production key changed')
 const stored=await page.evaluate(()=>localStorage.getItem('dit.exact-spike.practice.v1'))
 const priorEvents=await page.evaluate(()=>window.__events)
 const saved=JSON.parse(stored)
 if(saved.history.length!==2||saved.history.some(x=>x.mode!=='listen')||!saved.history[0].correct||saved.history[1].correct)throw Error('Listen outcomes not separately persisted')
 await page.reload();await page.waitForTimeout(450)
 if(await page.evaluate(()=>localStorage.getItem('dit.exact-spike.practice.v1'))!==stored)throw Error('reload rewrote snapshot')
 const result={pass:true,scope:'real Chrome Listen Characters entry/audio/replay/answers/reveal/cancellation and isolated reload',physicalAudioMeasured:false,errors,saved,events:priorEvents,reloadedEvents:await page.evaluate(()=>window.__events)}
 if(errors.length)throw Error(errors.join('; '))
 await writeFile(resolve(import.meta.dirname,'../.exact/listen-browser.json'),JSON.stringify(result,null,2))
 await page.screenshot({path:resolve(import.meta.dirname,'../.exact/listen-browser.png')})
 console.log(JSON.stringify(result,null,2))
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
