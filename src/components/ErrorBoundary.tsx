import React from 'react'
import { openReport } from '../lib/crash'

// ── Error boundary ────────────────────────────────────────────────────────────

interface State { error: Error | null }

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[WattsOrbit] Uncaught error:', error, info)

    // Report to Sentry if it was initialised (graceful if no DSN was set)
    try {
      // Dynamic import so a missing DSN doesn't break the build
      import('@sentry/react').then(Sentry =>
        Sentry.captureException(error, { extra: { componentStack: info.componentStack } })
      ).catch(() => {})
    } catch { /* ignore */ }
  }

  render() {
    if (this.state.error) {
      return (
        <CrashScreen
          error={this.state.error}
          onReset={() => this.setState({ error: null })}
        />
      )
    }
    return this.props.children
  }
}

// ── Crash screen ──────────────────────────────────────────────────────────────

function CrashScreen({ error, onReset }: { error: Error; onReset: () => void }) {
  function handleReport() {
    openReport({
      title: `[Crash] ${error.message}`,
      errorMessage: error.message,
      stack: error.stack,
    })
  }

  return (
    <div
      className="flex flex-col items-center justify-center text-center p-6 gap-4"
      style={{ minHeight: '200px' }}
    >
      {/* Icon */}
      <div className="w-12 h-12 rounded-2xl bg-danger/10 border border-danger/25 flex items-center justify-center text-xl">
        ⚡
      </div>

      <div className="space-y-1">
        <p className="text-sm font-semibold text-text-primary">Something went wrong</p>
        <p className="text-xs text-text-muted max-w-xs">
          WattsOrbit hit an unexpected error. Your data is safe.
        </p>
      </div>

      {/* Error message */}
      <code className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2 max-w-xs break-all text-left leading-relaxed">
        {error.message}
      </code>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onReset}
          className="px-3 py-1.5 rounded-lg bg-bg-surface border border-border text-xs
                     text-text-secondary hover:text-text-primary transition-colors"
        >
          Try again
        </button>
        <button
          onClick={handleReport}
          className="px-3 py-1.5 rounded-lg bg-primary text-bg-base text-xs font-semibold
                     hover:bg-amber-400 transition-colors"
        >
          Report issue →
        </button>
      </div>

      <p className="text-xs text-text-muted/60">
        Opens a pre-filled GitHub issue in your browser.
        <br />No data is sent automatically.
      </p>
    </div>
  )
}
