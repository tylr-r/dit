import { expect, test, type Page } from '@playwright/test'
import { MORSE_DATA, type Letter } from '@dit/core'

const DOT_PRESS_MS = 80
const DASH_PRESS_MS = 360
const SYMBOL_GAP_MS = 80
const LETTER_GAP_MS = 320

const overrideCoarsePointer = () => {
  const originalMatchMedia = window.matchMedia.bind(window)
  window.matchMedia = (query: string) => {
    if (query === '(pointer: coarse)') {
      return {
        matches: true,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }
    }
    return originalMatchMedia(query)
  }
}

type LocalStorageSeed = {
  listenWpm?: number
}

const seedLocalStorage = ({ listenWpm }: LocalStorageSeed = {}) => {
  window.localStorage.clear()
  window.localStorage.setItem('dit-nux-status', 'completed')
  window.localStorage.setItem('dit-intro-hint-step', 'done')
  if (listenWpm) {
    window.localStorage.setItem('dit-progress', JSON.stringify({ listenWpm }))
  }
}

const sendSymbol = async (page: Page, symbol: '.' | '-') => {
  await page.keyboard.down(' ')
  await page.waitForTimeout(symbol === '.' ? DOT_PRESS_MS : DASH_PRESS_MS)
  await page.keyboard.up(' ')
  await page.waitForTimeout(SYMBOL_GAP_MS)
}

const sendMorse = async (page: Page, code: string) => {
  for (const symbol of code) {
    await sendSymbol(page, symbol as '.' | '-')
  }
  await page.waitForTimeout(LETTER_GAP_MS)
}

const sendVbandSymbol = async (page: Page, code: 'ControlLeft' | 'ControlRight') => {
  await page.keyboard.down(code)
  await page.waitForTimeout(30)
  await page.keyboard.up(code)
  await page.waitForTimeout(code === 'ControlLeft' ? 130 : 330)
}

const gotoApp = async (
  page: Page,
  { coarsePointer = false, listenWpm }: { coarsePointer?: boolean; listenWpm?: number } = {},
) => {
  await page.addInitScript(seedLocalStorage, { listenWpm })
  if (coarsePointer) {
    await page.addInitScript(overrideCoarsePointer)
  }
  await page.goto('/app')
  await page.getByLabel('Tap for dot, hold for dah').waitFor()
}

const selectMode = async (page: Page, mode: 'practice' | 'freestyle' | 'listen') => {
  const shortcut = mode === 'practice' ? 'p' : mode === 'freestyle' ? 'f' : 'l'
  await page.keyboard.press(shortcut)
  await expect(page.locator('.app')).toHaveClass(new RegExp(`mode-${mode}`))
}

const focusMorseButton = async (page: Page) => {
  await page.getByLabel('Tap for dot, hold for dah').focus()
}

const readPracticeLetter = async (page: Page) => {
  const text = await page.locator('main.stage .letter').first().textContent()
  if (!text) {
    throw new Error('Expected a practice letter to be visible.')
  }
  return text.trim() as Letter
}

test('practice mode accepts a correct answer', async ({ page }) => {
  await gotoApp(page)
  await focusMorseButton(page)

  const letter = await readPracticeLetter(page)
  const code = MORSE_DATA[letter].code

  await sendMorse(page, code)

  await expect(page.locator('.status-text')).toHaveText('Correct')
})

test('practice mode flags an incorrect answer', async ({ page }) => {
  await gotoApp(page)
  await focusMorseButton(page)

  const letter = await readPracticeLetter(page)
  const code = MORSE_DATA[letter].code
  const wrongSymbol = code.startsWith('.') ? '-' : '.'

  await sendMorse(page, wrongSymbol)

  await expect(page.locator('.status-text')).toHaveText('Missed. Keep going.')
})

test('freestyle mode decodes morse input', async ({ page }) => {
  await gotoApp(page)

  await selectMode(page, 'freestyle')
  await focusMorseButton(page)

  await sendMorse(page, MORSE_DATA.A.code)

  await expect(page.locator('.freestyle-overlay-letter')).toHaveText('A')
})

test('freestyle mode accepts VBand paddle keyboard input', async ({ page }) => {
  await gotoApp(page)

  await selectMode(page, 'freestyle')

  await sendVbandSymbol(page, 'ControlLeft')
  await sendVbandSymbol(page, 'ControlRight')
  await page.waitForTimeout(LETTER_GAP_MS)

  await expect(page.locator('.freestyle-overlay-letter')).toHaveText('A')
})

test('freestyle mode repeats a held VBand paddle', async ({ page }) => {
  await gotoApp(page)

  await selectMode(page, 'freestyle')

  await page.keyboard.down('ControlLeft')
  await page.waitForTimeout(260)
  await page.keyboard.up('ControlLeft')
  await page.waitForTimeout(LETTER_GAP_MS)

  await expect(page.locator('.freestyle-overlay-letter')).toHaveText('I')
})

test('freestyle VBand paddle repeat follows playback speed', async ({ page }) => {
  await gotoApp(page, { listenWpm: 30 })

  await selectMode(page, 'freestyle')

  await page.keyboard.down('ControlLeft')
  await page.waitForTimeout(130)
  await page.keyboard.up('ControlLeft')
  await page.waitForTimeout(LETTER_GAP_MS)

  await expect(page.locator('.freestyle-overlay-letter')).toHaveText('I')
})

test('freestyle mode switches quickly between VBand paddles', async ({ page }) => {
  await gotoApp(page)

  await selectMode(page, 'freestyle')

  await page.keyboard.down('ControlLeft')
  await page.waitForTimeout(30)
  await page.keyboard.down('ControlRight')
  await page.waitForTimeout(30)
  await page.keyboard.up('ControlLeft')
  await page.waitForTimeout(330)
  await page.keyboard.up('ControlRight')
  await page.waitForTimeout(LETTER_GAP_MS)

  await expect(page.locator('.freestyle-overlay-letter')).toHaveText('A')
})

test('listen mode accepts keyboard answers', async ({ page }) => {
  await gotoApp(page, { coarsePointer: true })

  await selectMode(page, 'listen')
  await page.getByLabel('Keyboard').waitFor()

  await page.keyboard.press('A')

  await expect(page.locator('.status-text')).toHaveText(/Correct|Incorrect/)
  await expect(page.locator('.listen-overlay-letter')).not.toHaveText('?')
})
