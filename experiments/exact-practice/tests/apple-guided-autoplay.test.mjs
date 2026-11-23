import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'

const asset = readFileSync(new URL('../assets/dit-apple-session.js', import.meta.url), 'utf8')
const dit = runInNewContext(asset + '\nDitSession')

function learner(phase, autoPlay, overrides = {}) {
  const progress = {
    learnerProfile: 'beginner', guidedCourseActive: true, guidedPackIndex: 0, guidedPhase: phase,
    guidedProgress: {
      teachCounts: phase === 'teach' ? { E: 1 } : { E: 2, T: 2 },
      practiceAttempts: phase === 'listen' ? 10 : 0, practiceCorrect: phase === 'listen' ? 10 : 0,
      practiceLetterCorrect: phase === 'listen' ? { E: 5, T: 5 } : {},
      listenAttempts: 0, listenCorrect: 0, listenLetterCorrect: {},
    },
    practiceAutoPlay: autoPlay, ...overrides,
  }
  return new Map(Object.entries(dit.convertLegacy({
    'dit-nux-status': 'completed', 'dit-progress': JSON.stringify(progress),
  })))
}

function open(files, cancelInput = () => {}) {
  const view = new Map(), timers = new Map(), plays = []
  const session = dit.create({
    read: key => files.has(key) ? ['ok', files.get(key)] : ['missing'],
    write(key, value) { files.set(key, value); return true },
    project(message) {
      const split = message.indexOf(':')
      view.set(message.slice(0, split), message.slice(split + 1))
    },
    play(plan, pitch, prompt) {
      plays.push({ durations: Array.from(plan, ([a, b]) => b - a), pitch, prompt })
      return true
    },
    schedule: (id, ms) => timers.set(id, ms), cancelTimer: id => timers.delete(id),
    stop() {}, warm() {}, cancelInput, syncReminder() {}, outputVolume: () => 1,
  })
  let props = { mode: 'boot', blocked: 'false', 'settings-open': 'false', 'warm-token': '0', 'pref-token': '0' }
  function set(changes) {
    props = { ...props, ...changes }
    session.setProps(props)
  }
  function feedbackTimer() {
    const timer = [...timers].find(([, ms]) => ms === 1000)
    assert.ok(timer, 'missing guided feedback timer')
    return timer[0]
  }
  function settleFeedback() {
    const id = feedbackTimer()
    timers.delete(id)
    session.timer(id)
  }
  set({})
  session.bootstrap()
  set({ mode: 'guided' })
  return { session, view, plays, set, settleFeedback, feedbackTimer }
}

test('guided Teach honors restored Auto-play off while Play and corrective feedback remain audible', t => {
  const f = open(learner('teach', false))
  t.after(() => f.session.dispose())
  assert.equal(f.view.get('guide-target'), 'E')
  assert.equal(f.view.get('autoPlay'), 'false')
  assert.equal(f.plays.length, 0, 'quiet Teach entry')
  f.set({ 'warm-token': '1' })
  assert.deepEqual(f.plays.map(p => p.durations), [[100]], 'Play requests the E once')
  f.session.input('sequence', '.')
  f.settleFeedback()
  assert.equal(f.view.get('guide-target'), 'T')
  assert.equal(f.plays.length, 1, 'new target stays quiet')
  f.session.input('sequence', '.')
  assert.equal(f.view.get('guide-feedback'), 'Try again')
  assert.deepEqual(f.plays.map(p => p.durations), [[100], [300]], 'a missed T plays its correction once')
  f.settleFeedback()
  assert.equal(f.plays.length, 2)
})

test('guided mixed Practice honors the Settings switch on close, restart and re-enable', t => {
  const files = learner('practice', true)
  const f = open(files)
  assert.equal(f.view.get('guide-phase'), 'practice')
  assert.equal(f.plays.length, 1, 'enabled plays the initial target')
  f.set({ blocked: 'true', 'settings-open': 'true' })
  f.set({ 'pref-token': '1', 'pref-command': 'autoplay-off' })
  f.set({ blocked: 'false', 'settings-open': 'false' })
  assert.equal(f.plays.length, 1, 'turning Auto-play off must not play the target')
  f.session.dispose()

  const restored = open(files)
  t.after(() => restored.session.dispose())
  assert.equal(restored.view.get('autoPlay'), 'false')
  assert.equal(restored.plays.length, 0, 'saved switch suppresses replay on restart')
  restored.set({ blocked: 'true', 'settings-open': 'true' })
  restored.set({ 'pref-token': '1', 'pref-command': 'autoplay-on' })
  restored.set({ blocked: 'false', 'settings-open': 'false' })
  restored.set({})
  assert.equal(restored.plays.length, 1, 're-enable plays once')
})

test('guided Listen still presents a scored prompt with Practice Auto-play off', t => {
  const f = open(learner('listen', false))
  t.after(() => f.session.dispose())
  assert.equal(f.view.get('guide-phase'), 'listen')
  assert.equal(f.view.get('listen-phase'), 'answering')
  assert.equal(f.plays.length, 1)
  assert.ok(f.plays[0].prompt > 0)
  assert.deepEqual(f.plays[0].durations, [100])
})

const savedGuide = files => JSON.parse(files.get('dit.exact-spike.guided.v1')).data
const savedPractice = files => JSON.parse(files.get('dit.exact-spike.practice.v1'))
const symbolFor = target => target === 'E' ? '.' : '-'

for (const autoPlay of [true, false]) {
  test('Play during a guided miss clears feedback and replays once with Auto-play ' + autoPlay, t => {
    const files = learner('practice', autoPlay)
    const f = open(files)
    t.after(() => f.session.dispose())
    const target = f.view.get('guide-target')
    const symbol = symbolFor(target)
    const wrong = symbol === '.' ? '-' : '.'
    f.session.input('symbol', wrong)
    f.session.input('sequence', wrong)
    assert.equal(f.view.get('guide-feedback'), 'Try again')
    const timer = f.feedbackTimer()
    const afterMiss = new Map(files)
    assert.equal(savedGuide(files).progress.practiceAttempts, 1)
    assert.equal(savedPractice(files).scores[target], -1)
    const expectedRequests = f.plays.length + 1
    f.set({ 'warm-token': '1' })
    assert.equal(f.view.get('guide-feedback'), '')
    assert.equal(f.plays.length, expectedRequests)
    assert.deepEqual(f.plays.at(-1).durations, [symbol === '.' ? 100 : 300])
    f.session.timer(timer)
    assert.equal(f.view.get('guide-target'), target)
    assert.deepEqual(files, afterMiss, 'replay or stale timer must not grade a second attempt')
    f.session.input('symbol', symbol)
    f.session.input('sequence', symbol)
    assert.equal(savedGuide(files).progress.practiceCorrect, 1)
    assert.equal(savedPractice(files).scores[target], 0)
  })
}

test('a fresh guided symbol supersedes success before the target changes and a miss can be retried immediately', t => {
  const files = learner('teach', false, { showHint: true })
  const f = open(files)
  t.after(() => f.session.dispose())
  f.session.input('symbol', '.')
  f.session.input('sequence', '.')
  const stale = f.feedbackTimer()
  assert.equal(f.view.get('guide-feedback'), 'Correct')
  assert.equal(f.session.configuration().enabled, true, 'feedback accepts fresh key input')
  f.session.input('symbol', '-')
  assert.equal(f.view.get('guide-feedback'), '')
  f.session.timer(stale)
  assert.equal(f.view.get('guide-target'), 'E', 'late advance cannot grade the new input as T')
  f.session.input('sequence', '-')
  assert.equal(f.view.get('guide-feedback'), 'Try again')
  assert.deepEqual(f.plays.at(-1).durations, [100], 'correct the displayed E')
  const missed = f.feedbackTimer()
  f.session.input('symbol', '.')
  f.session.timer(missed)
  assert.equal(f.view.get('helper-hits'), '.')
  f.session.input('sequence', '.')
  assert.deepEqual(savedGuide(files).progress.teachCounts, { E: 3 })
  f.settleFeedback()
  assert.equal(f.view.get('guide-target'), 'T')
  assert.deepEqual(savedPractice(files).scores, {})
})

test('Play clears partial guided input and its pending submission before starting the target', t => {
  const files = learner('teach', false, { showHint: true })
  let pending
  const f = open(files, () => { pending = undefined })
  t.after(() => f.session.dispose())
  f.session.input('symbol', '.')
  pending = () => f.session.input('sequence', '.')
  assert.equal(f.view.get('helper-hits'), '.')
  f.set({ 'warm-token': '1' })
  assert.equal(f.view.get('helper-hits'), '')
  pending?.()
  assert.equal(pending, undefined, 'the host must cancel the pending letter')
  assert.deepEqual(f.plays.map(p => p.durations), [[100]])
  assert.deepEqual(savedGuide(files).progress.teachCounts, { E: 1 })
})

test('Play on the qualifying Teach success holds the displayed target and the earned gate survives restart', t => {
  const files = learner('teach', false)
  const f = open(files)
  t.after(() => f.session.dispose())
  for (const symbol of ['.', '-']) {
    f.session.input('symbol', symbol)
    f.session.input('sequence', symbol)
    f.settleFeedback()
  }
  f.session.input('symbol', '-')
  f.session.input('sequence', '-')
  const stale = f.feedbackTimer()
  const earned = files.get('dit.exact-spike.guided.v1')
  assert.equal(f.view.get('guide-phase'), 'teach')
  f.set({ 'warm-token': '1' })
  assert.deepEqual(f.plays.at(-1)?.durations, [300], 'Play still belongs to the visible T')
  f.session.timer(stale)
  assert.equal(f.view.get('guide-phase'), 'teach')
  assert.equal(f.view.get('guide-target'), 'T')
  assert.equal(files.get('dit.exact-spike.guided.v1'), earned)
  f.session.input('symbol', '-')
  f.session.input('sequence', '-')
  f.settleFeedback()
  assert.equal(f.view.get('guide-phase'), 'gate-practice')
  const after = savedGuide(files)
  assert.deepEqual(after.progress.teachCounts, { E: 2, T: 3 })
  const restored = open(files)
  t.after(() => restored.session.dispose())
  assert.equal(restored.view.get('guide-phase'), 'gate-practice')
  assert.equal(restored.session.configuration().enabled, false)
  assert.equal(restored.plays.length, 0)
})

test('retrying a qualifying mixed Practice answer grades only the visible character and opens Listen once', t => {
  const files = learner('practice', false, { guidedProgress: {
    teachCounts: { E: 2, T: 2 }, practiceAttempts: 9, practiceCorrect: 9, practiceLetterCorrect: { E: 4, T: 5 },
    listenAttempts: 0, listenCorrect: 0, listenLetterCorrect: {},
  } })
  const f = open(files)
  t.after(() => f.session.dispose())
  const target = f.view.get('guide-target')
  const symbol = symbolFor(target)
  const wrong = symbol === '.' ? '-' : '.'
  const submit = code => { f.session.input('symbol', code); f.session.input('sequence', code) }
  submit(symbol)
  const stale = f.feedbackTimer()
  f.set({ 'warm-token': '1' })
  f.session.timer(stale)
  f.set({ 'guide-token': '1' })
  assert.equal(f.view.get('guide-phase'), 'practice', 'Continue cannot open a gate before it is presented')
  submit(wrong)
  f.settleFeedback()
  assert.equal(f.view.get('guide-target'), target)
  assert.equal(f.view.get('guide-phase'), 'practice')
  submit(symbol)
  f.settleFeedback()
  assert.equal(f.view.get('guide-phase'), 'gate-listen')
  const progress = savedGuide(files).progress
  assert.equal(progress.practiceAttempts, 12)
  assert.equal(progress.practiceCorrect, 11)
  assert.deepEqual(savedPractice(files).scores, { [target]: 1 })
  f.set({ 'guide-token': '2' })
  assert.equal(f.view.get('guide-phase'), 'listen')
  assert.equal(f.plays.filter(p => p.prompt > 0).length, 1)
  assert.equal(savedGuide(files).progress.listenAttempts, 0)
})
