import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import Dashboard from './Dashboard'
import ErrorBoundary from './components/ErrorBoundary'
import './styles/globals.css'

// ── Sentry (optional) ─────────────────────────────────────────────────────────
// Set VITE_SENTRY_DSN in .env.production to enable crash reporting.
// If the env var is absent the app works normally — Sentry is never loaded.
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined
if (SENTRY_DSN) {
  import('@sentry/react').then(Sentry =>
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: import.meta.env.MODE,
      // No performance monitoring — only error capture
      tracesSampleRate: 0,
      // Never include PII
      sendDefaultPii: false,
    })
  ).catch(() => {})
}

// ── Window routing ────────────────────────────────────────────────────────────
// Route based on the Tauri window label (or ?window=dashboard in browser preview)
async function getWindowLabel(): Promise<string> {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    return getCurrentWindow().label
  } catch {
    return new URL(window.location.href).searchParams.get('window') ?? 'main'
  }
}

getWindowLabel().then(label => {
  const Component = label === 'dashboard' ? Dashboard : App
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <Component />
      </ErrorBoundary>
    </React.StrictMode>
  )
})
