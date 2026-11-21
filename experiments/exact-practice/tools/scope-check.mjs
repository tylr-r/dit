import {seedReturning} from './seed-returning.mjs'
import {createBuildServer} from './serve-build.mjs'
import {writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {chromium} from '/Users/tylr/Code/exact-spike-toolchain/node_modules/playwright-core/index.mjs'
const server=await createBuildServer(resolve(import.meta.dirname,'../target/audio-check-dist'));await new Promise(r=>server.listen(0,'127.0.0.1',r))
const key='dit.exact-spike.practice.v1';let browser
try{
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true})
 const page=await browser.newPage({viewport:{width:390,height:844},colorScheme:'dark'});await seedReturning(page,{legacyPractice:false});await page.addInitScript(()=>{Math.random=()=>0})
 const external=[],requests=[],errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/*',r=>{const q=r.request();requests.push({method:q.method(),body:q.postData()});if(new URL(q.url()).hostname!=='127.0.0.1'){external.push(q.url());return r.abort()}return r.continue()})
 const base=`http://127.0.0.1:${server.address().port}`;await page.goto(base+'/app');const id=n=>page.getByTestId(n),read=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null'),key)
 await id('target').waitFor();if(await id('target').innerText()!=='A')throw Error('newknown default not source alphabet')
 await page.evaluate(()=>localStorage.setItem('dit-progress','production-sentinel'))
 const settings=()=>page.getByRole('button',{name:'Settings',exact:true}).click(),scope=async()=>{await settings();await id('scope-open').click();await id('learning-open').click()}
 await settings();const fresh=await id('scope-current').innerText();await id('scope-open').click();await id('scope-custom').click();if(await id('scope-apply').isEnabled())throw Error('empty apply enabled')
 await id('scope-letter-Z').click();await id('scope-letter-E').click();await id('scope-cancel').click();if(await read()!==null)throw Error('cancel persisted draft')
 await scope();await id('scope-custom').click();await id('scope-letter-Z').click();await id('scope-letter-E').click();await page.screenshot({path:resolve(import.meta.dirname,'../.exact/scope-custom.png')});await id('scope-apply').click();await page.waitForTimeout(150)
 const custom=await read();if(JSON.stringify(custom.settings.selection)!=='{"kind":"custom","letters":["Z","E"]}')throw Error('web clickorder not preserved '+JSON.stringify(custom.settings.selection))
 if(await id('target').innerText()!=='Z')throw Error('target not reset to actual pool')
 await id('mode-listen').click();await page.waitForTimeout(120)
 const answers=await page.locator('[data-testid^="listen-answer-"]').evaluateAll(es=>es.map(e=>e.getAttribute('data-testid').replace('listen-answer-','')))
 if(JSON.stringify(answers)!=='["Z","E"]')throw Error('Listen custompool wrong '+answers)
 await page.reload();await id('target').waitFor();if(JSON.stringify((await read()).settings.selection)!==JSON.stringify(custom.settings.selection)||await id('target').innerText()!=='Z')throw Error('custom reload lost')
 await id('morse-key').focus();await page.keyboard.down('Space');await page.waitForTimeout(30)
 await scope();await id('scope-tier-1').click();await page.keyboard.up('Space');await page.waitForTimeout(350)
 const tier=await read();if(tier.history.length||Object.keys(tier.scores).length)throw Error('heldinput leaked across selection')
 if(tier.settings.selection.kind!=='tier'||tier.settings.selection.level!==1)throw Error('tier did not clearcustom')
 await id('mode-listen').click();await page.waitForTimeout(100);const tierAnswers=await page.locator('[data-testid^="listen-answer-"]').evaluateAll(es=>es.map(e=>e.textContent))
 if(tierAnswers.length!==6||new Set(tierAnswers.join('')).size!==6)throw Error('tier1 not6')
 await scope();await id('scope-custom').click();await id('scope-letter-Q').click();await id('scope-apply').click();await page.waitForTimeout(100)
 if(await page.locator('[data-testid^="listen-answer-"]').count()!==1||!await id('listen-answer-Q').isVisible())throw Error('singleletter custom unsupported')
 await settings();await id('guided-start').click();await id('guided-phase').waitFor();await scope();await id('scope-tier-2').click();await page.waitForTimeout(100)
 if(await id('guided-phase').count()&&await id('guided-phase').isVisible())throw Error('explicitscope keptguidedactive')
 await id('mode-listen').click();await page.waitForTimeout(100);if(await page.locator('[data-testid^="listen-answer-"]').count()!==14)throw Error('tier2 actualpool not14')
 await scope();await id('scope-tier-4').click();await page.waitForTimeout(100);if(await page.locator('[data-testid^="listen-answer-"]').count()!==36)throw Error('tier4 not36')
 await settings();await page.getByRole('dialog').evaluate(el=>el.scrollTop=0);await page.screenshot({path:resolve(import.meta.dirname,'../.exact/scope-settings.png')})
 const final=await read(),snapshot=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));await page.reload();await id('target').waitFor();if(JSON.stringify(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))))!==JSON.stringify(snapshot))throw Error('scope reload mutateddata')
 if(external.length||requests.some(r=>r.method!=='GET'||r.body)||errors.length)throw Error(JSON.stringify({external,errors}))
 const result={pass:true,fresh,custom,tier,answers,tierAnswers,final,external,errors};await writeFile(resolve(import.meta.dirname,'../.exact/scope-browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2))
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
