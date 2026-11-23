import { STORE_KEY, loadPractice, normalizePractice } from '../modules/web/practice-store.mjs'
import { GUIDED_KEY, GUIDED_PACKS, beginGuide, readGuide } from '../modules/web/guided.mjs'
import { NUX_KEY, readNux } from '../modules/web/nux.mjs'
import {normalizeTempo} from '../modules/web/tempo.mjs'
import { REMINDER_KEY, validTime } from './apple-reminder.mjs'

const settingsMap = {
  practiceWordMode:'practiceWords', showHint:'showHint', showMnemonic:'showMnemonic', practiceAutoPlay:'autoPlay', toneFrequency:'pitch', listenWpm:'speed', listenEffectiveWpm:'effectiveSpeed',
  listenAutoTightening:'autoTighten', listenAutoTighteningCorrectCount:'autoCorrect',
  practiceIfrMode:'ifr', practiceReviewMisses:'reviewMisses', wordMode:'words',
}
const metrics = ['bestWpm','scores','letterAccuracy','listenTtr','dailyActivity','streak']
const retained = ['bestWpm','practiceAutoPlay','practiceWordMode','showHint','showMnemonic','nuxCompleted','maxLevel']
const guideFields = ['guidedCourseActive','guidedPackIndex','guidedMaxPackReached','guidedPhase','guidedProgress']
const known = new Set([...Object.keys(settingsMap),...metrics,...retained,...guideFields,'practiceLearnMode',
  'learnerProfile','hapticsEnabled','reminder','customLetters','updatedAt'])
const record = v => v !== null && typeof v === 'object' && !Array.isArray(v)
const has = (v,k) => Object.hasOwn(v,k)
function requireValue(ok) {
  if (!ok) throw Error('Unsupported legacy progress')
}
function same(a,b) {
  if (a === b) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false
  return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(k => has(b,k) && same(a[k],b[k]))
}
function object(raw) {
  const value = JSON.parse(raw)
  requireValue(record(value))
  return value
}

function practiceRecord(p) {
  const settings = {}
  for (const [source,target] of Object.entries(settingsMap)) if (has(p,source)) settings[target] = p[source]
  if (has(p,'practiceLearnMode')) {
    requireValue(typeof p.practiceLearnMode === 'boolean')
    settings.strategy = p.practiceLearnMode ? 'sequential' : 'weighted'
  }
  if (has(p,'maxLevel')) requireValue([1,2,3,4].includes(p.maxLevel))
  if (has(p,'customLetters')) requireValue(Array.isArray(p.customLetters))
  settings.selection = p.customLetters?.length ? {kind:'custom',letters:p.customLetters} : {kind:'tier',level:p.maxLevel ?? 3}
  if (settings.selection.kind === 'custom') settings.maxLevel = p.maxLevel ?? 3
  const input = {settings}
  for (const k of metrics) if (has(p,k)) input[k] = p[k]
  const normalized = normalizePractice(input)
  // The runtime accepts a wider range of damaged inputs by normalizing them.
  // Migration must never silently trim a count, date, tempo, scope or accuracy window.
  for (const k of Object.keys(settings)) requireValue(same(settings[k], normalized.settings[k]))
  for (const k of metrics) if (has(p,k)) requireValue(same(p[k],normalized[k]))
  const value = JSON.stringify({version:1,...normalized})
  requireValue(loadPractice({getItem:() => value}).status === 'saved')
  return value
}

function guideRecord(p) {
  const pack = has(p,'guidedPackIndex') ? p.guidedPackIndex : 0
  requireValue(Number.isInteger(pack) && pack >= 0 && pack < GUIDED_PACKS.length)
  let phase = has(p,'guidedPhase') ? p.guidedPhase : 'teach'
  requireValue(['teach','practice','listen','complete'].includes(phase))
  // A missing counter block cannot establish a later phase.
  const counters = has(p,'guidedProgress') ? p.guidedProgress : beginGuide(pack).progress
  requireValue(record(counters))
  const every = (counts,n) => GUIDED_PACKS[pack].every(l => (counts?.[l] ?? 0) >= n)
  if (phase === 'teach' && every(counters.teachCounts,2)) phase = 'gate-practice'
  if (phase === 'practice' && counters.practiceAttempts >= 10 && counters.practiceCorrect >= 8 && every(counters.practiceLetterCorrect,2))
    phase = 'gate-listen'
  if (phase === 'listen' && counters.listenAttempts === 6)
    phase = counters.listenCorrect >= 4 && every(counters.listenLetterCorrect,1) ? 'gate-next' : 'gate-retry'
  const data = {pack,phase,progress:counters,maxPackReached:has(p,'guidedMaxPackReached') ? p.guidedMaxPackReached : (phase === 'complete' ? GUIDED_PACKS.length : pack)}
  const raw = JSON.stringify({version:1,data})
  const result = readGuide({getItem:() => raw})
  requireValue(result.status === 'saved' && same(data,result.data))
  return raw
}

function onboarding(values,p) {
  const explicit = values['dit-nux-status']
  const returning = p.guidedCourseActive || p.learnerProfile || Object.values(p.scores ?? {}).some(n => n > 0)
  const status = explicit ?? (returning ? 'skipped' : 'pending')
  requireValue(['pending','completed','skipped'].includes(status))
  const result = {version:1,status,step:'welcome',profile:p.learnerProfile ?? null,soundComplete:false,taps:0,holds:0}
  if (status === 'pending' && has(values,'dit-nux-state')) {
    const state = object(values['dit-nux-state'])
    requireValue(Object.keys(state).every(k => ['step','learnerProfile','didCompleteSoundCheck','tutorialTapCount','tutorialHoldCount'].includes(k)))
    requireValue(['welcome','profile','intro_fluency','intro_listen','intro_speed','sound_check','button_tutorial',
      'beginner_stages','beginner_intro','reminder','known_tour'].includes(state.step))
    result.step = state.step
    result.profile = state.learnerProfile ?? result.profile
    requireValue([null,'beginner','known'].includes(result.profile))
    result.soundComplete = state.didCompleteSoundCheck ?? false
    requireValue(typeof result.soundComplete === 'boolean')
    result.taps = state.tutorialTapCount ?? 0
    result.holds = state.tutorialHoldCount ?? 0
    for (const n of [result.taps,result.holds]) requireValue(Number.isInteger(n) && n >= 0 && n <= 3)
  }
  const raw = JSON.stringify(result)
  requireValue(same(readNux({getItem:() => raw}),result))
  return raw
}

/** Converts the allowlisted Dit records supplied by the native manifest reader. */
export function convertLegacy(values) {
  const p = has(values,'dit-progress') ? object(values['dit-progress']) : {}
  requireValue(Object.keys(p).every(k => known.has(k)))
  if (has(p,'learnerProfile')) requireValue(['known','beginner'].includes(p.learnerProfile))
  if (has(p,'guidedCourseActive')) requireValue(typeof p.guidedCourseActive === 'boolean')
  const preserved = {}
  for (const k of retained) if (has(p,k)) {
    if (k === 'bestWpm') requireValue(typeof p[k] === 'number' && Number.isFinite(p[k]) && p[k] >= 0)
    else if (k !== 'maxLevel') requireValue(typeof p[k] === 'boolean')
    preserved[k] = p[k]
  }
  if (has(p,'learnerProfile')) preserved.learnerProfile = p.learnerProfile
  if (has(p,'updatedAt')) requireValue(Number.isSafeInteger(p.updatedAt) && p.updatedAt >= 0)
  const result = {[NUX_KEY]:onboarding(values,p)}
  const hint = values['dit-intro-hint-step']
  result['dit.exact-spike.intro-hint.v1'] = ['morse','settings','done'].includes(hint) ? hint : 'morse'
  if (has(values,'dit-progress')) {
    result[STORE_KEY] = practiceRecord(p)
    if (guideFields.some(k => has(p,k))) {
      requireValue(!(p.guidedCourseActive && p.guidedPhase === 'complete'))
      result[GUIDED_KEY] = guideRecord(p)
      result['dit.exact-spike.method.v1'] = p.guidedCourseActive ? 'guided' : 'open'
    }
    if (has(p,'hapticsEnabled')) {
      requireValue(typeof p.hapticsEnabled === 'boolean')
      result['dit.exact-spike.haptics.v1'] = String(p.hapticsEnabled)
    }
    if (has(p,'reminder')) {
      requireValue(record(p.reminder) && Object.keys(p.reminder).every(k => ['time','enabled'].includes(k))
        && typeof p.reminder.enabled === 'boolean' && validTime(p.reminder.time))
      result[REMINDER_KEY] = JSON.stringify({version:1,...p.reminder})
    }
  }
  result['dit.exact-spike.legacy.v1'] = JSON.stringify({version:1,sourceUpdatedAt:p.updatedAt ?? null,preserved})
  return result
}

// The account transport carries only fields present in Dit's ProgressSnapshot.
// Private session records such as typed passages and per-attempt history stay local.
const methodKey = 'dit.exact-spike.method.v1'
const hapticsKey = 'dit.exact-spike.haptics.v1'
const receiptKey = 'dit.exact-spike.legacy.v1'
const wirePhase = {'gate-practice':'teach','gate-listen':'practice','gate-next':'listen','gate-retry':'listen'}

function accountOnboarding(records) {
  const storage = {getItem:key => records[key] ?? null}
  return readNux(storage,() => records[methodKey] === 'guided' ||
    (!has(records,methodKey) && readGuide(storage).status === 'saved') ||
    Object.values(loadPractice(storage).data.scores).some(n => n > 0))
}

export function accountPayload(records) {
  const storage = {getItem:key => records[key] ?? null}
  const practice = loadPractice(storage)
  const guide = readGuide(storage)
  requireValue([practice,guide].every(item => ['saved','empty'].includes(item.status)))
  const {settings,...data} = practice.data
  const nux = accountOnboarding(records)
  if (has(records,NUX_KEY)) {
    const saved = object(records[NUX_KEY])
    requireValue(saved.version === 1 && Object.keys(saved).every(k => same(saved[k],nux[k])))
  }
  const receipt = has(records,receiptKey) ? object(records[receiptKey]) : null
  if (receipt) requireValue(receipt.version === 1 && record(receipt.preserved))
  const saved = receipt?.preserved ?? {}
  const level = settings.selection?.kind === 'tier' ? settings.selection.level : settings.maxLevel ?? saved.maxLevel ?? 3
  const result = {
    practiceAutoPlay:saved.practiceAutoPlay ?? true, practiceWordMode:saved.practiceWordMode ?? false,
    showHint:saved.showHint ?? false,showMnemonic:saved.showMnemonic ?? false,
    practiceLearnMode:settings.strategy === 'sequential', maxLevel:level
  }
  for (const [source,target] of Object.entries(settingsMap)) if (has(settings,target)) result[source] = settings[target]
  for (const field of metrics) if (has(data,field)) result[field] = data[field]
  if (!has(result,'bestWpm') && has(saved,'bestWpm')) result.bestWpm = saved.bestWpm
  if (settings.selection?.kind === 'custom') result.customLetters = settings.selection.letters
  if (nux.profile) result.learnerProfile = nux.profile
  if (nux.status !== 'pending') result.nuxCompleted = true
  const method = records[methodKey]
  requireValue(method === undefined || ['open','guided'].includes(method))
  if (guide.status === 'saved' || method) {
    const {phase,pack,progress,maxPackReached} = guide.data
    Object.assign(result,{guidedCourseActive:phase !== 'complete' && method !== 'open',
      guidedPhase:wirePhase[phase] ?? phase,guidedPackIndex:pack,guidedProgress:progress,guidedMaxPackReached:maxPackReached})
  }
  requireValue(!has(records,hapticsKey) || ['true','false'].includes(records[hapticsKey]))
  result.hapticsEnabled = records[hapticsKey] !== 'false'
  if (has(records,REMINDER_KEY)) {
    const {version,...pref} = object(records[REMINDER_KEY])
    requireValue(version === 1 && Object.keys(pref).length === 2 && validTime(pref.time) && typeof pref.enabled === 'boolean')
    result.reminder = pref
  } else result.reminder = {time:'19:00',enabled:false}
  return result
}

// Realtime Database omits empty children and may return digit-keyed children as arrays.
function databaseGuideCounters(progress) {
  requireValue(record(progress))
  const counters = {...progress}
  for (const key of ['teachCounts','practiceLetterCorrect','listenLetterCorrect']) {
    if (!has(progress,key)) counters[key] = {}
    else if (Array.isArray(progress[key])) {
      requireValue(progress[key].length <= 10)
      counters[key] = Object.fromEntries(Object.entries(progress[key]).filter(([,value]) => value !== null))
    }
  }
  return counters
}

export function applyAccountPatch(records,patch) {
  requireValue(record(patch) && Object.keys(patch).some(k => k !== 'updatedAt') &&
    Object.keys(patch).every(k => known.has(k)))
  const local = accountPayload(records)
  const merged = {...local,...patch}
  if (has(patch,'guidedProgress')) merged.guidedProgress = databaseGuideCounters(patch.guidedProgress)
  if (has(patch,'guidedMaxPackReached')) {
    requireValue(Number.isSafeInteger(patch.guidedMaxPackReached) && patch.guidedMaxPackReached >= 0 &&
      patch.guidedMaxPackReached <= GUIDED_PACKS.length)
    merged.guidedMaxPackReached = Math.max(local.guidedMaxPackReached ?? 0,patch.guidedMaxPackReached)
  }
  // A speed-only patch uses shipped normalization for its dependent effective speed.
  if (['listenWpm','listenAutoTightening','listenAutoTighteningCorrectCount'].some(k => has(patch,k)) &&
      !has(patch,'listenEffectiveWpm')) merged.listenEffectiveWpm = normalizeTempo({
    speed:merged.listenWpm,effectiveSpeed:local.listenEffectiveWpm,
    autoTighten:merged.listenAutoTightening,autoCorrect:merged.listenAutoTighteningCorrectCount
  }).effectiveSpeed
  const converted = convertLegacy({'dit-progress':JSON.stringify(merged)})
  const next = {...records}
  const previous = loadPractice({getItem:key => records[key] ?? null}).data
  const practice = JSON.parse(converted[STORE_KEY])
  practice.history = previous.history
  next[STORE_KEY] = JSON.stringify(practice)
  for (const key of [GUIDED_KEY,methodKey,hapticsKey,REMINDER_KEY]) if (has(converted,key)) next[key] = converted[key]
  const nux = accountOnboarding(records)
  if (has(patch,'learnerProfile') && nux.profile !== patch.learnerProfile) {
    nux.profile = patch.learnerProfile
    // A completed experienced tour is not a resumable step for a beginner.
    nux.step = 'welcome'
  }
  if (nux.status === 'pending' && (patch.nuxCompleted === true || patch.learnerProfile ||
      patch.guidedCourseActive || Object.values(patch.scores ?? {}).some(n => n > 0))) nux.status = 'skipped'
  if (!has(next,NUX_KEY) || !same(object(next[NUX_KEY]),nux)) next[NUX_KEY] = JSON.stringify(nux)
  return next
}
