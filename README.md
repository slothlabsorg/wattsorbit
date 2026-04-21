# WattsOrbit

**Menu-bar power monitor for macOS.** See exactly what's draining your battery — per-app power draw, system totals, and time-to-empty — without opening Activity Monitor.

Part of the [SlothLabs](https://slothlabs.org) family — native Rust, free forever.

> **macOS only.** Windows and Linux support is coming soon.

---

## What it does

WattsOrbit lives in your menu bar. Click the icon to see a compact panel with your battery percentage, current charge/discharge rate in watts, and a ranked list of apps by power consumption. It polls every 5 seconds using macOS private power APIs, so the data is always fresh.

---

## Features

| Feature | Status |
|---|---|
| Menu-bar icon with live watt reading | ✅ |
| Battery percentage + charge state | ✅ |
| System-level discharge rate (watts) | ✅ |
| Per-app power consumption list | ✅ |
| Time-to-empty / time-to-full estimate | ✅ |
| 5-second polling with smooth updates | ✅ |
| Click-outside to dismiss | ✅ |
| macOS private power API integration | ✅ |
| Windows & Linux support | 🚧 Coming soon |

---

## Installation

### Download

Grab the latest `.dmg` from the [Releases](https://github.com/slothlabsorg/wattsorbit/releases) page. Drag to Applications and launch — the icon appears in your menu bar immediately.

### macOS (Homebrew) — coming soon

```bash
brew install slothlabs/tap/wattsorbit
```

---

## Usage

1. Launch WattsOrbit — it goes straight to the menu bar (no Dock icon)
2. Click the bolt icon to open the power panel
3. See current watts, battery status, and top power-consuming apps
4. Click anywhere outside to dismiss

---

## Development

Requirements: Node 18+, Rust stable, Tauri v2 CLI, macOS (required for power APIs).

```bash
npm install
npm run tauri dev
```

> The app uses `macos-private-api: true` in `tauri.conf.json` to access the IOKit power source APIs. CI and release builds run on `macos-latest` only.

---

## Testing

```bash
# Unit tests (Vitest)
npm test

# Playwright screenshot suite
npm run screenshots
```

Rust unit tests:

```bash
cd src-tauri
cargo test
```

---

## Contributing

1. Fork the repo and create a branch: `git checkout -b my-feature`
2. Make your changes — note that macOS is required to run the app
3. Open a pull request — all PRs require review before merging to `main`
4. Direct pushes to `main` are disabled

For significant changes (especially new data sources or UI reworks), open an issue first to discuss the approach.

---

## Roadmap

### v0.2
- Configurable poll interval
- Spark-line history chart in the panel
- Alert when discharge exceeds a threshold (e.g. > 20W)
- Launch at login option

### v0.3
- Windows support (via WMI battery API)
- Linux support (via `/sys/class/power_supply`)

---

## Support the project

WattsOrbit is free and built on nights and weekends. If it saves you time, consider supporting continued development:

- [Ko-fi](https://ko-fi.com/slothlabs)
- [GitHub Sponsors](https://github.com/sponsors/slothlabsorg)
- [Polar.sh](https://polar.sh/slothlabs)

---

## License

MIT © SlothLabs
