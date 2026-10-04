import { expect, test, type Page } from '@playwright/test'

const completeKeyTutorial = async (page: Page) => {
  const key = page.locator('.nux-tutorial-button-slot button').first()
  for (const duration of [80, 80, 80, 400, 400, 400]) {
    await key.hover()
    await page.mouse.down()
    await page.waitForTimeout(duration)
    await page.mouse.up()
    await page.waitForTimeout(140)
  }
}

for (const profile of ['beginner', 'known']) {
  test(`${profile} onboarding can go back through slides and the final steps`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/app')
    await page.getByRole('button', { name: 'Get started', exact: true }).click()
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Get started', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Get started', exact: true }).click()
    await page.getByRole('button', { name: profile === 'beginner' ? 'Learn Morse Start from the basics and build up.' : 'I know Morse Quick tour, then dive right in.' }).click()
    for (const heading of ['Real Morse fluency.', 'No chart. Just listen.', 'Real speed from day one.']) {
      await page.getByText(heading, { exact: true }).waitFor()
      await page.getByRole('button', { name: 'Continue', exact: true }).click()
      await expect(page.getByText(heading, { exact: true })).toHaveCount(0)
      await page.getByRole('button', { name: 'Back', exact: true }).click()
      await page.getByText(heading, { exact: true }).waitFor()
      await page.getByRole('button', { name: 'Continue', exact: true }).click()
    }
    await page.getByRole('button', { name: 'Play sound', exact: true }).click()
    await page.getByRole('button', { name: 'Yes, I heard it', exact: true }).click()
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByText('Meet the Morse key', { exact: true }).waitFor()
    await completeKeyTutorial(page)
    if (profile === 'beginner') {
      await page.getByText("How you'll learn", { exact: true }).waitFor()
      await page.getByRole('button', { name: 'Continue', exact: true }).click()
      await page.getByText('Your first letters', { exact: true }).waitFor()
      await page.getByRole('button', { name: 'Back', exact: true }).click()
      await page.getByText("How you'll learn", { exact: true }).waitFor()
    } else {
      await page.getByRole('dialog', { name: 'Modes', exact: true }).waitFor()
      await page.getByRole('button', { name: 'Next', exact: true }).click()
      await page.getByRole('dialog', { name: 'Settings', exact: true }).waitFor()
      await page.getByRole('button', { name: 'Back', exact: true }).click()
      await page.getByRole('dialog', { name: 'Modes', exact: true }).waitFor()
    }
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await page.getByText('Meet the Morse key', { exact: true }).waitFor()
    await expect(page.locator('.nux-tutorial-pip.filled')).toHaveCount(0)
    await page.waitForTimeout(800)
    await expect(page.getByText('Meet the Morse key', { exact: true })).toBeVisible()
  })
}
