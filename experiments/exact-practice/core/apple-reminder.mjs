import { todayStreakContribution } from '../modules/web/reference-retention.generated.mjs'

export const REMINDER_KEY = 'dit.exact-spike.reminder.v1'
export const validTime = time => typeof time === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)

export function clockLabel(time) {
  const [hour,minute] = time.split(':')
  return (Number(hour) % 12 || 12) + ':' + minute + (Number(hour) < 12 ? ' AM' : ' PM')
}

// Shipped apps/ios/src/notifications/reminder.ts schedules one local occurrence.
export function nextReminder(time, progress, now) {
  const [hour,minute] = time.split(':').map(Number)
  const target = new Date(now)
  target.setHours(hour,minute,0,0)
  const {correct,goal} = todayStreakContribution(progress, now)
  if (correct >= goal || target <= now) target.setDate(target.getDate() + 1)
  const streak = progress.streak?.current ?? 0
  return {at:target.getTime(), body:streak >= 1 ? 'Keep your ' + streak + '-day streak.' : 'Ready for a quick Morse session?'}
}

function read(storage) {
  try {
    const raw = storage.getItem(REMINDER_KEY)
    if (raw === null) return {enabled:false,time:'19:00',writable:true}
    const v = JSON.parse(raw)
    if (v?.version === 1 && typeof v.enabled === 'boolean' && validTime(v.time)
      && Object.keys(v).every(key => ['version','enabled','time'].includes(key)))
      return {enabled:v.enabled,time:v.time,writable:true}
  } catch { /* Keep unavailable and unsupported bytes intact. */ }
  return {enabled:false,time:'19:00',writable:false}
}

export function createReminder({storage,host,project,progress}) {
  let state = read(storage)
  let serial = 0
  let pending = null
  let syncID = 0
  let error = state.writable ? '' : 'Saved reminder settings are unavailable.'
  function publish() {
    project('reminder-enabled:' + Number(state.enabled))
    project('reminder-time:' + state.time)
    project('reminder-busy:' + Number(Boolean(pending)))
    project('reminder-error:' + error)
  }
  function sync() {
    if (!state.writable) return
    const plan = state.enabled ? nextReminder(state.time,progress(),new Date()) : null
    host.syncReminder(++syncID,plan?.at ?? 0,plan?.body ?? '')
  }
  function save(enabled,time) {
    if (!validTime(time)) return false
    try {
      if (!read(storage).writable) throw Error('protected')
      storage.setItem(REMINDER_KEY,JSON.stringify({version:1,enabled,time}))
    } catch {
      ++syncID
      error = 'Could not save the reminder. Try again or continue without it.'
      publish()
      return false
    }
    state = {enabled,time,writable:true}
    error = ''
    publish()
    sync()
    return true
  }
  function cancel() {
    if (!pending) return
    pending = null
    host.cancelReminderRequest()
    publish()
  }
  return {
    publish, sync, cancel,
    enable(time, done) {
      if (pending || !validTime(time)) return
      if (!read(storage).writable) { error = 'Saved reminder settings are unavailable.'; publish(); done?.(false); return }
      pending = {id:++serial,time,done}
      error = ''
      publish()
      host.requestReminder(serial)
    },
    permission(id,result) {
      if (id !== pending?.id) return
      const {done,time} = pending
      pending = null
      if (result !== 'granted' && result !== 'denied') {
        error = 'Could not check notification permission. Try again or continue without it.'
        publish()
        done?.(false)
      } else {
        const saved = save(result === 'granted',time)
        done?.(saved)
      }
    },
    scheduled(id,result) {
      if (id !== syncID) return
      const message = result === 'error' ? 'Could not schedule the reminder. Check notification settings and try again.'
        : result === 'denied' && state.enabled ? 'Allow notifications in iOS Settings to receive your reminder.' : ''
      if (message !== error && (message || state.enabled) && !pending) { error = message; publish() }
    },
    settings(command) {
      if (command === 'reminder-on' && !state.enabled) this.enable(state.time)
      else if (command === 'reminder-off') { cancel(); save(false,state.time) }
      else if (command.startsWith('reminder-time:') && state.enabled) save(true,command.slice(14))
    },
  }
}
