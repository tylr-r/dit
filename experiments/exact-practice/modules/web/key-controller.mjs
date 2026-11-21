import { createPaddleState, stepPaddle } from './paddle-core.js'

const thresholdMs = 200
const gapMs = 200

export function createKeyController({ now, setTimer, clearTimer, audio, message }) {
  let settings = { blocked: false, unitMs: 100, frequency: 600, volume: 0.75 }
  let state = createPaddleState()
  let currentTimer
  let straight = null
  let sequence = ''
  let commitTimer
  let generation = 0
  let sequenceVersion = 0
  let active = false
  let dispatching = false
  const events = []

  const clearCommit = () => {
    sequenceVersion++
    clearTimer(commitTimer)
    commitTimer = undefined
  }
  const begin = () => {
    clearCommit()
    active = true
    audio.start(settings.frequency, settings.volume)
    message('active:on')
  }
  const end = () => {
    if (!active) return
    active = false
    audio.stop()
    message('active:off')
  }
  const append = (symbol, batch) => {
    sequence += symbol
    message('symbol:' + symbol)
    if (batch !== generation) return
    clearCommit()
    const version = sequenceVersion
    commitTimer = setTimer(() => {
      if (batch !== generation || version !== sequenceVersion) return
      commitTimer = undefined
      const value = sequence
      sequence = ''
      if (value) message('sequence:' + value)
    }, gapMs)
  }

  function apply(event) {
    const batch = generation
    const result = stepPaddle(state, { ...event, atMs: now() }, {
      canStart: !settings.blocked && straight === null,
      unitMs: settings.unitMs,
    })
    state = result.state
    for (const effect of result.effects) {
      if (batch !== generation) break
      if (effect.type === 'toneStart') begin()
      if (effect.type === 'toneStop') end()
      if (effect.type === 'symbol') append(effect.symbol, batch)
      if (effect.type === 'cancelTimer' && currentTimer?.id === effect.id) {
        clearTimer(currentTimer.handle)
        currentTimer = undefined
      }
      if (effect.type === 'schedule' && state.phase.deadline?.id === effect.id) {
        const { id, atMs } = effect
        const handle = setTimer(() => {
          if (currentTimer?.id !== id || batch !== generation) return
          currentTimer = undefined
          dispatch({ type: 'timer', id })
        }, Math.max(0, atMs - now()))
        currentTimer = { id, handle }
      }
    }
    return result.accepted
  }

  function dispatch(event) {
    if (dispatching) {
      events.push(event)
      return false
    }
    dispatching = true
    try {
      const accepted = apply(event)
      while (events.length) apply(events.shift())
      return accepted
    } finally {
      dispatching = false
    }
  }

  const cancel = () => {
    generation++
    events.length = 0
    clearCommit()
    sequence = ''
    straight = null
    dispatch({ type: 'cancel' })
    end()
  }

  return {
    configure(patch) {
      const previous = settings
      settings = { ...settings, ...patch }
      if ((!previous.blocked && settings.blocked) ||
          (previous.cancelToken !== undefined && settings.cancelToken !== previous.cancelToken)) cancel()
    },
    paddleDown: symbol => dispatch({ type: 'press', symbol }),
    paddleUp: symbol => dispatch({ type: 'release', symbol }),
    straightDown(owner) {
      if (settings.blocked || straight !== null || state.phase.kind !== 'idle' || state.held !== null) return false
      straight = { owner, atMs: now() }
      begin()
      return true
    },
    straightUp(owner) {
      if (straight?.owner !== owner) return false
      const symbol = now() - straight.atMs < thresholdMs ? '.' : '-'
      const batch = generation
      straight = null
      end()
      if (batch === generation) append(symbol, batch)
      return true
    },
    cancel,
  }
}

export function createSidetone(window) {
  let context, oscillator, gain, epoch = 0, frequency, volume
  let phrase, frozen = false, delayedFinite, clockOperation = 0, replayClockEpoch = 0
  const abortPhrase = () => {
    if (!phrase) return
    const { oscillator: node, gain: level } = phrase
    phrase = undefined
    node.onended = null
    try { node.stop() } catch { /* already completed */ }
    node.disconnect()
    level.disconnect()
  }
  const warm = () => {
    const Context = window.AudioContext ?? window.webkitAudioContext
    if (!Context) return
    if (!context) {
      try {
        context = new Context({ latencyHint: 'interactive' })
        const installed = context
        installed.addEventListener?.('statechange', () => {
          if (installed === context && installed.state !== 'running') replayClockEpoch++
        })
        oscillator = context.createOscillator()
        gain = context.createGain()
        gain.gain.value = 0
        oscillator.connect(gain)
        gain.connect(context.destination)
        oscillator.start()
      } catch {
        if (context) void context.close().catch(() => {})
        context = oscillator = gain = undefined
        return
      }
    }
    if (context.state === 'suspended') void context.resume().catch(() => {})
  }
  const render = () => {
    if (!gain || !context) return
    const t = context.currentTime
    oscillator.frequency.setValueAtTime(frequency, t)
    gain.gain.cancelScheduledValues(t)
    gain.gain.setTargetAtTime(volume, t, 0.003)
  }
  return {
    warm,
    start(pitch, level) {
      abortPhrase()
      const token = ++epoch
      frequency = pitch
      volume = level
      warm()
      if (!context) return
      if (context.state === 'running') render()
      else void context.resume().then(() => { if (token === epoch) render() }).catch(() => {})
    },
    replay(plan, pitch, level, onScheduled) {
      this.stop()
      if (!plan.length) return
      const token = ++epoch
      warm()
      if (!context) return
      const schedule = () => {
        if (token !== epoch || !context || !gain) return
        const t = context.currentTime
        frequency = pitch
        volume = 0
        oscillator.frequency.setValueAtTime(pitch, t)
        gain.gain.cancelScheduledValues(t)
        for (const [start, end] of plan) {
          gain.gain.setTargetAtTime(level, t + start / 1000, 0.003)
          gain.gain.setTargetAtTime(0, t + end / 1000, 0.003)
        }
        const scheduledContext = context
        const clock = replayClockEpoch
        onScheduled?.(plan.at(-1)[1], () =>
          token === epoch && clock === replayClockEpoch && context === scheduledContext && context.state === 'running'
            ? Math.max(0, (context.currentTime - t) * 1000) : null)
      }
      if (context.state === 'running') schedule()
      else void context.resume().then(schedule).catch(() => {})
    },
    playFinite(plan, pitch, volume, onComplete, onError, onClock) {
      this.stop()
      const token = ++epoch
      warm()
      if (!context || !plan.length) { onError?.(); return }
      const schedule = () => {
        if (token !== epoch || !context) return
        if (frozen) { delayedFinite = schedule; return }
        delayedFinite = undefined
        let node, level
        try {
          const t = context.currentTime + 0.025
          node = context.createOscillator()
          level = context.createGain()
          phrase = {oscillator:node,gain:level}
          node.frequency.value = pitch
          level.gain.value = 0
          node.connect(level)
          level.connect(context.destination)
          for (const [start,end] of plan) {
            const a=t+start/1000, b=t+end/1000
            level.gain.setValueAtTime(0,a)
            level.gain.linearRampToValueAtTime(volume,a+0.005)
            level.gain.setValueAtTime(volume,b-0.005)
            level.gain.linearRampToValueAtTime(0,b)
          }
          node.onended = () => {
            if (phrase?.oscillator === node) phrase = undefined
            node.disconnect(); level.disconnect()
            if (token === epoch) onComplete()
          }
          node.start(t)
          node.stop(t+plan.at(-1)[1]/1000+0.05)
          onClock?.(() => token===epoch && phrase?.oscillator===node
            ? Math.max(0,(context.currentTime-t)*1000) : null)
        } catch {
          if (phrase?.oscillator === node && phrase) abortPhrase()
          else {
            node?.disconnect()
            level?.disconnect()
          }
          if (token === epoch) onError?.()
        }
      }
      if (context.state === 'running') schedule()
      else void context.resume().then(schedule).catch(() => { if (token === epoch) onError?.() })
    },
    async pause() {
      const operation = ++clockOperation
      frozen = true
      const current = context
      try {
        if (current?.state === 'running') await current.suspend()
      } catch (error) {
        if (operation === clockOperation) frozen = false
        throw error
      }
      // An already-enqueued platform suspend can finish after explicit new
      // playback. Do not leave that new playback stuck on the old request.
      if (operation !== clockOperation && current === context &&
          current?.state === 'suspended' && !frozen && (phrase || volume > 0)) {
        void current.resume().catch(() => {})
      }
    },
    async resume() {
      const operation = ++clockOperation
      const current = context
      if (current && current.state !== 'running') await current.resume()
      if (operation !== clockOperation || current !== context) return
      frozen = false
      delayedFinite?.()
    },
    stop() {
      epoch++
      clockOperation++
      frozen = false
      delayedFinite = undefined
      abortPhrase()
      volume = 0
      if (frequency !== undefined) render()
    },
    close() {
      epoch++
      clockOperation++
      frozen = false
      delayedFinite = undefined
      abortPhrase()
      if (context) void context.close().catch(() => {})
      context = oscillator = gain = undefined
    },
  }
}
