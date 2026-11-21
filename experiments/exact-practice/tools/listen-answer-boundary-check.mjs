import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { chromium } from '/Users/tylr/Code/exact-spike-toolchain/node_modules/playwright-core/index.mjs'
import { createBuildServer } from './serve-build.mjs'
import { seedReturning } from './seed-returning.mjs'

const server = await createBuildServer(resolve(import.meta.dirname,'../target/audio-check-dist'))
await new Promise(done => server.listen(0,'127.0.0.1',done))
let browser
try {
  browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true})
  const page = await browser.newPage()
  await seedReturning(page)
  const base = 'http://127.0.0.1:' + server.address().port
  await page.route('**/*', r => new URL(r.request().url()).origin === base ? r.continue() : r.abort())
  // A blank local document lets the fixture deliver coalesced host props to the
  // real built module without a second mounted instrument or store writer.
  await page.route(base + '/fixture', r => r.fulfill({contentType:'text/html',body:'<button>Start</button>'}))
  await page.goto(base + '/fixture')
  await page.getByRole('button').click()
  const result = await page.evaluate(async () => {
    const {create,setProps,destroy} = await import('/modules/index.js')
    const el = document.createElement('div')
    document.body.append(el)
    const events = []
    const props = {mode:'practice','listen-content':'characters','answer-token':'0','warm-token':'0','pref-token':'0'}
    const handle = create('dit-key',el,JSON.stringify(props),(_, value) => events.push(value))
    const apply = patch => setProps(handle,JSON.stringify(Object.assign(props,patch)))
    const latest = prefix => events.filter(e => e.startsWith(prefix)).at(-1)?.slice(prefix.length)
    const metrics = () => JSON.parse(localStorage.getItem('dit.exact-spike.practice.v1')).listenTtr ?? {}
    try {
      apply({'pref-token':'1','pref-command':'scope-custom:E'})
      apply({mode:'listen'})
      await new Promise(r => setTimeout(r,150))
      const first = latest('listen-prompt:')
      apply({'warm-token':'1','answer-token':'1','answer-value':'E','answer-prompt':first ?? '1'})
      const replay = latest('listen-prompt:')
      const coalesced = metrics()
      apply({'answer-token':'2','answer-prompt':first ?? '1'})
      const late = metrics()
      const phase = latest('listen-phase:')
      const bars = latest('ref-ttr-bars:')
      apply({'answer-token':'3','answer-prompt':replay ?? '2'})
      return {first,replay,coalesced,late,phase,bars,valid:metrics()}
    } finally { destroy(handle) }
  })
  console.log(JSON.stringify(result))
  assert.deepEqual(result.coalesced,{},'stale answer coalesced with replay wrote a recognition sample')
  assert.deepEqual(result.late,{})
  assert.equal(result.phase,'answering')
  assert.equal(result.bars,'')
  assert.ok(result.first && result.replay && result.first !== result.replay)
  assert.equal(result.valid.E?.samples,1)
} finally {
  await browser?.close()
  await new Promise(done => server.close(done))
}
