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
try {
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true})
 const results=[]
 for(const [width,height] of [[390,844],[1280,900]]){
  const page=await browser.newPage({viewport:{width,height},colorScheme:'dark'});
 await seedReturning(page)
  await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForTimeout(900);
  const key=page.getByRole('button',{name:'Morse key',exact:true});
  const target=page.getByText('T',{exact:true});if(!(await target.isVisible()))throw Error('target T absent');
  const base=resolve(import.meta.dirname,`../.exact/visual-pass/exact-T-${width}x${height}`);
  await page.screenshot({path:base+'-idle.png'});
  const before=await page.screenshot();await page.waitForTimeout(500);const after=await page.screenshot();
  const motionChanged=!before.equals(after);
  await key.hover();await page.mouse.down();await page.waitForTimeout(300);await page.screenshot({path:base+'-pressed.png'});
  const held=await key.evaluate(e=>({box:e.getBoundingClientRect().toJSON(),scale:getComputedStyle(e).scale,transform:getComputedStyle(e).transform}));
  await page.mouse.up();await page.getByText('Correct',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Haptics off'}).click();await page.getByRole('button',{name:'Haptics on'}).waitFor();await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(1500);const still1=await page.screenshot();await page.waitForTimeout(500);const still2=await page.screenshot();
  results.push({width,height,held,motionChanged,reducedMotionStable:still1.equals(still2),dialogRepeatedClose:true,physicalLatencyMeasured:false});
  await page.close();
 }
 console.log(JSON.stringify(results,null,2));await writeFile(resolve(import.meta.dirname,'../.exact/visual-pass/interaction-evidence.json'),JSON.stringify(results,null,2));
 if(results.some(r=>!r.motionChanged||!r.reducedMotionStable))throw Error('motion checks failed');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
