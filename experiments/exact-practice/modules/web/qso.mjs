import {textToConversationMorseCode,decodeConversationMorseCode,getReceivedConversationTextAtElapsedMs} from './qso-codec.generated.mjs'
import {generatePracticeCallsign} from './practice-callsign.generated.mjs'
import {customListenDiff} from './custom-diff.generated.mjs'
import {characterUnitMs} from './tempo.mjs'

/**
 * @typedef {{outgoing: string|null, reply: string}} AcceptedExchange
 * @typedef {{outgoing: string|null, history: AcceptedExchange[]}} StationTurn
 * @typedef {string|{text: string, accept: () => void}} StationReply
 * @typedef {{send: (turn: StationTurn) => StationReply|Promise<StationReply>, close?: () => void}} Station
 * @typedef {(options: {callsign: string}, onCancelOpen?: (cancel: () => void) => void) => Station|Promise<Station>} StationFactory
 *
 * One station per approved contact. A null outgoing turn asks for an opener.
 * History is a detached snapshot of accepted exchanges. A retry can rebuild
 * from it. close releases local resources synchronously and must not throw.
 */

/** Only these station errors may be projected to the learner. */
export class StationError extends Error {
  constructor(kind) {
    const messages = {
      open:'Could not start the QSO. Try again.',
      empty:'Empty response from the other station',
      send:'Could not reach the other station. Try again.',
    }
    super(messages[kind] ?? messages.send)
  }
}

/** @type {StationFactory} Deterministic station for the isolated experiment. */
export function createLocalStation() {
  return {send({outgoing,history}) {
    if (outgoing === null) return 'CQ K'
    return history.some(turn => turn.outgoing !== null) ? '73 SK' : 'R K'
  }}
}

export function qsoPlan(text,speed) {
  const unit=characterUnitMs(speed)
  const tokens=textToConversationMorseCode(text).code.split(' ').filter(Boolean)
  const plan=[]
  let offset=0
  for (const [index,token] of tokens.entries()) {
    if(token==='/'){offset+=7*unit;continue}
    for(const [i,symbol] of [...token].entries()){
      const start=offset
      offset+=symbol==='.' ? unit : 3*unit
      plan.push([start,offset])
      if(i<token.length-1)offset+=unit
    }
    if(index<tokens.length-1&&tokens[index+1]!=='/')offset+=3*unit
  }
  return plan
}

const typedLimit=2000
const draftLimit=2000
const transcriptLimit=40
const spaceMs=1200

export function createQso({project,createStation,play,stop,pause,resume,setTimer,clearTimer,callsignRandom,platform='web'}) {
  const apple = platform === 'ios'
  let active=false
  let phase='idle'
  let operation=0
  let clockOperation=0
  let previousCallsign
  let pendingDirection=null
  let live=false
  let liveText=null
  let copyChecked=false
  let cancelOpen
  let station=null
  let accepted=[]
  let draft=''
  let autoSpace=false
  let wordTimer
  let wordGeneration=0
  let incoming=null
  let incomingSerial=0
  let copy=''
  let turns=[]
  let retryRequest=null
  let recovery=''
  const proj=(key,value)=>project('qso-'+key+':'+value)
  let replyStarted=false
  let lastTranscript=''
  function publishTurns() {
    const receiving=['receiving','paused','rx-ready'].includes(phase)
    const latest=apple && turns.findLast(turn=>turn.speaker==='Station')
    const lines=turns.map(turn=>{
      const visible=!apple || turn.speaker==='You' || phase==='ended' || turn.revealed
        || (turn===latest && !receiving && (replyStarted || copyChecked || live))
      return visible ? turn.speaker+': '+turn.text : 'Hidden:'+turn.id
    }).join('\n')
    if(lines!==lastTranscript){lastTranscript=lines;proj('transcript',lines)}
  }
  function setPhase(value) {
    phase=value
    proj('phase',value)
    if(apple) publishTurns()
  }
  function clearWord() { wordGeneration++; clearTimer(wordTimer); wordTimer=undefined }
  function clearDraft(){clearWord();draft='';autoSpace=false;proj('draft','')}
  function showLive(value) {
    if (value===liveText) return
    liveText=value
    proj('live',value)
  }
  function clearCopy(){
    copy='';copyChecked=false;proj('copy-checked','0');proj('copy','');proj('rx-text','');proj('copy-summary','');proj('copy-diff','')
  }
  function stopFlight(){
    operation++;clockOperation++
    const cancel=cancelOpen
    cancelOpen=undefined
    cancel?.()
    clearWord();stop()
  }
  function addTurn(speaker,text,id){
    turns.push({speaker,text,id})
    if (!apple && turns.length > transcriptLimit) turns.shift()
    publishTurns()
  }
  function commitIncoming(){
    if(!incoming||incoming.committed)return
    incoming.committed=true
    addTurn('Station',incoming.text,incoming.id)
  }
  function closeStation(){
    const ended=station
    station=null
    accepted=[]
    ended?.close?.()
  }
  function reset(){
    stopFlight()
    clearDraft()
    clearCopy()
    closeStation()
    pendingDirection=null;incoming=null;turns=[]
    replyStarted=false;lastTranscript=''
    retryRequest=null;recovery=''
    proj('callsign','');proj('transcript','');proj('error','');proj('replayable','0');showLive('')
    setPhase('idle')
  }
  function playback(){
    if (!incoming) return false
    stopFlight()
    const ticket=operation
    replyStarted=false
    showLive('')
    clearCopy()
    recovery=''
    proj('error','')
    setPhase('receiving')
    const onComplete=()=>{
      if(active&&ticket===operation&&['receiving','paused'].includes(phase)) {
        if(live) showLive(incoming.text)
        setPhase('rx-ready')
      }
    }
    const onProgress=(elapsedMs,speed)=>{
      if(!active||!live||ticket!==operation||phase!=='receiving')return
      const unit=characterUnitMs(speed)
      showLive(getReceivedConversationTextAtElapsedMs(incoming.text,incoming.code,unit,elapsedMs,3*unit,7*unit))
    }
    const onError=()=>{
      if(!active||ticket!==operation||!['receiving','paused'].includes(phase))return
      stopFlight()
      recovery='audio';proj('error','Could not play the accepted transmission.');setPhase('error')
    }
    try { play(incoming.text,onComplete,onError,onProgress) } catch { onError() }
    return true
  }
  async function openStation(direction){
    stopFlight()
    const ticket=operation
    recovery=''
    proj('error','')
    try {
      const callsign=generatePracticeCallsign({previousCallsign,random:callsignRandom})
      previousCallsign=callsign
      proj('callsign',callsign)
      const opening=createStation({callsign}, cancel => { cancelOpen=cancel })
      let opened=opening
      if (typeof opening?.then === 'function') {
        setPhase('sending')
        opened=await opening
      }
      if(!active || ticket!==operation){opened?.close?.();return}
      cancelOpen=undefined
      station=opened
      if(direction==='send')setPhase('tx')
      else void request({outgoing:null})
    } catch {
      if(!active || ticket!==operation)return
      cancelOpen=undefined
      recovery='open'
      proj('error','Could not start the QSO. Try again.')
      setPhase('error')
    }
  }
  async function request(payload){
    stopFlight()
    incoming=null
    showLive('')
    retryRequest=payload
    recovery=''
    proj('error','')
    proj('replayable','0')
    clearCopy()
    const ticket=operation
    setPhase('sending')
    try{
      const result=await station.send({...payload,history:accepted.map(turn => ({...turn}))})
      if(!active||ticket!==operation)return
      const reply = typeof result === 'string' ? result : result.text
      const {normalized:text,code}=textToConversationMorseCode(reply)
      if(!text || !code)throw new StationError('empty')
      if (typeof result !== 'string') result.accept()
      accepted.push({outgoing:payload.outgoing, reply})
      incoming={id:++incomingSerial,text,code}
      proj('replayable','1')
      retryRequest=null
      playback()
    }catch(error){
      if(!active||ticket!==operation)return
      recovery='request'
      proj('error', error instanceof StationError ? error.message : 'The local practice station could not answer.')
      setPhase('error')
    }
  }
  function reveal(){
    if(!['rx-ready','tx'].includes(phase)||!incoming)return false
    proj('rx-text',incoming.text)
    return true
  }
  function checkCopy(){
    if(!reveal())return false
    copyChecked=true
    if(apple) publishTurns()
    proj('copy-checked','1')
    const diff=customListenDiff(incoming.text,copy.toUpperCase().slice(0,typedLimit))
    proj('copy-summary',diff.matched+'/'+diff.total+' matched · '+diff.missed+' missed · '+diff.extra+' extra')
    const esc=text=>text.replaceAll('%','%25').replaceAll('|','%7C')
    proj('copy-diff',diff.tokens.map(token=>token.kind+':'+esc(token.text)).join('|'))
    return true
  }
  function setLive(value){
    live=Boolean(value)
    if(apple) publishTurns()
    proj('live-enabled',Number(live))
    if(!live)showLive('')
    else if(phase==='rx-ready'&&incoming)showLive(incoming.text)
  }
  return {
    enter(){active=true;reset()},
    leave(){active=false;reset();if(apple)setLive(false)},
    canKey:()=>active&&phase==='tx',
    activity(){
      if(phase!=='tx')return
      clearWord()
      if(apple && !replyStarted){replyStarted=true;publishTurns()}
    },
    revealTurn(id){
      const turn=turns.find(turn=>turn.speaker==='Station' && turn.id===id)
      if(!active || !turn || !apple)return false
      turn.revealed=true
      publishTurns()
      return true
    },
    start(direction){
      if(!active||phase!=='idle'||!['send','receive'].includes(direction))return false
      pendingDirection=direction
      setPhase('consent')
      return true
    },
    confirm(allowed){
      if(!active||phase!=='consent'||!pendingDirection)return false
      const direction=pendingDirection
      if(!allowed){pendingDirection=null;setPhase('idle');return true}
      void openStation(direction)
      return true
    },
    setLive,
    key(code){
      if(!active||phase!=='tx')return false
      const letter=decodeConversationMorseCode(code)
      clearWord()
      if(letter){
        draft=(draft+letter).slice(0,draftLimit)
        autoSpace=false
        proj('draft',draft)
      }
      const ticket=wordGeneration
      wordTimer=setTimer(()=>{
        if(ticket!==wordGeneration||phase!=='tx'||!draft||draft.endsWith(' ')||draft.length>=draftLimit)return
        draft+=' ';autoSpace=true;proj('draft',draft)
      },spaceMs)
      return Boolean(letter)
    },
    backspace(){
      if(!active||phase!=='tx')return false
      clearWord()
      if(!draft)return false
      draft=draft.slice(0,autoSpace?-2:-1);autoSpace=false
      proj('draft',draft)
      return true
    },
    clear(){if(active&&phase==='tx')clearDraft()},
    send(){
      const tx=draft.trim()
      if(!active||phase!=='tx'||!tx)return false
      clearDraft()
      addTurn('You',tx)
      void request({outgoing:tx})
      return true
    },
    copy(value){
      if(!active||(!['receiving','rx-ready','tx'].includes(phase) && !(apple && phase==='paused'))||!incoming)return false
      copy=String(value).slice(0,typedLimit)
      if (apple && copyChecked && phase==='rx-ready') checkCopy()
      return true
    },
    reveal,
    check:checkCopy,
    startTurn(){
      if(!active||phase!=='rx-ready')return false
      commitIncoming()
      proj('copy',copy)
      proj('copy-checked',Number(copyChecked))
      showLive('')
      setPhase('tx')
      return true
    },
    replay(){
      if(!active||!incoming||!['receiving','paused','rx-ready','tx'].includes(phase))return false
      if(!apple&&phase==='tx'&&draft)return false
      return playback()
    },
    retry(){
      if(!active||phase!=='error')return false
      if(recovery==='open'){void openStation(pendingDirection);return true}
      if(recovery==='audio')return playback()
      if(recovery==='request'&&retryRequest){void request(retryRequest);return true}
      return false
    },
    async pause(){
      if(phase!=='receiving')return
      const ticket=++clockOperation
      setPhase('paused')
      try{await pause()}catch{
        if(ticket!==clockOperation||phase!=='paused')return
        stopFlight();recovery='audio';proj('error','Could not pause audio.');setPhase('error')
      }
    },
    async resume(){
      if(phase!=='paused')return
      const ticket=++clockOperation
      setPhase('receiving')
      try{await resume()}catch{
        if(ticket!==clockOperation||phase!=='receiving')return
        stopFlight();recovery='audio';proj('error','Could not resume audio.');setPhase('error')
      }
    },
    interrupt(){
      if(!active)return
      clearWord()
      if(['receiving','paused','sending'].includes(phase)){
        recovery=phase==='sending' ? (station ? 'request' : 'open') : 'audio'
        stopFlight()
        proj('error','Contact paused. Retry when you are ready.')
        setPhase('error')
      }
    },
    end(){
      if(!active||phase==='idle'||phase==='consent'||phase==='ended')return
      stopFlight();closeStation();commitIncoming();clearDraft();clearCopy();showLive('');retryRequest=null;recovery=''
      setPhase('ended')
    },
    new(){if(active)reset()},
  }
}
