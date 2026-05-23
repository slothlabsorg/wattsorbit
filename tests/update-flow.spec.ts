/**
 * WattsOrbit — Update flow E2E suite
 *
 * Tray popup: compact pill + bell reminder (no modal)
 * Dashboard:  full UpdaterModal + sticky snooze banner
 *
 * Run: npx playwright test --project=update-flow
 */
import { test, expect, type Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const OUT = path.resolve(__dirname, '../screenshots')

async function snap(page: Page, name: string) {
  fs.mkdirSync(OUT, { recursive: true })
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false })
  console.log(`  ✓  ${name}.png`)
}

// ── Tray popup (400×700) ──────────────────────────────────────────────────────

test.describe('Tray popup — compact pill + bell', () => {
  test('01 — compact update pill visible in header', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 700 })
    await page.goto('/?mock=1&updater=1')
    await page.waitForSelector('.font-display', { timeout: 8000 })
    await page.waitForTimeout(400)

    // Pill shows version — NOT the full modal backdrop
    const pill = page.locator('button[title*="available"]')
    await expect(pill).toBeVisible()
    await expect(page.getByText('Update Available')).not.toBeVisible()

    await snap(page, 'upd-01-tray-pill')
  })

  test('02 — no full modal backdrop in tray popup', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 700 })
    await page.goto('/?mock=1&updater=1')
    await page.waitForSelector('.font-display', { timeout: 8000 })
    await page.waitForTimeout(400)

    // No modal backdrop polluting the popup header
    const backdrops = await page.locator('[class*="backdrop-blur"]').count()
    expect(backdrops).toBe(0)
    await snap(page, 'upd-02-tray-no-modal')
  })

  test('03 — bell shows Update item in tray', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 700 })
    await page.goto('/?mock=1&updater=1&news=1')
    await page.waitForSelector('.font-display', { timeout: 8000 })
    await page.waitForTimeout(500)

    const bell = page.locator('[data-testid="news-bell"]')
    await expect(bell).toBeVisible()
    await bell.click()
    await page.waitForTimeout(300)

    await expect(page.locator('[data-testid="news-dropdown"]')).toBeVisible()
    await expect(page.locator('[data-testid="news-item-update-available"]')).toBeVisible()

    await snap(page, 'upd-03-tray-bell-update-item')
  })

  test('04 — bell + pill together with news items', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 700 })
    await page.goto('/?mock=1&updater=1&news=1')
    await page.waitForSelector('.font-display', { timeout: 8000 })
    await page.waitForTimeout(500)

    await expect(page.locator('button[title*="available"]')).toBeVisible()
    await expect(page.locator('[data-testid="news-bell-dot"]')).toBeVisible()

    await snap(page, 'upd-04-tray-pill-and-bell')
  })
})

// ── Dashboard (1100×800) ──────────────────────────────────────────────────────

test.describe('Dashboard — UpdaterModal + snooze banner', () => {
  test('05 — update modal visible in dashboard', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 })
    await page.goto('/?window=dashboard&mock=1&updater=1')
    await page.waitForSelector('text=Update Available', { timeout: 8000 })
    await page.waitForTimeout(400)

    await expect(page.getByText('Update Available', { exact: true })).toBeVisible()
    await expect(page.getByText(/ready to install/i)).toBeVisible()
    await expect(page.getByText(/what.s new/i).first()).toBeVisible()

    await snap(page, 'upd-05-dashboard-modal')
  })

  test('06 — sticky banner shown after modal dismiss', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 })
    // Clear any snooze state
    await page.goto('/?window=dashboard&mock=1&updater=1')
    await page.evaluate(() => localStorage.removeItem('wattsorbit.updateBannerSnoozedUntil'))
    await page.waitForSelector('text=Update Available', { timeout: 8000 })
    await page.waitForTimeout(400)

    // Dismiss the modal
    await page.getByText('Later', { exact: true }).click()
    await page.waitForTimeout(500)
    await expect(page.getByText('Update Available')).not.toBeVisible()

    // Sticky banner visible
    const banner = page.locator('text=is available').first()
    await expect(banner).toBeVisible()
    await expect(page.getByRole('button', { name: 'Update Now' })).toBeVisible()

    await snap(page, 'upd-06-dashboard-sticky-banner')
  })

  test('07 — banner snooze button dismisses for 1 hour', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 })
    await page.goto('/?window=dashboard&mock=1&updater=1')
    await page.evaluate(() => localStorage.removeItem('wattsorbit.updateBannerSnoozedUntil'))
    await page.waitForSelector('text=Update Available', { timeout: 8000 })
    await page.waitForTimeout(400)
    await page.getByText('Later', { exact: true }).click()
    await page.waitForTimeout(500)

    // Click the 1h snooze button
    const snoozeBtn = page.getByRole('button', { name: '1h' })
    await expect(snoozeBtn).toBeVisible()
    await snoozeBtn.click()
    await page.waitForTimeout(400)

    // Banner is gone
    await expect(page.getByRole('button', { name: '1h' })).not.toBeVisible()
    // Snooze is stored in localStorage
    const snoozed = await page.evaluate(() => localStorage.getItem('wattsorbit.updateBannerSnoozedUntil'))
    expect(Number(snoozed)).toBeGreaterThan(Date.now())

    await snap(page, 'upd-07-banner-snoozed')
  })

  test('08 — "Update Now" in banner reopens modal', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 })
    await page.goto('/?window=dashboard&mock=1&updater=1')
    await page.evaluate(() => localStorage.removeItem('wattsorbit.updateBannerSnoozedUntil'))
    await page.waitForSelector('text=Update Available', { timeout: 8000 })
    await page.waitForTimeout(400)
    await page.getByText('Later', { exact: true }).click()
    await page.waitForTimeout(500)

    await page.getByRole('button', { name: 'Update Now' }).click()
    await page.waitForTimeout(400)
    await expect(page.getByText('Update Available', { exact: true })).toBeVisible()

    await snap(page, 'upd-08-banner-update-now-reopens-modal')
  })

  test('09 — dashboard news view', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 })
    await page.goto('/?window=dashboard&mock=1')
    await page.waitForSelector('body', { timeout: 8000 })
    await page.waitForTimeout(800)
    const newsBtn = page.getByRole('button', { name: /news/i }).first()
    if (await newsBtn.count() > 0) { await newsBtn.click(); await page.waitForTimeout(400) }
    await snap(page, 'upd-09-dashboard-news')
  })
})

// ── Full flow composite ───────────────────────────────────────────────────────

test('10 — full flow: tray pill → dashboard modal → dismiss → banner → snooze', async ({ page }) => {
  // Tray: pill visible, no modal
  await page.setViewportSize({ width: 400, height: 700 })
  await page.goto('/?mock=1&updater=1&news=1')
  await page.waitForSelector('.font-display', { timeout: 8000 })
  await page.waitForTimeout(400)
  await expect(page.locator('button[title*="available"]')).toBeVisible()
  await expect(page.getByText('Update Available')).not.toBeVisible()
  await snap(page, 'upd-10a-tray-pill')

  // Dashboard: modal appears
  await page.setViewportSize({ width: 1100, height: 800 })
  await page.goto('/?window=dashboard&mock=1&updater=1')
  await page.evaluate(() => localStorage.removeItem('wattsorbit.updateBannerSnoozedUntil'))
  await page.waitForSelector('text=Update Available', { timeout: 8000 })
  await page.waitForTimeout(400)
  await expect(page.getByText('Update Available', { exact: true })).toBeVisible()
  await snap(page, 'upd-10b-dashboard-modal')

  // Dismiss → sticky banner
  await page.getByText('Later', { exact: true }).click()
  await page.waitForTimeout(500)
  await expect(page.getByRole('button', { name: 'Update Now' })).toBeVisible()
  await snap(page, 'upd-10c-sticky-banner')

  // Snooze
  await page.getByRole('button', { name: '1h' }).click()
  await page.waitForTimeout(300)
  await expect(page.getByRole('button', { name: '1h' })).not.toBeVisible()
  await snap(page, 'upd-10d-snoozed')
})
