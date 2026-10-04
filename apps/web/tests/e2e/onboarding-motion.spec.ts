import { expect, test } from '@playwright/test'

test('intro motion loops, keeps navigation still, and respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/app')
  await page.getByRole('button', { name: 'Get started', exact: true }).click()
  await page.getByRole('button', { name: 'Learn Morse Start from the basics and build up.' }).click()
  const art = page.locator('.nux-recognition-art')
  await expect(art).toBeVisible()
  const next = page.getByRole('button', { name: 'Continue', exact: true })
  const originalBounds = await next.boundingBox()
  expect(await art.evaluate(svg => svg.getAnimations({ subtree: true })
    .every(animation => animation.effect?.getTiming().iterations === Infinity))).toBe(true)
  for (const [time, feedback] of [[960, 'first'], [3360, 'miss'], [5760, 'last'], [8160, 'first'], [10560, 'first'], [12960, 'first'], [15360, 'miss']] as const) {
    await art.evaluate((svg, elapsed) => {
      for (const animation of svg.getAnimations({ subtree: true })) {
        animation.pause()
        animation.currentTime = elapsed
      }
    }, time)
    await expect(page.locator(`.nux-recognition-${feedback}`)).toHaveCSS('opacity', '1')
    expect(await next.boundingBox()).toEqual(originalBounds)
  }
  // Compare visible letter geometry on either side of the loop boundary.
  const frames = []
  for (const elapsed of [11999, 12000]) {
    frames.push(await art.evaluate((svg, time) => {
      for (const animation of svg.getAnimations({ subtree: true })) {
        animation.pause()
        animation.currentTime = time
      }
      return Array.from(svg.querySelectorAll('.nux-recognition-letter'))
        .filter(letter => Number(getComputedStyle(letter).opacity) > 0.1)
        .map(letter => {
          const rect = letter.getBoundingClientRect()
          return { letter: letter.textContent, x: Math.round(rect.x), width: Math.round(rect.width) }
        }).sort((a, b) => a.x - b.x)
    }, elapsed))
  }
  expect(frames[0]).toEqual(frames[1])
  expect(frames[0]).toHaveLength(5)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(await art.evaluate(svg => svg.getAnimations({ subtree: true }).length)).toBe(0)
  await expect(page.locator('.nux-recognition-last')).toHaveCSS('opacity', '1')
  await expect(page.locator('.nux-recognition-miss')).toHaveCSS('opacity', '0')
  for (const selector of ['.nux-listening-art', '.nux-spacing-art']) {
    await next.click()
    const illustration = page.locator(selector)
    await expect(illustration).toBeVisible()
    expect(await illustration.evaluate(svg => svg.getAnimations({ subtree: true }).length)).toBe(0)
    expect(await next.boundingBox()).toEqual(originalBounds)
  }
})
