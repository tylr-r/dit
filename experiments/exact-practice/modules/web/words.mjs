import { LISTEN_WORD_BANKS } from './word-bank.generated.mjs'
import { createListenPhraseRound, getEligibleListenPhrases } from './word-round.generated.mjs'
import { PRACTICE_POOL } from './progression.mjs'
import { replayPlan } from './session.mjs'
import { tempoTiming } from './tempo.mjs'

const ALL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const eligible = (vocabulary, all, pool=PRACTICE_POOL) =>
  getEligibleListenPhrases(LISTEN_WORD_BANKS[vocabulary], [...(all ? ALL : pool)])
export const wordEligibility = (vocabulary, all, pool) => eligible(vocabulary, all, pool).length

/** Exact Dit pulse timing: per-character spacing uses the Farnsworth unit, not the element unit. */
export function wordPlan(text, speed, effective) {
  const {unitMs:unit,characterGapMs} = tempoTiming(speed,effective)
  let offset = 0
  return [...text].flatMap(char => {
    const pulses = replayPlan(char, unit)
    if (!pulses.length) return []
    const shifted = pulses.map(([start,end]) => [offset + start, offset + end])
    offset = shifted.at(-1)[1] + characterGapMs
    return shifted
  })
}

/** Behavioral controller using source bank/round rules. Audio callback is the only reveal gate. */
export function createWords({ play, stop, project, getPool=()=>PRACTICE_POOL, initialVocabulary = 'common', random = Math.random }) {
  let active = false
  let all = false
  let vocabulary = initialVocabulary
  let phase = 'ready'
  let round = null
  let selected = null
  let previous
  let correctCount = 0
  let attemptCount = 0
  let ticket = 0
  function render() {
    const choices = phase === 'choosing' || phase === 'answered'
    const answered = phase === 'answered'
    project('word-phase:' + phase)
    project('word-vocab:' + vocabulary)
    project('word-pool:' + Number(all))
    project('word-ready:' + Number(wordEligibility(vocabulary,all,getPool()) >= 4))
    project('word-options:' + (choices ? round.options.map(item=>item.text).join(',') : ''))
    project('word-picked:' + (answered ? round.options.indexOf(selected) + 1 : ''))
    project('word-correct:' + (answered ? round.options.indexOf(round.target) + 1 : ''))
    project('word-target:' + (answered ? round.target.text : ''))
    project('word-feedback:' + (answered ? (selected.id===round.target.id ? 'Correct' : 'Incorrect: ' + round.target.text) : ''))
    project('word-meaning:' + (answered && vocabulary==='q-codes' ? round.target.meaning ?? '' : ''))
    project('word-count:' + correctCount + '/' + attemptCount)
  }
  function reset() {
    ticket++
    stop()
    phase = 'ready'
    round = null
    selected = null
    if (active) render()
  }
  function playRound() {
    const operation = ++ticket
    phase = 'playing'
    render()
    stop()
    play(round.target, () => {
      if (!active || ticket !== operation || phase !== 'playing') return
      phase = selected ? 'answered' : 'choosing'
      render()
    }, () => {
      if (!active || ticket !== operation || phase !== 'playing') return
      phase = 'audio-error'
      render()
    })
  }
  function start() {
    const result = createListenPhraseRound(eligible(vocabulary,all,getPool()), {previousTargetId:previous,random})
    if (!result) return false
    previous = result.target.id
    round = result
    selected = null
    playRound()
    return true
  }
  return {
    enter() { active = true; reset() },
    leave() { active = false; reset() },
    suspend:reset,
    vocabulary(value) {
      if (!Object.hasOwn(LISTEN_WORD_BANKS,value) || vocabulary === value) return
      vocabulary = value
      reset()
    },
    pool(value) {
      if (all === value) return
      all = value
      reset()
    },
    start() { return active && phase === 'ready' ? start() : false },
    replay() {
      if (!active || !round) return false
      playRound()
      return true
    },
    answer(index) {
      if (!active || phase !== 'choosing' || !Number.isInteger(index) || index < 1 || index > 4) return false
      ++ticket
      stop()
      selected = round.options[index - 1]
      attemptCount++
      if (selected.id === round.target.id) correctCount++
      phase = 'answered'
      render()
      return true
    },
    next() { return active && phase === 'answered' ? start() : false },
  }
}
