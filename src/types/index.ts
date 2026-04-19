// ── USB Device ────────────────────────────────────────────────────────────────
export interface UsbDevice {
  name: string
  manufacturer?: string
  currentMa?: number      // milliamps drawn from host
  voltageMv?: number      // millivolts (5000 = USB-A, varies for USB-C)
  speed?: string          // "USB 2.0", "USB 3.2", "USB4", etc.
  isPhone: boolean
  isHub: boolean
  children?: UsbDevice[]
}

// ── Power Status ──────────────────────────────────────────────────────────────
export interface PowerStatus {
  /** True if a charger is physically connected (regardless of active charging) */
  isCharging: boolean
  /** "charging" | "charged" | "discharging" */
  chargeState: 'charging' | 'charged' | 'discharging'
  /** 0–100 */
  batteryPercent: number
  /** Minutes remaining when discharging. null = calculating or N/A */
  timeRemainingMin: number | null
  /** Minutes to full when charging. null = calculating or N/A */
  timeToFullMin: number | null
  /** Watts delivered by the charger (e.g. 96 for a 96W adapter) */
  wattsIn: number | null
  /** Watts currently consumed by the whole system */
  wattsOut: number | null
  /** Human name of the adapter, e.g. "Apple 96W USB-C Power Adapter" */
  chargerName: string | null
  /** Cable/connector type, e.g. "USB-C", "MagSafe 3" */
  cableType: string | null
  /** All USB devices currently connected */
  connectedDevices: UsbDevice[]
  /** Non-fatal warning or error from the backend */
  error: string | null
}

// ── History / Dashboard ───────────────────────────────────────────────────────

export interface DeviceDraw {
  name: string
  watts: number
}

export interface PowerSample {
  timestampSecs: number
  wattsIn: number | null
  wattsOut: number | null
  devices: DeviceDraw[]
}

export interface ChargeSession {
  chargerName: string
  cableType: string | null
  startedAt: string       // ISO-8601
  endedAt: string | null  // null = still active
  whDelivered: number
  peakWatts: number
}

export interface DeviceStat {
  name: string
  manufacturer?: string
  whDrawn: number
  batteryImpactPct: number
}

export interface TodayStats {
  whCharged: number
  whConsumed: number
  secondsPluggedIn: number
  chargeSessions: ChargeSession[]
  deviceStats: DeviceStat[]
  samples: PowerSample[]
}

// ── Derived helpers ───────────────────────────────────────────────────────────
export function deviceWatts(d: UsbDevice): number {
  const ma = d.currentMa ?? 500
  const mv = d.voltageMv ?? 5000
  return (ma * mv) / 1_000_000
}

export function totalDeviceWatts(devices: UsbDevice[]): number {
  return devices.reduce((sum, d) => sum + deviceWatts(d), 0)
}

export function formatMinutes(min: number | null): string {
  if (min === null || min <= 0 || min === 65535) return 'Calculating…'
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function formatWatts(w: number | null): string {
  if (w === null) return '—'
  return `${w.toFixed(1)}W`
}
