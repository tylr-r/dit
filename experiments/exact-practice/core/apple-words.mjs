import { createWords, wordEligibility, wordPlan } from '../modules/web/words.mjs'
import { tempoTiming } from '../modules/web/tempo.mjs'

const key = 'dit.exact-spike.listen.v1'
const contents = ['characters', 'words', 'custom']
const vocabularies = ['common', 'q-codes']

export function createAppleWords({ storage, clock, host, project, current, nextPrompt }) {
  let preferred = 'characters'
  let vocabulary = 'common'
  let writable = true
  try {
    const value = storage.getItem(key)
    if (value !== null) {
      const saved = JSON.parse(value)
      writable = saved?.version === 1 && contents.includes(saved.content) &&
        vocabularies.includes(saved.vocabulary) && Object.keys(saved).length === 3
      if (writable) {
        preferred = saved.content
        vocabulary = saved.vocabulary
      }
    }
  } catch { writable = false }

  function saveChoice() {
    if (!writable) return
    try { storage.setItem(key, JSON.stringify({version:1, content:preferred, vocabulary})) }
    catch { project('storage:unavailable') }
  }

  let effective, offered, guided
  let poll, watchdog
  let phase = 'ready'
  function stop() {
    clock.clearTimer(poll)
    clock.clearTimer(watchdog)
    host.stop()
  }
  const words = createWords({
    getPool:() => current().studyPool, initialVocabulary:vocabulary,
    project(message) {
      if (message.startsWith('word-phase:')) phase = message.slice(11)
      project(message)
    },
    stop,
    play(target, done, failed) {
      const {speed, effectiveSpeed, pitch} = current().settings
      const {characterGapMs} = tempoTiming(speed, effectiveSpeed)
      const plan = wordPlan(target.text, speed, effectiveSpeed)
      const id = nextPrompt()
      if (!host.play(plan, pitch, id)) { failed(); return }
      // Shipped iOS includes the final Farnsworth gap in the played-back PCM.
      // Elapsed timers alone must never reveal the answers.
      function check(expired) {
        if (host.promptTailMs(id) >= characterGapMs) {
          clock.clearTimer(poll)
          clock.clearTimer(watchdog)
          done()
        } else if (expired) {
          stop()
          failed()
        } else poll = clock.setTimer(() => check(false), 40)
      }
      poll = clock.setTimer(() => check(false), 40)
      // A lost render stream gets an explicit retry after a grace period.
      watchdog = clock.setTimer(() => check(true), plan.at(-1)[1] + characterGapMs + 3000)
    },
  })
  return {
    content:() => effective,
    refresh(courseActive, choice) {
      const pool = current().studyPool
      const available = vocabularies.some(bank => wordEligibility(bank, false, pool) >= 4)
      if (contents.includes(choice) && !courseActive && (choice !== 'words' || available) && preferred !== choice) {
        preferred = choice
        saveChoice()
      }
      const content = courseActive || (!available && preferred === 'words') ? 'characters' : preferred
      if (guided !== courseActive) project('listen-course:' + Number(courseActive))
      if (offered !== available) project('words-available:' + Number(available))
      if (effective !== content || choice) project('apple-listen-content:' + content)
      guided = courseActive
      offered = available
      effective = content
    },
    enter:words.enter, leave:words.leave, suspend:words.suspend,
    command(value) {
      if (vocabularies.includes(value)) {
        if (vocabulary !== value) {
          vocabulary = value
          saveChoice()
          words.vocabulary(value)
        }
      } else if (value === 'start') {
        if (phase === 'audio-error') words.suspend()
        words.start()
      } else if (value === 'replay' && (phase === 'choosing' || phase === 'answered')) words.replay()
      else if (value === 'next') words.next()
      else if (/^option-[1-4]$/.test(value)) words.answer(Number(value.slice(-1)))
    },
  }
}
