import { expect, test, type Locator } from '@playwright/test'

const top = async (locator: Locator) => {
  const bounds = await locator.boundingBox()
  if (!bounds) throw new Error('Control is not visible')
  return bounds.y
}

for (const viewport of [{ width: 2100, height: 1240 }, { width: 1024, height: 600 }, { width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
  test(`onboarding controls stay anchored at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/app')
    await page.getByRole('button', { name: 'Get started', exact: true }).click()
    await page.getByRole('button', { name: 'Learn Morse Start from the basics and build up.' }).click()
    const next = page.getByRole('button', { name: 'Continue', exact: true })
    await page.getByText('Real Morse fluency.', { exact: true }).waitFor()
    const nextTop = await top(next)
    if (viewport.width >= 900) {
      const back = await page.getByRole('button', { name: 'Back', exact: true }).boundingBox()
      const forward = await next.boundingBox()
      expect(back!.x).toBeLessThan(80)
      expect(back!.y).toBeLessThan(80)
      expect(Math.abs(forward!.x + forward!.width / 2 - viewport.width / 2)).toBeLessThan(1)
      expect(viewport.height - forward!.y - forward!.height).toBeLessThan(80)
    }
    for (const heading of ['No chart. Just listen.', 'Real speed from day one.', 'Check your sound']) {
      await next.click()
      await page.getByText(heading, { exact: true }).waitFor()
      expect(Math.abs(await top(next) - nextTop)).toBeLessThan(1)
    }
    const play = page.locator('.nux-sound-button')
    const playTop = await top(play)
    await play.click()
    await expect(play).toHaveText('Play again')
    expect(Math.abs(await top(play) - playTop)).toBeLessThan(1)
    const noSound = page.getByRole('button', { name: 'No sound', exact: true })
    const noSoundTop = await top(noSound)
    await noSound.click()
    await expect(page.locator('.nux-sound-help')).toBeVisible()
    expect(Math.abs(await top(play) - playTop)).toBeLessThan(1)
    expect(Math.abs(await top(noSound) - noSoundTop)).toBeLessThan(1)
    expect(Math.abs(await top(next) - nextTop)).toBeLessThan(1)
    await page.getByRole('button', { name: 'Yes, I heard it', exact: true }).click()
    expect(Math.abs(await top(play) - playTop)).toBeLessThan(1)
    expect(Math.abs(await top(next) - nextTop)).toBeLessThan(1)
    await expect(next).toBeEnabled()
  })
}
