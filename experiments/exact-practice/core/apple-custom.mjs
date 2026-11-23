import {createCustom,customPlan} from '../modules/web/custom.mjs'
import {normalizeCustomText} from '../modules/web/custom-text.generated.mjs'
import {tempoTiming} from '../modules/web/tempo.mjs'

export function createAppleCustom({storage,project,host,clock,current}) {
  let chars = 0
  let timer, poll
  let duration = 0
  let elapsed = ''
  let fill = -1
  function describeDraft(raw) {
    const {normalized,ignored} = normalizeCustomText(raw)
    const {speed,effectiveSpeed} = current().settings
    const plan = customPlan(normalized,speed,effectiveSpeed)
    const {characterGapMs} = tempoTiming(speed,effectiveSpeed)
    const seconds = plan.length ? Math.ceil((plan.at(-1)[1] + characterGapMs) / 1000) : 0
    project('custom-estimate:' + normalized.length + ' / 2000 chars · ' + ignored + ' ignored · about ' + seconds + ' seconds')
  }
  function showTime(ms) {
    const percent = duration > 0 ? Math.min(100,Math.floor(ms * 100 / duration)) : 0
    if (percent !== fill) { fill = percent; project('custom-fill:' + percent + '%') }
    const text = Math.floor(ms / 1000) + ' / ' + Math.ceil(duration / 1000) + ' seconds'
    if (text !== elapsed) { elapsed = text; project('custom-time:' + text) }
  }
  function stop() {
    clock.clearTimer(timer)
    poll = undefined
    host.passageControl?.('stop')
  }
  const custom = createCustom({
    storage, stop,
    project(message) {
      if (message.startsWith('custom-chars:')) chars = Number(message.slice(13))
      if (message.startsWith('custom-editor:')) describeDraft(message.slice(14))
      project(message)
    },
    play(text, done, fail) {
      project('custom-control-error:')
      const {speed,effectiveSpeed,pitch} = current().settings
      const plan = customPlan(text,speed,effectiveSpeed)
      const {characterGapMs} = tempoTiming(speed,effectiveSpeed)
      if (!plan.length || !host.passageStart?.(plan,pitch,characterGapMs)) { fail(); return }
      duration = plan.at(-1)[1] + characterGapMs
      showTime(0)
      poll = () => {
        const ms = host.passagePosition()
        if (ms === -2) { done(); custom.reveal(); return }
        if (!Number.isFinite(ms) || ms < 0) { stop(); fail(); return }
        showTime(Math.min(ms,duration))
        timer = clock.setTimer(poll,60)
      }
      timer = clock.setTimer(poll,60)
    },
    pause() {
      if (!host.passageControl('pause')) {
        project('custom-control-error:Could not pause playback. Try End and Play again.')
        return false
      }
      clock.clearTimer(timer)
      const ms = host.passagePosition()
      if (ms >= 0) showTime(Math.min(ms,duration))
    },
    resume() {
      if (!host.passageControl('resume')) {
        project('custom-control-error:Could not resume playback. Try Restart.')
        return false
      }
      timer = clock.setTimer(poll,60)
    },
  })
  return {
    enter() { custom.enter(); project('custom-control-error:'); project('custom-active:1') },
    leave() { project('custom-active:0'); custom.leave() },
    suspend:custom.suspend,
    update(props,changed) {
      const raw = props['custom-source-value'] || ''
      if (changed('custom-source-value')) { custom.edit(raw); describeDraft(raw) }
      if (changed('custom-copy-value')) custom.copy(props['custom-copy-value'] || '')
      if (!changed('custom-token')) return
      const action = props['custom-command']
      if (action === 'save') {
        project('custom-control-error:')
        custom.save(raw, String(props['custom-type-value']) === 'true')
      } else if (['edit','discard','clear','play','pause','resume','reveal'].includes(action)) custom[action]()
      if (!chars && ['discard','clear','save'].includes(action)) project('custom-done')
    },
  }
}
