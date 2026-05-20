import type { NewsFeed } from '@/types/news'

// ── Mock / fallback feed ─────────────────────────────────────────────────────
// This data is shown when the remote feed is unreachable (no internet, dev
// mode, Playwright tests). It also acts as the reference for what a real
// feed payload looks like.
//
// Deploy the real feed at: https://slothlabs.org/news/feed.json
// Format must match the NewsFeed interface in src/types/news.ts

export const MOCK_FEED: NewsFeed = {
  version: 1,
  items: [
    {
      id: 'wo-v100-release',
      type: 'changelog',
      priority: 10,
      publishedAt: '2026-05-15T00:00:00Z',
      badge: 'UPDATE',
      badgeTone: 'primary',
      title: 'WattsOrbit v1.0.0',
      body: `## What's new\n\n- **Real-time watts in / out** — see exactly what your charger delivers and what your Mac consumes\n- **USB device monitoring** — track which devices are drawing power from your battery\n- **Battery health panel** — cycle count, temperature, max capacity, and optimized charging status\n- **Power flow chart** — up to 2 hours of history with stacked device areas\n- **Charge session log** — every charging session recorded with duration and Wh delivered\n- **Login-item autostart** — keep power data flowing in the background\n- **Tray popup** — quick stats in your menu bar, always one click away`,
      collapsed: false,
      action: { label: 'Full changelog', url: 'https://github.com/slothlabs/wattsorbit/blob/main/CHANGELOG.md' },
      targetApps: ['wattsorbit'],
    },
    {
      id: 'wo-tip-charger-quality',
      type: 'tip',
      priority: 7,
      publishedAt: '2026-05-14T00:00:00Z',
      badge: 'TIP',
      badgeTone: 'success',
      title: 'Is your cable throttling your charger?',
      body: `Many USB-C cables are rated for data only and cap power delivery at 60W or less — even when the adapter supports 96W+.\n\nCheck **Watts in** in the tray popup right after plugging in. If it's lower than your adapter's rated wattage, the cable is the bottleneck, not the adapter.`,
      targetApps: ['wattsorbit'],
    },
    {
      id: 'wo-tip-battery-health',
      type: 'tip',
      priority: 6,
      publishedAt: '2026-05-13T00:00:00Z',
      badge: 'TIP',
      badgeTone: 'success',
      title: 'Keep your battery above 80% health',
      body: `Apple replaces batteries under AppleCare when health drops below 80%.\n\nOpen the **Dashboard → Battery Health** panel to see your current health %, cycle count, and whether Optimized Battery Charging is active. Keeping cycles under 1000 and avoiding sustained heat extends lifespan significantly.`,
      action: { label: 'Open Dashboard', url: '' },
      targetApps: ['wattsorbit'],
    },
    {
      id: 'wo-pro-coming-soon',
      type: 'announcement',
      priority: 5,
      publishedAt: '2026-05-10T00:00:00Z',
      badge: 'NEW',
      badgeTone: 'primary',
      title: 'WattsOrbit Pro — in development',
      body: `Pro features are in active development. The roadmap includes **custom charge limits**, **heat protection**, **sailing mode**, and **CSV export**.\n\nAll Pro features require a signed privileged helper to write to your Mac's SMC — the same approach used by AlDente and coconutBattery Pro.\n\nInterested? Star the repo and let us know what matters most to you.`,
      collapsed: true,
      action: { label: 'View roadmap', url: 'https://github.com/slothlabs/wattsorbit' },
      targetApps: ['wattsorbit'],
    },
    {
      id: 'slothlabs-roadmap-2026',
      type: 'news',
      priority: 4,
      publishedAt: '2026-05-10T00:00:00Z',
      badge: 'NEW',
      badgeTone: 'neutral',
      title: 'SlothLabs 2026 roadmap',
      body: `We're building a suite of developer tools that make cloud access and system monitoring simpler. WattsOrbit is one of them — here's what's coming:\n\n- **WattsOrbit Pro** — charge limits, heat protection, sailing mode\n- **CloudOrbit** — AWS credential manager for your menu bar\n- **DataOrbit** — lightweight database client\n- **BastionOrbit** — SSH tunnel manager\n\nWe release fast and often. Star the repos to stay updated.`,
      collapsed: true,
      action: { label: 'Follow SlothLabs', url: 'https://github.com/slothlabs' },
      targetApps: ['all'],
    },
    {
      id: 'wo-sponsor-placeholder',
      type: 'ad',
      priority: 3,
      publishedAt: '2026-05-01T00:00:00Z',
      badge: 'SPONSOR',
      badgeTone: 'neutral',
      title: 'Want to reach Mac power users?',
      body: `WattsOrbit is used by developers and power users who monitor their Mac's energy daily. If your tool, accessory, or course targets this audience, **your ad could appear here**.\n\nSponsored placements are clearly labeled and help fund development.`,
      sponsored: true,
      action: { label: 'Advertise with SlothLabs', url: 'https://slothlabs.org/advertise' },
      targetApps: ['all'],
    },
  ],
}
