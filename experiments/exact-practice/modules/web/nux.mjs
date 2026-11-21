// Source: useOnboardingActions/State.ts and web NuxModal.tsx (3+3, 600ms).
import { STORE_KEY } from './practice-store.mjs'
import { GUIDED_KEY } from './guided.mjs'
import { CUSTOM_KEY } from './custom.mjs'

export const NUX_KEY='dit.exact-spike.onboarding.v1'
const steps=['welcome','profile','intro_fluency','intro_listen','intro_speed','sound_check','button_tutorial','beginner_stages','beginner_intro','reminder','known_tour']
const statuses=['pending','completed','skipped']
const fresh=(status='pending')=>({version:1,status,step:'welcome',profile:null,soundComplete:false,taps:0,holds:0})
const clamp=n=>Number.isInteger(n)?Math.max(0,Math.min(3,n)):0
const hasLegacyData = storage => [STORE_KEY,GUIDED_KEY,CUSTOM_KEY].some(key=>storage.getItem(key)!==null)
function read(storage, hasPriorProgress = hasLegacyData) {
 try {
  const raw=storage.getItem(NUX_KEY)
  if(raw===null){
   // Preserve any earlier experimental choices without reading production keys.
   const existing=hasPriorProgress(storage)
   return {data:fresh(existing?'skipped':'pending'),saved:false,readOnly:false,storageStatus:'empty'}
  }
  if(raw.length>16000)return {data:fresh('skipped'),saved:false,readOnly:true,storageStatus:'unsupported'}
  let v
  try{v=JSON.parse(raw)}catch{return {data:fresh(),saved:false,readOnly:false,storageStatus:'empty'}}
  if(v?.version!==1 || Object.keys(v).some(key=>!Object.hasOwn(fresh(),key)))return {data:fresh('skipped'),saved:false,readOnly:true,storageStatus:'unsupported'}
  const status=statuses.includes(v.status)?v.status:'pending'
  const profile=['beginner','known'].includes(v.profile)?v.profile:null
  let step=steps.includes(v.step)?v.step:'welcome'
  if(!profile&&!['welcome','profile'].includes(step))step='profile'
  if((step==='known_tour'&&profile!=='known')||(step.startsWith('beginner_')&&profile!=='beginner'))step='profile'
  const soundComplete=v.soundComplete===true
  // A damaged snapshot cannot bypass the sound or real keying gates.
  if(['button_tutorial','beginner_stages','beginner_intro','reminder','known_tour'].includes(step)&&!soundComplete)step='sound_check'
  const taps=clamp(v.taps),holds=clamp(v.holds)
  if(['beginner_stages','beginner_intro','reminder','known_tour'].includes(step)&&(taps!==3||holds!==3))step='button_tutorial'
  return {data:{version:1,status,step,profile,soundComplete,taps,holds},saved:true,readOnly:false,storageStatus:'saved'}
 }catch{return {data:fresh(),saved:false,readOnly:true,storageStatus:'unavailable'}}
}
export const readNux=(storage,hasPriorProgress)=>read(storage,hasPriorProgress).data

export function createNux({storage,project,play,stop,warm=()=>{},setTimer,clearTimer,hasPriorProgress,ownsFresh=false,persistInferred=false,checkSound,reminder}){
 const restored=read(storage,hasPriorProgress)
 let state=restored.data
 let storageStatus=restored.storageStatus
 let resume=state.status==='pending'&&state.step!=='welcome'?state.step:null
 let owned=state.status==='pending'&&(restored.saved||ownsFresh)
 if(state.status==='pending')state={...state,step:'welcome'}
 if(resume==='reminder'&&!reminder)resume=state.profile==='known'?'known_tour':'beginner_intro'
 let reminderTime='19:00'
 let exiting=false
 let sound=state.soundComplete?'heard':'idle'
 let timer
 let ticket=0
 let tourIndex=0
 const proj=(k,v)=>project('nux-'+k+':'+v)
 const publish=()=>{
  if(reminder){proj('reminder-time',reminderTime);proj('reminder-exiting',Number(exiting))}
  proj('step',state.step);proj('profile',state.profile??'')
  proj('taps',state.taps);proj('holds',state.holds)
  proj('sound',sound);proj('resume',Number(Boolean(resume)));proj('tour',tourIndex)
  proj('owned',Number(owned));proj('storage',storageStatus);proj('status',state.status)
 }
 function save(){
  const available=read(storage,hasPriorProgress)
  if(available.readOnly){storageStatus=available.storageStatus;return}
  try{storage.setItem(NUX_KEY,JSON.stringify(state));storageStatus='saved'}
  catch{storageStatus='unavailable'}
 }
 function update(patch){
  state={...state,...patch};owned=state.status==='pending';save();publish()
 }
 function clearTicket(){ticket++;clearTimer(timer);timer=undefined;exiting=false}
 function move(step,patch={}){
  clearTicket();stop()
  // This transition is reached only by explicit Back, Resume, or Continue.
  // Build WebAudio before a cold first stroke can measure graph startup time.
  if(step==='button_tutorial')warm()
  if(step==='known_tour'||state.step==='known_tour')tourIndex=0
  update({step,...patch})
  if(step==='button_tutorial')ready()
 }
 function exitReminder(enable){
  if(exiting)return
  exiting=true;publish()
  const current=++ticket
  const perform=()=>{
    if(current!==ticket||state.step!=='reminder')return
    timer=undefined
    if(enable)reminder.enable(reminderTime,ok=>{
      if(current!==ticket)return
      exiting=false
      if(ok)afterReminder()
      else publish()
    })
    else afterReminder()
  }
  if(reminder.reducedMotion())perform()
  else timer=setTimer(perform,280)
 }
 function afterReminder(){
  if(state.status!=='pending'||state.step!=='reminder')return
  if(state.profile==='known')move('known_tour')
  else finish('completed','guided')
 }
 function finish(status,mode){
  clearTicket();stop();resume=null
  proj('enter',mode)
  update({status,step:'welcome'})
 }
 function ready(){
  if(state.step!=='button_tutorial'||state.taps!==3||state.holds!==3||timer!==undefined)return
  const current=++ticket
  timer=setTimer(()=>{
    if(current!==ticket||state.step!=='button_tutorial')return
    // The web hides the reminder and immediately skips it (no OS prompt).
    move(state.profile==='known'?(reminder?'reminder':'known_tour'):'beginner_stages')
  },600)
 }
 // Apple mirrors the one-time legacy NUX migration in useOnboardingState.
 if(persistInferred&&!restored.saved&&!restored.readOnly&&state.status==='skipped')save()
 return {
  project:publish,
  profile:()=>state.profile,
  canKey:()=>state.status==='pending'&&state.step==='button_tutorial',
  symbol(symbol){
   if(state.status!=='pending'||state.step!=='button_tutorial'||!['.','-'].includes(symbol))return
   const k=symbol==='.'?'taps':'holds'
   if(state[k]<3)update({[k]:state[k]+1})
   ready()
  },
  act(command){
   if(command==='replay'){
    reminder?.cancel();reminderTime='19:00'
    clearTicket();stop();sound='idle';resume=null;tourIndex=0
    update(fresh());return
   }
   if(state.status!=='pending')return
   if(command==='skip'){reminder?.cancel();finish('skipped','practice');return}
   if(command==='resume'&&state.step==='welcome'&&resume){
    const step=resume;resume=null;move(step);return
   }
   if(command==='start'&&state.step==='welcome'){resume=null;move('profile');return}
   if(['known','beginner'].includes(command)&&state.step==='profile'){move('intro_fluency',{profile:command});return}
   if(command==='play'&&state.step==='sound_check'){
    if(checkSound){
      const result=checkSound()
      if(result==='heard'){sound='heard';update({soundComplete:true})}
      else if(!state.soundComplete){sound=result;publish()}
      return
    }
    if(sound!=='heard')sound='played'
    publish();play();return
   }
   if(command==='heard'&&state.step==='sound_check'&&sound!=='idle'){sound='heard';update({soundComplete:true});return}
   if(command==='no-sound'&&state.step==='sound_check'&&sound!=='idle'){sound='not_heard';update({soundComplete:false});return}
   if(reminder&&state.step==='reminder'){
    if(command==='reminder-skip'){exitReminder(false);return}
    if(command==='reminder-enable'){exitReminder(true);return}
    if(!exiting&&command.startsWith('reminder-time:')&&reminder.validTime(command.slice(14))){
      reminderTime=command.slice(14);publish();return
    }
   }
   if(command==='tour-next'&&state.step==='known_tour'){
    if(tourIndex<2){tourIndex++;publish()}
    else finish('completed','practice')
    return
   }
   if(command==='back'){
    if(state.step==='known_tour'&&tourIndex>0){tourIndex--;publish();return}
    if(reminder&&state.step==='reminder'){
      reminder.cancel()
      if(state.profile==='known')move('button_tutorial',{taps:0,holds:0})
      else move('beginner_intro')
      return
    }
    if(reminder&&state.step==='known_tour'){move('reminder');return}
    const previous={
      profile:'welcome',intro_fluency:'profile',intro_listen:'intro_fluency',intro_speed:'intro_listen',
      sound_check:'intro_speed',button_tutorial:'sound_check',beginner_stages:'button_tutorial',
      beginner_intro:'beginner_stages',known_tour:'button_tutorial',
    }[state.step]
    if(!previous)return
    if(state.step==='sound_check'){sound='idle';move(previous,{soundComplete:false});return}
    if(['button_tutorial','beginner_stages','known_tour'].includes(state.step)){move(previous,{taps:0,holds:0});return}
    move(previous);return
   }
   if(command==='continue'){
    const next={intro_fluency:'intro_listen',intro_listen:'intro_speed',intro_speed:'sound_check',
      beginner_stages:'beginner_intro',sound_check:sound==='heard'?'button_tutorial':undefined}[state.step]
    if(next){move(next);return}
    if(state.step==='beginner_intro'){if(reminder)move('reminder');else finish('completed','guided')}
   }
  },
  close(){reminder?.cancel();clearTicket();stop()},
 }
}
