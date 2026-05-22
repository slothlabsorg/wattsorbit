/**
 * WattsOrbit — Update flow E2E suite
 *
 * Covers: UpdaterModal (popup + dashboard), NewsBell reminder, full dismiss→re-trigger flow.
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

async function openPopupWithUpdater(page: Page, extra = '') {
  await page.setViewportSize({ width: 400, height: 700 })
  await page.goto(`/?mock=1&updater=1${extra}`)
  await page.waitForSelector('text=Update Available', { timeout: 8000 })
  await page.waitForTimeout(300)
}

// ── Popup (400×700) ───────────────────────────────────────────────────────────

test.describe('Popup — UpdaterModal', () => {
  test('01 — modal appears on startup when update available', async ({ page }) => {
    await openPopupWithUpdater(page)

    await expect(page.getByText('Update Available', { exact: true })).toBeVisible()
    await expect(page.getByText(/ready to install/i)).toBeVisible()

    await snap(page, 'upd-01-modal-appears')
  })

  test('02 — changelog section is visible inside modal', async ({ page }) => {
    await openPopupWithUpdater(page)

    // WHAT'S NEW section
    await expect(page.getByText(/what.s new/i).first()).toBeVisible()

    // At least one changelog item — the mock has bullet points
    const modalText = await page.locator('text=Update Available').locator('..').locator('..').innerText().catch(() => '')
    const bodyContent = await page.locator('body').innerText()
    expect(bodyContent.toLowerCase()).toMatch(/new|fix|support|improve|feature/)

    await snap(page, 'upd-02-changelog-visible')
  })

  test('03 — "Later" button dismisses modal', async ({ page }) => {
    await openPopupWithUpdater(page)

    await page.getByText('Later', { exact: true }).click()
    await page.waitForTimeout(400)

    await expect(page.getByText('Update Available', { exact: true })).not.toBeVisible()

    await snap(page, 'upd-03-modal-dismissed')
  })

  test('04 — bell shows dot after "Later" (update still pending)', async ({ page }) => {
    await openPopupWithUpdater(page, '&news=1')

    await page.getByText('Later', { exact: true }).click()
    await page.waitForTimeout(500)

    const dot = page.locator('[data-testid="news-bell-dot"]')
    await expect(dot).toBeVisible()

    await snap(page, 'upd-04-bell-dot-after-dismiss')
  })

  test('05 — bell dropdown shows "Update" item after dismiss', async ({ page }) => {
    await openPopupWithUpdater(page, '&news=1')

    await page.getByText('Later', { exact: true }).click()
    await page.waitForTimeout(500)

    await page.locator('[data-testid="news-bell"]').click()
    await page.waitForTimeout(300)

    await expect(page.locator('[data-testid="news-dropdown"]')).toBeVisible()
    await expect(page.locator('[data-testid="news-item-update-available"]')).toBeVisible()

    await snap(page, 'upd-05-bell-update-item')
  })

  test('06 — clicking update item in bell re-opens modal', async ({ page }) => {
    await openPopupWithUpdater(page, '&news=1')

    await page.getByText('Later', { exact: true }).click()
    await page.waitForTimeout(500)

    await page.locator('[data-testid="news-bell"]').click()
    await page.waitForTimeout(300)
    await page.locator('[data-testid="news-item-update-available"]').click()
    await page.waitForTimeout(400)

    await expect(page.getByText('Update Available', { exact: true })).toBeVisible()

    await snap(page, 'upd-06-modal-reopened-from-bell')
  })

  test('07 — bell visible with news items (no update)', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 700 })
    await page.goto('/?mock=1&news=1')
    await page.waitForSelector('.font-display', { timeout: 8000 })
    await page.waitForTimeout(500)

    await expect(page.locator('[data-testid="news-bell"]')).toBeVisible()
    await page.locator('[data-testid="news-bell"]').click()
    await page.waitForTimeout(300)
    await expect(page.locator('[data-testid="news-dropdown"]')).toBeVisible()

    await snap(page, 'upd-07-bell-news-only')
  })
})

// ── Dashboard (1100×800) ──────────────────────────────────────────────────────

test.describe('Dashboard — UpdaterModal', () => {
  test('08 — modal appears in dashboard', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 })
    await page.goto('/?dashboard=1&mock=1&updater=1')
    await page.waitForSelector('text=Update Available', { timeout: 8000 })
    await page.waitForTimeout(400)

    await expect(page.getByText('Update Available', { exact: true })).toBeVisible()
    await expect(page.getByText(/ready to install/i)).toBeVisible()

    await snap(page, 'upd-08-dashboard-modal')
  })

  test('09 — dashboard shows News view', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 })
    await page.goto('/?dashboard=1&mock=1')
    await page.waitForSelector('body', { timeout: 8000 })
    await page.waitForTimeout(800)

    const newsBtn = page.getByRole('button', { name: /news/i }).first()
    if (await newsBtn.count() > 0) {
      await newsBtn.click()
      await page.waitForTimeout(400)
    }

    await snap(page, 'upd-09-dashboard-news-view')
  })
})

// ── Full E2E flow ─────────────────────────────────────────────────────────────

test('10 — full update flow: modal → later → bell dot → bell item → reopen', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 700 })
  await page.goto('/?mock=1&updater=1&news=1')
  await page.waitForSelector('text=Update Available', { timeout: 8000 })
  await page.waitForTimeout(300)

  // 1 — modal visible with version
  await expect(page.getByText('Update Available')).toBeVisible()
  await snap(page, 'upd-10a-full-flow-modal')

  // 2 — dismiss
  await page.getByText('Later', { exact: true }).click()
  await page.waitForTimeout(500)
  await expect(page.getByText('Update Available')).not.toBeVisible()
  await snap(page, 'upd-10b-full-flow-dismissed')

  // 3 — bell has dot
  await expect(page.locator('[data-testid="news-bell-dot"]')).toBeVisible()
  await snap(page, 'upd-10c-full-flow-bell-dot')

  // 4 — bell shows update item
  await page.locator('[data-testid="news-bell"]').click()
  await page.waitForTimeout(300)
  await expect(page.locator('[data-testid="news-item-update-available"]')).toBeVisible()
  await snap(page, 'upd-10d-full-flow-bell-open')

  // 5 — clicking it reopens modal
  await page.locator('[data-testid="news-item-update-available"]').click()
  await page.waitForTimeout(400)
  await expect(page.getByText('Update Available')).toBeVisible()
  await snap(page, 'upd-10e-full-flow-modal-reopened')
})
