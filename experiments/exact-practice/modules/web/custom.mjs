import { normalizeCustomText, textToMorseCode } from './custom-text.generated.mjs'
import { customListenDiff } from './custom-diff.generated.mjs'
import { tempoTiming } from './tempo.mjs'

export const CUSTOM_KEY = 'dit.exact-spike.custom.v1'
const LIMIT = 2000
const DRAFT_LIMIT = 8000

export function customPlan(text, speed, effective) {
  const {unitMs:unit,characterGapMs,wordGapMs} = tempoTiming(speed,effective)
  const tokens = textToMorseCode(text).code.split(' ').filter(Boolean)
  const plan = []
  let offset = 0
  for (const [index, token] of tokens.entries()) {
    if (token === '/') { offset += wordGapMs; continue }
    for (const [symbolIndex, symbol] of [...token].entries()) {
      const start = offset
      offset += symbol === '.' ? unit : 3 * unit
      plan.push([start,offset])
      if (symbolIndex < token.length - 1) offset += unit
    }
    if (index < tokens.length - 1 && tokens[index + 1] !== '/') offset += characterGapMs
  }
  return plan
}

function load(storage) {
  try {
    const raw = storage.getItem(CUSTOM_KEY)
    if (raw === null) return { text:'',typeAlong:true,status:'empty' }
    if (raw.length > 20_000) return { text:'',typeAlong:true,status:'unsupported' }
    let v
    try { v = JSON.parse(raw) } catch { return {text:'',typeAlong:true,status:'damaged'} }
    if (v?.version !== 1) return { text:'',typeAlong:true,status:'unsupported' }
    if (typeof v.text !== 'string' || typeof v.typeAlong !== 'boolean') return {text:'',typeAlong:true,status:'damaged'}
    return { text:normalizeCustomText(v.text).normalized,typeAlong:v.typeAlong,status:'saved' }
  } catch { return { text:'',typeAlong:true,status:'unavailable' } }
}

export function createCustom({storage, project, play, stop, pause, resume}) {
  let {text,typeAlong,status}=load(storage)
  let active=false
  let phase='editor'
  let typed=''
  let lastResult=null
  let generation=0
  let clockOperation=0
  const proj=(key,value)=>project('custom-'+key+':'+value)
  const setPhase=value=>{phase=value;proj('phase',phase)}
  function cancel() { generation++; clockOperation++; stop() }
  const clearReveal=()=>{proj('reveal','');proj('summary','');proj('diff','')}
  function prep() {
    cancel()
    typed=''
    proj('copy','')
    proj('typealong', Number(typeAlong))
    proj('chars',text.length)
    proj('words',text ? text.split(' ').length : 0)
    proj('storage',status)
    clearReveal()
    if (text) {
      proj('editor','')
      setPhase('setup')
    } else {
      proj('editor','')
      setPhase('editor')
    }
  }
  function saveLocal() {
    const before=load(storage).status
    if (before==='unsupported'||before==='unavailable') { status=before; return }
    try { storage.setItem(CUSTOM_KEY,JSON.stringify({version:1,text,typeAlong}));status='saved' }
    catch { status='unavailable' }
  }
  function edit(raw) {
    if (!active || phase!=='editor') return
    lastResult=normalizeCustomText(raw.slice(0,DRAFT_LIMIT))
    proj('ignored',lastResult.ignored)
    proj('truncated',Number(lastResult.truncated || raw.length>DRAFT_LIMIT))
  }
  function start() {
    if(!active||!text||phase==='editor') return false
    cancel()
    const token=generation
    typed=''
    proj('copy','')
    clearReveal()
    setPhase('playing')
    play(text,()=>{
      if(token===generation&&active&&(phase==='playing'||phase==='paused')) setPhase('ended')
    },()=>{
      if(token===generation&&active&&(phase==='playing'||phase==='paused')) setPhase('audio-error')
    })
    return true
  }
  return {
    enter(){ active=true; prep() },
    leave(){ active=false; cancel();typed='';proj('copy','');proj('editor','');clearReveal();setPhase('editor') },
    suspend(){ if(active&&phase!=='editor') prep() },
    edit(raw) {
      if (!active) return
      if(typeof raw==='string') { edit(raw); return }
      cancel()
      typed=''
      proj('copy','')
      clearReveal()
      setPhase('editor')
      proj('editor',text)
      edit(text)
    },
    discard(){ if(active) prep() },
    toggleType() {
      if (!active || phase!=='editor') return
      // Draft only; Save commits this choice.
      proj('typealong',Number(!typeAlong))
    },
    save(src,nextType=typeAlong) {
      if(!active||phase!=='editor') return
      edit(src)
      text=lastResult?.normalized ?? ''
      typeAlong=Boolean(nextType)
      saveLocal()
      prep()
    },
    clear(){
      if(!active) return
      text='';saveLocal();prep()
    },
    play:start,
    copy(value) {
      if(!active||!typeAlong||!['playing','ended'].includes(phase)) return false
      typed=value.slice(0,LIMIT)
      return true
    },
    async pause() {
      if(!active||phase!=='playing') return
      const token=++clockOperation
      try {
        const pending = pause()
        if (pending === false) return
        setPhase('paused')
        await pending
      } catch { if(token===clockOperation&&phase==='paused') setPhase('playing') }
    },
    async resume() {
      if(!active||phase!=='paused') return
      const token=++clockOperation
      try {
        const pending = resume()
        if (pending === false) return
        setPhase('playing')
        await pending
      } catch { if(token===clockOperation&&phase==='playing') setPhase('paused') }
    },
    reveal() {
      if(!active||!['playing','paused','ended'].includes(phase)) return
      cancel()
      setPhase('reveal')
      proj('reveal',text)
      if(!typeAlong) return
      const diff=customListenDiff(text,typed.toUpperCase().slice(0,LIMIT))
      proj('summary',diff.matched+'/'+diff.total+' matched · '+diff.missed+' missed · '+diff.extra+' extra')
      const esc=value=>value.replaceAll('%','%25').replaceAll('|','%7C')
      proj('diff',diff.tokens.map(token=>token.kind+':'+esc(token.text)).join('|'))
    },
  }
}
