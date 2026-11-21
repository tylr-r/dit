import {readFile} from 'node:fs/promises'
import {resolve} from 'node:path'

/** Local browser harness for Contract actions driven by the bundled Apple adapter. */
export async function installAppleContractFixture(page,dist) {
  const original=await readFile(resolve(dist,'modules/index.js'),'utf8')
  const appleSource=await readFile(resolve(dist,'assets/dit-apple-session.js'),'utf8')
  const renamed=original.replace('export function create(','function webCreate(')
    .replace('export function setProps(','function setProps(').replace('export function destroy(','function webDestroy(')
  // Install the actual Apple reducer bundle behind the same module ABI. Only
  // the system clock, notification center, audio and persistence are supplied here.
  const bridge=`
    function nativeProps(json){return Object.fromEntries(Object.entries(JSON.parse(json)).map(([k,v])=>[k,String(v)]))}
    export function create(tag,el,json,event){
      if(tag!=='dit-key')return webCreate(tag,el,json,event)
      let live=true, queued=false
      const messages=[],timers=new Map()
      const project=s=>{
        messages.push(s)
        if(queued)return
        queued=true;queueMicrotask(()=>{queued=false;for(const item of messages.splice(0))if(live)event(8,item)})
      }
      const app=DitSession.create({
        monotonicMs:()=>performance.now(),
        read:k=>localStorage.getItem(k)===null?['missing']:['ok',localStorage.getItem(k)],
        write:(k,v)=>{localStorage.setItem(k,v);return true},
        schedule:(id,ms)=>timers.set(id,setTimeout(()=>app.timer(id),ms)),
        cancelTimer:id=>clearTimeout(timers.get(id)),project,outputVolume:()=>window.fixtureVolume??1,
        passageStart:(plan,pitch,gap)=>{window.fixturePassage={plan,pitch,gap,position:0};return true},
        passageControl:action=>{if(window.fixturePassage)window.fixturePassage.action=action;return true},
        passagePosition:()=>window.fixturePassage?.position??-1,
        play:(plan,pitch,id)=>{
          window.fixtureTone={plan,pitch,id}
          window.fixtureTail=-1
          return true
        },
        promptTailMs:id=>window.fixtureTone?.id===id?window.fixtureTail:-1,
        stop(){window.fixtureTail=-1},warm(){},cancelInput(){},
        requestReminder:id=>{window.fixtureRequests++;queueMicrotask(()=>app.permissionResult(id,'granted'))},
        cancelReminderRequest(){},syncReminder:(id,deadline)=>{window.fixtureDeadline=deadline},
      })
      const notifyVolume = () => project((window.fixtureVolume??1)<0.05?'output-volume:low':'output-volume:ready')
      const keySymbol = event => { if(app.configuration().enabled)app.input('symbol',event.detail) }
      const keySequence = event => { if(app.configuration().enabled)app.input('sequence',event.detail) }
      const projected=event=>project(event.detail)
      window.addEventListener('fixture-project',projected)
      window.addEventListener('fixture-sequence',keySequence)
      window.addEventListener('fixture-symbol',keySymbol)
      window.addEventListener('fixture-volume',notifyVolume)
      app.setProps(nativeProps(json));queueMicrotask(()=>{if(live)app.bootstrap()})
      return {app,close(){live=false;window.removeEventListener('fixture-project',projected);window.removeEventListener('fixture-sequence',keySequence);window.removeEventListener('fixture-symbol',keySymbol);window.removeEventListener('fixture-volume',notifyVolume);app.dispose();for(const t of timers.values())clearTimeout(t)}}
    }
    function update(h,json){if(h.app)h.app.setProps(nativeProps(json));else setProps(h,json)}
    export {update as setProps}
    export function destroy(h){if(h.app)h.close();else webDestroy(h)}
  `
  await page.route('**/*',route=>{
    const u=new URL(route.request().url())
    if(u.hostname!=='127.0.0.1')return route.abort()
    if(u.pathname==='/modules/index.js')return route.fulfill({contentType:'text/javascript',body:renamed+"\n"+appleSource+"\n"+bridge})
    return route.continue()
  })
}
