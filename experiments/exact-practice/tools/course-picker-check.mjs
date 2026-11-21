import {seedReturning} from './seed-returning.mjs'
import {createBuildServer} from './serve-build.mjs'
import {writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import assert from 'node:assert/strict'
import {chromium} from '/Users/tylr/Code/exact-spike-toolchain/node_modules/playwright-core/index.mjs'
const server=await createBuildServer(resolve(import.meta.dirname,'../target/audio-check-dist'));await new Promise(r=>server.listen(0,'127.0.0.1',r))
let browser
const key='dit.exact-spike.guided.v1',practiceKey='dit.exact-spike.practice.v1'
try{
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true})
 const page=await browser.newPage({viewport:{width:390,height:844},colorScheme:'dark'});await seedReturning(page)
 await page.addInitScript(()=>{Math.random=()=>0;window.__events=[];document.addEventListener('dit-key-event',e=>window.__events.push(e.detail))})
 const external=[],errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/*',r=>{const q=r.request();requests.push({method:q.method(),body:q.postData()});if(new URL(q.url()).hostname!=='127.0.0.1'){external.push(q.url());return r.abort()}return r.continue()})
 const base=`http://127.0.0.1:${server.address().port}`,id=n=>page.getByTestId(n),read=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null'),key),practice=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null'),practiceKey)
 await page.goto(base+'/app?dit-key-trace=1');await id('target').waitFor();await page.evaluate(()=>localStorage.setItem('dit-progress','production-sentinel'))
 const settings=()=>page.getByRole('button',{name:'Settings',exact:true}).click(),picker=async()=>{await settings();await id('scope-open').click()},course=async()=>{await picker();await id('learning-course').click()}
 await picker();await id('scope-custom').click();await id('scope-letter-Z').click();await id('scope-letter-E').click();await id('scope-apply').click();const before=await practice()
 await course();assert.equal(await page.locator('[data-testid^="course-pack-"]').count(),14)
 for(let i=1;i<=14;i++)assert.equal(await id('course-pack-'+i).isEnabled(),true)
 await page.getByRole('dialog').evaluate(el=>el.scrollTop=0);await page.screenshot({path:resolve(import.meta.dirname,'../.exact/course-picker.png')})
 await id('course-pack-14').click();await id('guided-phase').waitFor();await page.waitForTimeout(100)
 const jumped=await read();assert.equal(jumped.data.pack,13);assert.equal(jumped.data.phase,'teach');assert.equal(jumped.data.maxPackReached,13)
 assert.deepEqual((await practice()).settings.selection,before.settings.selection);assert.deepEqual((await practice()).history,before.history)
 // A held key cannot cross a pack-switch boundary and score in the new lesson.
 await id('morse-key').focus();await page.keyboard.down('Space');await page.waitForTimeout(30);await course();await id('course-pack-1').click();await page.keyboard.up('Space');await page.waitForTimeout(450)
 const backwards=await read();assert.equal(backwards.data.pack,0);assert.equal(backwards.data.maxPackReached,13);assert.deepEqual(backwards.data.progress.teachCounts,{})
 assert.deepEqual((await practice()).history,before.history)
 // Exercise a real Teach E press, then pick the same pack to reset only that lesson.
 await page.keyboard.down('ControlLeft');await page.waitForTimeout(15);await page.keyboard.up('ControlLeft');await page.waitForTimeout(1300)
 const partial=await read();assert.equal(partial.data.progress.teachCounts.E,1)
 await course();await id('course-pack-1').click();await page.waitForTimeout(100);assert.deepEqual((await read()).data.progress.teachCounts,{})
 // Open practice retains explicit custom scope and stored course progress.
 await course();await id('learning-open').click();await id('scope-cancel').click();await page.waitForTimeout(100)
 assert.deepEqual((await practice()).settings.selection,before.settings.selection)
 await id('mode-listen').click();await page.waitForTimeout(100)
 assert.equal(await page.locator('[data-testid^="listen-answer-"]').count(),2);assert.equal(await id('listen-answer-Z').isVisible(),true)
 await course();await id('course-pack-2').click();await page.waitForTimeout(100);assert.equal((await read()).data.pack,1);assert.equal(await id('guided-phase').isVisible(),true)
 const snapshot=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));await page.reload();await id('target').waitFor();assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))),snapshot)
 await course();assert.equal((await read()).data.maxPackReached,13);await id('course-pack-2').click();await page.waitForTimeout(100)
 assert.equal(await page.evaluate(()=>localStorage.getItem('dit-progress')),'production-sentinel');assert.deepEqual(external,[]);assert.deepEqual(errors,[]);assert.equal(requests.some(r=>r.method!=='GET'||r.body),false)
 const result={pass:true,jumped,backwards,partial,final:await read(),practice:await practice(),external,errors};await writeFile(resolve(import.meta.dirname,'../.exact/course-picker-browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2))
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
