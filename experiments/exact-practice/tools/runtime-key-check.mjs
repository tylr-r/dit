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
 await page.addInitScript(()=>{
  window.__key=[];window.__audio=[]
  document.addEventListener('dit-key-event',e=>window.__key.push({event:e.detail,time:performance.now()}))
  const start=OscillatorNode.prototype.start
  OscillatorNode.prototype.start=function(...args){window.__audio.push({event:'oscillator',state:this.context.state,time:performance.now()});return start.apply(this,args)}
  const gain=AudioParam.prototype.setTargetAtTime
  AudioParam.prototype.setTargetAtTime=function(...args){window.__audio.push({event:'gain',value:args[0],time:performance.now()});return gain.apply(this,args)}
 })
 await page.goto(`http://127.0.0.1:${server.address().port}/?dit-key-trace=1`)
 await page.waitForTimeout(500)
 const key=page.getByRole('button',{name:'Morse key',exact:true})
 // Real, cold first input. No Play/priming click before this.
 await key.hover();await page.mouse.down();await page.waitForTimeout(300);await page.mouse.up();await page.waitForTimeout(260)
 if(!(await page.locator('body').innerText()).includes('Correct'))throw Error('cold straight hold did not grade T')
 await page.waitForTimeout(650)
 await page.keyboard.down('ControlLeft');await page.waitForTimeout(30);await page.keyboard.up('ControlLeft');await page.waitForTimeout(350)
 if(!(await page.locator('body').innerText()).includes('Correct'))throw Error('timed paddle E did not grade')
 await page.waitForTimeout(650)
 // N: complete dah, switch to dit before its end, release both after next starts.
 await page.keyboard.down('ControlRight');await page.waitForTimeout(100)
 await page.keyboard.down('ControlLeft');await page.keyboard.up('ControlRight');await page.waitForTimeout(340)
 await page.keyboard.up('ControlLeft');await page.waitForTimeout(300)
 const trace=()=>page.evaluate(()=>window.__key)
 if(!(await trace()).some(x=>x.event==='sequence:-.'))throw Error('complete N sequence not emitted')
 // Escape cancels an ongoing paddle and discards the pending attempt.
 const count=(await trace()).filter(x=>x.event.startsWith('sequence:')).length
 await page.keyboard.down('ControlRight');await page.waitForTimeout(30);await page.keyboard.press('Escape');await page.keyboard.up('ControlRight');await page.waitForTimeout(550)
 if((await trace()).filter(x=>x.event.startsWith('sequence:')).length!==count)throw Error('cancel leaked a sequence')
 await page.getByRole('button',{name:'Settings',exact:true}).click()
 const before=(await trace()).length
 await page.keyboard.down('ControlLeft');await page.waitForTimeout(30);await page.keyboard.up('ControlLeft');await page.waitForTimeout(350)
 if((await trace()).slice(before).some(x=>x.event==='active:on'))throw Error('modal failed to suppress key')
 await page.getByRole('button',{name:'Close',exact:true}).click()
 await page.waitForTimeout(100)
 await key.hover();await page.mouse.down();await page.waitForTimeout(50)
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')))
 await page.mouse.up();await page.waitForTimeout(350)
 const result={kind:'real Chrome events and continuous WebAudio API observations',physicalAudioMeasured:false,errors,trace:await trace(),audio:await page.evaluate(()=>window.__audio)}
 if(errors.length)throw Error(errors.join('; '))
 if(!result.audio.some(x=>x.event==='oscillator'))throw Error('continuous oscillator did not start')
 if(!result.audio.some(x=>x.event==='gain'&&x.value>0))throw Error('tone never gated on')
 if(result.audio.filter(x=>x.event==='gain').at(-1)?.value!==0)throw Error('tone remained active after blur')
 await writeFile(resolve(import.meta.dirname,'../.exact/runtime-browser.json'),JSON.stringify(result,null,2))
 await page.screenshot({path:resolve(import.meta.dirname,'../.exact/runtime-browser.png')})
 console.log(JSON.stringify({pass:true,assertions:['cold touch T','paddle E','multi-symbol N','Escape cancellation','modal suppression','blur silence','continuous oscillator'],trace:result.trace,errors},null,2))
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
