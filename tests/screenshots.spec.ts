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
