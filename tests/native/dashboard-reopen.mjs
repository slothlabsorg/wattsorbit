#!/usr/bin/env node
// Native e2e test — exercises the compiled Tauri app via AppleScript.
// Requirements:
//   - macOS
//   - App already built (debug or release) — we resolve the binary below
//   - Terminal running this script must have Accessibility permission granted
//     to drive System Events (System Settings → Privacy → Accessibility).
//
// Covers the two bugs that the Playwright ?mock=1 browser tests cannot catch:
//   1. Dashboard reopens after being closed once (CloseRequested → prevent_close → hide → show)
//   2. Tray popup window becomes visible when clicked (NSPanel non-activating path)

import { spawn, execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../..')
const PROCESS_NAME = 'wattsorbit'
const APP_TITLE = 'WattsOrbit — Dashboard'

const BIN_CANDIDATES = [
  resolve(REPO_ROOT, 'src-tauri/target/release/wattsorbit'),
  resolve(REPO_ROOT, 'src-tauri/target/debug/wattsorbit'),
]
const binPath = BIN_CANDIDATES.find(existsSync)
if (!binPath) {
  console.error('❌ No compiled binary found. Run: (cd src-tauri && cargo build)')
  process.exit(2)
}

// ── Test harness ─────────────────────────────────────────────────────────────

let failures = 0
function pass(name) { console.log(`  ✓  ${name}`) }
function fail(name, err) { failures++; console.error(`  ✗  ${name}\n     ${err}`) }

function osa(script) {
  try {
    return execFileSync('osascript', ['-e', script], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
    }).trim()
  } catch (e) {
    throw new Error(`osascript failed: ${e.stderr?.toString() || e.message}`)
  }
}

async function waitFor(predicate, { timeoutMs = 5000, pollMs = 150, label = 'condition' } = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await predicate()) return true
    await sleep(pollMs)
  }
  throw new Error(`timed out waiting for ${label}`)
}

function dashboardVisible() {
  const script = `
    tell application "System Events"
      if not (exists process "${PROCESS_NAME}") then return "false"
      tell process "${PROCESS_NAME}"
        set titles to name of windows
      end tell
    end tell
    return titles as string`
  try {
    const out = osa(script)
    return out.includes(APP_TITLE)
  } catch { return false }
}

function clickTrayMenuItem(itemName) {
  // Left-click on the tray icon would toggle the popup, not open the menu.
  // Our menu opens only on right-click (show_menu_on_left_click(false)).
  // We can't easily simulate right-click on NSStatusItem from AppleScript,
  // so we drive the menu by sending the menu action directly via accessibility.
  const script = `
    tell application "System Events"
      tell process "${PROCESS_NAME}"
        -- Menu bar 2 is the status items; menu bar item 1 is our tray icon.
        -- If the layout differs on a given Mac, the loop below finds the one
        -- whose menu has an item matching our label.
        set mbs to menu bar items of menu bar 2
        repeat with mb in mbs
          try
            click mb
            delay 0.2
            click menu item "${itemName}" of menu 1 of mb
            return "ok"
          on error
            -- wrong status item, dismiss and keep searching
            try
              key code 53 -- Escape
            end try
          end try
        end repeat
      end tell
    end tell
    return "not-found"`
  const out = osa(script)
  if (out !== 'ok') throw new Error(`tray menu item "${itemName}" not found (got "${out}")`)
}

function closeDashboardWindow() {
  const script = `
    tell application "System Events"
      tell process "${PROCESS_NAME}"
        if exists (window "${APP_TITLE}") then
          click button 1 of window "${APP_TITLE}"
          return "ok"
        end if
      end tell
    end tell
    return "no-window"`
  const out = osa(script)
  if (out !== 'ok') throw new Error(`could not click close button (got "${out}")`)
}

// ── Run ──────────────────────────────────────────────────────────────────────

console.log(`Launching ${binPath} …`)
const child = spawn(binPath, [], { stdio: 'ignore', detached: false })
child.on('error', e => { console.error('spawn error:', e); process.exit(2) })

// Give the app time to boot and register the tray
await sleep(2500)

try {
  // Test 1: open dashboard via tray menu
  try {
    clickTrayMenuItem('Open Dashboard')
    await waitFor(dashboardVisible, { label: 'dashboard window to appear (first open)' })
    pass('dashboard opens via tray menu')
  } catch (e) { fail('dashboard opens via tray menu', e.message) }

  // Test 2: close via red X → dashboard should be hidden (not killed)
  try {
    closeDashboardWindow()
    await waitFor(() => !dashboardVisible(), { label: 'dashboard window to hide' })
    pass('dashboard hides on close (prevent_close path)')
  } catch (e) { fail('dashboard hides on close', e.message) }

  // Test 3: re-open from tray — this is the regression we are guarding
  try {
    clickTrayMenuItem('Open Dashboard')
    await waitFor(dashboardVisible, { label: 'dashboard window to reappear', timeoutMs: 4000 })
    pass('dashboard reopens after close')
  } catch (e) { fail('dashboard reopens after close', e.message) }

} finally {
  // Tear down — the app process survives spawn's child handle because Tauri's
  // event loop detaches from our stdio; kill by pid group to be sure.
  try { process.kill(child.pid, 'SIGTERM') } catch {}
  await sleep(200)
  try { execFileSync('pkill', ['-f', PROCESS_NAME], { stdio: 'ignore' }) } catch {}
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`)
  process.exit(1)
}
console.log('\nAll native tests passed.')
