// Run from experiments/exact-practice with DIT_SOURCE_DIST pointing to a local Vite build.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { chromium } from '/Users/tylr/Code/exact-spike-toolchain/node_modules/playwright-core/index.mjs'
import { pathToFileURL } from 'node:url'

const { seedReturning } = await import(pathToFileURL(resolve('tools/seed-returning.mjs')))
const output = resolve(process.env.DIT_EVIDENCE || '.exact/learning-comparison')
const sourceRoot = resolve(process.env.DIT_SOURCE_DIST)
const exactRoot = resolve(process.env.DIT_EXACT_DIST || 'target/audio-check-dist')
const phase = process.argv.includes('--before') ? 'before' : 'after'
const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const origin = 'http://127.0.0.1:18371'
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.json': 'application/json', '.svg': 'image/svg+xml' }

async function capture(browser, implementation, viewport) {
  const shipped = implementation === 'dit'
  const root = shipped ? sourceRoot : exactRoot
  const context = await browser.newContext({ viewport, colorScheme: 'dark', reducedMotion: 'reduce', serviceWorkers: 'block' })
  const page = await context.newPage()
  const blocked = []
  page.on('pageerror', e => console.error(implementation, e.message))
  try {
    page.setDefaultTimeout(8500)
    await page.route('**/*', async route => {
      const req = route.request()
      const url = new URL(req.url())
      if (url.origin !== origin || req.method() !== 'GET') {
        blocked.push(url.hostname)
        return route.abort()
      }
      const path = url.pathname === '/app' ? (shipped ? '/index.html' : '/shell.html') : url.pathname
      const file = resolve(root, '.' + path)
      if (!file.startsWith(root + sep)) return route.abort()
      try { return await route.fulfill({ body: await readFile(file), contentType: types[extname(file)] }) }
      catch { return route.fulfill({ status: 404 }) }
    })
    const progress = { scores:{E:5,T:2}, letterAccuracy:{E:{recent:Array(10).fill(true)},T:{recent:[true]}} }
    if (shipped) await page.addInitScript(data => {
      localStorage.setItem('dit-nux-status', 'completed')
      localStorage.setItem('dit-progress', JSON.stringify(data))
    }, progress)
    else {
      await seedReturning(page, {legacyPractice:false})
      await page.addInitScript(data => localStorage.setItem('dit.exact-spike.practice.v1', JSON.stringify({ version:1, settings:{}, history:[], ...data })), progress)
    }
    await page.goto(origin + '/app')
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByRole('button', { name: /Learning method/i }).click()
    await page.getByRole('tab', { name: 'Course', exact: true }).click()
    const sheet = page.getByRole('dialog')
    const rows = shipped ? sheet.locator('.learning-row') : sheet.locator('[data-testid^="course-pack-"]')
    assert.equal(await rows.count(), 14)
    await page.mouse.move(0, 0)
    await page.waitForTimeout(250)
    const rect = el => {
      const { x, y, width, height } = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      return { x, y, width, height, radius: style.borderRadius, background: style.backgroundColor, border: style.borderColor }
    }
    const data = {
      implementation, viewport, modal: await sheet.evaluate(rect),
      tab: await page.getByRole('tab', {name:'Course'}).evaluate(rect), row: await rows.first().evaluate(rect),
      firstName: await rows.first().innerText(), blockedHostnames: [...new Set(blocked)]
    }
    await page.screenshot({ path: resolve(output, implementation + '-' + phase + '-' + viewport.width + '.png') })
    await rows.last().scrollIntoViewIfNeeded()
    const afterScroll = await page.getByRole('tab', {name:'Course'}).evaluate(rect)
    data.tabMotionOnScroll = Math.round(afterScroll.y - data.tab.y)
    if (!shipped && phase === 'after') {
      assert.ok(Math.abs(data.tabMotionOnScroll) <= 1, JSON.stringify(data))
      assert.equal(await sheet.getAttribute('aria-label'), 'Learning method')
      assert.equal(await rows.first().getAttribute('aria-current'), 'step')
      assert.ok(data.row.radius === '14px')
    }
    if (!shipped && phase === 'after') {
      const tab = page.getByRole('tab', {name:'Course', exact:true})
      await tab.focus()
      await page.keyboard.press('End')
      const openTab = page.getByRole('tab', {name:'Open practice', exact:true})
      assert.equal(await openTab.getAttribute('aria-selected'), 'true')
      assert.equal(await openTab.evaluate(el => el === document.activeElement), true)
      await page.getByTestId('scope-custom').click()
      assert.equal(await page.getByTestId('scope-back').evaluate(el => el === document.activeElement), true)
      await page.keyboard.press('Enter')
      assert.equal(await page.getByTestId('scope-custom').evaluate(el => el === document.activeElement), true)
      await openTab.focus()
      await page.keyboard.press('Home')
      assert.equal(await tab.getAttribute('aria-selected'), 'true')
      await page.keyboard.press('Escape')
      assert.equal(await page.getByRole('button', {name:'Settings', exact:true}).evaluate(el => el === document.activeElement), true)
    } else {
      await sheet.getByRole('button', {name:shipped ? 'Close' : 'Cancel', exact:true}).click()
    }
    if (phase === 'after' && viewport.width === 390) {
      await page.getByRole('button', {name:shipped ? 'Open reference chart' : 'Open progress', exact:true}).click()
      const t = page.getByRole('button', {name:'Play Morse for T', exact:true})
      await t.hover()
      await page.waitForTimeout(250)
      if (shipped) assert.equal(await t.locator('.reference-tile-pattern').evaluate(el => getComputedStyle(el).opacity), '1')
      else assert.equal(await t.innerText(), '—')
      await page.screenshot({path:resolve(output, implementation + '-reference-hover-T.png')})
    }
    if (!shipped && phase === 'after' && viewport.width === 390) {
      await page.keyboard.press('Escape')
      await page.setViewportSize({width:320, height:568})
      await page.evaluate(() => document.documentElement.style.setProperty('font-size', '53px', 'important'))
      await page.getByRole('button', {name:'Settings', exact:true}).click()
      await page.getByTestId('scope-open').click()
      await page.getByRole('tab', {name:'Course', exact:true}).click()
      await page.getByTestId('course-pack-14').scrollIntoViewIfNeeded()
      const last = page.getByTestId('course-pack-14')
      assert.ok(await last.evaluate(el => {
        const box = el.getBoundingClientRect()
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
        return el.contains(hit)
      }), 'Pack 14 cannot be reached at 320×568 and 53px root text')
      await page.screenshot({path:resolve(output, 'exact-course-largest-320.png')})
      await last.click()
      await page.getByTestId('guided-phase').waitFor()
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('dit.exact-spike.guided.v1')).data.pack),13)
    }

    return data
  } finally { await context.close() }
}

await mkdir(output, { recursive: true })
const browser = await chromium.launch({ executablePath: chrome, headless: true })
try {
  const results = []
  for (const viewport of [{ width:390, height:844 }, { width:1280, height:900 }]) {
    const dit = await capture(browser, 'dit', viewport)
    const exact = await capture(browser, 'exact', viewport)
    results.push(dit, exact)
    if (phase === 'after') {
      for (const key of ['x','y','width','height']) assert.ok(Math.abs(dit.modal[key] - exact.modal[key]) <= 1, 'sheet ' + key)
      for (const key of ['x','width','height']) assert.ok(Math.abs(dit.row[key] - exact.row[key]) <= 1, 'row ' + key)
      assert.ok(Math.abs(dit.row.y - exact.row.y) <= 4, 'first row vertical offset: Dit ' + dit.row.y + ', Exact ' + exact.row.y)
    }
  }
  await writeFile(resolve(output, 'geometry-' + phase + '.json'), JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results, null, 2))
} finally { await browser.close() }
