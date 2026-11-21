import {seedReturning} from './seed-returning.mjs'
import {createBuildServer} from './serve-build.mjs'
import {writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {chromium} from '/Users/tylr/Code/exact-spike-toolchain/node_modules/playwright-core/index.mjs'
import {tempoTiming} from '../modules/web/tempo.mjs'
const server=await createBuildServer(resolve(import.meta.dirname,'../target/audio-check-dist'));await new Promise(r=>server.listen(0,'127.0.0.1',r))
const key='dit.exact-spike.practice.v1';let browser
try{
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true})
 const page=await browser.newPage({viewport:{width:390,height:844},colorScheme:'dark'});await seedReturning(page)
 const external=[],requests=[],errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/*',r=>{const q=r.request();requests.push({method:q.method(),body:q.postData()});if(new URL(q.url()).hostname!=='127.0.0.1'){external.push(q.url());return r.abort()}return r.continue()})
 await page.addInitScript(()=>{window.__events=[];window.__gains=[];window.__contexts=[];document.addEventListener('dit-key-event',e=>window.__events.push(e.detail));const Base=window.AudioContext;window.AudioContext=class extends Base{constructor(...args){super(...args);window.__contexts.push(this)}createGain(){const g=super.createGain();for(const method of ['setTargetAtTime','cancelScheduledValues']){const fn=g.gain[method].bind(g.gain);g.gain[method]=(...args)=>{window.__gains.push({method,args,clock:this.currentTime});return fn(...args)}}return g}}})
 const base=`http://127.0.0.1:${server.address().port}`;await page.goto(base+'/app?dit-key-trace=1')
 const id=n=>page.getByTestId(n),read=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null'),key)
 await id('target').waitFor();await page.evaluate(()=>localStorage.setItem('dit-progress','production-sentinel'))
 await page.getByRole('button',{name:'Open progress',exact:true}).click()
 const missing=await id('ref-recognition-average').innerText();if(!/—|unknown|not yet|no /i.test(missing))throw Error('missing data misleading '+missing)
 await id('close-panel').click()
 const played=()=>page.evaluate(()=>window.__events.filter(x=>String(x).startsWith('listen-audio:')).at(-1)?.split(':')[1])
 await id('mode-listen').click();await page.waitForTimeout(80);const first=await played();if(!first)throw Error('no prompt')
 const wrong=[...'TENRA'].find(x=>x!==first);await id('listen-answer-'+wrong).click();const early=await read()
 if(early.listenTtr?.[first]?.samples!==1||early.listenTtr[first].averageMs!==0)throw Error('early wrong sample incorrect '+JSON.stringify(early))
 await page.getByRole('button',{name:'Settings',exact:true}).click();const paused=await read();await page.waitForTimeout(900)
 if(JSON.stringify(await read())!==JSON.stringify(paused))throw Error('suspended time scored')
 await id('close-panel').click();await id('listen-play').click();await page.waitForTimeout(90)
 const target=await played()
 const scheduled=await page.evaluate(()=>window.__gains.filter(x=>x.method==='setTargetAtTime').at(-1)?.args[1])
 if(!Number.isFinite(scheduled))throw Error('no scheduled audio clock')
 const timing=tempoTiming(paused.settings.speed,paused.settings.effectiveSpeed)
 const expectedEnd=scheduled+timing.characterGapMs/1000
 const clock=await page.evaluate(()=>window.__contexts[0].currentTime)
 await page.waitForTimeout(Math.max(0,(expectedEnd-clock)*1000)+450)
 const responseClock=await page.evaluate(()=>window.__contexts[0].currentTime)
 await id('listen-answer-'+target).click();const timed=await read()
 const raw=Math.max(0,Math.round((responseClock-expectedEnd)*1000)),old=paused.listenTtr?.[target]
 const expected=old?Math.round(old.averageMs*.75+Math.min(10000,raw)*.25):Math.min(10000,raw)
 if(Math.abs(timed.listenTtr[target].averageMs-expected)>160)throw Error('audio-clock sample mismatch '+JSON.stringify({raw,expected,actual:timed.listenTtr[target],scheduled,responseClock,expectedEnd}))
 await page.getByRole('button',{name:'Settings',exact:true}).click();await id('close-panel').click();await id('listen-play').click();await page.waitForTimeout(2100)
 await id('listen-play').click();await page.waitForTimeout(50);const replayTarget=await played(),beforeReplay=await read()
 await id('listen-answer-'+replayTarget).click();const replayed=await read(),prior=beforeReplay.listenTtr?.[replayTarget]
 const expectedReplay=prior?Math.round(prior.averageMs*.75):0
 if(replayed.listenTtr[replayTarget].averageMs!==expectedReplay)throw Error('replay did not reset timing '+JSON.stringify({prior,replayed,expectedReplay}))
 await page.getByRole('button',{name:'Settings',exact:true}).click();await id('close-panel').click();await id('listen-play').click();await page.waitForTimeout(100)
 const interruptedTarget=await played(),beforeInterruption=await read()
 await page.evaluate(async()=>{await window.__contexts[0].suspend()});await page.waitForTimeout(120)
 await page.evaluate(async()=>{await window.__contexts[0].resume()});await page.waitForTimeout(120)
 await id('listen-answer-'+interruptedTarget).click();const interrupted=await read()
 if(JSON.stringify(interrupted.listenTtr)!==JSON.stringify(beforeInterruption.listenTtr))throw Error('interrupted clock created sample')
 await page.getByRole('button',{name:'Open progress',exact:true}).click();await id('ref-char-'+replayTarget).click()
 const selected=await id('ref-selected-recognition').innerText();if(!selected)throw Error('selected sample missing')
 await page.getByRole('dialog').evaluate(e=>e.scrollTop=0);await page.screenshot({path:resolve(import.meta.dirname,'../.exact/recognition-progress.png')})
 const snapshot=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));await page.reload();await id('target').waitFor();if(JSON.stringify(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))))!==JSON.stringify(snapshot))throw Error('reload changed metrics')
 if(external.length||requests.some(r=>r.method!=='GET'||r.body)||errors.length)throw Error(JSON.stringify({external,errors}))
 const result={pass:true,interruptedTarget,interrupted:interrupted.listenTtr,missing,first,early:early.listenTtr,target,scheduled,responseClock,expectedEnd,raw,expected,timed:timed.listenTtr,replayTarget,expectedReplay,replayed:replayed.listenTtr,selected,external,errors};await writeFile(resolve(import.meta.dirname,'../.exact/recognition-browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2))
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
