/**
 * Crash / issue reporting utilities
 *
 * Builds a pre-filled GitHub issue URL so the user can file a bug report
 * without the app ever sending data anywhere without their explicit consent.
 */

const GITHUB_REPO = 'slothlabsorg/wattsorbit'

// ── App version ───────────────────────────────────────────────────────────────

async function getAppVersion(): Promise<string> {
  try {
    const { getVersion } = await import('@tauri-apps/api/app')
    return await getVersion()
  } catch {
    return '0.1.0'
  }
}

// ── macOS version from user-agent ─────────────────────────────────────────────

function getMacVersion(): string {
  const m = navigator.userAgent.match(/Mac OS X ([\d_.]+)/)
  return m ? m[1].replace(/_/g, '.') : 'macOS'
}

// ── Issue URL builder ─────────────────────────────────────────────────────────

export interface ReportOpts {
  title?: string
  errorMessage?: string
  stack?: string
}

export async function buildReportUrl(opts: ReportOpts = {}): Promise<string> {
  const version = await getAppVersion()
  const mac     = getMacVersion()

  const lines: string[] = [
    `**App version:** ${version}`,
    `**macOS:** ${mac}`,
  ]

  if (opts.errorMessage) {
    lines.push(`**Error:** \`${opts.errorMessage}\``)
  }
  if (opts.stack) {
    lines.push(
      '',
      '<details>',
      '<summary>Stack trace</summary>',
      '',
      '```',
      opts.stack.slice(0, 3000),
      '```',
      '</details>',
    )
  }

  lines.push(
    '',
    '---',
    '**Steps to reproduce:**',
    '1. ',
    '',
    '**Expected behavior:**',
    '',
    '**Actual behavior:**',
  )

  const params = new URLSearchParams({
    title:  opts.title ?? 'Bug report',
    body:   lines.join('\n'),
    labels: 'bug',
  })
  return `https://github.com/${GITHUB_REPO}/issues/new?${params}`
}

export async function openReport(opts: ReportOpts = {}): Promise<void> {
  const { openExternalUrl } = await import('./tauri')
  const url = await buildReportUrl(opts)
  openExternalUrl(url)
}
