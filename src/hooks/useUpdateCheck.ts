import { useState, useEffect } from 'react'

export interface AppUpdate {
  version: string
  body?: string
  install: () => Promise<void>
}

export function useUpdateCheck(): { update: AppUpdate | null; installing: boolean } {
  const [update, setUpdate]         = useState<AppUpdate | null>(null)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function run() {
      // Playwright / browser mock: ?mock_update=X.Y.Z injects a fake pending update.
      try {
        const mockVer = new URLSearchParams(window.location.search).get('mock_update')
        if (mockVer) {
          setUpdate({ version: mockVer, body: 'Mock update for testing', install: async () => {} })
          return
        }
      } catch {}

      try {
        const { check } = await import('@tauri-apps/plugin-updater')
        const result = await check()
        if (!result || cancelled) return
        setUpdate({
          version: result.version,
          body: result.body ?? undefined,
          install: async () => {
            if (cancelled) return
            setInstalling(true)
            await result.downloadAndInstall()
            const { relaunch } = await import('@tauri-apps/plugin-process')
            await relaunch()
          },
        })
      } catch {
        // updater not configured or no network — silent
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  return { update, installing }
}
