import { expect, test } from '@playwright/test'

test('Conversation entry redirects pending onboarding to the main app', async ({ page }) => {
  await page.goto('/app/qso')
  await expect(page.getByRole('button', { name: 'Get started', exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/app$/)
  const conversation = page.locator('.conversation-surface')
  await expect(conversation).toHaveCount(0)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Continue with Email' })).toBeVisible()
  await expect(conversation).toHaveCount(0)
  await page.getByRole('button', { name: 'Back to welcome' }).click()
  await page.getByRole('button', { name: 'Get started', exact: true }).click()
  await expect(page.getByText('Choose your path', { exact: true })).toBeVisible()
  await expect(conversation).toHaveCount(0)
})

test('completed onboarding keeps Conversation available and replay exits it', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('dit-nux-status', 'completed'))
  await page.goto('/app/qso')
  await expect(page.getByRole('button', { name: 'Send first', exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/app\/qso$/)
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Replay onboarding', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Get started', exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/app$/)
  await expect(page.locator('.conversation-surface')).toHaveCount(0)
})
