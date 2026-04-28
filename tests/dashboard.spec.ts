/**
 * WattsOrbit — Dashboard screenshot suite
 *
 * Run: npm run screenshots
 * URL: /?window=dashboard&mock=1
 */
import { test, type Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const OUT = path.resolve(__dirname, '../screenshots')

async function gotoDashboard(page: Page) {
  await page.goto('/?window=dashboard&mock=1')
  await page.waitForSelector('.font-display', { timeout: 10_000 })
  await page.waitForTimeout(500)
}

async function snap(page: Page, name: string) {
  fs.mkdirSync(OUT, { recursive: true })
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false })
  console.log(`  ✓  ${name}.png`)
}

test.describe('Dashboard — landing page', () => {
  test('dashboard-landing', async ({ page }) => {
    await gotoDashboard(page)
    await snap(page, 'dashboard-landing')
  })

  test('dashboard-landing-autostart-banner', async ({ page }) => {
    // Clear localStorage so the banner is shown
    await page.goto('/?window=dashboard&mock=1')
    await page.evaluate(() => localStorage.removeItem('wattsorbit_autostart_asked'))
    await page.reload()
    await page.waitForSelector('text=Start WattsOrbit at login?', { timeout: 8000 })
    await snap(page, 'dashboard-landing-autostart-banner')
  })

  test('dashboard-landing-use-cases', async ({ page }) => {
    await gotoDashboard(page)
    await page.waitForSelector('text=Cable & Charger Quality', { timeout: 5000 })
    await snap(page, 'dashboard-landing-use-cases')
  })
})

test.describe('Dashboard — power data view', () => {
  async function openDataView(page: Page) {
    await gotoDashboard(page)
    await page.locator('button', { hasText: 'View Power Data' }).click()
    await page.waitForSelector("text=Today's Power Data", { timeout: 8000 })
    await page.waitForTimeout(600) // let animations settle
  }

  test('dashboard-data-stats', async ({ page }) => {
    await openDataView(page)
    await snap(page, 'dashboard-data-stats')
  })

  test('dashboard-data-chart', async ({ page }) => {
    await openDataView(page)
    // Scroll to chart area
    await page.locator('text=Power Flow').first().scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)
    await snap(page, 'dashboard-data-chart')
  })

  test('dashboard-data-devices', async ({ page }) => {
    await openDataView(page)
    await page.locator('text=Devices').first().scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)
    await snap(page, 'dashboard-data-devices')
  })

  test('dashboard-data-charge-sessions', async ({ page }) => {
    await openDataView(page)
    await page.locator('text=Charge Sessions').scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)
    await snap(page, 'dashboard-data-charge-sessions')
  })

  test('dashboard-data-battery-health', async ({ page }) => {
    await openDataView(page)
    await page.locator('text=Battery Health').first().scrollIntoViewIfNeeded()
    await page.waitForTimeout(400)
    await snap(page, 'dashboard-data-battery-health')
  })

  test('dashboard-data-roadmap', async ({ page }) => {
    await openDataView(page)
    await page.locator("text=What's Coming").scrollIntoViewIfNeeded()
    await page.waitForTimeout(400)
    await snap(page, 'dashboard-data-roadmap')
  })

  test('dashboard-data-full-scroll', async ({ page }) => {
    await openDataView(page)
    // Full-page screenshot of the data view
    await page.screenshot({
      path: path.join(OUT, 'dashboard-data-full.png'),
      fullPage: true,
    })
    console.log('  ✓  dashboard-data-full.png')
  })
})
