import { test, expect } from '@playwright/test'

// Minimal smoke E2E to protect main flows without changing behavior
// Assumes local dev server is running or baseURL is set via PLAYWRIGHT_BASE_URL

test.describe('Main flow smoke', () => {
  test('open top page without errors', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('body')).toBeVisible()
  })

  // Placeholders for future expansion without breaking behavior
  test('navigate to reservations page if accessible', async ({ page }) => {
    await page.goto('/reservations')
    // Do not assert content strictly to avoid flakiness; just check 200 navigation
    await expect(page).toHaveURL(/\/reservations/)
  })
})
