import { motion } from 'framer-motion'
import type { PowerStatus } from '../types'
import { formatWatts, formatMinutes } from '../types'

interface Props { status: PowerStatus }

export default function PowerHeader({ status }: Props) {
  if (!status.isCharging) {
    return (
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-bg-surface border border-border">
        <div className="mt-0.5 w-9 h-9 rounded-lg bg-bg-overlay flex items-center justify-center shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M18.36 6.64a9 9 0 1 1-12.73 0" stroke="#f87171" strokeWidth="2" strokeLinecap="round" />
            <line x1="12" y1="2" x2="12" y2="12" stroke="#f87171" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-danger leading-tight">Not Connected</p>
          <p className="text-xs text-text-muted mt-0.5">No charger detected</p>
          {status.timeRemainingMin !== null && (
            <p className="text-xs text-text-secondary mt-1">
              Est. remaining: <span className="text-text-primary font-medium">{formatMinutes(status.timeRemainingMin)}</span>
            </p>
          )}
        </div>
      </div>
    )
  }

  // Charging — show watts in and charger info
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 px-4 py-3 rounded-xl bg-bg-surface border border-primary/30"
      style={{ boxShadow: '0 0 12px rgba(245,158,11,0.12)' }}
    >
      {/* Plug icon */}
      <div className="mt-0.5 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 2v4M8 2v4M6 6h12v4a6 6 0 0 1-6 6v0a6 6 0 0 1-6-6V6Z" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M12 16v6" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      </div>

      <div className="flex-1 min-w-0">
        {/* Charger name */}
        <p className="text-sm font-semibold text-primary leading-tight truncate">
          {status.chargerName ?? 'Charger Connected'}
        </p>

        {/* Watts row */}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {status.wattsIn !== null && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/15 text-xs font-mono font-semibold text-primary">
              ⚡ {status.wattsIn}W in
            </span>
          )}
          {status.wattsOut !== null && (
            <span className="text-xs text-text-muted">
              {formatWatts(status.wattsOut)} used
            </span>
          )}
        </div>

        {/* Cable type + time to full */}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {status.cableType && (
            <span className="text-xs text-text-muted">{status.cableType}</span>
          )}
          {status.timeToFullMin !== null && (
            <span className="text-xs text-text-secondary">
              Full in {formatMinutes(status.timeToFullMin)}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}
