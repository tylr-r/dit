import { expect, test, type Page } from '@playwright/test';
import { MORSE_DATA, type Letter } from '@dit/core';

const DOT_PRESS_MS = 80;
const DASH_PRESS_MS = 360;
const SYMBOL_GAP_MS = 80;
const LETTER_GAP_MS = 320;

const overrideCoarsePointer = () => {
  const originalMatchMedia = window.matchMedia.bind(window);
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
      };
    }
    return originalMatchMedia(query);
  };
};

const clearLocalStorage = () => {
  window.localStorage.clear();
};

const sendSymbol = async (page: Page, symbol: '.' | '-') => {
  await page.keyboard.down(' ');
  await page.waitForTimeout(symbol === '.' ? DOT_PRESS_MS : DASH_PRESS_MS);
  await page.keyboard.up(' ');
  await page.waitForTimeout(SYMBOL_GAP_MS);
};

const sendMorse = async (page: Page, code: string) => {
  for (const symbol of code) {
    await sendSymbol(page, symbol as '.' | '-');
  }
  await page.waitForTimeout(LETTER_GAP_MS);
};

const gotoApp = async (page: Page, { coarsePointer = false } = {}) => {
  await page.addInitScript(clearLocalStorage);
  if (coarsePointer) {
    await page.addInitScript(overrideCoarsePointer);
  }
  await page.goto('/');
  await page.getByLabel('Mode').waitFor();
};

const focusMorseButton = async (page: Page) => {
  await page.getByLabel('Tap for dot, hold for dah').focus();
};

const readPracticeLetter = async (page: Page) => {
  const text = await page.locator('main.stage .letter').first().textContent();
  if (!text) {
    throw new Error('Expected a practice letter to be visible.');
  }
  return text.trim() as Letter;
};

test('practice mode accepts a correct answer', async ({ page }) => {
  await gotoApp(page);
  await focusMorseButton(page);

  const letter = await readPracticeLetter(page);
  const code = MORSE_DATA[letter].code;

  await sendMorse(page, code);

  await expect(page.locator('.status-text')).toHaveText('Correct');
});

test('practice mode flags an incorrect answer', async ({ page }) => {
  await gotoApp(page);
  await focusMorseButton(page);

  const letter = await readPracticeLetter(page);
  const code = MORSE_DATA[letter].code;
  const wrongSymbol = code.startsWith('.') ? '-' : '.';

  await sendMorse(page, wrongSymbol);

  await expect(page.locator('.status-text')).toHaveText('Missed. Start over.');
});

test('freestyle mode decodes morse input', async ({ page }) => {
  await gotoApp(page);

  await page.getByLabel('Mode').selectOption('freestyle');
  await focusMorseButton(page);

  await sendMorse(page, MORSE_DATA.A.code);

  await expect(page.locator('main.stage .letter')).toHaveText('A');
});

test('listen mode accepts keyboard answers', async ({ page }) => {
  await gotoApp(page, { coarsePointer: true });

  await page.getByLabel('Mode').selectOption('listen');
  await page.getByLabel('Keyboard').waitFor();

  await page.getByLabel('Type A').click();

  await expect(page.locator('.status-text')).toHaveText(/Correct|Incorrect/);
  await expect(page.locator('main.stage .letter')).not.toHaveText('?');
});
