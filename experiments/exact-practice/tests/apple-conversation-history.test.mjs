import assert from 'node:assert/strict'
import test from 'node:test'
import {createQso,createLocalStation} from '../modules/web/qso.mjs'

test('Apple reply handoff conceals unchecked reception until manual reveal or keying',async () => {
  let transcript,complete
  const qso=createQso({
    platform:'ios',createStation:createLocalStation,
    project:message=>{if(message.startsWith('qso-transcript:')) transcript=message.slice(15)},
    play:(_text,done)=>{complete=done},stop(){},pause(){},resume(){},setTimer(){},clearTimer(){},
  })
  qso.enter()
  qso.start('receive')
  qso.confirm(true)
  await Promise.resolve()
  complete()
  qso.startTurn()
  assert.match(transcript,/^Hidden:\d+$/)
  const firstID=Number(transcript.slice(7))
  assert.equal(qso.revealTurn(firstID+100),false)
  qso.activity()
  assert.equal(transcript,'Station: CQ K')
  qso.key('.')
  qso.send()
  await Promise.resolve()
  assert.equal(transcript,'Hidden:'+firstID+'\nYou: E')
  assert.equal(qso.revealTurn(firstID),true)
  assert.equal(transcript,'Station: CQ K\nYou: E')
  complete()
  qso.startTurn()
  assert.match(transcript,/^Station: CQ K\nYou: E\nHidden:\d+$/)
  qso.end()
  assert.equal(transcript,'Station: CQ K\nYou: E\nStation: R K')
  qso.new()
  assert.equal(transcript,'')
  assert.equal(qso.revealTurn(firstID),false)
})

test('a long Apple contact keeps the first received turn available to reveal', async () => {
  let history = '', finish
  const contact = createQso({
    platform:'ios',createStation:createLocalStation,
    project(message) { if (message.startsWith('qso-transcript:')) history=message.slice(15) },
    play(_text,done) { finish=done },stop(){},pause(){},resume(){},setTimer(){},clearTimer(){},
  })
  contact.enter()
  contact.start('receive')
  contact.confirm(true)
  await Promise.resolve()
  finish()
  contact.startTurn()
  const first=Number(history.slice('Hidden:'.length))
  for (let i=0;i<24;i++) {
    contact.activity()
    contact.key('.')
    contact.send()
    await Promise.resolve()
    finish()
    contact.startTurn()
  }
  assert.equal(history.split('\n').length,49)
  assert.equal(contact.revealTurn(first),true)
  assert.equal(history.split('\n')[0],'Station: CQ K')
  contact.end()
  contact.new()
  assert.equal(history,'')
})
