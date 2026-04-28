/**
 * WattsOrbit — Interaction / smoke tests
 *
 * Run: npx playwright test --project=interactions
 * All tests use ?mock=1 (browser mode — no Tauri runtime needed).
 */
import { test, expect, type Page } from '@playwright/test'

const BASE = '/?mock=1'
const DASH = '/?window=dashboard&mock=1'

// ── Helper: capture window.open calls ────────────────────────────────────────

async function captureWindowOpens(page: Page) {
  await page.addInitScript(() => {
    (window as any).__captured_opens = []
    const orig = window.open.bind(window)
    window.open = function (url?: string | URL, ...args: unknown[]) {
      if (url) (window as any).__captured_opens.push(String(url))
      return orig(url as string, ...(args as [string, string]))
    }
  })
}

async function getOpenedUrls(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as any).__captured_opens as string[])
}

// ── Popup — basic rendering ───────────────────────────────────────────────────

test.describe('Popup — rendering', () => {
  test('shows content after loading', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForSelector('.font-mono', { timeout: 8000 })
    await expect(page.locator('.font-mono').first()).toBeVisible()
  })

  test('charge state badge is present', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForSelector('.font-mono', { timeout: 8000 })
    const badge = page.locator('text=⚡ Charging').or(page.locator('text=🔋 On Battery')).or(page.locator('text=✓ Charged'))
    await expect(badge.first()).toBeVisible({ timeout: 5000 })
  })

  test('temperature pill is visible', async ({ page }) => {
    await page.goto(BASE)
    await expect(page.locator('span[title="Battery temperature"]')).toBeVisible({ timeout: 8000 })
  })

  test('battery bar renders', async ({ page }) => {
    await page.goto(BASE)
    await expect(page.locator('svg[viewBox="0 0 20 12"]')).toBeVisible({ timeout: 8000 })
  })

  test('Connected Devices section is visible', async ({ page }) => {
    await page.goto(BASE)
    await expect(page.locator('text=Connected Devices')).toBeVisible({ timeout: 8000 })
  })

  test('mock devices appear in list', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForSelector('text=Connected Devices', { timeout: 8000 })
    // USB Fan appears in both charging and discharging mock states
    await expect(page.locator('text=USB Fan')).toBeVisible({ timeout: 5000 })
  })
})

// ── Popup — external links ────────────────────────────────────────────────────

test.describe('Popup — external links', () => {
  test('Report issue opens a github.com URL', async ({ page }) => {
    await captureWindowOpens(page)
    await page.goto(BASE)
    await page.waitForSelector('.font-mono', { timeout: 8000 })
    await page.locator('button', { hasText: 'Report issue' }).click()
    await page.waitForTimeout(400)
    const urls = await getOpenedUrls(page)
    expect(urls.some(u => u.includes('github.com'))).toBe(true)
  })
})

// ── Popup — UpdateBanner ──────────────────────────────────────────────────────

test.describe('Popup — UpdateBanner', () => {
  test('not shown when no update available', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForSelector('.font-mono', { timeout: 8000 })
    await expect(page.locator('text=is available')).toBeHidden({ timeout: 2000 })
  })

  test('shown with version and Install button when update injected', async ({ page }) => {
    await page.goto(`${BASE}&mock_update=9.9.9`)
    await page.waitForSelector('text=9.9.9 is available', { timeout: 6000 })
    await expect(page.locator('text=9.9.9 is available')).toBeVisible()
    await expect(page.locator('button', { hasText: 'Update' })).toBeVisible()
  })

  test('Update button is clickable', async ({ page }) => {
    await page.goto(`${BASE}&mock_update=9.9.9`)
    await page.waitForSelector('button:has-text("Update")', { timeout: 6000 })
    await page.locator('button', { hasText: 'Update' }).click()
    // install() is a no-op in mock mode — button should not crash
    await expect(page.locator('button', { hasText: /Update|Installing/ })).toBeVisible()
  })
})

// ── Dashboard — rendering & navigation ───────────────────────────────────────

test.describe('Dashboard — rendering', () => {
  test('landing page loads with WattsOrbit heading', async ({ page }) => {
    await page.goto(DASH)
    await expect(page.locator('h1', { hasText: 'WattsOrbit' })).toBeVisible({ timeout: 8000 })
  })

  test('autostart banner shown when not yet asked', async ({ page }) => {
    await page.goto(DASH)
    await page.evaluate(() => localStorage.removeItem('wattsorbit_autostart_asked'))
    await page.reload()
    await expect(page.locator('text=Start WattsOrbit at login?')).toBeVisible({ timeout: 8000 })
  })

  test('autostart banner dismissed by Not now', async ({ page }) => {
    await page.goto(DASH)
    await page.evaluate(() => localStorage.removeItem('wattsorbit_autostart_asked'))
    await page.reload()
    await page.waitForSelector('text=Start WattsOrbit at login?', { timeout: 8000 })
    await page.locator('button', { hasText: 'Not now' }).click()
    await expect(page.locator('text=Start WattsOrbit at login?')).toBeHidden({ timeout: 3000 })
  })

  test('View Power Data navigates to data view', async ({ page }) => {
    await page.goto(DASH)
    await page.locator('button', { hasText: 'View Power Data' }).click()
    await expect(page.locator("text=Today's Power Data")).toBeVisible({ timeout: 8000 })
  })

  test('Back button returns to landing', async ({ page }) => {
    await page.goto(DASH)
    await page.locator('button', { hasText: 'View Power Data' }).click()
    await page.waitForSelector("text=Today's Power Data", { timeout: 8000 })
    // Back is the first button in the data view header
    await page.locator('[aria-label="Back"]').or(page.locator('button').filter({ hasText: /back|←/i }).first()).click()
    await expect(page.locator('h1', { hasText: 'WattsOrbit' })).toBeVisible({ timeout: 5000 })
  })

  test('data view shows Power Flow, Devices, Charge Sessions sections', async ({ page }) => {
    await page.goto(DASH)
    await page.locator('button', { hasText: 'View Power Data' }).click()
    await page.waitForSelector("text=Today's Power Data", { timeout: 8000 })
    await expect(page.locator('text=Power Flow').first()).toBeVisible()
    await expect(page.locator('text=Devices').first()).toBeVisible()
    await expect(page.locator('text=Charge Sessions')).toBeVisible()
  })

  test('Battery Health section visible on scroll', async ({ page }) => {
    await page.goto(DASH)
    await page.locator('button', { hasText: 'View Power Data' }).click()
    await page.waitForSelector("text=Today's Power Data", { timeout: 8000 })
    await page.locator('text=Battery Health').first().scrollIntoViewIfNeeded()
    await expect(page.locator('text=Battery Health').first()).toBeVisible({ timeout: 5000 })
  })

  test('Roadmap panel shows Pro features', async ({ page }) => {
    await page.goto(DASH)
    await page.locator('button', { hasText: 'View Power Data' }).click()
    await page.waitForSelector("text=Today's Power Data", { timeout: 8000 })
    await page.locator("text=What's Coming").scrollIntoViewIfNeeded()
    await expect(page.locator('text=Custom Charge Limit')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=Sailing Mode')).toBeVisible()
  })
})

// ── Dashboard — external links ────────────────────────────────────────────────

test.describe('Dashboard — external links', () => {
  test('GitHub button opens github.com', async ({ page }) => {
    await captureWindowOpens(page)
    await page.goto(DASH)
    await page.waitForSelector('button:has-text("GitHub")', { timeout: 8000 })
    await page.locator('button', { hasText: 'GitHub' }).click()
    await page.waitForTimeout(400)
    const urls = await getOpenedUrls(page)
    expect(urls.some(u => u.includes('github.com'))).toBe(true)
  })

  test('Report issue opens github.com/issues', async ({ page }) => {
    await captureWindowOpens(page)
    await page.goto(DASH)
    await page.waitForSelector('button:has-text("Report issue")', { timeout: 8000 })
    await page.locator('button', { hasText: 'Report issue' }).click()
    await page.waitForTimeout(600)
    const urls = await getOpenedUrls(page)
    expect(urls.some(u => u.includes('github.com') && u.includes('issues'))).toBe(true)
  })

  test('Support us button opens ko-fi.com', async ({ page }) => {
    await captureWindowOpens(page)
    await page.goto(DASH)
    await page.waitForSelector('button:has-text("Support us")', { timeout: 8000 })
    await page.locator('button', { hasText: 'Support us' }).click()
    await page.waitForTimeout(400)
    const urls = await getOpenedUrls(page)
    expect(urls.some(u => u.includes('ko-fi.com'))).toBe(true)
  })

  test('System Settings button is present and clickable', async ({ page }) => {
    await page.goto(DASH)
    // System Settings button is in the battery health panel — navigate to data view first
    await page.locator('button', { hasText: 'View Power Data' }).click()
    await page.waitForSelector("text=Today's Power Data", { timeout: 8000 })
    await page.locator('text=Battery Health').first().scrollIntoViewIfNeeded()
    // Button opens System Prefs via Rust — in mock mode it's a no-op but must not throw
    const sysBtn = page.locator('button', { hasText: /System Settings|Battery Settings/i })
    await expect(sysBtn).toBeVisible({ timeout: 5000 })
    await sysBtn.click()
    // No crash = pass
  })
})

// ── Dashboard — UpdateBanner ──────────────────────────────────────────────────

test.describe('Dashboard — UpdateBanner', () => {
  test('update banner shows in dashboard with mock_update param', async ({ page }) => {
    await page.goto(`${DASH}&mock_update=2.0.0`)
    await expect(page.locator('text=2.0.0 is available')).toBeVisible({ timeout: 8000 })
    await expect(page.locator('button', { hasText: 'Update' })).toBeVisible()
  })
})
