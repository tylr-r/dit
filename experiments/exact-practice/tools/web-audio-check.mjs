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
 await page.addInitScript(()=>{
  window.__audio=[]
  const P=AudioBufferSourceNode.prototype
  const start=P.start,stop=P.stop
  P.start=function(...args){window.__audio.push({event:'start',time:performance.now(),context:this.context.state,duration:this.buffer?.duration,scheduled:args[0]??0});return start.apply(this,args)}
  P.stop=function(...args){window.__audio.push({event:'stop',time:performance.now(),context:this.context.state,scheduled:args[0]??0});return stop.apply(this,args)}
 })
 await page.goto(`http://127.0.0.1:${server.address().port}/`)
 await page.getByRole('button',{name:'Play target sound',exact:true}).click()
 await page.waitForTimeout(350)
 const key=page.getByRole('button',{name:'Morse key',exact:true});await key.hover();await page.mouse.down();await page.waitForTimeout(300);await page.mouse.up();await page.waitForTimeout(100)
 const result={mode:'ordinary real-time browser, not Exact agent clock',acousticLatencyMeasured:false,events:await page.evaluate(()=>window.__audio),screen:await page.locator('body').innerText()}
 console.log(JSON.stringify(result,null,2))
 if(!result.events.some(e=>e.event==='start'&&e.duration>=9&&e.context==='running'))throw Error('live sidetone buffer never started in running AudioContext')
 if(!result.screen.includes('Correct'))throw Error('real-time hold did not score T')
 await page.screenshot({path:resolve(import.meta.dirname,'../.exact/practice-real-browser.png')})
 await writeFile(resolve(import.meta.dirname,'../.exact/audio-check.json'),JSON.stringify(result,null,2))
 console.log(JSON.stringify(result,null,2))
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
