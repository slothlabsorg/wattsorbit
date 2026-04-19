import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Backgrounds ─────────────────────────────
        'bg-base':     '#0f0e00',
        'bg-elevated': '#161400',
        'bg-surface':  '#1c1a00',
        'bg-surface2': '#221f00',
        'bg-overlay':  '#2b2700',
        // ── Borders ─────────────────────────────────
        'border':        '#3d3600',
        'border-subtle': '#2b2700',
        'border-focus':  '#f59e0b',
        // ── Brand ───────────────────────────────────
        'primary':       '#f59e0b',   // amber-500
        'primary-dim':   '#d97706',   // amber-600
        'accent':        '#fbbf24',   // amber-400
        // ── Semantic ────────────────────────────────
        'success':  '#34d399',
        'warning':  '#fbbf24',
        'danger':   '#f87171',
        'info':     '#60a5fa',
        // ── Text ────────────────────────────────────
        'text-primary':   '#fefce8',
        'text-secondary': '#fde68a',
        'text-muted':     '#92834a',
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        ui:      ['Inter', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'glow-amber': '0 0 24px rgba(245,158,11,0.30)',
        'glow-sm':    '0 0 10px rgba(245,158,11,0.15)',
        'popup':      '0 8px 40px rgba(0,0,0,0.6)',
      },
      keyframes: {
        pulse_amber: {
          '0%,100%': { opacity: '1' },
          '50%':     { opacity: '0.4' },
        },
      },
      animation: {
        'pulse-amber': 'pulse_amber 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config
