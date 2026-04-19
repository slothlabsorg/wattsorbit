import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { UsbDevice } from '../types'
import { deviceWatts } from '../types'

// ── Icons ─────────────────────────────────────────────────────────────────────
function DeviceIcon({ device }: { device: UsbDevice }) {
  if (device.isPhone) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <rect x="5" y="1" width="14" height="22" rx="3" stroke="#f59e0b" strokeWidth="1.8"/>
        <circle cx="12" cy="18" r="1" fill="#f59e0b"/>
      </svg>
    )
  }
  if (device.isHub) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="3" fill="#fbbf24"/>
        <path d="M12 9V3M7.76 10.24 3.51 6M16.24 10.24l4.25-4.24M12 15v6M7.76 13.76l-4.25 4.24M16.24 13.76l4.25 4.24" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    )
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M2 9V6a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v3M2 15v3a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-3M7 12h10" stroke="#92834a" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )
}

// ── Single Device Row ─────────────────────────────────────────────────────────
function DeviceRow({ device, isCharging }: { device: UsbDevice; isCharging: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const watts = deviceWatts(device)

  return (
    <div>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-bg-overlay transition-colors text-left group"
      >
        <div className="w-5 h-5 rounded-md bg-bg-surface2 flex items-center justify-center shrink-0">
          <DeviceIcon device={device} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm text-text-primary truncate leading-tight">{device.name}</p>
          {device.manufacturer && (
            <p className="text-xs text-text-muted truncate">{device.manufacturer}</p>
          )}
        </div>

        {/* Watts badge */}
        <div className="shrink-0 text-right">
          <span className={`text-xs font-mono font-semibold ${isCharging ? 'text-text-secondary' : 'text-warning'}`}>
            {watts >= 0.1 ? `${watts.toFixed(1)}W` : '<0.1W'}
          </span>
          {device.currentMa !== undefined && (
            <p className="text-xs text-text-muted">{device.currentMa}mA</p>
          )}
        </div>

        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          className={`shrink-0 text-text-muted transition-transform ${expanded ? 'rotate-90' : ''}`}
        >
          <path d="M4 3l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="mx-3 mb-2 px-3 py-2 rounded-lg bg-bg-overlay border border-border-subtle text-xs space-y-1">
              {device.speed && (
                <div className="flex justify-between">
                  <span className="text-text-muted">Speed</span>
                  <span className="text-text-secondary font-mono">{device.speed}</span>
                </div>
              )}
              {device.voltageMv !== undefined && (
                <div className="flex justify-between">
                  <span className="text-text-muted">Voltage</span>
                  <span className="text-text-secondary font-mono">{(device.voltageMv / 1000).toFixed(1)}V</span>
                </div>
              )}
              {device.currentMa !== undefined && (
                <div className="flex justify-between">
                  <span className="text-text-muted">Current</span>
                  <span className="text-text-secondary font-mono">{device.currentMa} mA</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-text-muted">Power</span>
                <span className="text-primary font-mono font-semibold">{watts.toFixed(2)} W</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Device List ───────────────────────────────────────────────────────────────
interface Props {
  devices: UsbDevice[]
  isCharging: boolean
  totalDeviceWatts: number
}

export default function DeviceList({ devices, isCharging, totalDeviceWatts }: Props) {
  if (devices.length === 0) {
    return (
      <div className="px-4 py-3 text-center text-xs text-text-muted">
        No USB devices detected
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      {devices.map((d, i) => (
        <DeviceRow key={i} device={d} isCharging={isCharging} />
      ))}

      {/* Footer: total draw */}
      <div className={`mx-3 mt-2 px-3 py-2 rounded-lg flex items-center justify-between text-xs
        ${isCharging ? 'bg-bg-surface border border-border-subtle' : 'bg-warning/10 border border-warning/25'}`}
      >
        <span className="text-text-muted">Total device draw</span>
        <span className={`font-mono font-semibold ${isCharging ? 'text-text-secondary' : 'text-warning'}`}>
          {totalDeviceWatts.toFixed(1)}W
          {!isCharging && <span className="text-text-muted font-normal ml-1">from battery</span>}
        </span>
      </div>
    </div>
  )
}
