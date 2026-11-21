import {seedReturning} from './seed-returning.mjs'
import {createBuildServer} from './serve-build.mjs'
import {writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {chromium} from '/Users/tylr/Code/exact-spike-toolchain/node_modules/playwright-core/index.mjs'
const server=await createBuildServer(resolve(import.meta.dirname,'../target/audio-check-dist'));await new Promise(r=>server.listen(0,'127.0.0.1',r))
const key='dit.exact-spike.practice.v1';let browser
try{
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true})
 const page=await browser.newPage({viewport:{width:390,height:844},colorScheme:'dark',timezoneId:'America/Denver'});await seedReturning(page,{legacyPractice:false})
 await page.addInitScript(()=>{const RealDate=Date;window.__dateNow=Date.UTC(2026,10,19,6,59);window.Date=class extends RealDate{constructor(...a){super(...(a.length?a:[window.__dateNow]))}static now(){return window.__dateNow}};window.__events=[];document.addEventListener('dit-key-event',e=>window.__events.push(e.detail))})
 const external=[],requests=[],errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/*',r=>{const q=r.request();requests.push({method:q.method(),body:q.postData()});if(new URL(q.url()).hostname!=='127.0.0.1'){external.push(q.url());return r.abort()}return r.continue()})
 const base=`http://127.0.0.1:${server.address().port}`;await page.goto(base+'/app?dit-key-trace=1');const id=n=>page.getByTestId(n),read=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null'),key)
 await id('target').waitFor();const open=()=>page.getByRole('button',{name:'Open progress',exact:true}).click()
 await open();const missing=await id('ref-streak-today').innerText();if(!/no daily|unknown|not recorded/i.test(missing))throw Error('missing legacy invented '+missing);await id('close-panel').click()
 const fixture={version:1,settings:{speed:12,effectiveSpeed:8,autoTighten:false,autoCorrect:0,pitch:600,ifr:true,words:false,strategy:'sequential',reviewMisses:true},scores:{T:1},history:[{letter:'T',correct:true,atMs:123}],letterAccuracy:{T:{recent:[true]}},dailyActivity:{'2026-11-18':{correct:14,modes:['practice']}},streak:{current:2,longest:4,lastCountedDate:'2026-11-17'}}
 await page.evaluate(({key,fixture})=>{localStorage.setItem(key,JSON.stringify(fixture));localStorage.setItem('dit-progress','production-sentinel')},{key,fixture});await page.reload();await id('target').waitFor()
 const input=async(letter)=>{for(const sym of {T:'-',E:'.',N:'-.',R:'.-.',A:'.-'}[letter]){const key=sym==='.'?'ControlLeft':'ControlRight';await page.keyboard.down(key);await page.waitForTimeout(15);await page.keyboard.up(key);await page.waitForTimeout(sym==='.'?125:325)}await page.waitForTimeout(1350)}
 await input('T');const hit=await read()
 if(hit.dailyActivity['2026-11-18'].correct!==15||hit.streak.current!==3||hit.streak.longest!==4||hit.streak.lastCountedDate!=='2026-11-18'||hit.letterAccuracy.T.recent.length!==2)throw Error('15th goal or doubleaccuracy bug '+JSON.stringify(hit))
 const target=await id('target').innerText();await input(target==='T'?'E':'T');const miss=await read();if(miss.dailyActivity['2026-11-18'].correct!==15||miss.streak.current!==3)throw Error('miss counted toward goal')
 await input(await id('target').innerText());const extra=await read();if(extra.dailyActivity['2026-11-18'].correct!==16||extra.streak.current!==3)throw Error('16th double streak')
 await open();const capped=await id('ref-streak-today').innerText();if(!capped.includes('15/15'))throw Error('daily UI not capped '+capped);await id('close-panel').click()
 const beforeMidnight=JSON.stringify(await read());await page.evaluate(()=>window.__dateNow=Date.UTC(2026,10,19,7,1));await open();const midnight=await id('ref-streak-today').innerText();if(!midnight.includes('0/15'))throw Error('local midnight projection stale '+midnight)
 if(JSON.stringify(await read())!==beforeMidnight)throw Error('midnight projection wrote/reset data');await id('close-panel').click()
 await id('mode-listen').click();await page.waitForTimeout(100);const heard=await page.evaluate(()=>window.__events.filter(x=>String(x).startsWith('listen-audio:')).at(-1)?.split(':')[1]);await id('listen-answer-'+heard).click();await page.waitForTimeout(100)
 const nextDay=await read();if(nextDay.dailyActivity['2026-11-19'].correct!==1||nextDay.streak.current!==3||nextDay.streak.lastCountedDate!=='2026-11-18'||JSON.stringify(nextDay.dailyActivity['2026-11-19'].modes)!=='["listen"]')throw Error('partial next day changed qualifying streak '+JSON.stringify(nextDay))
 await open();await page.getByRole('dialog').evaluate(e=>e.scrollTop=0);await page.screenshot({path:resolve(import.meta.dirname,'../.exact/activity-progress.png')});const risk=await id('ref-streak-risk').innerText();if(!risk)throw Error('at-risk not surfaced')
 const snapshot=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));await page.reload();await id('target').waitFor();if(JSON.stringify(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))))!==JSON.stringify(snapshot))throw Error('reload mutated daily data')
 if(external.length||requests.some(r=>r.method!=='GET'||r.body)||errors.length)throw Error(JSON.stringify({external,errors}))
 const result={pass:true,missing,hit,miss,extra,capped,midnight,nextDay,risk,external,errors};await writeFile(resolve(import.meta.dirname,'../.exact/activity-browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2))
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
