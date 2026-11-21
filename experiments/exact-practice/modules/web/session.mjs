import { PRACTICE_WORDS } from './word-bank.generated.mjs'
import { PRACTICE_POOL, pickWeighted, enqueueReview, pullReview } from './progression.mjs'
import { normalizeSelection, selectionPool, tierSelection } from './selection.mjs'
import { HISTORY_LIMIT, normalizePractice } from './practice-store.mjs'
import { characterUnitMs, normalizeTempo, tempoStep } from './tempo.mjs'
import { applyListenTtrSample } from "./recognition.generated.mjs"
import { countsAnswer, recordCorrectAnswer, todayStreakContribution } from './reference-retention.generated.mjs'
import { buildReference, buildRecognition, recordLetterAttempt } from './reference.mjs'
// Shipped data source: packages/core/src/data/morse.ts (A–Z, 0–9).
const codes = [
  '.-', '-...', '-.-.', '-..', '.', '..-.', '--.', '....', '..', '.---', '-.-', '.-..', '--',
  '-.', '---', '.--.', '--.-', '.-.', '...', '-', '..-', '...-', '.--', '-..-', '-.--', '--..',
  '-----', '.----', '..---', '...--', '....-', '.....', '-....', '--...', '---..', '----.',
]
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const byCharacter = new Map([...alphabet].map((char, i) => [char, codes[i]]))
const byCode = new Map(codes.map((code, i) => [code, alphabet[i]]))
export const decode = code => byCode.get(code) ?? null
export const playbackUnitMs = characterUnitMs
const feedbackMs = 1000
const extraWordGapMs = 1200
const next = (pool,target) => pool[(pool.indexOf(target) + 1) % pool.length]

export function replayPlan(char, unitMs) {
  const code = byCharacter.get(char)
  if (!code) return []
  let offset = 0
  return [...code].map(symbol => {
    const start = offset
    const end = start + (symbol === '-' ? 3 : 1) * unitMs
    offset = end + unitMs
    return [start, end]
  })
}

function newPracticeWord(pool, previous, roll = 0) {
  const available = new Set(pool)
  let choices = PRACTICE_WORDS.filter(word => [...word].every(letter => available.has(letter)))
  if (!choices.length) choices = [...pool]
  if (choices.length > 1) choices = choices.filter(word => word !== previous)
  const word = choices[Math.min(choices.length-1,Math.floor(roll*choices.length))]
  return {practiceWord:word, practiceIndex:0, wordStartMs:null, target:word[0]}
}

function advanceWord(state, event) {
  const nextIndex = state.practiceIndex + 1
  if (nextIndex < state.practiceWord.length)
    return {practiceIndex:nextIndex, target:state.practiceWord[nextIndex]}
  const next = newPracticeWord(state.studyPool,state.practiceWord,event.roll)
  const elapsed = event.monoMs - state.wordStartMs
  if (Number.isFinite(state.wordStartMs) && Number.isFinite(elapsed) && elapsed > 0) {
    next.practiceWpm = Math.round((state.practiceWord.length/5)*60000/elapsed*10)/10
    if (next.practiceWpm > (state.bestWpm ?? 0)) next.bestWpm = next.practiceWpm
  }
  return next
}

export function initialSession(data, courseComplete=false, cleanInstall=false, initialRoll=0) {
  const { settings, scores, history, letterAccuracy, listenTtr, dailyActivity, streak, bestWpm } = normalizePractice(data)
  if(cleanInstall&&!settings.selection)settings.selection=tierSelection(courseComplete?4:3)
  const studyPool=selectionPool(settings.selection,courseComplete)
  const draw=Math.max(0,Math.min(studyPool.length-1,Math.floor(initialRoll*studyPool.length)))
  const target=cleanInstall?studyPool[draw]:settings.selection?.kind==='custom'?studyPool[0]:
    studyPool.includes(PRACTICE_POOL[0])?PRACTICE_POOL[0]:studyPool[0]
  return {
    mode: 'practice', studyPool, target, score: Object.values(scores).reduce((a,b) => a+b,0),
    scores, history, letterAccuracy, listenTtr, dailyActivity, streak, settings, reviewQueue: [], feedback: '', outcome: null,
    transcript: '', freestyleInput: '', advance: false, bestWpm,
    ...(settings.practiceWords ? newPracticeWord(studyPool,null,initialRoll) : {}),
  }
}

export function stepSession(state, event) {
  const keep = { state, effects: [] }
  const update = (patch, ...effects) => ({ state: { ...state, ...patch }, effects })
  const scored = (letter, correct, mode) => {
    const delta = correct ? 1 : -1
    const at = new Date(event.atMs ?? NaN)
    const retention=countsAnswer(mode,correct)&&Number.isFinite(at.getTime())
      ? recordCorrectAnswer({dailyActivity:state.dailyActivity,streak:state.streak,letterAccuracy:state.letterAccuracy},{letter,mode,at})
      : {letterAccuracy:recordLetterAttempt(state,letter,correct).letterAccuracy,dailyActivity:state.dailyActivity,streak:state.streak}
    return {
      ...retention,
      score: state.score + delta,
      listenTtr: mode==='listen' && Number.isFinite(event.sample)
        ? applyListenTtrSample(state.listenTtr,letter,event.sample) : state.listenTtr,
      settings: mode === 'listen' && correct ? tempoStep(state.settings,'auto-correct') : state.settings,
      scores: { ...state.scores, [letter]: (state.scores[letter] ?? 0) + delta },
      history: [...state.history, {
        letter, correct, atMs: event.atMs ?? 0, ...(mode === 'listen' ? { mode } : {}),
      }].slice(-HISTORY_LIMIT),
    }
  }
  const clearFeedback = { feedback: '', outcome: null, advance: false }
  const changeSelection=(selection, extra={})=>{
    const studyPool=selectionPool(selection)
    return update({
      ...clearFeedback, ...extra,
      settings:{...state.settings,...extra.settings,selection}, studyPool,
      target:studyPool.includes(state.target)?state.target:
        state.settings.strategy==='weighted'?pickWeighted(studyPool,state.scores,state.target,event.roll):studyPool[0],
      ...(state.settings.practiceWords && state.mode === 'practice' ? {...newPracticeWord(studyPool,state.practiceWord,event.roll),practiceWpm:null} : {}),
      reviewQueue:state.reviewQueue.filter(item=>studyPool.includes(item.letter)),
    },{type:'cancelFeedback'},{type:'cancelWord'})
  }
  switch (event.type) {
    case 'selection': {
      const selection=normalizeSelection(event.selection)
      if (!selection) return keep
      if (event.rememberLevel && selection.kind === 'custom') {
        const maxLevel = state.settings.selection?.level ?? state.settings.maxLevel ?? 3
        return changeSelection(selection,{settings:{maxLevel}})
      }
      return changeSelection(selection)
    }
    case 'coursePool': {
      // The active lesson limits ordinary Practice/Listen without overwriting
      // the learner's free-practice scope or the saved pack counters.
      const studyPool = event.letters ? event.letters.join('') : selectionPool(state.settings.selection)
      if (studyPool === state.studyPool || !studyPool.length) return keep
      return update({...clearFeedback,studyPool,target:studyPool.includes(state.target) ? state.target : studyPool[0],
        reviewQueue:state.reviewQueue.filter(item=>studyPool.includes(item.letter))}, {type:'cancelFeedback'})
    }
    case 'openPractice':
      if(state.settings.selection?.kind==='custom'||state.studyPool.length>=26)return keep
      return changeSelection(tierSelection(3))
    case 'courseComplete':
      return state.settings.selection?.kind==='custom' ? keep : changeSelection(tierSelection(4))
    case 'mode':
      if (event.mode === state.mode) return keep
      return update({ mode: event.mode, transcript: '', freestyleInput: '', ...clearFeedback,
        ...(event.mode === 'guided' && state.settings.practiceWords ? {settings:{...state.settings,practiceWords:false}} : {}),
        ...(event.mode === 'practice' && state.settings.practiceWords ? newPracticeWord(state.studyPool,state.practiceWord,event.roll) : {}),
        wordStartMs:null,practiceWpm:null }, { type: 'cancelFeedback' }, { type: 'cancelWord' })
    case 'recommended': {
      const current = state.settings
      const known = event.profile === 'known'
      const maxLevel = known ? 3 : 1
      const desired = {...normalizeTempo({}),showHint:!known,showMnemonic:!known,strategy:'sequential',
        autoPlay:true,ifr:known,reviewMisses:known,maxLevel}
      const effective = {...current,showHint:current.showHint ?? false,showMnemonic:current.showMnemonic ?? false,
        autoPlay:current.autoPlay ?? event.inheritedAutoPlay,maxLevel:current.selection?.level ?? current.maxLevel ?? 3}
      if (Object.entries(desired).every(([key,value]) => effective[key] === value)) return keep
      const tier = tierSelection(maxLevel)
      const selection = current.selection?.kind === 'custom' ? current.selection : tier
      const targetPool = selectionPool(tier)
      return update({...clearFeedback,settings:{...current,...desired,selection,practiceWords:false},
        studyPool:selectionPool(selection),target:targetPool.includes(state.target) ? state.target : targetPool[0],
        practiceWord:'',practiceIndex:0,practiceWpm:null,wordStartMs:null,reviewQueue:[],freestyleInput:'',transcript:''},
        {type:'cancelFeedback'},{type:'cancelWord'})
    }
    case 'practiceControl': {
      const { control, enabled } = event
      const { settings } = state
      if (control === 'sequential') {
        const strategy = enabled ? 'sequential' : 'weighted'
        if (settings.practiceWords || settings.strategy === strategy) return keep
        const patch = {settings:{...settings,strategy}}
        if (enabled && state.mode === 'practice')
          return update({...patch,...clearFeedback,target:state.studyPool[0]}, {type:'cancelFeedback'})
        return update(patch)
      }
      if (control === 'review' && settings.ifr && settings.reviewMisses !== enabled)
        return update({settings:{...settings,reviewMisses:enabled}, ...(!enabled && {reviewQueue:[]})})
      if (control === 'ifr' && settings.ifr !== enabled) {
        const patch = {settings:{...settings,ifr:enabled}, ...(!enabled && {reviewQueue:[]})}
        return state.mode === 'practice' ? update({...patch,...clearFeedback}, {type:'cancelFeedback'}) : update(patch)
      }
      return keep
    }
    case 'ifr':
      if (state.settings.ifr === event.enabled) return keep
      return update({ settings: { ...state.settings, ifr: event.enabled } })
    case 'words':
      if (state.settings.words === event.enabled) return keep
      return update({ settings: { ...state.settings, words: event.enabled },
        ...(state.mode === 'freestyle' ? {transcript:'', freestyleInput:'', ...clearFeedback} : {}) }, { type: 'cancelWord' })
    case 'freshBeginnerDefaults':
      return changeSelection(tierSelection(1),{settings:{ifr:false,reviewMisses:false,showHint:false,showMnemonic:false,autoPlay:true,strategy:'weighted'}})
    case 'preference': {
      const s = state.settings
      switch (event.command) {
        case 'practice-words-on':
        case 'practice-words-off': {
          const enabled = event.command === 'practice-words-on'
          if (enabled === Boolean(s.practiceWords) || state.mode === 'guided') return keep
          return update({...clearFeedback,practiceWpm:null,wordStartMs:null,
            settings:{...s,practiceWords:enabled},
            ...(enabled ? newPracticeWord(state.studyPool,null,event.roll) : {practiceWord:'',practiceIndex:0})},
            {type:'cancelFeedback'})
        }
        case 'hint-on':
        case 'hint-off':
        case 'mnemonic-on':
        case 'mnemonic-off': {
          const key = event.command.startsWith('hint-') ? 'showHint' : 'showMnemonic'
          const enabled = event.command.endsWith('-on')
          return s[key] === enabled ? keep : update({settings:{...s,[key]:enabled}})
        }
        case 'autoplay-on':
        case 'autoplay-off': {
          const autoPlay = event.command === 'autoplay-on'
          return autoPlay === s.autoPlay ? keep : update({settings:{...s,autoPlay}})
        }
        case 'toggle-ifr': return stepSession(state, { type: 'ifr', enabled: !s.ifr })
        case 'toggle-words': return stepSession(state, { type: 'words', enabled: !s.words })
        case 'toggle-strategy':
          return update({settings: {...s, strategy: s.strategy === 'weighted' ? 'sequential' : 'weighted'}})
        case 'toggle-review':
          return update({settings: {...s, reviewMisses: !s.reviewMisses}})
        case 'speed-up':
        case 'speed-down':
        case 'effective-up':
        case 'effective-down':
        case 'toggle-auto-tighten': {
          const settings = tempoStep(s,event.command)
          return settings === s ? keep : update({settings})
        }
        case 'pitch-up':
        case 'pitch-down': {
          const pitch = Math.max(400, Math.min(800, s.pitch + (event.command === 'pitch-up' ? 20 : -20)))
          return pitch === s.pitch ? keep : update({ settings: { ...s, pitch } })
        }
        default: return keep
      }
    }
    case 'clear':
      return update({ transcript: '', freestyleInput: '', ...clearFeedback }, { type: 'cancelFeedback' }, { type: 'cancelWord' })
    case 'replay':
      if (state.mode !== 'practice') return keep
      if (state.outcome === 'wrong') return update({ feedback: '', advance: false })
      return update(clearFeedback, { type: 'cancelFeedback' })
    case 'routeBoundary':
      return update({ transcript:'', freestyleInput:'', ...clearFeedback }, { type:'cancelFeedback' }, { type:'cancelWord' })
    case 'cancel':
      if (state.mode === 'practice' && state.settings.practiceWords)
        return update({...clearFeedback,wordStartMs:null},{type:'cancelFeedback'})
      return state.mode === 'freestyle'
        ? update({freestyleInput:''}, {type:'cancelWord'})
        : keep
    case 'toneStart':
      return state.mode === 'freestyle' ? { state, effects: [{ type: 'cancelWord' }] } : keep
    case 'symbol':
      if (state.mode === 'practice' && state.settings.practiceWords && (!state.outcome || state.settings.ifr)) {
        const start = state.practiceIndex === 0 && state.wordStartMs == null && Number.isFinite(event.monoMs)
          ? event.monoMs : state.wordStartMs
        return update({...clearFeedback,wordStartMs:start},{type:'cancelFeedback'})
      }
      if (state.mode === 'practice' && state.outcome === 'correct')
        return update(clearFeedback, { type: 'cancelFeedback' })
      if (state.mode === 'freestyle' && (event.symbol === '.' || event.symbol === '-'))
        return update({feedback:'', freestyleInput:(state.freestyleInput + event.symbol).slice(-64)})
      if (state.mode === 'freestyle' && state.feedback) return update({feedback:''})
      return keep
    case 'resetScores':
      return update({scores:{}, score:0})
    case 'guidedScore':
      return state.mode === 'guided' && byCharacter.has(event.letter)
        ? update(scored(event.letter, event.correct, event.mode)) : keep
    case 'listenScore':
      return state.mode === 'listen' && state.studyPool.includes(event.letter) && event.letter.length === 1
        ? update(scored(event.letter, event.correct, 'listen')) : keep
    case 'sequence': {
      const letter = decode(event.code)
      if (state.mode === 'freestyle') {
        if (!letter || !state.settings.words) return update({ freestyleInput:'', feedback: letter ?? 'No match' }, { type: 'cancelWord' })
        // Keep the local, non-persisted transcript bounded for the view protocol.
        return update({ freestyleInput:'', feedback: letter, transcript: (state.transcript + letter).slice(-1000) },
          { type: 'scheduleWord', ms: extraWordGapMs })
      }
      if (state.mode !== 'practice' || state.outcome === 'wrong') return keep
      const correct = letter === state.target
      if (correct && state.settings.practiceWords)
        return update({...clearFeedback,...advanceWord(state,event),...(state.settings.showHint ? {} : scored(state.target,true,'practice'))},
          {type:'cancelFeedback'})
      return update({
        feedback: correct ? 'Correct' : 'Try again',
        outcome: correct ? 'correct' : 'wrong',
        advance: correct || state.settings.ifr,
        ...(state.settings.showHint ? {} : scored(state.target, correct, 'practice')),
        reviewQueue: !correct && state.settings.ifr && state.settings.reviewMisses
          ? enqueueReview(state.reviewQueue, state.target) : state.reviewQueue,
      }, { type: 'scheduleFeedback', ms: feedbackMs })
    }
    case 'feedbackElapsed':
      if (state.outcome === null) return keep
      if (!state.advance) return update(clearFeedback)
      if (state.settings.practiceWords) return update({...clearFeedback,...advanceWord(state,event)})
      const useReview = state.settings.ifr && state.settings.reviewMisses
      const picked = useReview ? pullReview(state.reviewQueue) : { queue: state.reviewQueue, letter: null }
      const target = picked.letter ?? (state.settings.strategy === 'sequential'
        ? next(state.studyPool,state.target) : pickWeighted(state.studyPool, state.scores, state.target, event.roll))
      return update({ ...clearFeedback, target, reviewQueue: picked.queue })
    case 'wordElapsed':
      if (state.mode !== 'freestyle' || !state.settings.words || !state.transcript || state.transcript.endsWith(' ')) return keep
      return update({ transcript: state.transcript + ' ' })
    default:
      return keep
  }
}

/** Use local civil midnight, not a 24-hour duration, across daylight-saving changes. */
export function millisecondsUntilLocalMidnight(now) {
  const next=new Date(now)
  next.setHours(24,0,0,0)
  return Math.max(1,next.getTime()-now)
}

export function createSession({ setTimer, clearTimer, project, onLock, data, courseComplete=false, cleanInstall=false, onChange = () => {},
  random = Math.random, wallNow = Date.now, monotonicNow = () => globalThis.performance?.now?.() ?? NaN }) {
  let state = initialSession(data,courseComplete,cleanInstall,cleanInstall || data?.settings?.practiceWords ? random():0)
  const timers = new Map()
  const clear = kind => { clearTimer(timers.get(kind)?.id); timers.delete(kind) }
  const names = { cancelFeedback: 'feedback', scheduleFeedback: 'feedback', cancelWord: 'word', scheduleWord: 'word' }
  function dispatch(event) {
    const before = state
    const enriched = {...event}
    if (['sequence','listenScore','guidedScore'].includes(event.type)) enriched.atMs = wallNow()
    if (state.settings.practiceWords && ['symbol','sequence','feedbackElapsed'].includes(event.type)) enriched.monoMs = monotonicNow()
    if (event.type === 'feedbackElapsed' || event.type === 'selection' || event.command === 'practice-words-on'
        || (state.settings.practiceWords && (event.type === 'mode' || event.type === 'sequence')))
      enriched.roll = random()
    const result = stepSession(state, enriched)
    state = result.state
    for (const effect of result.effects) {
      const kind = names[effect.type]
      clear(kind)
      if (effect.type.startsWith('schedule')) {
        const token = {}
        token.id = setTimer(() => {
          if (timers.get(kind) !== token) return
          timers.delete(kind)
          dispatch({ type: kind + 'Elapsed' })
        }, effect.ms)
        timers.set(kind, token)
      }
    }
    if (before.bestWpm !== state.bestWpm || before.settings !== state.settings || before.scores !== state.scores || before.history !== state.history || before.letterAccuracy !== state.letterAccuracy || before.listenTtr !== state.listenTtr || before.dailyActivity !== state.dailyActivity || before.streak !== state.streak) onChange(state)
    const errorLocked = snapshot => snapshot.outcome === 'wrong' && !(snapshot.settings.practiceWords && snapshot.settings.ifr)
    if (errorLocked(before) !== errorLocked(state)) onLock(errorLocked(state))
    projectState(before)
  }
  function projectDaily(){
    const tracked=Object.keys(state.dailyActivity??{}).length>0||state.streak!==undefined
    const {correct,goal,atRisk}=todayStreakContribution(state,new Date(wallNow()))
    project('ref-streak-today:'+(tracked?`${Math.min(correct,goal)}/${goal}`:''))
    project('ref-day-label:'+(correct >= goal ? 'Today counted' : correct + ' / ' + goal + ' today'))
    project('ref-day-fill:'+Math.round(Math.min(correct,goal)*100/goal)+'%')
    project('ref-streak-current:'+(state.streak?.current??''))
    project('ref-streak-best:'+(state.streak?.longest??''))
    project('ref-streak-risk:'+(atRisk?'1':'0'))
  }
  function projectState(before) {
    if(!before||before.dailyActivity!==state.dailyActivity||before.streak!==state.streak)projectDaily()
    if (!before || before.practiceWord !== state.practiceWord || before.practiceIndex !== state.practiceIndex)
      project('practice-prefix:'+(state.practiceWord?.slice(0,state.practiceIndex) ?? ''))
    for (const key of ['practiceWord','practiceWpm'])
      if (!before || before[key] !== state[key]) project(key + ':' + (state[key] ?? ''))
    if (!before || before.bestWpm !== state.bestWpm) project('bestWpm:'+(state.bestWpm > 0 ? state.bestWpm.toFixed(1) : ''))
    for (const key of ['target', 'score', 'feedback', 'transcript', 'freestyleInput']) {
      if (!before || before[key] !== state[key]) project(key + ':' + state[key])
    }
    if (!before || before.studyPool!==state.studyPool) project('study-pool:'+Array.from(state.studyPool).join(','))
    if (!before || before.history.length !== state.history.length) project('history:' + state.history.length)
    if (!before || before.scores!==state.scores || before.history!==state.history || before.letterAccuracy!==state.letterAccuracy || before.listenTtr!==state.listenTtr) {
      const model=buildReference(state)
      for(const [key,value] of Object.entries(model))
        project('ref-'+key+':'+(Array.isArray(value)?value.join(','):value))
      const recognition=buildRecognition(state)
      project('ref-ttr-average:'+(recognition.average===null?'':recognition.average))
      project('ref-ttr-bars:'+recognition.bars.map(({letter,averageMs,samples,fill})=>[letter,averageMs,samples,fill].join(',')).join(';'))
    }
    if(!before||before.settings.selection!==state.settings.selection){
      const choice=state.settings.selection
      project('scope-selection:'+(choice?.kind==='tier'?'tier-'+choice.level:choice?.kind??'legacy'))
      project('scope-letters:'+(choice?.kind==='custom'?choice.letters.join(''):''))
    }
    for (const key of Object.keys(state.settings)) {
      if(key==='selection')continue
      if (!before || before.settings[key] !== state.settings[key]) project(key + ':' + state.settings[key])
    }
  }
  return { dispatch, projectState, projectDaily, current: () => state, dispose: () => { clear('feedback'); clear('word') } }
}
