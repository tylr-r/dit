// Rules and pack order from shipped packages/core/src/utils/beginnerCourse.ts.
export const GUIDED_PACKS = Object.freeze(['ET','AN','IM','RS','OD','UW','GK','HL','BC','FP','VX','QYZ','12345','67890'].map(pack => Object.freeze([...pack])))
// Shipped guided packs omit J; graduation enables the full ordinary alphabet.
export const COURSE_POOL = GUIDED_PACKS.flat().join('') + 'J'
const teachPraise = ['Got it 👍','Nice ✨','Good 🙌',"That's it 👏",'Nailed it 🎯']
const LAST_PACK = GUIDED_PACKS.length-1
export const GUIDED_KEY = 'dit.exact-spike.guided.v1'
const VERSION = 1
const PHASES = new Set(['teach','gate-practice','practice','gate-listen','listen','gate-retry','gate-next','complete'])
const progress = (teachCounts = {}) => ({
  teachCounts, practiceAttempts:0, practiceCorrect:0, practiceLetterCorrect:{},
  listenAttempts:0, listenCorrect:0, listenLetterCorrect:{},
})
export const beginGuide = (pack = 0) => ({ pack, phase:'teach', progress:progress() })
const completeGuide = () => ({pack:LAST_PACK,phase:'complete',maxPackReached:GUIDED_PACKS.length,progress:progress()})
const every = (pack, counts, min) => pack.every(letter => (counts[letter] ?? 0) >= min)
const add = (counts, letter) => ({ ...counts, [letter]:(counts[letter] ?? 0) + 1 })
export const guidePack = state => GUIDED_PACKS[state.pack]
export const guideReached=state=>state.maxPackReached??state.pack
export function selectGuidePack(state,pack) {
  if(!Number.isInteger(pack)||pack<0||pack>LAST_PACK)return state
  return {...beginGuide(pack),maxPackReached:Math.max(guideReached(state),pack)}
}
export const guideUnlocked = state => GUIDED_PACKS.slice(0,state.pack+1).flat()
export const guidePracticePool = (state, roll) =>
  state.pack > 0 && roll >= .6 ? GUIDED_PACKS.slice(0,state.pack).flat() : guidePack(state)
export const teachTarget = state => guidePack(state).find(letter => (state.progress.teachCounts[letter] ?? 0) < 2) ?? guidePack(state)[0]

export function guideAttempt(state, letter, correct) {
  const pack = guidePack(state)
  if (!(state.phase === 'teach' ? pack : guideUnlocked(state)).includes(letter)) return state
  const p = state.progress
  if (state.phase === 'teach') {
    if (!correct || (p.teachCounts[letter] ?? 0) >= 2) return state
    const teachCounts = add(p.teachCounts, letter)
    return { ...state, phase:every(pack,teachCounts,2) ? 'gate-practice' : 'teach', progress:{ ...p, teachCounts } }
  }
  if (state.phase === 'practice') {
    const practiceAttempts = p.practiceAttempts + 1
    const practiceCorrect = p.practiceCorrect + Number(correct)
    const practiceLetterCorrect = correct ? add(p.practiceLetterCorrect,letter) : p.practiceLetterCorrect
    const done = correct && practiceAttempts >= 10 && practiceCorrect >= 8 && every(pack,practiceLetterCorrect,2)
    return { ...state, phase:done ? 'gate-listen' : 'practice', progress:{...p,practiceAttempts,practiceCorrect,practiceLetterCorrect} }
  }
  if (state.phase === 'listen') {
    const listenAttempts = p.listenAttempts + 1
    const listenCorrect = p.listenCorrect + Number(correct)
    const listenLetterCorrect = correct ? add(p.listenLetterCorrect,letter) : p.listenLetterCorrect
    const done = listenAttempts >= 6
    const pass = listenCorrect >= 4 && every(pack,listenLetterCorrect,1)
    return { ...state, phase:done ? pass ? 'gate-next' : 'gate-retry' : 'listen', progress:{...p,listenAttempts,listenCorrect,listenLetterCorrect} }
  }
  return state
}

export function continueGuide(state) {
  switch (state.phase) {
    case 'gate-practice':
    case 'gate-retry': return { ...state, phase:'practice', progress:progress(state.progress.teachCounts) }
    case 'gate-listen': return { ...state, phase:'listen' }
    case 'gate-next':
      return state.pack + 1 < GUIDED_PACKS.length ? selectGuidePack(state,state.pack+1) : completeGuide()
    default: return state
  }
}

function decodeGuide(data) {
  if (!data || !Number.isInteger(data.pack) || data.pack < 0 || data.pack >= GUIDED_PACKS.length || !PHASES.has(data.phase)) return null
  const pack = guidePack(data)
  const p = data.progress
  const count = n => Number.isInteger(n) && n >= 0 && n <= 1_000_000
  if (!p || !['practiceAttempts','practiceCorrect','listenAttempts','listenCorrect'].every(key => count(p[key]))) return null
  if (p.practiceCorrect > p.practiceAttempts || p.listenCorrect > p.listenAttempts || p.listenAttempts > 6) return null
  const counts = {}
  for (const key of ['teachCounts','practiceLetterCorrect','listenLetterCorrect']) {
    const value = p[key]
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const allowed = key === 'teachCounts' ? pack : guideUnlocked(data)
    if (Object.keys(value).some(letter => !allowed.includes(letter) || !count(value[letter]))) return null
    counts[key] = Object.fromEntries(Object.entries(value))
  }
  if (Object.values(counts.teachCounts).some(value => value > 2)) return null
  if (Object.values(counts.practiceLetterCorrect).reduce((a,b)=>a+b,0) !== p.practiceCorrect ||
      Object.values(counts.listenLetterCorrect).reduce((a,b)=>a+b,0) !== p.listenCorrect) return null
  const reached=data.maxPackReached
  if(reached!==undefined && (!Number.isInteger(reached)||reached<data.pack||reached>GUIDED_PACKS.length
    || (data.phase==='complete'&&reached!==GUIDED_PACKS.length)))return null
  if (data.phase==='complete' && data.pack===LAST_PACK && data.maxPackReached===GUIDED_PACKS.length
      && p.practiceAttempts===0 && p.listenAttempts===0 && !Object.keys(counts.teachCounts).length
      && !Object.keys(counts.practiceLetterCorrect).length && !Object.keys(counts.listenLetterCorrect).length)
    return completeGuide()
  const teachDone = every(pack,counts.teachCounts,2)
  const practiceDone = p.practiceAttempts >= 10 && p.practiceCorrect >= 8 && every(pack,counts.practiceLetterCorrect,2)
  const listenPass = p.listenAttempts === 6 && p.listenCorrect >= 4 && every(pack,counts.listenLetterCorrect,1)
  const phase = data.phase
  if (phase !== 'teach' && !teachDone) return null
  if (['gate-listen','listen','gate-next','gate-retry','complete'].includes(phase) && !practiceDone) return null
  if ((phase === 'gate-next' || phase === 'complete') && !listenPass) return null
  if (phase === 'complete' && data.pack !== GUIDED_PACKS.length - 1) return null
  if (phase === 'gate-retry' && (p.listenAttempts !== 6 || listenPass)) return null
  if (phase === 'listen' && p.listenAttempts >= 6) return null
  if(data.pack===LAST_PACK && (phase==='complete'||phase==='gate-next')) return completeGuide()
  return { pack:data.pack, phase, ...(reached===undefined?{}:{maxPackReached:reached}), progress:{
    teachCounts:counts.teachCounts, practiceAttempts:p.practiceAttempts, practiceCorrect:p.practiceCorrect,
    practiceLetterCorrect:counts.practiceLetterCorrect, listenAttempts:p.listenAttempts, listenCorrect:p.listenCorrect,
    listenLetterCorrect:counts.listenLetterCorrect,
  } }
}

const hasUnknownFields=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)
  &&Object.keys(value).some(key=>!keys.includes(key))
function futureGuide(value){
  const data=value.data
  return hasUnknownFields(value,['version','data'])
    ||hasUnknownFields(data,['pack','phase','maxPackReached','progress'])
    ||(typeof data?.phase==='string'&&!PHASES.has(data.phase))
    ||hasUnknownFields(data?.progress,Object.keys(progress()))
}

export function readGuide(storage) {
  try {
    const raw = storage.getItem(GUIDED_KEY)
    if (raw === null) return { status:'empty', data:beginGuide() }
    if (raw.length > 100_000) return { status:'unsupported', data:beginGuide() }
    let value
    try { value = JSON.parse(raw) } catch { return { status:'damaged', data:beginGuide() } }
    if (value?.version !== VERSION || futureGuide(value)) return { status:'unsupported', data:beginGuide() }
    const data = decodeGuide(value.data)
    return data ? { status:'saved', data, ...(data.phase==='complete'&&value.data.maxPackReached===undefined ? {migrated:true} : {}) } : {status:'damaged', data:beginGuide()}
  } catch { return { status:'unavailable', data:beginGuide() } }
}
export function saveGuide(storage, data) {
  const {status} = readGuide(storage)
  if (status === 'unsupported' || status === 'unavailable') return status
  try {
    storage.setItem(GUIDED_KEY,JSON.stringify({version:VERSION,data}))
    return 'saved'
  } catch { return 'unavailable' }
}

const TITLES = {
  teach:'Teach', practice:'Practice', listen:'Listen',
  'gate-practice':'Next up: Practice', 'gate-listen':'Ready to listen',
  'gate-retry':'Keep going: Practice again', 'gate-next':'New letters unlocked', complete:'Course complete',
}

/** Orchestrate real keying and Listen confirmations around the pure pack model. */
export function createGuide({ storage, setTimer, clearTimer, project, decode, play, score, pick, pickListenWeighted = pick, random = Math.random, startListen, stopListen, lock, completed = () => {} }) {
  const initial = readGuide(storage)
  let state = initial.data
  let active = false
  let allowed = false
  let status = initial.migrated ? saveGuide(storage,state) : initial.status
  let target = teachTarget(state)
  let waiting = false
  let listenOn = false
  let timer
  let generation = 0
  function projectCatalog() {
    const reached=guideReached(state)
    project('course-packs:'+GUIDED_PACKS.map(pack=>pack.join(' ')).join(';'))
    project('course-current:'+(state.pack+1))
    project('course-lesson-mode:'+(state.phase === 'listen' ? 'listen' : 'practice'))
    project('course-reached:'+Math.min(GUIDED_PACKS.length,reached+1))
    project('course-learned:'+GUIDED_PACKS.slice(0,reached).map((_,i)=>i+1).join(','))
    project('course-graduated:'+Number(reached===GUIDED_PACKS.length))
    project('course-finished:'+Number(state.phase==='complete'))
  }
  const persist = next => {
    if (next === state) return
    state = next
    status = saveGuide(storage,state)
    project('guide-storage:' + status)
    projectCatalog()
  }
  const practiceTarget = previous => pick(guidePracticePool(state,state.pack > 0 ? random() : 0),previous)
  function render() {
    if (!active) return
    const phase = state.phase
    if (phase === 'teach') project('teach-remaining:' + Math.max(0,2-(state.progress.teachCounts[target] ?? 0)))
    project('guide-phase:' + phase)
    project('guide-title:' + TITLES[phase])
    const nextPack = phase === 'gate-next' ? GUIDED_PACKS[state.pack + 1] : null
    project('guide-pack:' + (nextPack ?? guidePack(state)).join(','))
    project('guide-pool:' + guideUnlocked(state).join(','))
    project('guide-target:' + (phase === 'teach' || phase === 'practice' ? target : ''))
  }
  function stop() {
    generation++
    clearTimer(timer)
    waiting = false
    lock(false)
    if (listenOn) stopListen()
    listenOn = false
  }
  function finishCourse() {
    if(state.phase==='complete')return false
    persist(completeGuide())
    active=allowed=false
    completed(status)
    return true
  }
  function activate() {
    if(active && allowed && !listenOn && state.phase==='gate-next' && state.pack===LAST_PACK){
      finishCourse()
      return
    }
    render()
    if (active && allowed && state.phase === 'listen' && !listenOn) {
      listenOn = true
      startListen()
    }
  }
  return {
    completed: () => state.phase==='complete',
    graduated: () => guideReached(state)===GUIDED_PACKS.length,
    projectCatalog,
    selectPack(pack) {
      const next=selectGuidePack(state,pack)
      if(next===state)return false
      stop()
      persist(next)
      target=teachTarget(state)
      project('guide-feedback:')
      activate()
      return true
    },
    enter(canPlay) {
      if(state.phase==='complete')return false
      active = true
      allowed = canPlay
      target = state.phase === 'teach' ? teachTarget(state) : state.phase === 'practice' ? practiceTarget() : guidePack(state)[0]
      project('guide-storage:' + status)
      activate()
    },
    leave() {
      stop()
      active = allowed = false
    },
    blocked(blocked) {
      if (!active || blocked === !allowed) return
      allowed = !blocked
      if (blocked) {
        stop()
        project('guide-feedback:')
      } else {
        if (state.phase === 'teach') target = teachTarget(state)
        activate()
      }
    },
    replay() {
      if (!active || !allowed || waiting || !['teach','practice'].includes(state.phase)) return false
      play(target)
      return true
    },
    accept(code) {
      if (!active || !allowed || waiting || !['teach','practice'].includes(state.phase)) return
      const phase = state.phase
      const correct = decode(code) === target
      persist(guideAttempt(state,target,correct))
      if (phase === 'teach' && correct) {
        const total = Object.values(state.progress.teachCounts).reduce((sum,count)=>sum+count,0)
        project('teach-praise:' + teachPraise[(total-1) % teachPraise.length])
      }
      if (phase === 'practice') score(target,correct,'practice')
      project('guide-feedback:' + (correct ? 'Correct' : 'Try again'))
      waiting = true
      lock(true)
      if (!correct) play(target)
      const ticket = ++generation
      timer = setTimer(() => {
        if (ticket !== generation) return
        waiting = false
        lock(false)
        project('guide-feedback:')
        if (state.phase === 'teach') target = teachTarget(state)
        if (state.phase === 'practice' && correct) target = practiceTarget(target)
        render()
      },1000)
    },
    continue() {
      if (!active || !allowed || waiting || listenOn) return false
      if(state.phase==='gate-next' && state.pack===LAST_PACK)return finishCourse()
      const next = continueGuide(state)
      if (next === state) return false
      stop()
      persist(next)
      target = state.phase === 'teach' ? teachTarget(state) : state.phase === 'practice' ? practiceTarget(target) : guidePack(state)[0]
      project('guide-feedback:')
      activate()
      return true
    },
    recordListen(letter, correct, sample) {
      if (!listenOn || state.phase !== 'listen') return
      const next=guideAttempt(state,letter,correct)
      if(next===state)return
      persist(next)
      score(letter,correct,'listen',sample)
    },
    finishListenRound() {
      if (!listenOn || state.phase === 'listen') return true
      listenOn = false
      stopListen()
      if(state.phase==='gate-next' && state.pack===LAST_PACK){
        finishCourse()
      }else render()
      return false
    },
    canKey: () => active && allowed && !waiting && ['teach','practice'].includes(state.phase),
    isListening: () => listenOn,
    pool: () => guideUnlocked(state),
    pickListen(previous) {
      const pack = guidePack(state)
      return pack.find(letter => (state.progress.listenLetterCorrect[letter] ?? 0) < 1) ?? pickListenWeighted(guideUnlocked(state),previous)
    },
  }
}
