import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from '/Users/tylr/Code/exact-spike-toolchain/node_modules/playwright-core/index.mjs'
const { createBuildServer } = await import(pathToFileURL(resolve('tools/serve-build.mjs')))
const { seedReturning } = await import(pathToFileURL(resolve('tools/seed-returning.mjs')))

const output = resolve(process.env.DIT_EVIDENCE || '.exact/learning-comparison')
await mkdir(output, { recursive: true })
const server = await createBuildServer(resolve(process.env.DIT_EXACT_DIST || 'target/audio-check-dist'))
let browser
try {
  await new Promise((ready, reject) => server.once('error', reject).listen(0, '127.0.0.1', ready))
  const origin = 'http://127.0.0.1:' + server.address().port
  browser = await chromium.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
  const results = []
  for (const touch of [true, false]) {
    const context = await browser.newContext({ viewport:{ width:390, height:844 }, hasTouch:touch, isMobile:touch, reducedMotion:touch ? 'reduce' : 'no-preference', serviceWorkers:'block' })
    try {
      const page = await context.newPage()
      const reqErrors = []
      const errors = []
      page.on('pageerror', e => errors.push(e.message))
      page.setDefaultTimeout(4500)
      await page.route('**/*', route => {
        const req = route.request()
        if (new URL(req.url()).origin === origin && req.method() === 'GET') return route.continue()
        reqErrors.push(req.method() + ' ' + new URL(req.url()).hostname)
        return route.abort()
      })
      await seedReturning(page, { legacyPractice:false })
      await page.addInitScript(() => {
        const key = 'dit.exact-spike.practice.v1'
        if (!localStorage.getItem(key)) {
          localStorage.setItem(key, JSON.stringify({ version:1, settings:{}, scores:{E:5,T:2},
            history:[], letterAccuracy:{E:{recent:Array(10).fill(true)},T:{recent:[true]}} }))
          localStorage.setItem('dit-progress', 'synthetic-production-sentinel')
        }
        window.plays = []
        document.addEventListener('dit-key-event', e => {
          if (e.detail.startsWith('reference-audio:')) window.plays.push(e.detail.split(':')[1])
        })
      })
      await page.goto(origin + '/app?dit-key-trace=1')
      const open = () => page.getByRole('button', { name:'Open progress', exact:true }).click()
      await open()
      const id = n => page.getByTestId(n)
      const tile = letter => id('ref-char-' + letter)
      const snapshot = () => page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()))
      const before = await snapshot()
      const plays = () => page.evaluate(() => window.plays)
      const session = await context.newCDPSession(page)
      async function point(letter) {
        await tile(letter).scrollIntoViewIfNeeded()
        const box = await tile(letter).boundingBox()
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
      }
      const send = (type, point) => session.send('Input.dispatchTouchEvent', { type, touchPoints:point ? [point] : [] })
      const waitText = (letter, text) => page.waitForFunction(([letter, text]) => document.querySelector('[data-testid="ref-char-' + letter + '"]')?.textContent.trim() === text, [letter, text])
      if (touch) {
        const e = await point('E')
        await send('touchStart', e)
        await page.waitForTimeout(140)
        assert.equal(await tile('E').innerText(), 'E')
        await waitText('E', '•')
        await page.screenshot({ path:resolve(output, 'exact-touch-hold-E.png') })
        await send('touchEnd')
        await waitText('E', 'E')
        await page.waitForTimeout(100)
        assert.deepEqual(await plays(), [], 'release after eligible hold played')
        await tile('E').tap()
        await page.waitForFunction(() => window.plays.length === 1)
        const z = await point('Z')
        await send('touchStart', z)
        await page.waitForTimeout(450)
        assert.equal(await tile('Z').innerText(), 'Z')
        await send('touchEnd')
        await page.waitForTimeout(80)
        assert.deepEqual(await plays(), ['E'], 'ineligible hold played')
        const t = await point('T')
        await send('touchStart', t)
        await send('touchCancel')
        await page.waitForTimeout(440)
        assert.equal(await tile('T').innerText(), 'T')
        assert.deepEqual(await plays(), ['E'])
        await send('touchStart', t)
        await send('touchMove', {x:t.x, y:t.y+100})
        await page.waitForTimeout(420)
        await send('touchEnd')
        assert.equal(await tile('T').innerText(), 'T')
        assert.deepEqual(await plays(), ['E'])
        await tile('T').tap()
        await page.waitForFunction(() => window.plays.length === 2)
        assert.deepEqual(await plays(), ['E','T'])
      } else {
        await tile('T').hover()
        await waitText('T', '—')
        assert.deepEqual(await plays(), [])
        const initial = await tile('T').boundingBox()
        await page.mouse.down()
        await page.waitForTimeout(400)
        const pressed = await tile('T').boundingBox()
        assert.ok(pressed.width < initial.width, 'missing press compression')
        await page.mouse.up()
        await tile('Z').hover()
        await waitText('T', 'T')
        assert.equal(await tile('Z').innerText(), 'Z')
        assert.deepEqual(await plays(), [])
        await tile('E').focus()
        await page.keyboard.press('Enter')
        await page.keyboard.press('Space')
        await page.waitForFunction(() => window.plays.length === 2)
        assert.deepEqual(await plays(), ['E','E'])
        await id('ref-show-pattern').click()
        assert.equal(await id('ref-pattern').innerText(), '.')
        assert.equal(await page.getByRole('img', {name:'E, dit', exact:true}).count(), 1)
        await tile('T').hover()
        await waitText('T', '—')
        await page.keyboard.press('Escape')
        await open()
        assert.equal(await tile('T').innerText(), 'T')
        assert.equal(await id('ref-pattern').count(), 0)
      }
      assert.equal(await tile('E').getAttribute('aria-label'), 'Play Morse for E')
      assert.equal(await snapshot(), before)
      assert.deepEqual(errors, [])
      assert.deepEqual(reqErrors, [])
      results.push({ input:touch ? 'emulated touch' : 'mouse and keyboard', plays:await plays(), storageUnchanged:true })
    } finally { await context.close() }
  }
  await writeFile(resolve(output, 'reference-gestures.json'), JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results))
} finally {
  if (browser) await browser.close()
  await new Promise(done => server.close(done))
}
