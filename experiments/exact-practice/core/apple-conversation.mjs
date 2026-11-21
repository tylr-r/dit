// Synthetic station; the Apple transport and Morse input are real. Typed copy
// stays in the shared session and is never an argument to the station.
import { createQso, fixtureReply, qsoPlan } from '../modules/web/qso.mjs'
import { characterUnitMs } from '../modules/web/tempo.mjs'

export function createAppleConversation({project, host, clock, current}) {
  let timer
  let poll
  function stop() {
    clock.clearTimer(timer)
    poll = undefined
    host.passageControl?.('stop')
  }
  const contact = createQso({
    ...clock, project, reply:fixtureReply, stop, platform:'ios',
    play(text, complete, fail, progress) {
      const {speed, pitch} = current().settings
      const plan = qsoPlan(text,speed)
      const finalGap = 3*characterUnitMs(speed)
      if (!plan.length || !host.passageStart?.(plan,pitch,finalGap)) { fail(); return }
      const duration = plan.at(-1)[1] + finalGap
      let lastPercent
      const publishProgress = percent => {
        if (lastPercent !== percent) project('qso-percent:'+percent)
        lastPercent = percent
      }
      publishProgress(0)
      poll = () => {
        const ms = host.passagePosition()
        if (ms === -2) { poll=undefined; publishProgress(100); complete(); return }
        if (!Number.isFinite(ms) || ms < 0) { fail(); return }
        publishProgress(duration > 0 ? Math.min(100,Math.floor(100*ms/duration)) : 0)
        progress(ms,speed)
        timer = clock.setTimer(poll,50)
      }
      timer = clock.setTimer(poll,50)
    },
    pause() {
      if (!host.passageControl('pause')) throw Error('Audio pause failed')
      clock.clearTimer(timer)
    },
    resume() {
      if (!poll || !host.passageControl('resume')) throw Error('Audio resume failed')
      timer = clock.setTimer(poll,50)
    },
  })
  return {
    ...contact,
    update(props,changed) {
      if (changed('qso-copy-value')) contact.copy(props['qso-copy-value'] || '')
      if (!changed('qso-token')) return
      const action = props['qso-command']
      if (action === 'send-first' || action === 'receive-first') contact.start(action === 'send-first' ? 'send' : 'receive')
      else if (action === 'consent-allow' || action === 'consent-cancel') {
        const allow = action === 'consent-allow'
        if (contact.confirm(allow) && allow) host.warm()
      } else if (action?.startsWith('reveal-turn-')) contact.revealTurn(Number(action.slice(12)))
      else if (action === 'live-on' || action === 'live-off') contact.setLive(action === 'live-on')
      else if (action === 'start-turn') contact.startTurn()
      else if (['clear','end','new','backspace','send','reveal','check','pause','resume','replay','retry'].includes(action)) {
        if (action === 'clear' || action === 'end') host.cancelInput()
        contact[action]()
      }
    },
  }
}
