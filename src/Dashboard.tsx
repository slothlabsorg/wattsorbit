import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { TodayStats, ChargeSession, DeviceStat, PowerSample, PowerStatus } from './types'
import { deviceWatts, totalDeviceWatts } from './types'
import { getTodayStats, getPowerStatus, openExternalUrl, setAutoStart } from './lib/tauri'
import { openReport } from './lib/crash'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtWh   = (wh: number) => `${wh.toFixed(1)} Wh`
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const fmtTimeSecs = (s: number) =>
  new Date(s * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

function fmtDuration(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h === 0 && m === 0) return '<1m'
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

// ── Device colour palette ─────────────────────────────────────────────────────
const PALETTE = [
  { line: 'rgba(245,158,11,0.9)',  area: 'rgba(245,158,11,0.18)',  dot: '#f59e0b' },  // amber
  { line: 'rgba(59,130,246,0.85)', area: 'rgba(59,130,246,0.15)',  dot: '#3b82f6' },  // blue
  { line: 'rgba(16,185,129,0.85)', area: 'rgba(16,185,129,0.15)',  dot: '#10b981' },  // emerald
  { line: 'rgba(139,92,246,0.85)', area: 'rgba(139,92,246,0.15)',  dot: '#8b5cf6' },  // violet
  { line: 'rgba(249,115,22,0.85)', area: 'rgba(249,115,22,0.15)',  dot: '#f97316' },  // orange
  { line: 'rgba(236,72,153,0.85)', area: 'rgba(236,72,153,0.15)',  dot: '#ec4899' },  // pink
]

function paletteFor(name: string, allNames: string[]) {
  const idx = allNames.indexOf(name)
  return PALETTE[idx % PALETTE.length]
}

// ── SVG chart helpers ─────────────────────────────────────────────────────────
const CW = 760, CH = 200
const PAD = { t: 14, r: 16, b: 32, l: 48 }
const PW = CW - PAD.l - PAD.r
const PH = CH - PAD.t - PAD.b

function buildLine(
  pts: Array<{ x: number; y: number } | null>,
): string {
  let d = '', gap = true
  for (const p of pts) {
    if (!p) { gap = true; continue }
    d += gap ? `M${p.x.toFixed(1)} ${p.y.toFixed(1)}` : ` L${p.x.toFixed(1)} ${p.y.toFixed(1)}`
    gap = false
  }
  return d
}

function buildArea(
  pts: Array<{ x: number; yTop: number; yBot: number } | null>,
): string {
  const segs: string[] = []
  let top: string[] = [], bot: string[] = []

  const flush = () => {
    if (top.length > 1) {
      segs.push(
        `M${top[0]} ` + top.slice(1).map(p => `L${p}`).join(' ') +
        ' ' + bot.slice().reverse().map(p => `L${p}`).join(' ') + ' Z'
      )
    }
    top = []; bot = []
  }

  for (const p of pts) {
    if (!p) { flush(); continue }
    top.push(`${p.x.toFixed(1)},${p.yTop.toFixed(1)}`)
    bot.push(`${p.x.toFixed(1)},${p.yBot.toFixed(1)}`)
  }
  flush()
  return segs.join(' ')
}

// ── Power flow chart ──────────────────────────────────────────────────────────
function PowerChart({ samples }: { samples: PowerSample[] }) {
  if (samples.length < 3) {
    return (
      <div className="flex items-center justify-center h-36 text-sm text-text-muted italic">
        Collecting data — check back in ~30 seconds
      </div>
    )
  }

  const tMin = samples[0].timestampSecs
  const tMax = samples[samples.length - 1].timestampSecs
  const tRange = Math.max(tMax - tMin, 1)

  // Collect all unique device names in order of first appearance
  const deviceNames: string[] = []
  for (const s of samples)
    for (const d of s.devices)
      if (!deviceNames.includes(d.name)) deviceNames.push(d.name)

  const allW = samples.flatMap(s => [s.wattsIn ?? 0, s.wattsOut ?? 0, ...s.devices.map(d => d.watts)])
  const wTop = Math.max(Math.ceil(Math.max(...allW, 10) / 20) * 20, 20)

  const xOf = (t: number) => PAD.l + ((t - tMin) / tRange) * PW
  const yOf = (w: number) => PAD.t + PH - (w / wTop) * PH

  // --- watts_out line (total system draw)
  const outPts = samples.map(s => s.wattsOut !== null
    ? { x: xOf(s.timestampSecs), y: yOf(s.wattsOut) } : null)

  // --- stacked device areas (cumulative from 0 upward)
  const deviceAreas = deviceNames.map(name => {
    const pts = samples.map(s => {
      const deviceIdx = deviceNames.indexOf(name)
      let baseline = 0
      for (let i = 0; i < deviceIdx; i++) {
        const prev = s.devices.find(d => d.name === deviceNames[i])
        baseline += prev?.watts ?? 0
      }
      const d = s.devices.find(dev => dev.name === name)
      if (!d || d.watts === 0) return null
      const top = baseline + d.watts
      return { x: xOf(s.timestampSecs), yTop: yOf(top), yBot: yOf(baseline) }
    })
    return { name, pts, color: paletteFor(name, deviceNames) }
  })

  // --- watts_in line (charger)
  const inPts = samples.map(s => s.wattsIn !== null
    ? { x: xOf(s.timestampSecs), y: yOf(s.wattsIn) } : null)

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    w: Math.round(wTop * f), y: yOf(wTop * f),
  }))
  const xLabels = [0, 0.25, 0.5, 0.75, 1]
    .map(f => Math.round(f * (samples.length - 1)))

  const hasCharging = samples.some(s => s.wattsIn !== null)

  return (
    <div>
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2 px-1">
        {hasCharging && (
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-0.5 rounded bg-amber-400" />
            <span className="text-xs text-text-muted">Charger (W in)</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-0.5 rounded bg-slate-400/60" />
          <span className="text-xs text-text-muted">System draw (W out)</span>
        </div>
        {deviceNames.map(name => {
          const c = paletteFor(name, deviceNames)
          return (
            <div key={name} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: c.area, border: `1px solid ${c.dot}` }} />
              <span className="text-xs text-text-muted">{name}</span>
            </div>
          )
        })}
      </div>

      <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full" style={{ height: CH }}>
        {/* Grid + Y labels */}
        {yTicks.map(({ w, y }) => (
          <g key={w}>
            <line x1={PAD.l} y1={y} x2={PAD.l + PW} y2={y}
              stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <text x={PAD.l - 6} y={y + 4} textAnchor="end"
              fill="rgba(254,252,232,0.35)" fontSize="10" fontFamily="monospace">
              {w}W
            </text>
          </g>
        ))}

        {/* X labels */}
        {xLabels.map(idx => (
          <text key={idx}
            x={xOf(samples[idx].timestampSecs)} y={CH - 4}
            textAnchor="middle" fill="rgba(254,252,232,0.35)" fontSize="10" fontFamily="monospace">
            {fmtTimeSecs(samples[idx].timestampSecs)}
          </text>
        ))}

        {/* Stacked device areas (drawn bottom to top = first device at bottom) */}
        {deviceAreas.map(({ name, pts, color }) => (
          <path key={name} d={buildArea(pts)} fill={color.area} />
        ))}

        {/* Device area outlines */}
        {deviceAreas.map(({ name, pts, color }) => (
          <path key={`l-${name}`}
            d={buildLine(pts.map(p => p ? { x: p.x, y: p.yTop } : null))}
            fill="none" stroke={color.line} strokeWidth="1" strokeDasharray="3 2"
            strokeLinejoin="round" strokeLinecap="round" />
        ))}

        {/* watts_out total — gray line */}
        <path d={buildLine(outPts)} fill="none"
          stroke="rgba(148,163,184,0.55)" strokeWidth="1.5"
          strokeLinejoin="round" strokeLinecap="round" />

        {/* watts_in — bold amber line on top */}
        {hasCharging && (
          <path d={buildLine(inPts)} fill="none"
            stroke="rgba(245,158,11,0.95)" strokeWidth="2.5"
            strokeLinejoin="round" strokeLinecap="round" />
        )}
      </svg>
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent = false }: {
  label: string; value: string; sub?: string; accent?: boolean
}) {
  return (
    <div className={`rounded-xl px-4 py-3 border ${
      accent ? 'bg-primary/10 border-primary/25' : 'bg-bg-surface border-border'
    }`}>
      <p className="text-xs text-text-muted mb-1">{label}</p>
      <p className={`text-xl font-mono font-bold ${accent ? 'text-primary' : 'text-text-primary'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-text-muted mt-0.5">{sub}</p>}
    </div>
  )
}

function SessionRow({ session }: { session: ChargeSession }) {
  const active = !session.endedAt
  const ms = active
    ? Date.now() - new Date(session.startedAt).getTime()
    : new Date(session.endedAt!).getTime() - new Date(session.startedAt).getTime()
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border-subtle last:border-0">
      <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${active ? 'bg-primary animate-pulse' : 'bg-text-muted/40'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-text-primary truncate">{session.chargerName}</span>
          {active && <span className="text-xs px-1.5 py-0.5 rounded bg-primary/15 text-primary font-mono">Active</span>}
        </div>
        <div className="flex flex-wrap gap-x-3 mt-0.5 text-xs text-text-muted">
          <span>{fmtTime(session.startedAt)}{session.endedAt ? ` – ${fmtTime(session.endedAt)}` : ' – now'}</span>
          <span>{fmtDuration(Math.round(ms / 1000))}</span>
          {session.cableType && <span>{session.cableType}</span>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-mono font-semibold text-primary">{fmtWh(session.whDelivered)}</p>
        <p className="text-xs text-text-muted">peak {session.peakWatts.toFixed(0)}W</p>
      </div>
    </div>
  )
}

function DeviceBar({ stat }: { stat: DeviceStat }) {
  const pct = Math.min(stat.batteryImpactPct, 100)
  return (
    <div className="py-2.5 border-b border-border-subtle last:border-0">
      <div className="flex items-center justify-between mb-1.5">
        <div>
          <span className="text-sm text-text-primary">{stat.name}</span>
          {stat.manufacturer && <span className="text-xs text-text-muted ml-2">{stat.manufacturer}</span>}
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-text-secondary">{fmtWh(stat.whDrawn)}</span>
          <span className="text-text-muted w-10 text-right">{pct.toFixed(1)}%</span>
        </div>
      </div>
      <div className="h-1.5 bg-bg-overlay rounded-full overflow-hidden">
        <motion.div className="h-full rounded-full bg-primary/70"
          initial={{ width: 0 }} animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }} />
      </div>
    </div>
  )
}

function LiveDeviceRow({ device, isCharging }: {
  device: PowerStatus['connectedDevices'][number]; isCharging: boolean
}) {
  const w = deviceWatts(device)
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border-subtle last:border-0">
      <div className="w-7 h-7 rounded-lg bg-bg-overlay flex items-center justify-center shrink-0">
        {device.isPhone ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <rect x="5" y="1" width="14" height="22" rx="3" stroke="#f59e0b" strokeWidth="1.8"/>
            <circle cx="12" cy="18" r="1" fill="#f59e0b"/>
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M2 9V6a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v3M2 15v3a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-3M7 12h10"
              stroke="#92834a" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-primary truncate">{device.name}</p>
        <div className="flex flex-wrap gap-x-2 text-xs text-text-muted mt-0.5">
          {device.manufacturer && <span>{device.manufacturer}</span>}
          {device.speed && <span>· {device.speed}</span>}
          {device.voltageMv && <span>· {(device.voltageMv / 1000).toFixed(0)}V</span>}
          {device.currentMa && <span>· {device.currentMa} mA</span>}
        </div>
      </div>
      <span className={`text-sm font-mono font-semibold shrink-0 ${isCharging ? 'text-text-secondary' : 'text-amber-400'}`}>
        {w >= 0.1 ? `${w.toFixed(1)}W` : '<0.1W'}
      </span>
    </div>
  )
}

function SectionHeader({ title, right }: { title: string; right?: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">{title}</p>
      {right && <p className="text-xs text-text-muted">{right}</p>}
    </div>
  )
}

// ── Autostart prompt ──────────────────────────────────────────────────────────

const ASKED_KEY = 'wattsorbit_autostart_asked'

function AutostartBanner({ onDone }: { onDone: () => void }) {
  const [loading, setLoading] = useState(false)

  async function handle(enable: boolean) {
    setLoading(true)
    try { await setAutoStart(enable) } catch { /* best-effort */ }
    localStorage.setItem(ASKED_KEY, '1')
    setLoading(false)
    onDone()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className="mb-6 rounded-xl border border-primary/30 bg-primary/8 px-4 py-3.5"
    >
      <div className="flex items-start gap-3">
        <span className="text-xl shrink-0 mt-0.5">⚡</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary mb-0.5">
            Start WattsOrbit at login?
          </p>
          <p className="text-xs text-text-muted leading-relaxed">
            Run in the background so power data is always captured — even when you
            don't open the app manually.
          </p>
          <div className="flex gap-2 mt-2.5">
            <button
              onClick={() => handle(true)}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-primary text-bg-base text-xs font-semibold
                         hover:bg-amber-400 transition-colors disabled:opacity-50"
            >
              Yes, start at login
            </button>
            <button
              onClick={() => handle(false)}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg border border-border text-xs text-text-muted
                         hover:text-text-secondary hover:border-border-muted transition-colors disabled:opacity-50"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ── Landing page ──────────────────────────────────────────────────────────────

const USE_CASES = [
  {
    icon: '⚡',
    title: 'Cable & Charger Quality',
    body: 'Does your cable truly deliver 100W or is it throttling? WattsOrbit shows real watts in vs out so you know exactly what your charger and cable are doing.',
  },
  {
    icon: '☀️',
    title: 'Field & Solar Work',
    body: 'Working off a solar power bank or generator? Monitor what\'s actually flowing in vs out. Know your real energy budget before you run out.',
  },
  {
    icon: '🔋',
    title: 'Battery Intelligence',
    body: 'Which USB device is silently eating your battery? Get alerts when connected devices push your remaining time below 30 minutes.',
  },
]

function Landing({ onOpen }: { onOpen: () => void }) {
  const [showAutostart, setShowAutostart] = useState(
    !localStorage.getItem(ASKED_KEY)
  )

  return (
    <div className="min-h-screen bg-bg-base text-text-primary flex flex-col">
      {/* Hero */}
      <div className="flex-1 max-w-3xl mx-auto px-8 pt-14 pb-8 w-full">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <AnimatePresence>
            {showAutostart && (
              <AutostartBanner onDone={() => setShowAutostart(false)} />
            )}
          </AnimatePresence>
          {/* Logo + name */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M13 2L4.09 12.74a.5.5 0 0 0 .38.83H11v8.43a.5.5 0 0 0 .9.3L20.91 11.3a.5.5 0 0 0-.39-.83H15V2.5A.5.5 0 0 0 13 2Z"
                  fill="#f59e0b" stroke="#d97706" strokeWidth="0.5" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-text-primary">WattsOrbit</h1>
              <p className="text-sm text-text-muted">Real-time power intelligence for your Mac</p>
            </div>
          </div>

          <p className="text-text-secondary text-base leading-relaxed mb-10 max-w-xl">
            Know exactly what your charger delivers, what your Mac consumes, and which USB devices
            are draining your battery — whether you're at a desk or working off a solar pack in the field.
          </p>

          {/* Use-case cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            {USE_CASES.map((c, i) => (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.08 }}
                className="bg-bg-surface border border-border rounded-xl p-4"
              >
                <div className="text-2xl mb-2">{c.icon}</div>
                <h3 className="text-sm font-semibold text-text-primary mb-1">{c.title}</h3>
                <p className="text-xs text-text-muted leading-relaxed">{c.body}</p>
              </motion.div>
            ))}
          </div>

          {/* CTA */}
          <motion.button
            onClick={onOpen}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-primary text-bg-base font-semibold text-sm
                       shadow-lg shadow-primary/30 hover:bg-amber-400 transition-colors"
          >
            View Power Data →
          </motion.button>
        </motion.div>
      </div>

      {/* Footer — SlothLabs */}
      <div className="border-t border-border-subtle px-8 py-5">
        <div className="max-w-3xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs font-semibold text-text-secondary">SlothLabs</p>
            <p className="text-xs text-text-muted mt-0.5">
              Tiny tools for developers and power users.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => openExternalUrl('https://github.com/slothlabs')}
              className="text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              GitHub
            </button>
            <button
              onClick={() => openReport()}
              className="text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              Report issue
            </button>
            <button
              onClick={() => openExternalUrl('https://ko-fi.com/slothlabs')}
              className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/25 text-primary
                         hover:bg-primary/20 transition-colors"
            >
              ☕ Support us
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Battery Health Panel ──────────────────────────────────────────────────────

function HealthBadge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
      ok ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
    }`}>
      {label}
    </span>
  )
}

function BatteryHealthPanel({ power }: { power: PowerStatus }) {
  const hasHealth = power.cycleCount != null || power.healthPercent != null
  if (!hasHealth) return null

  const healthColor =
    power.healthPercent == null ? '#6b7280' :
    power.healthPercent >= 80   ? '#34d399' :
    power.healthPercent >= 60   ? '#fbbf24' : '#f87171'

  const tempColor =
    power.temperatureCelsius == null ? '#6b7280' :
    power.temperatureCelsius >= 40   ? '#f87171' :
    power.temperatureCelsius >= 35   ? '#fbbf24' : '#34d399'

  return (
    <div>
      <SectionHeader title="Battery Health" />
      <div className="bg-bg-surface border border-border rounded-xl p-4 space-y-4">

        {/* Health % bar */}
        {power.healthPercent != null && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-text-muted">Battery health</span>
              <span className="text-sm font-mono font-bold" style={{ color: healthColor }}>
                {power.healthPercent}%
              </span>
            </div>
            <div className="h-2 bg-bg-overlay rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: healthColor }}
                initial={{ width: 0 }}
                animate={{ width: `${power.healthPercent}%` }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-text-muted/60">
              <span>0%</span>
              <span>Good ≥ 80%</span>
              <span>100%</span>
            </div>
          </div>
        )}

        {/* Grid of stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {power.cycleCount != null && (
            <div className="bg-bg-overlay rounded-lg px-3 py-2.5">
              <p className="text-xs text-text-muted mb-0.5">Cycle count</p>
              <p className="text-base font-mono font-semibold text-text-primary">
                {power.cycleCount}
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                {power.cycleCount < 500 ? 'Healthy' : power.cycleCount < 1000 ? 'Moderate' : 'High'}
              </p>
            </div>
          )}

          {power.maxCapacityMah != null && (
            <div className="bg-bg-overlay rounded-lg px-3 py-2.5">
              <p className="text-xs text-text-muted mb-0.5">Max capacity</p>
              <p className="text-base font-mono font-semibold text-text-primary">
                {power.maxCapacityMah} mAh
              </p>
              {power.designCapacityMah && (
                <p className="text-xs text-text-muted mt-0.5">
                  of {power.designCapacityMah} mAh
                </p>
              )}
            </div>
          )}

          {power.temperatureCelsius != null && (
            <div className="bg-bg-overlay rounded-lg px-3 py-2.5">
              <p className="text-xs text-text-muted mb-0.5">Temperature</p>
              <p className="text-base font-mono font-semibold" style={{ color: tempColor }}>
                {power.temperatureCelsius.toFixed(1)}°C
              </p>
              <p className="text-xs mt-0.5" style={{ color: tempColor }}>
                {power.temperatureCelsius >= 40 ? 'Hot — check ventilation' :
                 power.temperatureCelsius >= 35 ? 'Warm' : 'Normal'}
              </p>
            </div>
          )}

          {power.optimizedCharging != null && (
            <div className="bg-bg-overlay rounded-lg px-3 py-2.5">
              <p className="text-xs text-text-muted mb-0.5">Optimized charging</p>
              <div className="mt-1">
                <HealthBadge
                  label={power.optimizedCharging ? 'Active' : 'Off'}
                  ok={power.optimizedCharging}
                />
              </div>
              <p className="text-xs text-text-muted mt-1.5">
                {power.optimizedCharging ? 'Pauses at 80%' : 'Charging to 100%'}
              </p>
            </div>
          )}
        </div>

        {/* Open System Settings hint */}
        <div className="flex items-center justify-between pt-1 border-t border-border-subtle">
          <p className="text-xs text-text-muted">
            Apple replaces batteries below 80% health under AppleCare.
          </p>
          <button
            onClick={() => openExternalUrl('x-apple.systempreferences:com.apple.preference.battery')}
            className="text-xs text-primary hover:text-amber-300 transition-colors shrink-0 ml-3"
          >
            System Settings →
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Roadmap ────────────────────────────────────────────────────────────────────

const V1_FEATURES = [
  { icon: '⚡', label: 'Real-time watts in / out' },
  { icon: '📊', label: 'Power flow chart (today)' },
  { icon: '🔌', label: 'Charger & cable detection' },
  { icon: '📱', label: 'USB device monitoring' },
  { icon: '🔋', label: 'Battery health panel' },
  { icon: '🌡️', label: 'Temperature display & alerts' },
  { icon: '🟢', label: 'Healthy-range indicator (20–80%)' },
  { icon: '🔔', label: 'Charge-limit notifications (80%)' },
  { icon: '💡', label: 'Login-item autostart' },
]

const PRO_FEATURES = [
  {
    icon: '🎯',
    label: 'Custom Charge Limit',
    desc: 'Stop charging at any % (e.g. 80%) to maximise long-term battery lifespan. Requires writing SMC key CH0B — needs privileged helper process.',
    tag: 'Pro',
  },
  {
    icon: '⛵',
    label: 'Sailing Mode',
    desc: 'Discharge your battery to a target level before reconnecting power. Ideal after long AC sessions to recalibrate.',
    tag: 'Pro',
  },
  {
    icon: '🔥',
    label: 'Heat Protection',
    desc: 'Automatically pause charging when the battery exceeds a temperature threshold to prevent heat degradation.',
    tag: 'Pro',
  },
  {
    icon: '⬇️',
    label: 'Discharge Mode',
    desc: 'Force the Mac to run on battery even when plugged in. Useful for calibration and clearing memory effects.',
    tag: 'Pro',
  },
  {
    icon: '🔝',
    label: 'Top Up',
    desc: 'Temporarily override your charge limit and charge to 100% with one click — for long travel days.',
    tag: 'Pro',
  },
  {
    icon: '📈',
    label: 'Export & Reporting',
    desc: 'Export power history as CSV/JSON. Weekly email summaries, cycle trend graphs, and battery degradation projections.',
    tag: 'Pro',
  },
]

function Roadmap() {
  return (
    <div>
      <SectionHeader title="What's Coming" />
      <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">

        {/* v1 Free — shipped */}
        <div className="px-4 pt-4 pb-3 border-b border-border-subtle">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-success">
              v1.0 Free — Available Now
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-success/15 text-success font-mono">✓ Shipped</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1.5">
            {V1_FEATURES.map(f => (
              <div key={f.label} className="flex items-center gap-2 text-xs text-text-secondary">
                <span>{f.icon}</span>
                <span>{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* v2 Pro — coming soon */}
        <div className="px-4 pt-4 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              v2.0 Pro — In Development
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-primary/15 text-primary font-mono">Coming Soon</span>
          </div>
          <p className="text-xs text-text-muted mb-3 leading-relaxed">
            Pro features require writing to your Mac's SMC (System Management Controller) to directly
            control charging hardware — the same approach used by apps like AlDente and coconutBattery Pro.
            This needs a signed privileged helper that runs with elevated permissions,
            which takes significant engineering effort and Apple notarisation to maintain safely.
            The Pro tier funds that ongoing development and maintenance.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PRO_FEATURES.map(f => (
              <div key={f.label} className="flex items-start gap-3 bg-bg-overlay rounded-lg p-3">
                <span className="text-lg shrink-0 mt-0.5">{f.icon}</span>
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-sm font-medium text-text-primary">{f.label}</span>
                    <span className="text-xs px-1 py-0.5 rounded bg-primary/15 text-primary font-mono leading-none">
                      {f.tag}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer CTA */}
        <div className="px-4 py-3 border-t border-border-subtle bg-bg-overlay/50 flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs text-text-muted">
            Interested in Pro features? Let us know — early interest shapes the roadmap.
          </p>
          <button
            onClick={() => openExternalUrl('https://ko-fi.com/slothlabs')}
            className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/25 text-primary
                       hover:bg-primary/20 transition-colors shrink-0"
          >
            ☕ Support development
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Power data view ───────────────────────────────────────────────────────────

function PowerDataView({ onBack }: { onBack: () => void }) {
  const [stats, setStats] = useState<TodayStats | null>(null)
  const [power, setPower] = useState<PowerStatus | null>(null)
  const [lastUpdate, setLastUpdate] = useState(Date.now())

  const refresh = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([getTodayStats(), getPowerStatus()])
      setStats(s); setPower(p); setLastUpdate(Date.now())
    } catch (err) { console.error('Dashboard refresh error', err) }
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 10_000)
    return () => clearInterval(id)
  }, [refresh])

  if (!stats || !power) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="animate-pulse text-text-muted text-sm">Loading…</div>
      </div>
    )
  }

  const netWh    = stats.whCharged - stats.whConsumed
  const devWatts = totalDeviceWatts(power.connectedDevices)

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-bg-elevated border-b border-border-subtle px-6 py-3">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="w-7 h-7 rounded-lg bg-bg-surface border border-border flex items-center justify-center
                         text-text-muted hover:text-text-primary transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M13 2L4.09 12.74a.5.5 0 0 0 .38.83H11v8.43a.5.5 0 0 0 .9.3L20.91 11.3a.5.5 0 0 0-.39-.83H15V2.5A.5.5 0 0 0 13 2Z"
                  fill="#f59e0b" stroke="#d97706" strokeWidth="0.5" />
              </svg>
              <span className="font-display text-sm font-semibold">Today's Power Data</span>
            </div>
          </div>
          <button onClick={refresh}
            className="text-xs text-text-muted hover:text-text-secondary transition-colors">
            {new Date(lastUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-5 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Charged today"  value={fmtWh(stats.whCharged)}  sub="from adapter" />
          <StatCard label="Consumed today" value={fmtWh(stats.whConsumed)} sub="system draw" />
          <StatCard
            label="Net balance"
            value={(netWh >= 0 ? '+' : '') + fmtWh(netWh)}
            sub={netWh >= 0 ? 'battery net gain' : 'battery net drain'}
            accent={netWh > 0}
          />
          <StatCard label="On charger" value={fmtDuration(stats.secondsPluggedIn)} sub="today" />
        </div>

        {/* Chart */}
        <div>
          <SectionHeader title="Power Flow" right="up to last 2 hours" />
          <div className="bg-bg-surface border border-border rounded-xl px-4 pt-3 pb-2">
            <PowerChart samples={stats.samples} />
          </div>
        </div>

        {/* Two columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            {/* Merge live devices + session history into one list.
                Devices still connected show their live wattage;
                devices seen earlier today but now disconnected show their
                accumulated wh from stats.deviceStats. */}
            {(() => {
              const liveNames = new Set(power.connectedDevices.map(d => d.name))
              const disconnected = stats.deviceStats.filter(s => !liveNames.has(s.name))
              const totalCount = power.connectedDevices.length + disconnected.length
              const right = power.connectedDevices.length > 0
                ? `${power.connectedDevices.length} live · ${devWatts.toFixed(1)}W`
                : totalCount > 0 ? `${totalCount} seen today` : undefined
              return (
                <>
                  <SectionHeader title="Devices" right={right} />
                  <div className="bg-bg-surface border border-border rounded-xl px-4">
                    {/* Live connected devices */}
                    {power.connectedDevices.map((d, i) => (
                      <LiveDeviceRow key={`live-${i}`} device={d} isCharging={power.isCharging} />
                    ))}

                    {/* Disconnected devices seen today */}
                    {disconnected.map((s, i) => (
                      <div key={`hist-${i}`}
                        className="flex items-center gap-3 py-2.5 border-b border-border-subtle last:border-0 opacity-55">
                        <div className="w-7 h-7 rounded-lg bg-bg-overlay flex items-center justify-center shrink-0">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                            <path d="M2 9V6a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v3M2 15v3a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-3M7 12h10"
                              stroke="#92834a" strokeWidth="1.8" strokeLinecap="round"/>
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-text-secondary truncate">{s.name}</p>
                            <span className="text-xs px-1.5 py-0.5 rounded bg-bg-overlay text-text-muted font-mono shrink-0">
                              disconnected
                            </span>
                          </div>
                          {s.manufacturer && (
                            <p className="text-xs text-text-muted mt-0.5">{s.manufacturer}</p>
                          )}
                        </div>
                        <span className="text-xs font-mono text-text-muted shrink-0">
                          {s.whDrawn.toFixed(2)} Wh today
                        </span>
                      </div>
                    ))}

                    {power.connectedDevices.length === 0 && disconnected.length === 0 && (
                      <p className="text-sm text-text-muted py-4 text-center">No USB devices today</p>
                    )}

                    {!power.isCharging && power.connectedDevices.length > 0 && (
                      <div className="py-2 flex justify-between text-xs border-t border-border-subtle mt-1">
                        <span className="text-text-muted">Total drain from battery</span>
                        <span className="font-mono font-semibold text-amber-400">{devWatts.toFixed(1)}W</span>
                      </div>
                    )}
                  </div>
                </>
              )
            })()}
          </div>

          <div>
            <SectionHeader title="Charge Sessions" />
            <div className="bg-bg-surface border border-border rounded-xl px-4">
              {stats.chargeSessions.length === 0
                ? <p className="text-sm text-text-muted py-4 text-center">No sessions recorded yet</p>
                : stats.chargeSessions.map((s, i) => <SessionRow key={i} session={s} />)
              }
            </div>
          </div>
        </div>

        {/* Device impact */}
        <div>
          <SectionHeader
            title="Device Impact on Battery"
            right={`${stats.whConsumed.toFixed(1)} Wh total today`}
          />
          {stats.deviceStats.length === 0
            ? <p className="text-sm text-text-muted py-2 text-center">No device activity yet</p>
            : (
              <div className="bg-bg-surface border border-border rounded-xl px-4">
                {stats.deviceStats
                  .slice().sort((a, b) => b.whDrawn - a.whDrawn)
                  .map((d, i) => <DeviceBar key={i} stat={d} />)
                }
              </div>
            )
          }
        </div>

        {/* ── Battery Health ──────────────────────────────────────────────── */}
        <BatteryHealthPanel power={power} />

        {/* ── Roadmap ─────────────────────────────────────────────────────── */}
        <Roadmap />

      </div>
    </div>
  )
}

// ── Shell — landing ↔ data ────────────────────────────────────────────────────

export default function Dashboard() {
  const [view, setView] = useState<'home' | 'data'>('home')

  return (
    <AnimatePresence mode="wait">
      {view === 'home' ? (
        <motion.div key="home"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}>
          <Landing onOpen={() => setView('data')} />
        </motion.div>
      ) : (
        <motion.div key="data"
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}>
          <PowerDataView onBack={() => setView('home')} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
