/**
 * WattsOrbit — Popup (main window) screenshot suite
 *
 * Run: npm run screenshots
 * URL: /?mock=1  → charges every 10s, discharges alternately
 */
import { test, type Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const OUT = path.resolve(__dirname, '../screenshots')

async function gotoPopup(page: Page, extra = '') {
  await page.goto(`/?mock=1${extra}`)
  await page.waitForSelector('.font-display', { timeout: 8000 })
  await page.waitForTimeout(500)
}

async function snap(page: Page, name: string) {
  fs.mkdirSync(OUT, { recursive: true })
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false })
  console.log(`  ✓  ${name}.png`)
}

test.describe('Popup — charging state', () => {
  test('popup-charging', async ({ page }) => {
    // Mock toggles every 10s; at t=0 it starts in charging state
    await gotoPopup(page)
    await snap(page, 'popup-charging')
  })

  test('popup-charging-warm-battery', async ({ page }) => {
    // Temperature pill is shown in header — verify it's visible
    await gotoPopup(page)
    const tempPill = page.locator('span[title="Battery temperature"]')
    await tempPill.waitFor({ timeout: 4000 })
    await snap(page, 'popup-charging-temp')
  })

  test('popup-stats-row', async ({ page }) => {
    await gotoPopup(page)
    // Stats row: time-to-full, system draw, net balance, battery health
    await page.waitForSelector('.font-mono', { timeout: 5000 })
    await snap(page, 'popup-stats-row')
  })
})

test.describe('Popup — battery bar', () => {
  test('battery-bar-healthy-zone', async ({ page }) => {
    await gotoPopup(page)
    // Healthy zone overlay should be present (20–80% green band)
    await page.waitForSelector('svg[viewBox="0 0 20 12"]', { timeout: 5000 })
    await snap(page, 'popup-battery-bar')
  })
})

test.describe('Popup — devices', () => {
  test('popup-devices-list', async ({ page }) => {
    await gotoPopup(page)
    const devSection = page.locator('text=Connected Devices')
    await devSection.waitFor({ timeout: 5000 })
    await snap(page, 'popup-devices')
  })
})

// ── Update modal + bell screenshots ──────────────────────────────────────────
test('update modal — available with changelog', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 700 })
  await page.goto('/?mock=1&updater=1')
  await page.waitForSelector('.font-display', { timeout: 8000 })
  await page.waitForTimeout(600)
  await snap(page, 'update-01-modal-popup')
})

test('bell — visible in popup header', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 700 })
  await page.goto('/?mock=1&news=1')
  await page.waitForSelector('.font-display', { timeout: 8000 })
  await page.waitForTimeout(500)
  await snap(page, 'update-02-bell-visible')
})

test('bell — dropdown open with news items', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 700 })
  await page.goto('/?mock=1&news=1')
  await page.waitForSelector('.font-display', { timeout: 8000 })
  await page.waitForTimeout(500)
  const bell = page.locator('[data-testid="news-bell"]')
  if (await bell.count() > 0) { await bell.click(); await page.waitForTimeout(300) }
  await snap(page, 'update-03-bell-dropdown')
})

test('update modal — dashboard view', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 })
  await page.goto('/?dashboard=1&mock=1&updater=1')
  await page.waitForSelector('body', { timeout: 8000 })
  await page.waitForTimeout(600)
  await snap(page, 'update-04-modal-dashboard')
})

test('bell — update item after dismiss (popup)', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 700 })
  await page.goto('/?mock=1&updater=1&news=1')
  await page.waitForSelector('.font-display', { timeout: 8000 })
  await page.waitForTimeout(600)
  const later = page.getByText('Later', { exact: true }).first()
  if (await later.count() > 0) { await later.click(); await page.waitForTimeout(400) }
  const bell = page.locator('[data-testid="news-bell"]')
  if (await bell.count() > 0) { await bell.click(); await page.waitForTimeout(300) }
  await snap(page, 'update-05-bell-update-item')
})
