import { motion } from 'framer-motion'

interface Props {
  percent: number
  isCharging: boolean
  /** Show the healthy-range zone (20–80 %) overlay. Default true. */
  showHealthZone?: boolean
}

function barColor(pct: number, charging: boolean): string {
  if (charging) return '#f59e0b'
  if (pct > 40)  return '#34d399'
  if (pct > 20)  return '#fbbf24'
  return '#f87171'
}

export default function BatteryBar({ percent, isCharging, showHealthZone = true }: Props) {
  const color   = barColor(percent, isCharging)
  const clamped = Math.max(0, Math.min(100, percent))

  // Healthy zone: 20–80 %
  const ZONE_MIN = 20
  const ZONE_MAX = 80

  return (
    <div className="flex items-center gap-3">
      {/* Bar track */}
      <div className="flex-1 relative h-2.5 rounded-full bg-bg-overlay overflow-hidden">

        {/* Healthy-range zone underlay (20 %–80 %) */}
        {showHealthZone && (
          <div
            className="absolute inset-y-0 rounded-full"
            style={{
              left:  `${ZONE_MIN}%`,
              width: `${ZONE_MAX - ZONE_MIN}%`,
              background: 'rgba(52,211,153,0.12)',
            }}
          />
        )}

        {/* Filled bar */}
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />

        {/* Charging shimmer */}
        {isCharging && (
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full opacity-40"
            style={{
              backgroundColor: '#fff',
              backgroundImage: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)',
              backgroundSize: '60% 100%',
            }}
            animate={{ backgroundPosition: ['-60% 0', '160% 0'] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
          />
        )}

        {/* 80 % limit marker */}
        {showHealthZone && (
          <div
            className="absolute inset-y-0 w-px"
            style={{ left: `${ZONE_MAX}%`, background: 'rgba(52,211,153,0.45)' }}
          />
        )}
      </div>

      {/* Percentage + battery icon */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="font-mono text-sm font-medium" style={{ color }}>{clamped}%</span>
        <svg width="20" height="12" viewBox="0 0 20 12" fill="none">
          <rect x="0.5" y="0.5" width="16" height="11" rx="2.5" stroke={color} strokeWidth="1.2" />
          <rect x="2" y="2" width={Math.round(clamped / 100 * 12)} height="8" rx="1.2" fill={color} />
          <path d="M17.5 4v4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M19 5v2" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          {isCharging && <text x="4" y="10" fontSize="8" fill="#0f0e00" fontWeight="bold">⚡</text>}
        </svg>
      </div>
    </div>
  )
}
