import assert from 'node:assert/strict'
import test from 'node:test'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import * as apple from '../core/apple-session.mjs'
import {createRetryableConversationChat} from '../../../packages/core/src/utils/conversation.ts'
const {create} = apple

const flush = () => new Promise(resolve => setImmediate(resolve))
function deferred() {
  let resolve, reject
  const promise = new Promise((yes,no) => { resolve=yes; reject=no })
  return {promise,resolve,reject}
}

function fixture(open, callsignRandom, createSession=create) {
  const state = {}, audio = [], timers = new Map(), calls = []
  let position = -2
  const session = createSession({
    callsignRandom,
    createStation(options,onCancelOpen) { calls.push(structuredClone(options)); return open(options,onCancelOpen) },
    read: key => key.endsWith('onboarding.v1') ? ['ok','{"version":1,"status":"skipped"}'] : ['missing'],
    write: () => true, schedule:(id,ms) => timers.set(id,ms), cancelTimer:id => timers.delete(id),
    project(event) { const i = event.indexOf(':'); state[event.slice(0,i)] = event.slice(i+1) },
    stop(){}, warm(){}, cancelInput(){}, syncReminder(){}, outputVolume:() => 1, play:() => true,
    passageStart(plan) { audio.push(plan); return true }, passagePosition:() => position, passageControl:() => true,
  })
  let props = {mode:'boot',blocked:'false','qso-token':'0','route-boundary':'1'}
  function set(patch) { props = {...props,...patch}; session.setProps(props) }
  function command(action) { set({'qso-token':String(Number(props['qso-token'])+1),'qso-command':action}) }
  set({}); session.bootstrap(); set({mode:'conversation'})
  return {
    set,command,session,state,calls,audio,
    key:code => session.input('sequence',code),
    receiveDone(result=-2) {
      position = result
      const timer = [...timers].find(([,ms]) => ms===50)
      assert.ok(timer,'a station reply should be playing')
      timers.delete(timer[0]); session.timer(timer[0])
    },
    phase:value => assert.equal(state['qso-phase'],value),
  }
}

test('Swift Send first reports startup failure before any key, and ignores abandoned opens',async () => {
  const openings = [], cancelled = [], sends = []
  const station = apple.createSwiftStationFactory(
    (...args) => { sends.push(args); return 100 },
    id => cancelled.push(id),
    (model,instruction,ready) => { openings.push({model,instruction,ready}); return openings.length },
  )
  const f = fixture(station)
  f.command('send-first'); f.command('consent-cancel')
  assert.equal(openings.length,0)
  f.command('send-first'); f.command('consent-allow'); await flush()
  assert.equal(openings.length,1,'Allow must start the Swift station before any Morse input')
  f.phase('sending'); openings[0].ready(false); await flush()
  f.phase('error'); assert.equal(f.state['qso-error'],'Could not start the QSO. Try again.')
  assert.deepEqual(sends,[]); assert.deepEqual(f.audio,[])
  f.command('retry'); assert.equal(openings.length,2)
  f.command('end'); f.command('new'); f.command('send-first'); f.command('consent-allow')
  assert.deepEqual(cancelled,[2]); openings[1].ready(true); await flush(); f.phase('sending')
  openings[2].ready(true); await flush(); f.phase('tx')
  assert.equal(openings[2].model,'gemini-3.5-flash-lite')
  assert.ok(openings[2].instruction.includes(f.calls.at(-1).callsign))
  assert.deepEqual(sends,[])
  f.session.dispose()
})

test('a fresh station selects a pinned callsign only after consent, including on open retry',async () => {
  // The candidate W9AAZ occurs three times. Only the immediately previous
  // selection is excluded, even when the station failed or was abandoned.
  const draws = [
    ...Array.from({length:3},() => [0.99,0.99,0,0,0.99]).flat(),
    0.4,0,0,0.04,0.08,
    0,0,0,0,0,
    0,0,0,0,0,
  ]
  const late = deferred()
  let attempt = 0, closed = 0
  const f = fixture(() => {
    attempt++
    if (attempt === 1) throw Error('offline')
    if (attempt === 2) return late.promise
    return {send:() => 'R K'}
  },() => { assert.ok(draws.length); return draws.shift() })
  const start = () => { f.command('send-first'); f.command('consent-allow') }
  const next = () => { f.command('end'); f.command('new'); start() }
  f.command('send-first'); f.command('consent-cancel')
  assert.equal(draws.length,30); assert.deepEqual(f.calls,[])
  start(); f.phase('error')
  assert.deepEqual(f.calls,[{callsign:'W9AAZ'}])
  f.command('retry'); f.phase('sending')
  assert.equal(f.state['qso-callsign'],'W9AAA')
  next(); f.phase('tx')
  late.resolve({send() { assert.fail('abandoned send') },close() { closed++ }})
  await flush()
  assert.equal(closed,1); assert.equal(f.state['qso-callsign'],'W9AAZ')
  next(); next(); next()
  assert.deepEqual(f.calls.map(call => call.callsign),['W9AAZ','W9AAA','W9AAZ','N0ABC','K0AAA','K0AAB'])
  assert.equal(draws.length,0)
  assert.equal(f.audio.length,0,'send-first waits for a deliberate turn')
  f.session.dispose()
})

test('packaged receive-first, keyed retry and replay keep the assigned callsign and only accepted history',async () => {
  const source = readFileSync(new URL('../assets/dit-apple-session.js',import.meta.url),'utf8')
  const packaged = runInNewContext(source+'\nDitSession')
  const turns = []
  let draws = 0
  const f = fixture(({callsign}) => ({
    send(turn) {
      turns.push(structuredClone(turn))
      if (turns.length === 2) throw Error('offline')
      return turn.outgoing === null ? 'CQ DE '+callsign+' K' : 'DE '+callsign+' K'
    },
  }),() => { draws++; return 0.5 },packaged.create)
  f.command('receive-first'); f.command('consent-allow'); await flush()
  f.phase('receiving')
  assert.equal(f.state['qso-callsign'],'N5NNN')
  f.set({'qso-copy-value':'UNSENT COPY'})
  f.receiveDone(); f.command('reveal')
  assert.equal(f.state['qso-rx-text'],'CQ DE N5NNN K')
  f.command('start-turn'); f.key('-'); f.command('clear'); f.key('.'); f.command('send')
  await flush(); f.phase('error'); f.command('retry'); await flush(); f.phase('receiving')
  f.receiveDone(); f.command('replay'); f.receiveDone(); f.command('reveal')
  assert.equal(f.state['qso-rx-text'],'DE N5NNN K')
  const reply = {outgoing:'E',history:[{outgoing:null,reply:'CQ DE N5NNN K'}]}
  assert.deepEqual(turns,[{outgoing:null,history:[]},reply,reply])
  assert.deepEqual(f.calls,[{callsign:'N5NNN'}]); assert.equal(draws,5)
  assert.equal(f.audio.length,3); assert.deepEqual(f.audio[1],f.audio[2])
  f.session.dispose()
})

test('Allow opens one station; only deliberate turns and accepted history cross its boundary',async () => {
  const requests = [], responses = ['CQ K', Error('offline'), 'R K', '73 SK']
  let closes = 0
  const f = fixture(() => ({
    async send(payload) {
      requests.push(structuredClone(payload))
      const next = responses.shift()
      if (next instanceof Error) throw next
      return next
    },
    close() { closes++ },
  }))
  f.command('receive-first'); f.command('consent-cancel')
  assert.equal(f.calls.length,0)
  f.command('receive-first'); f.command('consent-allow'); f.command('consent-allow')
  await flush()
  assert.equal(f.calls.length,1,'the consented Apple session must open the injected station')
  assert.deepEqual(Object.keys(f.calls[0]),['callsign'])
  assert.deepEqual(requests,[{outgoing:null,history:[]}])
  f.set({'qso-copy-value':'PRIVATE COPY'}); f.receiveDone(); f.command('start-turn')
  f.key('-'); f.command('clear'); f.key('.')
  assert.equal(requests.length,1)
  f.command('send'); f.command('send'); await flush(); f.phase('error')
  f.command('retry'); f.command('retry'); await flush(); f.phase('receiving')
  const turn = {outgoing:'E',history:[{outgoing:null,reply:'CQ K'}]}
  assert.deepEqual(requests.slice(1),[turn,turn])
  f.receiveDone(-1); f.phase('error'); f.command('retry'); f.phase('receiving')
  assert.equal(requests.length,3,'audio retry must not resend an accepted exchange')
  f.command('end'); f.command('end'); f.command('new')
  assert.equal(closes,1)
  f.command('send-first'); f.command('consent-allow'); f.phase('tx')
  assert.equal(f.calls.length,2)
  assert.notEqual(f.calls[0].callsign,f.calls[1].callsign)
  assert.equal(requests.length,3)
  f.key('-'); f.command('send')
  assert.deepEqual(requests.at(-1),{outgoing:'T',history:[]})
  f.session.dispose(); await flush()
})

test('a late open or reply cannot resurrect a closed contact or overwrite its successor',async () => {
  const opening = deferred(), old = deferred(), current = deferred()
  const closed = [], requests = []
  function station(id, response) {
    return {send(payload) { requests.push([id,payload]); return response.promise }, close() { closed.push(id) }}
  }
  const stations = [opening.promise,station(2,old),station(3,current)]
  const f = fixture(() => stations.shift())
  f.command('receive-first'); f.command('consent-allow')
  assert.equal(f.calls.length,1)
  f.command('end'); f.command('new')
  f.command('receive-first'); f.command('consent-allow')
  opening.resolve(station(1,deferred())); await flush()
  assert.deepEqual(closed,[1])
  f.set({blocked:'true'}); f.phase('ended'); f.set({blocked:'false'})
  f.command('new'); f.command('receive-first'); f.command('consent-allow')
  old.reject(Error('late rejection')); await flush(); f.phase('sending')
  assert.equal(f.audio.length,0)
  current.resolve('CQ K'); current.resolve('DUP'); await flush(); f.phase('receiving')
  assert.equal(f.audio.length,1)
  assert.deepEqual(requests,[[2,{outgoing:null,history:[]}],[3,{outgoing:null,history:[]}]])
  f.session.dispose()
  assert.deepEqual(closed,[1,2,3])
})

test('opening failure retries within consent; background during an audio interruption ends the contact',async () => {
  const response = deferred()
  let attempts = 0, closes = 0
  const f = fixture(() => {
    if (++attempts===1) return Promise.reject(Error('unavailable'))
    return {send:() => response.promise,close() { closes++ }}
  })
  f.command('send-first'); f.command('consent-allow'); await flush()
  assert.equal(attempts,1)
  f.phase('error'); f.command('retry'); await flush(); f.phase('tx')
  f.key('.'); f.command('send'); f.session.interrupt(true)
  f.session.interrupt(true,true); f.phase('ended')
  response.resolve('STALE'); await flush()
  f.session.interrupt(false); f.phase('ended')
  assert.equal(f.audio.length,0)
  assert.equal(closes,1)
  assert.equal(f.state['qso-transcript'],'You: E')
  f.session.dispose()
})

test('temporary focus loss in the consent alert opens no station; background invalidates that approval',() => {
  const f = fixture(() => ({send:() => 'R K'}))
  f.command('send-first'); f.set({blocked:'true'}); f.set({blocked:'false'})
  f.phase('consent'); assert.equal(f.calls.length,0)
  f.command('consent-allow'); f.phase('tx'); assert.equal(f.calls.length,1)
  f.command('end'); f.command('new'); f.command('receive-first')
  f.session.interrupt(true,true); f.session.interrupt(false)
  f.command('consent-allow'); f.phase('idle'); assert.equal(f.calls.length,1)
  f.session.dispose()
})

test('an interrupted request resolving after its retry cannot append or play a second reply',async () => {
  const abandoned=deferred(), retried=deferred(), requests=[]
  const f=fixture(() => ({send(payload) {
    requests.push(structuredClone(payload))
    return [abandoned.promise,retried.promise,'73 SK'][requests.length-1]
  }}))
  f.command('send-first'); f.command('consent-allow')
  f.key('.'); f.command('send'); f.session.interrupt(true); f.session.interrupt(false)
  f.command('retry'); retried.resolve('R K'); await flush()
  f.receiveDone(); f.command('start-turn')
  abandoned.resolve('DUP'); await flush()
  f.phase('tx'); assert.equal(f.audio.length,1)
  f.key('-'); f.command('send')
  assert.deepEqual(requests,[
    {outgoing:'E',history:[]},{outgoing:'E',history:[]},
    {outgoing:'T',history:[{outgoing:'E',reply:'R K'}]},
  ])
  f.session.dispose(); await flush()
})

const kickoff = 'Begin the QSO now. Call CQ or send your opening call as you see fit.'
const userPart = text => ({role:'user',parts:[{text}]})
const modelPart = text => ({role:'model',parts:[{text,thoughtSignature:'fixture-marker'}]})

// A failed send poisons its chat, like the pinned SDK queue. Record only local objects.
function recordingModel(responses) {
  const models = [], chats = [], sends = []
  return {
    models,chats,sends,
    open(options) {
      models.push(options)
      return {startChat({history}) {
        const transcript = structuredClone(history)
        chats.push(structuredClone(transcript))
        let poisoned = false
        return {
          async sendMessage(text) {
            if (poisoned) throw Error('fixture queue rejected')
            sends.push([...structuredClone(transcript),userPart(text)])
            transcript.push(userPart(text))
            try {
              assert.ok(responses.length,'unexpected send')
              const next = await responses.shift()
              if (next instanceof Error) throw next
              transcript.push(modelPart(next))
              return {response:{text:() => next}}
            } catch (error) { poisoned=true; throw error }
          },
          async getHistory() { return structuredClone(transcript) },
        }
      }}
    },
  }
}

function sdkFactory(sdk) {
  assert.equal(typeof apple.createProviderStationFactory,'function','bundled Apple session needs an injectable SDK station factory')
  return apple.createProviderStationFactory(sdk.open)
}

test('provider model receives the complete pinned station instruction and opens silently',async () => {
  const sdk = recordingModel([])
  const factory = sdkFactory(sdk)
  for (const [localHour,digest] of [
    [4,'a6b62e131cc29fa099dc5bdfb260e51a721f2a94e500c3b260eee8529cf7c5ae'],
    [5,'d6cb14a0661d21ac5664ca5c14d2ec1cfeae83e134747507d7c70923e1959828'],
    [12,'7eeb7e8ff7752756f13bceaa363ac9e089d4d24ec4869842996416adf3b0df6e'],
    [17,'bfcda53a126af20083597a283b4cc178be9b7493e1025139cbf4058e3bf80e32'],
    [22,'79dab63d08eb77502e7ff72a25563d2056ef6453d8dd8284184ccd9a262ac950'],
  ]) {
    const station = await factory({callsign:'N2XYZ',localHour})
    const options = sdk.models.at(-1)
    assert.deepEqual(Object.keys(options).sort(),['model','systemInstruction'])
    assert.equal(options.model,'gemini-3.5-flash-lite')
    assert.equal(createHash('sha256').update(options.systemInstruction).digest('hex'),digest)
    station.close()
  }
  assert.deepEqual(sdk.chats,[[],[],[],[],[]])
  assert.deepEqual(sdk.sends,[])
})

test('provider formats a received opener and preserves raw accepted SDK history on keyed retry',async () => {
  const raw = '  UR RST 599 K599X 1599 599 K  '
  const sdk = recordingModel([raw,Error('raw transport detail'),'TU SK'])
  const f = fixture(sdkFactory(sdk))
  f.command('receive-first'); f.command('consent-cancel')
  assert.equal(sdk.models.length,0)
  f.command('receive-first'); f.command('consent-allow'); await flush(); f.phase('receiving')
  f.set({'qso-copy-value':'UNSENT PRIVATE COPY'}); f.receiveDone(); f.command('reveal')
  assert.equal(f.state['qso-rx-text'],'UR RST 5NN K599X 1599 5NN K')
  f.command('start-turn'); f.key('-'); f.command('clear'); f.key('.'); f.command('send')
  await flush(); f.phase('error')
  assert.equal(f.state['qso-error'],'Could not reach the other station. Try again.')
  f.command('retry'); await flush(); f.phase('receiving')
  const accepted = [userPart(kickoff),modelPart(raw)]
  assert.deepEqual(sdk.chats,[[],accepted])
  assert.deepEqual(sdk.sends,[[userPart(kickoff)],[...accepted,userPart('E')],[...accepted,userPart('E')]])
  assert.ok(!JSON.stringify(sdk.models).includes('UNSENT PRIVATE COPY'))

  // Compare the original pure SDK-queue wrapper with the same simulated rejection.
  const original = recordingModel([raw,Error('offline'),'TU SK'])
  const model = original.open({})
  const chat = createRetryableConversationChat(model.startChat({history:[]}),
    history => model.startChat({history}), 'Could not reach the other station. Try again.')
  assert.equal(await chat.send(kickoff),'UR RST 5NN K599X 1599 5NN K')
  await assert.rejects(chat.send('E'),/Could not reach the other station/)
  assert.equal(await chat.send('E'),'TU SK')
  assert.deepEqual(sdk.chats,original.chats)
  assert.deepEqual(sdk.sends,original.sends)
  f.session.dispose()
})

test('blank and rejected provider replies stay silent; a closed provider cannot change the next contact',async () => {
  const abandoned = deferred()
  const sdk = recordingModel(['  ',abandoned.promise, 'CQ K'])
  const f = fixture(sdkFactory(sdk))
  f.command('send-first'); f.command('consent-allow'); await flush()
  assert.equal(sdk.sends.length,0)
  f.key('.'); f.command('send'); await flush(); f.phase('error')
  assert.equal(f.state['qso-error'],'Empty response from the other station')
  assert.equal(f.audio.length,0)
  f.command('retry'); f.command('end'); f.command('new')
  f.command('receive-first'); f.command('consent-allow'); await flush()
  abandoned.resolve('STALE 599'); await flush()
  assert.equal(f.audio.length,1)
  assert.deepEqual(sdk.chats,[[],[],[]])
  assert.deepEqual(sdk.sends,[[userPart('E')],[userPart('E')],[userPart(kickoff)]])
  f.session.dispose()
})

test('stale or unplayable SDK replies never seed a later request',async () => {
  const abandoned = deferred()
  const sdk = recordingModel([abandoned.promise,'☁','R K','TU SK'])
  const f = fixture(sdkFactory(sdk))
  f.command('send-first'); f.command('consent-allow'); await flush()
  f.key('.'); f.command('send')
  f.session.interrupt(true); f.session.interrupt(false); f.command('retry')
  await flush(); f.phase('error'); assert.equal(f.audio.length,0)
  f.command('retry'); await flush(); f.phase('receiving')
  abandoned.resolve('OLD'); await flush()
  assert.equal(f.audio.length,1)
  f.receiveDone(); f.command('start-turn'); f.key('-'); f.command('send'); await flush()
  assert.deepEqual(sdk.chats,[[],[],[]])
  assert.deepEqual(sdk.sends.at(-1),[userPart('E'),modelPart('R K'),userPart('T')])
  f.session.dispose()
})
