import {seedReturning} from './seed-returning.mjs'
import {createBuildServer} from './serve-build.mjs'
import {writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {chromium} from '/Users/tylr/Code/exact-spike-toolchain/node_modules/playwright-core/index.mjs'
const server=await createBuildServer(resolve(import.meta.dirname,'../target/audio-check-dist'));await new Promise(r=>server.listen(0,'127.0.0.1',r))
const key='dit.exact-spike.guided.v1';let browser
try{
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true})
 const page=await browser.newPage({viewport:{width:390,height:844},colorScheme:'dark'});await seedReturning(page)
 await page.addInitScript(()=>{window.__roll=.9;Math.random=()=>window.__roll;window.__events=[];document.addEventListener('dit-key-event',e=>window.__events.push(e.detail))})
 const external=[],requests=[],errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/*',r=>{const q=r.request();requests.push({method:q.method(),body:q.postData()});if(new URL(q.url()).hostname!=='127.0.0.1'){external.push(q.url());return r.abort()}return r.continue()})
 const base=`http://127.0.0.1:${server.address().port}`;await page.goto(base+'/app?dit-key-trace=1')
 const id=n=>page.getByTestId(n),read=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null'),key)
 await id('target').waitFor();const fixture={version:1,data:{pack:1,phase:'practice',progress:{teachCounts:{A:2,N:2},practiceAttempts:8,practiceCorrect:8,practiceLetterCorrect:{A:4,N:4},listenAttempts:0,listenCorrect:0,listenLetterCorrect:{}}}}
 await page.evaluate(({key,fixture})=>{localStorage.setItem(key,JSON.stringify(fixture));localStorage.setItem('dit-progress','production-sentinel')},{key,fixture});await page.reload();await id('target').waitFor()
 const start=async()=>{await page.getByRole('button',{name:'Settings',exact:true}).click();await id('guided-start').click();await page.waitForTimeout(150)}
 const input=async(letter)=>{for(const symbol of {E:'.',T:'-',A:'.-',N:'-.'}[letter]){await page.keyboard.down(symbol==='.'?'ControlLeft':'ControlRight');await page.waitForTimeout(15);await page.keyboard.up(symbol==='.'?'ControlLeft':'ControlRight');await page.waitForTimeout(symbol==='.'?125:325)}await page.waitForTimeout(1400)}
 await start();const review=await id('target').innerText();if(!['E','T'].includes(review))throw Error('prior review missing '+review)
 await input(review);const afterReview=await read()
 if(afterReview.data.progress.practiceAttempts!==9||afterReview.data.progress.practiceLetterCorrect[review]!==1||afterReview.data.progress.practiceLetterCorrect.A!==4||afterReview.data.progress.practiceLetterCorrect.N!==4)throw Error('review wrong gates '+JSON.stringify(afterReview))
 await page.reload();await id('target').waitFor();if(JSON.stringify(await read())!==JSON.stringify(afterReview))throw Error('valid review counts lost on reload')
 await page.evaluate(()=>window.__roll=.1);await start();const current=await id('target').innerText();if(!['A','N'].includes(current))throw Error('current branch missing '+current)
 await input(current);if((await read()).data.phase!=='gate-listen')throw Error('aggregate review not counted toward practice gate')
 await page.evaluate(()=>window.__roll=0);await id('guided-continue').click();await page.waitForTimeout(100)
 const played=()=>page.evaluate(()=>window.__events.filter(x=>String(x).startsWith('listen-audio:')).at(-1)?.split(':')[1])
 const prompts=[]
 for(let i=0;i<6;i++){
  const target=await played();prompts.push(target)
  if(i===0&&target!=='A'||i===1&&target!=='N')throw Error('current minima not prioritized '+JSON.stringify(prompts))
  if(!['E','T','A','N'].includes(target))throw Error('locked letter leaked '+target)
  await id('listen-answer-'+target).click();await page.waitForTimeout(i===5?1800:2350)
 }
 if(!prompts.slice(2).some(x=>['E','T'].includes(x)))throw Error('Listen never reviews unlocked prior pack '+prompts)
 const final=await read();if(final.data.phase!=='gate-next'||final.data.progress.listenAttempts!==6||final.data.progress.listenLetterCorrect.A<1||final.data.progress.listenLetterCorrect.N<1)throw Error('Listen gate incorrect '+JSON.stringify(final))
 await page.screenshot({path:resolve(import.meta.dirname,'../.exact/guided-review.png')})
 await page.reload();await id('target').waitFor();if(JSON.stringify(await read())!==JSON.stringify(final))throw Error('Listen review count reload invalid')
 const practice=await page.evaluate(()=>JSON.parse(localStorage.getItem('dit.exact-spike.practice.v1')))
 if(practice.history.length!==8)throw Error('review scoring not single event '+JSON.stringify(practice.history))
 if(await page.evaluate(()=>localStorage.getItem('dit-progress'))!=='production-sentinel'||external.length||requests.some(r=>r.method!=='GET'||r.body)||errors.length)throw Error('privacy/runtime failure')
 const result={pass:true,review,current,prompts,afterReview,final,practice,external,errors};await writeFile(resolve(import.meta.dirname,'../.exact/guided-review-browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2))
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
