import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { PowerStatus } from './types'
import { formatWatts, formatMinutes, totalDeviceWatts } from './types'
import { getPowerStatus, hideWindow } from './lib/tauri'
import { openReport } from './lib/crash'
import PowerHeader from './components/PowerHeader'
import BatteryBar from './components/BatteryBar'
import DeviceList from './components/DeviceList'
import { UpdateBanner } from './components/UpdateBanner'

const POLL_MS = 5_000

// ── Logo / brand mark ─────────────────────────────────────────────────────────
function BoltLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M13 2L4.09 12.74a.5.5 0 0 0 .38.83H11v8.43a.5.5 0 0 0 .9.3L20.91 11.3a.5.5 0 0 0-.39-.83H15V2.5A.5.5 0 0 0 13 2Z"
        fill="#f59e0b"
        stroke="#d97706"
        strokeWidth="0.5"
      />
    </svg>
  )
}

// ── Close button ──────────────────────────────────────────────────────────────
function CloseBtn() {
  return (
    <button
      onClick={() => hideWindow()}
      className="w-6 h-6 rounded-full flex items-center justify-center
                 text-text-muted hover:text-text-primary hover:bg-bg-overlay transition-colors"
      title="Close"
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </button>
  )
}

// ── Stat pill ─────────────────────────────────────────────────────────────────
function StatPill({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex-1 rounded-lg px-3 py-2 text-center ${highlight ? 'bg-primary/10 border border-primary/25' : 'bg-bg-surface border border-border-subtle'}`}>
      <p className="text-xs text-text-muted mb-0.5">{label}</p>
      <p className={`text-sm font-mono font-semibold ${highlight ? 'text-primary' : 'text-text-primary'}`}>{value}</p>
    </div>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="space-y-3 px-4 py-3 animate-pulse">
      <div className="h-14 rounded-xl bg-bg-surface" />
      <div className="h-8 rounded-lg bg-bg-surface" />
      <div className="h-4 rounded bg-bg-surface" />
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [status, setStatus]   = useState<PowerStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(Date.now())

  const refresh = useCallback(async () => {
    try {
      const s = await getPowerStatus()
      setStatus(s)
    } catch (err) {
      console.error('WattsOrbit: failed to read power status', err)
    } finally {
      setLoading(false)
      setLastUpdate(Date.now())
    }
  }, [])

  // Initial load + polling
  useEffect(() => {
    refresh()
    const id = setInterval(refresh, POLL_MS)
    return () => clearInterval(id)
  }, [refresh])

  // Refresh on window focus (user re-opens the popup)
  useEffect(() => {
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  const devWatts = status ? totalDeviceWatts(status.connectedDevices) : 0
  const netBalance = status?.wattsIn != null ? status.wattsIn - (status.wattsOut ?? 0) : null

  // ── Charger connection flash ────────────────────────────────────────────────
  // Brief amber radial glow that plays once when a charger is plugged in.
  const prevIsCharging = useRef<boolean | null>(null)
  const [chargerFlash, setChargerFlash] = useState(false)
  useEffect(() => {
    if (prevIsCharging.current === false && status?.isCharging === true) {
      setChargerFlash(true)
      const t = setTimeout(() => setChargerFlash(false), 850)
      return () => clearTimeout(t)
    }
    if (status != null) prevIsCharging.current = status.isCharging
  }, [status?.isCharging])

  // Status badge label + color
  const badgeLabel = !status ? '' :
    status.chargeState === 'charging'     ? '⚡ Charging' :
    status.chargeState === 'charged'      ? '✓ Charged'  :
                                            '🔋 On Battery'
  const badgeClass = !status ? '' :
    status.chargeState === 'charging' ? 'bg-primary/15 text-primary'  :
    status.chargeState === 'charged'  ? 'bg-success/15 text-success'  :
                                        'bg-danger/15 text-danger'

  return (
    /* Root fills window exactly — no min-h-screen so transparent area below card doesn't show */
    <div className="w-full">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="relative w-full bg-bg-elevated rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.65), 0 0 0 1px rgba(245,158,11,0.12)' }}
      >
        <UpdateBanner />
        {/* ── Charger-connected flash overlay ──────────────────────────── */}
        <AnimatePresence>
          {chargerFlash && (
            <motion.div
              key="charger-flash"
              initial={{ opacity: 0.55 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="absolute inset-0 pointer-events-none z-50 rounded-2xl"
              style={{
                background: 'radial-gradient(ellipse 90% 65% at 50% 45%, rgba(245,158,11,0.38) 0%, transparent 70%)',
              }}
            />
          )}
        </AnimatePresence>

        {/* ── Drag / title bar ─────────────────────────────────────────── */}
        <div
          data-tauri-drag-region
          className="flex items-center justify-between px-4 py-3 border-b border-border-subtle"
        >
          <div className="flex items-center gap-2" data-tauri-drag-region>
            <BoltLogo />
            <span className="font-display text-sm font-semibold text-text-primary" data-tauri-drag-region>
              WattsOrbit
            </span>
            {status && (
              <span className={`text-xs px-1.5 py-0.5 rounded-md font-mono font-medium ${badgeClass}`}>
                {badgeLabel}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Battery temperature pill — amber if warm, red if hot */}
            {status?.temperatureCelsius != null && (
              <span
                className="text-xs font-mono px-1.5 py-0.5 rounded-md"
                style={
                  status.temperatureCelsius >= 40
                    ? { background: 'rgba(248,113,113,0.15)', color: '#f87171' }
                    : status.temperatureCelsius >= 35
                    ? { background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }
                    : { background: 'rgba(255,255,255,0.06)', color: '#6b7280' }
                }
                title="Battery temperature"
              >
                {status.temperatureCelsius.toFixed(1)}°C
              </span>
            )}
            {/* Last-updated dot */}
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" title={`Updated ${Math.round((Date.now() - lastUpdate) / 1000)}s ago`} />
            <CloseBtn />
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────── */}
        {loading || !status
          ? <LoadingSkeleton />
          : (
          <div className="pb-3">
            {/* Charger status */}
            <div className="px-4 pt-3 pb-2">
              <PowerHeader status={status} />
            </div>

            {/* Battery bar */}
            <div className="px-4 pb-3">
              <BatteryBar percent={status.batteryPercent} isCharging={status.isCharging} />
            </div>

            {/* Stats row */}
            <div className="px-4 pb-3 flex gap-2">
              {status.chargeState !== 'charged' && (
                <StatPill
                  label={status.isCharging ? 'Time to full' : 'Time left'}
                  value={formatMinutes(status.isCharging ? status.timeToFullMin : status.timeRemainingMin)}
                />
              )}
              <StatPill
                label="System draw"
                value={formatWatts(status.wattsOut)}
              />
              {netBalance !== null && (
                <StatPill
                  label="Net balance"
                  value={`${netBalance > 0 ? '+' : ''}${netBalance.toFixed(1)}W`}
                  highlight={netBalance > 0}
                />
              )}
              {status.healthPercent != null && (
                <StatPill
                  label="Battery health"
                  value={`${status.healthPercent}%`}
                  highlight={status.healthPercent >= 80}
                />
              )}
            </div>

            {/* Error banner */}
            {status.error && (
              <div className="mx-4 mb-3 px-3 py-2 rounded-lg bg-danger/10 border border-danger/25 text-xs text-danger">
                {status.error}
              </div>
            )}

            {/* Devices section */}
            <div className="border-t border-border-subtle pt-2">
              <div className="flex items-center justify-between px-4 py-1.5">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Connected Devices
                </p>
                <span className="text-xs text-text-muted">
                  {status.connectedDevices.length} device{status.connectedDevices.length !== 1 ? 's' : ''}
                </span>
              </div>

              <DeviceList
                devices={status.connectedDevices}
                isCharging={status.isCharging}
                totalDeviceWatts={devWatts}
              />
            </div>

            {/* Footer: refresh + report issue */}
            <div className="px-4 pt-3 flex items-center justify-between">
              <button
                onClick={refresh}
                className="text-xs text-text-muted hover:text-text-secondary transition-colors"
              >
                Refresh · {new Date(lastUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </button>
              <button
                onClick={() => openReport()}
                className="text-xs text-text-muted/60 hover:text-text-muted transition-colors"
                title="Report an issue on GitHub"
              >
                Report issue
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}

