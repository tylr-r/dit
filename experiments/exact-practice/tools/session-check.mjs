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
 const assert=async(n,want)=>{const got=n==='transcript'?await id(n).textContent():await id(n).innerText();if(got!==want)throw Error(`${n}: expected ${want}, got ${got}`)}
 const input=async(code)=>{await id('morse-key').hover();for(const symbol of code){await page.mouse.down();await page.waitForTimeout(symbol==='.'?65:280);await page.mouse.up();await page.waitForTimeout(55)}await page.waitForTimeout(240)}
 await page.waitForTimeout(450)
 await page.getByRole('button',{name:'Settings',exact:true}).click()
 if((await id('strategy-toggle').innerText()).toLowerCase().includes('weighted'))await id('strategy-toggle').click()
 await page.getByRole('button',{name:'Close',exact:true}).click()
 await assert('target','T')
 await input('-');await assert('feedback','Correct')
 await id('play').click();await assert('feedback','');await page.waitForTimeout(1100);await assert('target','T')
 await input('-');await assert('feedback','Correct');await page.waitForTimeout(1050);await assert('target','E')
 await input('.');await assert('feedback','Correct');await page.waitForTimeout(1050);await assert('target','N')
 await input('-.');await assert('feedback','Correct');await page.waitForTimeout(1050);await assert('target','R')
 // Complete multi-symbol R accepted, not the old fixed T/E classifier.
 await input('.-.');await assert('feedback','Correct');await page.waitForTimeout(1050);await assert('target','A')
 await input('.');await assert('feedback','Try again');await page.waitForTimeout(1050);await assert('target','T')
 await page.getByRole('button',{name:'Settings',exact:true}).click()
 await id('ifr-toggle').click();await id('speed-up').click();await id('pitch-up').click()
 if(!(await page.locator('body').innerText()).includes('620 Hz'))throw Error('pitch setting did not update')
 await page.getByRole('button',{name:'Close',exact:true}).click()
 if(!(await page.locator('body').innerText()).includes('13 WPM'))throw Error('speed setting did not update')
 await input('.');await assert('feedback','Try again')
 await id('play').click();await assert('feedback','');await page.waitForTimeout(1100);await assert('target','T')
 // Source-default IFR advanced a missed A; mode switching cancels work.
 await id('mode-freestyle').click();await page.waitForTimeout(150)
 await input('...');await assert('feedback','S')
 await input('......');await assert('feedback','No match')
 await page.getByRole('button',{name:'Settings',exact:true}).click()
 await id('word-mode-toggle').click()
 await page.getByRole('button',{name:'Close',exact:true}).click()
 await input('-.');await assert('transcript','N')
 await page.waitForTimeout(1250);await assert('transcript','N ')
 await input('.');await assert('transcript','N E')
 await id('clear').click();await assert('transcript','');await assert('feedback','')
 await input('.');await assert('transcript','E')
 // A partial held signal cannot leak into the new mode.
 await id('morse-key').focus();await page.keyboard.down('Space');await page.waitForTimeout(70)
 await id('mode-practice').click();await page.keyboard.up('Space');await page.waitForTimeout(350)
 await assert('feedback','')
 await id('mode-freestyle').click();await assert('transcript','')
 const result={pass:true,scope:'real Chrome touch practice progression T/E/N/R, IFR miss, Freestyle decoding/invalid input',physicalAudioMeasured:false,errors,events:await page.evaluate(()=>window.__events)}
 if(errors.length)throw Error(errors.join('; '))
 await writeFile(resolve(import.meta.dirname,'../.exact/session-browser.json'),JSON.stringify(result,null,2))
 await page.screenshot({path:resolve(import.meta.dirname,'../.exact/session-browser.png')})
 console.log(JSON.stringify(result,null,2))
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
