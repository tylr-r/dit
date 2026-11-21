import assert from 'node:assert/strict'
import test from 'node:test'
import { wordPlan } from '../modules/web/words.mjs'
import { tempoTiming } from '../modules/web/tempo.mjs'
import { create } from '../core/apple-session.mjs'

function launch(files = new Map()) {
  const view = {}, timers = new Map(), tones = []
  let tail = -1
  let audio = true
  const host = {
    project(message) {
      const split = message.indexOf(':')
      view[message.slice(0,split)] = message.slice(split+1)
    },
    read:key => files.has(key) ? ['ok', files.get(key)] : ['missing'],
    write(key,value) { files.set(key,value); return true },
    schedule(id,ms) { timers.set(id,ms) }, cancelTimer(id) { timers.delete(id) },
    play(plan,pitch,id) { tones.push({plan,pitch,id}); tail = -1; return audio },
    promptTailMs(id) { return id === tones.at(-1)?.id ? tail : -1 },
    stop() {}, cancelInput() {}, warm() {}, syncReminder() {}, outputVolume:() => 1,
  }
  const session = create(host)
  let props = {mode:'boot','listen-content':'characters',blocked:'false'}
  const set = patch => { props = {...props,...patch}; session.setProps(props) }
  const command = (channel,value) => set({[channel+'-command']:value,[channel+'-token']:String(Number(props[channel+'-token'] || 0)+1)})
  const poll = () => {
    const entry = [...timers].find(([,ms]) => ms === 40)
    assert.ok(entry, 'expected Apple playback completion poll')
    timers.delete(entry[0])
    session.timer(entry[0])
  }
  set({})
  session.bootstrap()
  return {view, tones, files, session, command, set, poll, timers, audio(enabled) { audio = enabled }, present(ms) { tail = ms }}
}

test('Apple Listen Words starts a quiet eligible round and reveals choices only after its last rendered tone', () => {
  const f = launch()
  f.set({mode:'nux'})
  f.command('nux','skip')
  f.set({mode:'practice'})
  f.command('pref','scope-tier:4')
  f.set({mode:'listen'})
  f.set({'listen-content':'words','listen-choice-token':'1'})
  const before = f.tones.length
  assert.equal(f.view['word-ready'],'1','Apple did not enable Start for the full alphabet')
  assert.equal(f.view['word-phase'],'ready')
  f.command('word','start')
  assert.equal(f.tones.length, before + 1)
  assert.ok(f.tones.at(-1).id > 0)
  assert.equal(f.tones.at(-1).pitch,600)
  assert.equal(f.view['word-phase'],'playing')
  f.poll()
  assert.equal(f.view['word-options'],'')
  f.command('word','option-1')
  f.command('word','replay')
  assert.equal(f.tones.length,before+1)
  assert.equal(f.view['word-count'],'0/0')
  f.present(695)
  f.poll()
  assert.equal(f.view['word-options'],'','the trailing Farnsworth gap is still playing')
  f.present(696)
  f.poll()
  assert.equal(f.view['word-phase'],'choosing')
  assert.equal(new Set(f.view['word-options'].split(',')).size,4)
  f.session.dispose()
})

const preferenceKey = 'dit.exact-spike.listen.v1'
function returning(preferences, files = new Map()) {
  files.set('dit.exact-spike.onboarding.v1',JSON.stringify({version:1,status:'skipped',step:'welcome',profile:null,soundComplete:false,taps:0,holds:0}))
  if (preferences) files.set(preferenceKey,JSON.stringify(preferences))
  const f = launch(files)
  f.set({mode:'practice'})
  return f
}

test('correct and missed Words answers affect this app session only, including replays and mode changes', () => {
  const f = returning({version:1,content:'words',vocabulary:'q-codes'})
  f.command('pref','scope-tier:4')
  const saved = [...f.files.entries()]
  const before = f.tones.length
  f.set({mode:'listen'})
  assert.equal(f.tones.length,before,'saved Words must suppress Characters autoplay')
  let previous = ''
  for (const [correct, expected] of [[true,'1/1'], [false,'1/2']]) {
    f.command('word',previous ? 'next' : 'start')
    f.present(696)
    f.poll()
    const options = f.view['word-options'].split(',')
    const audio = f.tones.at(-1)
    const target = options.find(option => JSON.stringify(wordPlan(option,12,8)) === JSON.stringify(audio.plan))
    assert.ok(target && target !== previous)
    previous = target
    const chosen = correct ? options.indexOf(target) : options.findIndex(option => option !== target)
    f.command('word','option-' + (chosen+1))
    assert.equal(f.view['word-target'],target)
    assert.equal(f.view['word-count'],expected)
    assert.equal(f.view['word-feedback'],correct ? 'Correct' : 'Incorrect: ' + target)
    assert.ok(f.view['word-meaning'])
    f.command('word','option-1')
    f.command('word','replay')
    assert.equal(f.view['word-target'],'')
    assert.equal(f.view['word-options'],'')
    assert.equal(f.view['word-meaning'],'')
    assert.deepEqual(f.tones.at(-1).plan,audio.plan)
    f.present(696)
    f.poll()
    assert.equal(f.view['word-phase'],'answered')
    assert.deepEqual(f.view['word-options'].split(','),options)
    assert.equal(f.view['word-count'],expected)
  }
  f.set({mode:'freestyle'})
  f.set({mode:'listen'})
  assert.equal(f.view['word-count'],'1/2')
  assert.equal(f.view['word-phase'],'ready')
  assert.deepEqual([...f.files.entries()],saved,'Words must leave learner progress untouched')
  f.session.dispose()
})

test('active scope, course and interruption gate Words, retain preferences, and cancel callbacks', () => {
  const pref = {version:1,content:'words',vocabulary:'q-codes'}
  const f = returning(pref)
  f.command('pref','scope-custom:TENRA')
  f.set({mode:'listen'})
  assert.equal(f.view['words-available'],'1')
  assert.equal(f.view['word-ready'],'0')
  const before = f.tones.length
  f.command('word','all')
  f.command('word','start')
  assert.equal(f.tones.length,before)
  f.command('pref','scope-custom:E')
  assert.equal(f.view['apple-listen-content'],'characters')
  assert.equal(f.view['words-available'],'0')
  assert.deepEqual(JSON.parse(f.files.get(preferenceKey)),pref)
  f.command('pref','scope-tier:4')
  assert.equal(f.view['apple-listen-content'],'words')
  for (const interrupt of ['sheet','background','route','cancel','vocabulary','content']) {
    f.command('word','start')
    const stale = [...f.timers.keys()]
    assert.equal(f.view['word-phase'],'playing')
    if (interrupt === 'sheet') {
      f.set({blocked:'true'})
      f.command('word','option-1')
      f.set({blocked:'false'})
    } else if (interrupt === 'background') {
      f.session.interrupt(true)
      f.command('word','replay')
      f.session.interrupt(false)
    } else if (interrupt === 'route') f.set({'route-boundary':'2'})
    else if (interrupt === 'cancel') f.set({'cancel-token':'1'})
    else if (interrupt === 'vocabulary') f.command('word','common')
    else {
      f.set({'listen-content':'characters','listen-choice-token':'1'})
      f.set({'listen-content':'words','listen-choice-token':'2'})
    }
    f.present(9999)
    for (const id of stale) f.session.timer(id)
    assert.equal(f.view['word-phase'],'ready')
    assert.equal(f.view['word-options'],'')
    assert.equal(f.view['word-count'],'0/0')
  }
  f.set({mode:'guided'})
  f.set({mode:'listen'})
  assert.equal(f.view['listen-course'],'1')
  assert.equal(f.view['apple-listen-content'],'characters')
  f.session.dispose()
})

test('native audio refusal or stalled render offers Start again without revealing or grading', () => {
  const f = returning({version:1,content:'words',vocabulary:'common'})
  f.set({mode:'listen'})
  f.audio(false)
  f.command('word','start')
  assert.equal(f.view['word-phase'],'audio-error')
  assert.equal(f.view['word-ready'],'1')
  f.audio(true)
  f.command('word','start')
  assert.equal(f.view['word-phase'],'playing')
  const [watchdog] = [...f.timers].find(([,ms]) => ms > 3000)
  f.session.timer(watchdog)
  f.command('word','option-4')
  assert.equal(f.view['word-phase'],'audio-error')
  assert.equal(f.view['word-count'],'0/0')
  assert.equal(f.view['word-options'],'')
  f.command('pref','speed-up')
  f.command('pref','pitch-up')
  f.command('word','start')
  assert.equal(f.tones.at(-1).pitch,620)
  // On an explicit speed change the existing effective WPM stays at 8.
  const {characterGapMs} = tempoTiming(13,8)
  f.present(characterGapMs-1)
  f.poll()
  assert.equal(f.view['word-options'],'')
  f.present(characterGapMs)
  f.poll()
  assert.equal(f.view['word-phase'],'choosing')
  f.session.dispose()
})

test('a future private Listen record stays byte-identical when choosing a vocabulary', () => {
  const f = returning({version:2,content:'words',vocabulary:'q-codes',future:true})
  const future = f.files.get(preferenceKey)
  f.set({mode:'listen'})
  f.set({'listen-content':'words','listen-choice-token':'1'})
  f.command('word','q-codes')
  assert.equal(f.files.get(preferenceKey),future)
  f.session.dispose()
})

test('Apple picker applies characters in shipped MORSE_DATA order, independent of tap order', () => {
  const f=launch()
  f.set({mode:'nux'}); f.command('nux','skip'); f.set({mode:'practice'})
  f.command('pref','scope-custom:Z1A')
  assert.deepEqual(JSON.parse(f.files.get('dit.exact-spike.practice.v1')).settings.selection,{kind:'custom',letters:['1','A','Z']})
  f.session.dispose()
})
