import { normalizeSelection, protectedSelection } from './selection.mjs'
import { normalizeTempo } from './tempo.mjs'
export const STORE_KEY = 'dit.exact-spike.practice.v1'
export const HISTORY_LIMIT = 200
const VERSION = 1
const MAX_INPUT_BYTES = 100_000
const MAX_SCORE = 1_000_000_000
export const defaultSettings = () => ({
  ...normalizeTempo({}), pitch: 600, ifr: true, words: false, strategy: 'sequential', reviewMisses: true,
})
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const bool = (value, fallback) => typeof value === 'boolean' ? value : fallback
const int = (value, min, max, fallback) =>
  Number.isInteger(value) && value >= min && value <= max ? value : fallback
const activityModes=new Set(['practice','listen'])
const dateKeyValid=key=>{
  if(typeof key!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(key))return false
  const stamp=Date.parse(key+'T00:00:00Z')
  return Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===key
}
const known = new Set('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')

export function normalizePractice(value) {
  const input = record(value) ? value : {}
  const raw = record(input.settings) ? input.settings : {}
  const settings = {
    ...normalizeTempo({...raw, speed: int(raw.speed, 10, 30, 12)}),
    pitch: raw.pitch % 20 === 0 ? int(raw.pitch, 400, 800, 600) : 600,
    ifr: bool(raw.ifr, true),
    words: bool(raw.words, false),
    strategy: raw.strategy === 'weighted' ? 'weighted' : 'sequential',
    reviewMisses: bool(raw.reviewMisses, true),
  }
  for (const key of ['autoPlay','showHint','showMnemonic','practiceWords'])
    if (typeof raw[key] === 'boolean') settings[key] = raw[key]
  const selection=normalizeSelection(raw.selection)
  if(selection)settings.selection=selection
  if ([1,2,3,4].includes(raw.maxLevel)) settings.maxLevel = raw.maxLevel
  const scores = {}
  for (const letter of known) {
    if (!record(input.scores) || !Object.hasOwn(input.scores, letter)) continue
    const score = int(input.scores[letter], -MAX_SCORE, MAX_SCORE, undefined)
    if (score !== undefined) scores[letter] = score
  }
  const history = (Array.isArray(input.history) ? input.history : []).slice(-HISTORY_LIMIT)
    .filter(item => record(item) && known.has(item.letter) && typeof item.correct === 'boolean' &&
      Number.isSafeInteger(item.atMs) && item.atMs >= 0)
    .map(({ letter, correct, atMs, mode }) => ({ letter, correct, atMs, ...(mode === 'listen' ? { mode } : {}) }))
  const letterAccuracy={}
  if(record(input.letterAccuracy))for(const letter of known){
    const entry=input.letterAccuracy[letter]
    if(!record(entry)||!Array.isArray(entry.recent))continue
    if(entry.recent.every(item=>typeof item==='boolean'))
      letterAccuracy[letter]={recent:entry.recent.slice(-10)}
  }
  const listenTtr={}
  if(record(input.listenTtr)) for(const letter of known) {
    const entry=input.listenTtr[letter]
    if(!record(entry)) continue
    const averageMs=int(entry.averageMs,0,10000,undefined)
    const samples=int(entry.samples,1,300,undefined)
    if(averageMs!==undefined && samples!==undefined) listenTtr[letter]={averageMs,samples}
  }
  const metrics={}
  if (Number.isFinite(input.bestWpm) && input.bestWpm >= 0) metrics.bestWpm = input.bestWpm
  if(record(input.dailyActivity)){
    metrics.dailyActivity={}
    for(const [day,entry] of Object.entries(input.dailyActivity)){
      if(!dateKeyValid(day)||!record(entry)||!Array.isArray(entry.modes)||entry.modes.length<1
        ||new Set(entry.modes).size!==entry.modes.length||!entry.modes.every(mode=>activityModes.has(mode)))continue
      const correct=int(entry.correct,1,Number.MAX_SAFE_INTEGER,undefined)
      if(correct!==undefined)metrics.dailyActivity[day]={correct,modes:entry.modes}
    }
  }
  if(record(input.streak)){
    const {current,longest,lastCountedDate}=input.streak
    if(int(current,0,Number.MAX_SAFE_INTEGER,undefined)!==undefined &&
      int(longest,current,Number.MAX_SAFE_INTEGER,undefined)!==undefined &&
      (current===0 ? lastCountedDate===null : dateKeyValid(lastCountedDate)))
      metrics.streak={current,longest,lastCountedDate}
  }
  return { settings, scores, history, letterAccuracy, listenTtr, ...metrics }
}

export function loadPractice(storage) {
  let raw
  try { raw = storage.getItem(STORE_KEY) } catch { return { status: 'unavailable', data: normalizePractice(null) } }
  if (raw === null) return { status: 'empty', data: normalizePractice(null) }
  if (raw.length > MAX_INPUT_BYTES) return { status: 'oversized', data: normalizePractice(null) }
  let value
  try { value = JSON.parse(raw) } catch { /* damage uses defaults */ }
  if (!record(value)) return { status: 'reset', data: normalizePractice(null) }
  if (value.version !== VERSION) return { status: 'newer', data: normalizePractice(null) }
  const data = normalizePractice(value)
  const practiceKeys = ['version','settings','scores','history','letterAccuracy','listenTtr','dailyActivity','streak','bestWpm']
  const settingKeys = {...defaultSettings(), selection:null, maxLevel:3, autoPlay:true, showHint:false, showMnemonic:false,practiceWords:false}
  if(Object.keys(value).some(key=>!practiceKeys.includes(key))
      || (record(value.settings) && Object.keys(value.settings).some(key=>!Object.hasOwn(settingKeys,key))))
    return {status:'newer',data}
  if(protectedSelection(value.settings?.selection))return {status:'newer',data}
  if(record(value.letterAccuracy) && Object.entries(value.letterAccuracy).some(([letter,entry])=>
    known.has(letter) && record(entry) && Object.keys(entry).some(key=>key!=='recent')))
    return {status:'newer',data}
  if(record(value.listenTtr) && Object.entries(value.listenTtr).some(([letter,entry])=>
    known.has(letter) && record(entry) && Object.keys(entry).some(key=>key!=='averageMs' && key!=='samples')))
    return {status:'newer',data}
  if(record(value.dailyActivity) && Object.entries(value.dailyActivity).some(([day,entry])=>
    dateKeyValid(day) && record(entry) && (Object.keys(entry).some(key=>key!=='correct' && key!=='modes')
      || (Array.isArray(entry.modes) && entry.modes.some(mode=>typeof mode==='string'&&!activityModes.has(mode))))))
    return {status:'newer',data}
  if(record(value.streak) && Object.keys(value.streak).some(key=>!['current','longest','lastCountedDate'].includes(key)))
    return {status:'newer',data}
  const fields = (actual, normalized) => Object.entries(actual).every(([key, entry]) =>
    Object.hasOwn(normalized,key) && JSON.stringify(entry) === JSON.stringify(normalized[key]))
  const valid = record(value.settings) && fields(value.settings,data.settings) && record(value.scores)
    && fields(value.scores,data.scores) && Array.isArray(value.history)
    && JSON.stringify(value.history)===JSON.stringify(data.history)
    && (!Object.hasOwn(value,'letterAccuracy') || (record(value.letterAccuracy)
      && fields(value.letterAccuracy,data.letterAccuracy)))
    && (!Object.hasOwn(value,"listenTtr") || (record(value.listenTtr) && fields(value.listenTtr,data.listenTtr)))
    && (!Object.hasOwn(value,'dailyActivity') || (record(value.dailyActivity) && fields(value.dailyActivity,data.dailyActivity)))
    && (!Object.hasOwn(value,'bestWpm') || value.bestWpm === data.bestWpm)
    && (!Object.hasOwn(value,'streak') || (record(value.streak) && record(data.streak) && fields(value.streak,data.streak)))
  return { status: valid ? 'saved' : 'reset', data }
}

export function savePractice(storage, state) {
  const latest = loadPractice(storage).status
  if (latest === 'newer' || latest === 'oversized' || latest === 'unavailable') return latest
  try {
    storage.setItem(STORE_KEY, JSON.stringify({ version: VERSION, ...normalizePractice(state) }))
    return 'saved'
  } catch { return 'unavailable' }
}
