import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { createWords, wordPlan, wordEligibility } from '../modules/web/words.mjs'
const fake = () => {
  const events = []
  const jobs = []
  const words = createWords({
    random:()=>0,
    project:s=>events.push(s),
    play:(phrase, done, fail)=>{ jobs.push({phrase,done,fail}) },
    stop:()=>{},
  })
  return { words, events, jobs }
}
test('the current pool admits four common words but rejects Q codes until explicitly expanded', () => {
  assert.equal(wordEligibility('common', false) >= 4,true)
  assert.equal(wordEligibility('q-codes', false),0)
  assert.equal(wordEligibility('q-codes', true) >= 4,true)
})
test('silent ready and actual-completion gate: no options or grading before audio ends', () => {
  const {words,events,jobs} = fake()
  words.enter()
  assert.equal(jobs.length,0)
  assert.equal(words.start(),true)
  assert.equal(words.answer(1),false)
  assert.equal(words.next(),false)
  assert.equal(events.some(s=>s.startsWith('word-options:') && s !== 'word-options:'),false)
  jobs[0].done()
  assert.equal(events.filter(s=>s.startsWith('word-options:')).at(-1).slice(13).split(',').length,4)
  assert.equal(words.answer(1),true)
  assert.equal(words.answer(2),false)
  assert.equal(words.next(),true)
  assert.notEqual(jobs[0].phrase.id,jobs[1].phrase.id)
})
test('replay conceals answered round and then restores its unchanged feedback and counts', () => {
  const {words,events,jobs} = fake()
  words.enter()
  words.start()
  jobs[0].done()
  words.answer(1)
  const prior=events.filter(s=>s.startsWith('word-feedback:')).at(-1)
  words.replay()
  assert.equal(jobs[0].phrase.id,jobs[1].phrase.id)
  assert.equal(events.filter(s=>s.startsWith('word-feedback:')).at(-1),'word-feedback:')
  assert.equal(words.next(),false)
  jobs[0].done()
  assert.equal(events.filter(s=>s.startsWith('word-feedback:')).at(-1),'word-feedback:')
  jobs[1].done()
  assert.equal(events.filter(s=>s.startsWith('word-feedback:')).at(-1),prior)
  assert.equal(events.filter(s=>s.startsWith('word-count:')).at(-1).split('/').at(-1),'1')
})
test('switching Q codes cancels stale completion, preserves attempts, and reveals definitions only after grading', () => {
  const {words,events,jobs} = fake()
  words.enter()
  words.start()
  words.vocabulary('q-codes')
  jobs[0].done()
  assert.equal(words.start(),false)
  words.pool(true)
  words.start()
  assert.equal(events.filter(s=>s.startsWith('word-meaning:')).at(-1),'word-meaning:')
  jobs[1].done()
  assert.equal(events.filter(s=>s.startsWith('word-meaning:')).at(-1),'word-meaning:')
  words.answer(1)
  assert.ok(events.filter(s=>s.startsWith('word-meaning:')).at(-1).length > 13)
  assert.match(jobs[1].phrase.text,/^Q[A-Z]{2}$/)
})
test('phrase playback honors one-unit intra-character rhythm and Farnsworth spacing', () => {
  assert.deepEqual(wordPlan('ET',12,12),[[0,100],[400,700]])
  assert.deepEqual(wordPlan('ET',12,8),[[0,100],[796,1096]])
})


test('natural completion is one-shot; audio failure never reveals and Replay can recover', () => {
  const {words,events,jobs} = fake()
  words.enter()
  words.start()
  jobs[0].fail()
  assert.equal(events.filter(s=>s.startsWith('word-phase:')).at(-1),'word-phase:audio-error')
  assert.equal(words.answer(1),false)
  jobs[0].done()
  assert.equal(words.answer(1),false)
  words.replay()
  jobs[1].done()
  const count=events.length
  jobs[1].fail()
  jobs[1].done()
  assert.equal(events.length,count)
  assert.equal(words.answer(1),true)
  assert.notEqual(events.filter(s=>s.startsWith('word-correct:')).at(-1),'word-correct:')
  assert.equal(events.filter(s=>s.startsWith('word-picked:')).at(-1),'word-picked:1')
  words.replay()
  assert.equal(events.filter(s=>s.startsWith('word-correct:')).at(-1),'word-correct:')
  jobs[2].done()
  assert.equal(events.filter(s=>s.startsWith('word-picked:')).at(-1),'word-picked:1')
})

test('generated banks/rounds and Farnsworth timing match actual shipped source',async () => {
  const bun='/Users/tylr/Code/exact-spike-toolchain/.spike-tools/bun-darwin-aarch64/bun'
  const source='/Users/tylr/Code/dit/packages/core/src'
  const serialized=execFileSync(bun,['-e',`
    import {LISTEN_WORD_BANKS as b} from '${source}/data/listenPhrases.ts';
    import {createListenPhraseRound as draw} from '${source}/utils/listenPhrases.ts';
    import {getListenTiming as timing} from '${source}/utils/listenWave.ts';
    const rounds=[0,0.27,0.99].map(roll=>draw(b['q-codes'],{previousTargetId:b['q-codes'][0].id,random:()=>roll}));
    console.log(JSON.stringify({banks:b,rounds,timings:[[12,8],[20,16],[30,30]].map(([a,c])=>timing(a,c,40))}));
  `],{encoding:'utf8'})
  const truth=JSON.parse(serialized)
  const {LISTEN_WORD_BANKS:b}=await import('../modules/web/word-bank.generated.mjs')
  const {createListenPhraseRound:draw}=await import('../modules/web/word-round.generated.mjs')
  assert.deepEqual(b,truth.banks)
  assert.deepEqual([0,0.27,0.99].map(roll=>draw(b['q-codes'],{previousTargetId:b['q-codes'][0].id,random:()=>roll})),truth.rounds)
  for (const [i,[speed,effective]] of [[12,8],[20,16],[30,30]].entries()) {
    const {unitMs,interCharacterGapMs}=truth.timings[i]
    assert.deepEqual(wordPlan('ET',speed,effective),[[0,unitMs],[unitMs+interCharacterGapMs,4*unitMs+interCharacterGapMs]])
  }
})
