import { expect, test } from '@playwright/test'

test('welcome sign-in replaces onboarding and returns before starting', async ({ page }) => {
  await page.goto('/app')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()

  const sheet = page.getByRole('dialog', { name: 'Sign in', exact: true })
  await expect(page.locator('.nux-overlay-welcome')).toHaveCount(0)
  const backBefore = await sheet.getByRole('button', { name: 'Back to welcome' }).boundingBox()
  await sheet.getByRole('button', { name: 'Continue with Email' }).click({ timeout: 3000 })
  await expect(sheet.getByRole('textbox', { name: 'Email', exact: true })).toBeVisible()
  const backAfter = await sheet.getByRole('button', { name: 'Back to providers' }).boundingBox()
  expect(backAfter?.y).toBe(backBefore?.y)
  await sheet.getByRole('button', { name: 'Back to providers' }).click()
  await expect(sheet.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
  await sheet.getByRole('button', { name: 'Back to welcome' }).click()

  await expect(sheet).toHaveCount(0)
  await page.getByRole('button', { name: 'Get started', exact: true }).click()
  await expect(page.locator('.nux-overlay-welcome')).toHaveCount(0)
  await expect(sheet).toHaveCount(0)
})
