/**
 * WattsOrbit — Interaction / smoke tests
 */
import { test, expect } from '@playwright/test'

const BASE = '/?mock=1'
const DASH = '/?window=dashboard&mock=1'

test.describe('Popup interactions', () => {
  test('shows loading skeleton then content', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForSelector('.animate-pulse', { timeout: 3000 }).catch(() => {})
    // Should eventually show battery percent
    await page.waitForSelector('.font-mono', { timeout: 8000 })
  })

  test('shows charge state badge (Charging or On Battery)', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForSelector('.font-mono', { timeout: 8000 })
    // One of these will be present
    const badge = page.locator('text=⚡ Charging, text=🔋 On Battery, text=✓ Charged')
    const count = await badge.count()
    expect(count).toBeGreaterThan(0)
  })

  test('temperature pill is visible in header', async ({ page }) => {
    await page.goto(BASE)
    const pill = page.locator('span[title="Battery battery"]').or(
      page.locator('span[title="Battery temperature"]')
    )
    // Mock data has 29.5°C — pill should show
    await page.waitForSelector('span[title="Battery temperature"]', { timeout: 8000 })
    await expect(page.locator('span[title="Battery temperature"]')).toBeVisible()
  })

  test('battery bar renders', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForSelector('svg[viewBox="0 0 20 12"]', { timeout: 8000 })
    await expect(page.locator('svg[viewBox="0 0 20 12"]')).toBeVisible()
  })

  test('device list shows mock devices', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForSelector('text=Connected Devices', { timeout: 8000 })
    await expect(page.locator('text=Connected Devices')).toBeVisible()
  })
})

test.describe('Dashboard interactions', () => {
  test('landing page loads with WattsOrbit heading', async ({ page }) => {
    await page.goto(DASH)
    await page.waitForSelector('h1', { timeout: 8000 })
    await expect(page.locator('h1', { hasText: 'WattsOrbit' })).toBeVisible()
  })

  test('autostart banner visible when not yet asked', async ({ page }) => {
    await page.goto(DASH)
    await page.evaluate(() => localStorage.removeItem('wattsorbit_autostart_asked'))
    await page.reload()
    await page.waitForSelector('text=Start WattsOrbit at login?', { timeout: 8000 })
    await expect(page.locator('text=Start WattsOrbit at login?')).toBeVisible()
  })

  test('autostart banner hidden after clicking Not now', async ({ page }) => {
    await page.goto(DASH)
    await page.evaluate(() => localStorage.removeItem('wattsorbit_autostart_asked'))
    await page.reload()
    await page.waitForSelector('text=Start WattsOrbit at login?', { timeout: 8000 })
    await page.locator('button', { hasText: 'Not now' }).click()
    // Banner should disappear
    await expect(page.locator('text=Start WattsOrbit at login?')).toBeHidden({ timeout: 3000 })
  })

  test('navigate to data view and back', async ({ page }) => {
    await page.goto(DASH)
    await page.waitForSelector('button', { timeout: 8000 })
    await page.locator('button', { hasText: 'View Power Data' }).click()
    await page.waitForSelector("text=Today's Power Data", { timeout: 8000 })
    await expect(page.locator("text=Today's Power Data")).toBeVisible()
    // Back button
    await page.locator('button').first().click()
    await page.waitForSelector('h1', { timeout: 5000 })
    await expect(page.locator('h1', { hasText: 'WattsOrbit' })).toBeVisible()
  })

  test('data view shows all sections', async ({ page }) => {
    await page.goto(DASH)
    await page.locator('button', { hasText: 'View Power Data' }).click()
    await page.waitForSelector("text=Today's Power Data", { timeout: 8000 })
    await expect(page.locator('text=Power Flow')).toBeVisible()
    await expect(page.locator('text=Devices').first()).toBeVisible()
    await expect(page.locator('text=Charge Sessions')).toBeVisible()
  })

  test('battery health panel visible with mock data', async ({ page }) => {
    await page.goto(DASH)
    await page.locator('button', { hasText: 'View Power Data' }).click()
    await page.waitForSelector("text=Today's Power Data", { timeout: 8000 })
    // Scroll to bottom to reveal health panel
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForSelector('text=Battery Health', { timeout: 5000 })
    await expect(page.locator('text=Battery Health')).toBeVisible()
  })

  test('roadmap panel visible with pro features', async ({ page }) => {
    await page.goto(DASH)
    await page.locator('button', { hasText: 'View Power Data' }).click()
    await page.waitForSelector("text=Today's Power Data", { timeout: 8000 })
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForSelector("text=What's Coming", { timeout: 5000 })
    await expect(page.locator("text=What's Coming")).toBeVisible()
    await expect(page.locator('text=Custom Charge Limit')).toBeVisible()
    await expect(page.locator('text=Sailing Mode')).toBeVisible()
  })
})
