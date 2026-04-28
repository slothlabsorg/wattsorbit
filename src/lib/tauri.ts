import { invoke } from '@tauri-apps/api/core'
import { openUrl } from '@tauri-apps/plugin-opener'
import type { PowerStatus, TodayStats, PowerSample } from '../types'

// ── External URL helper ───────────────────────────────────────────────────────
export async function openExternalUrl(url: string): Promise<void> {
  if (MOCK_MODE) { window.open(url, '_blank', 'noopener,noreferrer'); return }
  await openUrl(url)
}

// Opens macOS System Settings to the Battery pane via a native Rust command
// because the x-apple.systempreferences: URL scheme is blocked by plugin-opener's regex.
export async function openSystemSettings(): Promise<void> {
  if (MOCK_MODE) return
  return invoke('open_system_settings')
}

// ── Autostart helpers ─────────────────────────────────────────────────────────
export async function getAutoStart(): Promise<boolean> {
  if (MOCK_MODE) return false
  return invoke<boolean>('get_autostart')
}

export async function setAutoStart(enabled: boolean): Promise<void> {
  if (MOCK_MODE) return
  return invoke('set_autostart', { enabled })
}

const MOCK_MODE = (() => {
  try { return new URL(window.location.href).searchParams.get('mock') === '1' }
  catch { return false }
})()

// ── Mock data ─────────────────────────────────────────────────────────────────
const MOCK_HEALTH = {
  cycleCount: 183,
  temperatureCelsius: 29.5,
  designCapacityMah: 4382,
  maxCapacityMah: 4156,
  healthPercent: 95,
  optimizedCharging: true,
}

const MOCK_CHARGING: PowerStatus = {
  isCharging: true,
  chargeState: 'charging',
  batteryPercent: 78,
  timeRemainingMin: null,
  timeToFullMin: 38,
  wattsIn: 96,
  wattsOut: 45.2,
  chargerName: 'Apple 96W USB-C Power Adapter',
  cableType: 'USB-C 240W',
  error: null,
  connectedDevices: [
    { name: 'iPhone 15 Pro', manufacturer: 'Apple Inc.', currentMa: 1000, voltageMv: 5000, speed: 'USB 2.0', isPhone: true, isHub: false },
    { name: 'Logitech USB Receiver', manufacturer: 'Logitech', currentMa: 100, voltageMv: 5000, speed: 'USB 2.0', isPhone: false, isHub: false },
    { name: 'USB Fan', manufacturer: undefined, currentMa: 800, voltageMv: 5000, speed: 'USB 2.0', isPhone: false, isHub: false },
  ],
  ...MOCK_HEALTH,
}

const MOCK_DISCHARGING: PowerStatus = {
  isCharging: false,
  chargeState: 'discharging',
  batteryPercent: 45,
  timeRemainingMin: 134,
  timeToFullMin: null,
  wattsIn: null,
  wattsOut: 12.8,
  chargerName: null,
  cableType: null,
  error: null,
  connectedDevices: [
    { name: 'USB Mouse', manufacturer: 'Logitech', currentMa: 100, voltageMv: 5000, speed: 'USB 2.0', isPhone: false, isHub: false },
    { name: 'USB Fan', manufacturer: undefined, currentMa: 800, voltageMv: 5000, speed: 'USB 2.0', isPhone: false, isHub: false },
  ],
  ...MOCK_HEALTH,
}

// ── Mock history data ─────────────────────────────────────────────────────────

function makeMockSamples(): PowerSample[] {
  const now = Math.floor(Date.now() / 1000)
  const count = 90
  return Array.from({ length: count }, (_, i) => {
    const t = now - (count - i) * 10
    const phase = Math.floor(i / 30) % 3
    const j = Math.sin(i * 0.7) * 3
    const iphoneW = 5.0 + Math.sin(i * 0.3) * 0.5
    const fanW    = 4.0 + Math.sin(i * 0.5) * 0.3
    const rcvW    = 0.5
    if (phase === 0) return {
      timestampSecs: t, wattsIn: 96 + j, wattsOut: 43 + j * 0.5,
      devices: [{ name: 'iPhone 15 Pro', watts: iphoneW }, { name: 'USB Fan', watts: fanW }, { name: 'Logitech USB Receiver', watts: rcvW }],
    }
    if (phase === 1) return {
      timestampSecs: t, wattsIn: null, wattsOut: 13 + j * 0.4,
      devices: [{ name: 'USB Fan', watts: fanW }],
    }
    return {
      timestampSecs: t, wattsIn: 88 + j, wattsOut: 41 + j * 0.5,
      devices: [{ name: 'iPhone 15 Pro', watts: iphoneW }, { name: 'USB Fan', watts: fanW }],
    }
  })
}

const MOCK_TODAY_STATS: TodayStats = {
  whCharged: 142.4,
  whConsumed: 89.2,
  secondsPluggedIn: 12600, // 3h30m
  chargeSessions: [
    {
      chargerName: 'Apple 96W USB-C Power Adapter',
      cableType: 'USB-C PD 20V',
      startedAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
      endedAt: new Date(Date.now() - 1.5 * 3600_000).toISOString(),
      whDelivered: 96.0,
      peakWatts: 96,
    },
    {
      chargerName: 'Apple 96W USB-C Power Adapter',
      cableType: 'USB-C PD 20V',
      startedAt: new Date(Date.now() - 45 * 60_000).toISOString(),
      endedAt: null,
      whDelivered: 46.4,
      peakWatts: 96,
    },
  ],
  deviceStats: [
    { name: 'iPhone 15 Pro', manufacturer: 'Apple Inc.', whDrawn: 5.0, batteryImpactPct: 5.6 },
    { name: 'USB Fan', manufacturer: undefined, whDrawn: 4.0, batteryImpactPct: 4.5 },
    { name: 'Logitech USB Receiver', manufacturer: 'Logitech', whDrawn: 0.5, batteryImpactPct: 0.6 },
  ],
  samples: makeMockSamples(),
}

// ── API ───────────────────────────────────────────────────────────────────────
export async function getPowerStatus(): Promise<PowerStatus> {
  if (MOCK_MODE) {
    // Toggle between charging/discharging every 10s for demo
    const charging = Math.floor(Date.now() / 10_000) % 2 === 0
    return charging ? MOCK_CHARGING : MOCK_DISCHARGING
  }
  return invoke<PowerStatus>('get_power_status')
}

export async function getTodayStats(): Promise<TodayStats> {
  if (MOCK_MODE) return MOCK_TODAY_STATS
  return invoke<TodayStats>('get_today_stats')
}

export async function hideWindow(): Promise<void> {
  if (MOCK_MODE) return
  return invoke('hide_window')
}
