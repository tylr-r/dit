import {createProgressPayload} from '../../../packages/core/src/firebase/progress.ts'
import {beginGuide} from '../modules/web/guided.mjs'
import {MORSE_DATA} from '../modules/web/reference-morse.generated.mjs'
import {accountPayload,applyAccountPatch} from './apple-legacy.mjs'

const waitToSave = 800
const waitToRetry = 30_000
const syncTimer = -1
const validTime = value => Number.isSafeInteger(value) && value >= 0

// Shipped sessions initialize every score to zero. The local Exact file may be sparse.
function databasePayload(records, updatedAt) {
  const snapshot = accountPayload(records)
  const scores = Object.fromEntries(Object.keys(MORSE_DATA).map(letter => [letter,snapshot.scores[letter] ?? 0]))
  const initialGuide = beginGuide()
  return createProgressPayload({
    guidedCourseActive:false, guidedPackIndex:initialGuide.pack, guidedPhase:initialGuide.phase,
    guidedProgress:initialGuide.progress, dailyActivity:{},
    ...snapshot, scores, guidedMaxPackReached:snapshot.guidedMaxPackReached || undefined,
  },updatedAt)
}

/** Wrap the normal Apple reducer for the lifetime of one authenticated identity. */
export function createAccountSession(host,createLocal,initial) {
  let state = JSON.parse(initial)
  if (state.version !== 1 || typeof state.dirty !== 'boolean' ||
      (state.updatedAt !== null && !validTime(state.updatedAt)) ||
      !state.records || Array.isArray(state.records) || typeof state.records !== 'object' ||
      Object.values(state.records).some(v => typeof v !== 'string')) throw Error('Unsupported account store')
  accountPayload(state.records)
  let revision = null
  let pending
  let serial = 0
  let closed = false
  let replacing = false
  let ready = false
  let props
  let interrupted = false
  const project = status => host.project('account-sync:' + status)
  function commit(next) {
    if (!host.accountCommit(JSON.stringify(next))) throw Error('Account storage unavailable')
    state = next
  }
  function schedule(delay) {
    host.cancelTimer(syncTimer)
    host.schedule(syncTimer,delay)
  }
  const localHost = Object.create(host)
  localHost.read = key => Object.hasOwn(state.records,key) ? ['ok',state.records[key]] : ['missing']
  localHost.write = (key,value) => {
    if (replacing || closed) return false
    if (state.records[key] === value) return true
    try {
      const records = {...state.records,[key]:value}
      const changed = JSON.stringify(accountPayload(records)) !== JSON.stringify(accountPayload(state.records))
      const next = changed ? {version:1,records,updatedAt:Math.max(host.wallTime(),(state.updatedAt ?? -1)+1),dirty:true}
        : {...state,records}
      commit(next)
      if (changed && !pending && revision !== null) schedule(waitToSave)
      return true
    } catch { project('storage-unavailable'); return false }
  }
  // Resetting anonymously-owned files while signed in would affect a different learner.
  localHost.requestLocalReset = () => host.project('local-reset:error')
  let local = createLocal(localHost)
  function replaceLocal() {
    replacing = true
    try { local.dispose(); host.invalidateLocal() } finally { replacing = false }
    local = createLocal(localHost)
    if (interrupted) local.interrupt(true)
    local.bootstrap()
    if (props) local.setProps(props)
  }
  function request() {
    if (pending || closed) return
    if (revision !== null && !state.dirty) { project('current'); return }
    const kind = revision === null ? 'read' : 'save'
    const id = ++serial
    pending = {kind,id,stamp:state.updatedAt}
    project(kind === 'read' ? 'loading' : 'saving')
    const payload = kind === 'save' ? JSON.stringify(databasePayload(state.records,state.updatedAt)) : ''
    host.accountRequest(id,kind,revision ?? '',payload)
  }
  function response(id,status,token,raw) {
    if (closed || !pending || pending.id !== id) return
    const {kind,stamp} = pending
    pending = null
    if (status !== 'ok' || !token) {
      revision = null
      project('retry')
      schedule(status === 'conflict' ? 0 : waitToRetry)
      return
    }
    try {
      if (kind === 'save') {
        if (state.updatedAt === stamp) commit({...state,dirty:false})
      } else {
        const remote = raw === '' ? null : JSON.parse(raw)
        if (remote !== null && (typeof remote !== 'object' || Array.isArray(remote) ||
            (remote.updatedAt !== undefined && !validTime(remote.updatedAt)))) throw Error('Unsupported account progress')
        // Never replace a remote shape this client cannot safely round-trip.
        const records = remote === null ? null : applyAccountPatch(state.records,remote)
        if (remote === null || (state.updatedAt !== null &&
            (remote.updatedAt === undefined || remote.updatedAt < state.updatedAt))) {
          if (state.updatedAt !== null && !state.dirty) commit({...state,dirty:true})
        } else {
          const changed = Object.entries(records).some(([k,v]) => state.records[k] !== v)
          commit({version:1,records,updatedAt:remote.updatedAt ?? host.wallTime(),dirty:false})
          if (changed) replaceLocal()
        }
      }
      revision = token
      if (state.dirty) schedule(waitToSave)
      else project('current')
    } catch {
      revision = null
      project('unavailable')
      schedule(waitToRetry)
    }
  }
  return {
    accountResult:response,
    bootstrap() { local.bootstrap(); if (!ready) {ready = true; request()} },
    setProps(next) { props = next; local.setProps(next) },
    timer(id) { if (id === syncTimer) request(); else local.timer(id) },
    input(...args) { local.input(...args) },
    interrupt(value, applicationInactive) { interrupted = value; local.interrupt(value, applicationInactive) },
    permissionResult(...args) { local.permissionResult(...args) },
    scheduleResult(...args) { local.scheduleResult(...args) },
    foreground() {
      local.foreground()
      if (ready && !pending) {host.cancelTimer(syncTimer); revision = null; request()}
    },
    configuration() { return local.configuration() },
    dispose() { closed = true; pending = null; host.cancelTimer(syncTimer); local.dispose() }
  }
}
