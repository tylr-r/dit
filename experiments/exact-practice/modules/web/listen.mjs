import { PRACTICE_POOL } from './progression.mjs'

// Behavioral source: useMorseSessionController submitListenAnswer / handleListenReplay.
// 650/1000ms base + 1000ms reveal; 320ms fade + 220ms post-reveal pause.
const REVEAL_MS = { correct: 1650, wrong: 2000 }
const NEXT_GAP_MS = 540
const RECOGNITION_MS = 2600

/** Standalone Characters Listen; no guided gates, vocabulary, or custom-text modes. */
export function createListen({ setTimer, clearTimer, play, stop, project, record, pick, getPool = () => PRACTICE_POOL, onRoundEnd = () => true, isGuided = () => false }) {
  let enabled = false
  let phase = 'ready'
  let target = PRACTICE_POOL[0]
  let timing = null
  let generation = 0
  let nextTimer
  let recognitionTimer
  const setPhase = next => { phase = next; project('listen-phase:' + next) }
  const fields = (reveal = '', feedback = '') => {
    project('listen-reveal:' + reveal)
    project('listen-feedback:' + feedback)
  }
  function cancelTimers() {
    generation++
    clearTimer(nextTimer)
    clearTimer(recognitionTimer)
    nextTimer = recognitionTimer = undefined
    timing = null
  }
  function prompt() {
    if (!enabled) return false
    if (!getPool().includes(target)) target = pick(undefined)
    const ticket = ++generation
    timing = null
    fields()
    project('listen-prompt:' + ticket)
    setPhase('answering')
    play(target, (duration, readElapsed) => {
      if (ticket === generation && phase === 'answering') timing = {duration, readElapsed}
    })
    return true
  }
  function suspend() {
    if (!enabled) return
    cancelTimers()
    stop()
    fields()
    project('listen-recognition:')
    setPhase('ready')
  }
  return {
    enter({autoplay=true, keepTarget=false}={}) {
      enabled = true
      project('listen-submitted:0')
      if(!keepTarget || !getPool().includes(target)) target = pick(undefined)
      if(!autoplay){
        cancelTimers()
        fields()
        project('listen-recognition:')
        setPhase('ready')
        return true
      }
      return prompt()
    },
    suspend,
    exit() { suspend(); enabled = false },
    replay() {
      return enabled && (phase === 'answering' || phase === 'ready') ? prompt() : false
    },
    answer(input, promptId = String(generation)) {
      if (promptId !== String(generation)) return false
      const letter = typeof input === 'string' ? input.toUpperCase() : ''
      if (!enabled || phase !== 'answering' || letter.length !== 1 || !getPool().includes(letter)) return false
      if (!getPool().includes(target)) {
        suspend()
        return false
      }
      const elapsed = timing?.readElapsed?.()
      const sample = Number.isFinite(elapsed) && elapsed >= 0 && Number.isFinite(timing.duration) && timing.duration >= 0
        ? Math.max(0, elapsed - timing.duration) : null
      const recognition = sample === null ? '' : (sample / 1000).toFixed(1) + 's'
      cancelTimers()
      stop()
      const correct = letter === target
      project('listen-submitted:1')
      setPhase('reveal')
      fields(target, correct ? 'Correct' : isGuided() ? 'It was ' + target : 'Incorrect')
      project('listen-recognition:' + recognition)
      record(target, correct, sample)
      recognitionTimer = setTimer(() => {
        recognitionTimer = undefined
        project('listen-recognition:')
      }, RECOGNITION_MS)
      const ticket = generation
      nextTimer = setTimer(() => {
        if (ticket !== generation || !enabled) return
        if (!onRoundEnd()) {
          fields()
          setPhase('ready')
          return
        }
        target = pick(target)
        fields()
        setPhase('gap')
        nextTimer = setTimer(() => {
          if (ticket === generation && enabled) prompt()
        }, NEXT_GAP_MS)
      }, correct ? REVEAL_MS.correct : REVEAL_MS.wrong)
      return true
    },
  }
}
