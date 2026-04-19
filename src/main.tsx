import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import Dashboard from './Dashboard'
import './styles/globals.css'

// Route based on the Tauri window label (or URL hash in browser preview)
async function getWindowLabel(): Promise<string> {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    return getCurrentWindow().label
  } catch {
    // Browser preview: use ?window=dashboard
    return new URL(window.location.href).searchParams.get('window') ?? 'main'
  }
}

getWindowLabel().then(label => {
  const Component = label === 'dashboard' ? Dashboard : App
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <Component />
    </React.StrictMode>
  )
})
