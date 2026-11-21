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
 await page.addInitScript(()=>{Math.random=()=>0;window.__events=[];document.addEventListener('dit-key-event',e=>window.__events.push(e.detail))})
 const external=[],requests=[],errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/*',r=>{const q=r.request();requests.push({method:q.method(),body:q.postData()});if(new URL(q.url()).hostname!=='127.0.0.1'){external.push(q.url());return r.abort()}return r.continue()})
 const base=`http://127.0.0.1:${server.address().port}`;await page.goto(base+'/app?dit-key-trace=1');const id=n=>page.getByTestId(n)
 await id('target').waitFor();const counts=n=>Object.fromEntries([...'67890'].map(x=>[x,n]))
 const fixture={version:1,data:{pack:13,phase:'listen',progress:{teachCounts:counts(2),practiceAttempts:10,practiceCorrect:10,practiceLetterCorrect:counts(2),listenAttempts:5,listenCorrect:5,listenLetterCorrect:counts(1)}}}
 await page.evaluate(({key,fixture})=>{localStorage.setItem(key,JSON.stringify(fixture));localStorage.setItem('dit-progress','production-sentinel')},{key,fixture});await page.reload();await id('target').waitFor()
 await page.getByRole('button',{name:'Settings',exact:true}).click();await id('guided-start').click();await page.waitForTimeout(100)
 const played=()=>page.evaluate(()=>window.__events.filter(x=>String(x).startsWith('listen-audio:')))
 const before=await played(),target=before.at(-1)?.split(':')[1];if(!target)throw Error('final prompt missing')
 if(await id('guided-complete-dialog').count()&&await id('guided-complete-dialog').isVisible())throw Error('completed before sixth answer')
 const wrong=target==='E'?'T':'E';await id('listen-answer-'+wrong).click();await page.waitForTimeout(500)
 if(await id('guided-complete-dialog').count()&&await id('guided-complete-dialog').isVisible())throw Error('completion skipped result reveal')
 await id('guided-complete-dialog').waitFor({state:'visible',timeout:6000})
 const final=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key)
 if(final.data.phase!=='complete'||final.data.maxPackReached!==14||final.data.progress.listenAttempts!==0||Object.keys(final.data.progress.teachCounts).length)throw Error('completion not normalized '+JSON.stringify(final))
 const scored=await page.evaluate(()=>JSON.parse(localStorage.getItem('dit.exact-spike.practice.v1')))
 if(scored.history.length!==1||scored.history[0].correct!==false||scored.history[0].letter!==target)throw Error('wrong sixth not scored exactly once')
 const atComplete=await played();if(atComplete.length!==before.length)throw Error('extra audio before completion dismiss')
 await page.screenshot({path:resolve(import.meta.dirname,'../.exact/guided-finale.png')})
 await id('guided-complete-dismiss').click();await page.waitForTimeout(500)
 if((await played()).length!==before.length)throw Error('dismiss autoplayed')
 if(await page.locator('[data-testid^="listen-answer-"]').count()!==36||!await id('listen-answer-J').isVisible())throw Error('course unlock not all36 including J')
 await id('listen-play').click();await page.waitForTimeout(100);if((await played()).length!==before.length+1)throw Error('ordinary Listen explicit play unavailable')
 await page.reload();await id('target').waitFor()
 if(await id('guided-complete-dialog').count()&&await id('guided-complete-dialog').isVisible())throw Error('celebration repeated')
 if(JSON.stringify(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key))!==JSON.stringify(final))throw Error('completed restart altereddata')
 await id('mode-listen').click();await page.waitForTimeout(100);if(await page.locator('[data-testid^="listen-answer-"]').count()!==36)throw Error('reload lost fullpool')
 await page.evaluate(({key,fixture})=>{localStorage.setItem(key,JSON.stringify(fixture));localStorage.removeItem('dit.exact-spike.practice.v1')},{key,fixture});await page.reload();await id('target').waitFor()
 await page.getByRole('button',{name:'Settings',exact:true}).click();await id('guided-start').click();await page.waitForTimeout(100)
 const interruptedTarget=(await played()).at(-1)?.split(':')[1]
 await id('listen-answer-'+(interruptedTarget==='E'?'T':'E')).click();await page.waitForTimeout(60)
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.waitForTimeout(200);await id('close-panel').click()
 await id('guided-complete-dialog').waitFor({state:'visible',timeout:5000});await id('guided-complete-dismiss').click()
 if(await page.locator('[data-testid^="listen-answer-"]').count()!==36)throw Error('interrupted finale stranded Guided')
 const interruptedFinal=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key)
 if(interruptedFinal.data.phase!=='complete')throw Error('interrupted finale not persisted')
 if(await page.evaluate(()=>localStorage.getItem('dit-progress'))!=='production-sentinel'||external.length||requests.some(r=>r.method!=='GET'||r.body)||errors.length)throw Error(JSON.stringify({external,errors}))
 const result={pass:true,interruptedFinal,target,wrong,final,scored,before,atComplete,external,errors};await writeFile(resolve(import.meta.dirname,'../.exact/guided-finale-browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2))
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
