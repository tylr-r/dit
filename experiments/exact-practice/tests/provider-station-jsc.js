// Load after assets/dit-apple-session.js in the macOS JavaScriptCore shell.
async function verifyPackagedStation() {
  function check(condition, message) { if (!condition) throw Error(message) }
  let attempt = 0
  const histories = []
  const factory = DitSession.createProviderStationFactory(options => {
    check(options.model === 'gemini-3.5-flash-lite', 'unexpected model')
    check(options.systemInstruction.includes('GA'), 'missing afternoon greeting')
    return {startChat({history}) {
      histories.push(history)
      return {
        sendMessage(text) {
          check(text === 'CQ', 'unexpected synthetic turn')
          attempt++
          return {response:{text() {
            if (attempt === 1) throw Error('synthetic blocked response')
            return '  RST 599 K  '
          }}}
        },
        getHistory() {
          if (attempt === 2) throw Error('synthetic history failure')
          return [{role:'user',parts:[{text:'CQ'}]}, {role:'model',parts:[{text:'  RST 599 K  '}]}]
        },
      }
    }}
  })
  const station = await factory({callsign:'W3ABC',localHour:13})
  for (let i = 0; i < 2; i++) {
    let failure
    try { await station.send({outgoing:'CQ',history:[]}) } catch (error) { failure=error }
    check(failure?.message === 'Could not reach the other station. Try again.', 'unsafe failure message')
  }
  const result = await station.send({outgoing:'CQ',history:[]})
  check(result.text === 'RST 5NN K', 'incorrect Morse signal report')
  result.accept()
  station.close()
  check(JSON.stringify(histories) === '[[],[],[]]', 'unaccepted response in retry history')
  const unavailable = DitSession.createProviderStationFactory(() => { throw Error('synthetic initialization failure') })
  let openError
  try { await unavailable({callsign:'W3ABC'}) } catch (error) { openError=error }
  check(openError?.message === 'Could not start the QSO. Try again.', 'unsafe opening error')
}
let complete = false
let failure
verifyPackagedStation().then(() => { complete=true }, error => { failure=error })
drainMicrotasks()
if (failure) throw failure
if (!complete) throw Error('unsettled packaged station')
print('PASS packaged macOS JavaScriptCore station: blocked reply, history failure, cut numbers, retry and opening failure')
