<div align="center">
  <h1>⚡ WattsOrbit — Mac Power Monitor</h1>
  <p><strong>The free macOS menu bar power monitor — real-time watts in, watts out, per-USB-device draw, and battery health. Native Rust, no Electron, no subscription.</strong></p>

  [![Release](https://img.shields.io/github/v/release/slothlabsorg/wattsorbit?style=flat-square)](https://github.com/slothlabsorg/wattsorbit/releases)
  [![License: FSL-1.1-MIT](https://img.shields.io/badge/License-FSL--1.1--MIT-blue.svg?style=flat-square)](LICENSE)
  [![GitHub Sponsors](https://img.shields.io/github/sponsors/slothlabsorg?style=flat-square&logo=github&color=pink)](https://github.com/sponsors/slothlabsorg)
  [![Ko-fi](https://img.shields.io/badge/Ko--fi-Support-ff5e5b?style=flat-square&logo=ko-fi)](https://ko-fi.com/slothlabs)
  [![Website](https://img.shields.io/badge/web-slothlabs.org-F59E0B?style=flat-square)](https://slothlabs.org/wattsorbit)
</div>

---

## What is WattsOrbit?

**WattsOrbit is the Mac power monitor that lives in your menu bar.** It shows real-time watts going *in* (from the charger) and *out* (system draw), per-USB-device power consumption, battery health (cycles, capacity, temperature), and smart alerts — all polled from native macOS power APIs every few seconds.

If you've ever wondered *"why is my MacBook draining while plugged in?"* or *"is this $5 USB hub eating 8W?"* — WattsOrbit answers both, with real numbers from IOKit / SMC / libproc, not estimates. iStatMenus shows temperature behind a $12/year paywall, BatFi tracks battery longevity but not live wattage, Activity Monitor only shows CPU. WattsOrbit is the missing link.

> **v1.0 ships for macOS, Windows, and Linux.** Real-device smoke-testing on Windows + Linux is ongoing — please file issues if anything looks off.

## Features

| Feature | macOS | Windows | Linux |
|---|:---:|:---:|:---:|
| Tray / menu-bar icon with live watt reading | ✅ | ✅ | ✅ |
| Battery % + charge state | ✅ | ✅ | ✅ |
| System-level discharge rate (watts) | ✅ | ✅ | ✅ |
| Per-USB-device power list | ✅ | ✅ | ✅ |
| Time-to-empty / time-to-full estimate | ✅ | ✅ | ⚠ partial |
| Battery health (cycle count, max capacity, temperature) | ✅ | ✅ | ✅ |
| Charger name + cable-type detection | ✅ | ⚠ generic | ⚠ generic |
| Smart alerts: weak charger, low battery, 80% sweet spot | ✅ osascript | ✅ Toast XML | ✅ notify-send |
| Open OS power settings from the popup | ✅ | ✅ ms-settings | ✅ GNOME/KDE |
| 5-second polling with smooth updates | ✅ | ✅ | ✅ |
| Launch at login | ✅ | ✅ | ✅ |

## Why use WattsOrbit?

- **Catch weak chargers** — your "100W" charger plus a bad cable might deliver 18W. WattsOrbit shows the real number.
- **Solar / off-grid budgets** — running off a power station? Live watts in vs out tells you exactly when to unplug.
- **Bad cable detection** — plug a USB-C cable rated 100W in, see what it actually delivers. Test every adapter you own.
- **Battery longevity** — get notified at 80% so you can unplug and stay in the healthy charge zone.
- **Per-device USB analysis** — find out which device is the freeloader.

## Install

### macOS

Grab the latest `.dmg` from the [Releases](https://github.com/slothlabsorg/wattsorbit/releases) page. Drag to Applications and launch — the icon appears in your menu bar immediately.

First launch will show "unverified developer" (the app isn't notarized yet). Right-click → **Open** → **Open** once to trust it.

### macOS (Homebrew)

```bash
brew install --cask slothlabsorg/tap/wattsorbit
```

The cask in [slothlabsorg/homebrew-tap](https://github.com/slothlabsorg/homebrew-tap) is auto-updated on every published release.

### Windows

```powershell
winget install SlothLabs.WattsOrbit
```

Or download the `.exe` from [Releases](https://github.com/slothlabsorg/wattsorbit/releases).

### Linux

Download `.deb` or `.AppImage` from [Releases](https://github.com/slothlabsorg/wattsorbit/releases).

## Tech stack

| Layer | Technology |
|---|---|
| Shell | Tauri v2 (native menu-bar via NSStatusItem on macOS) |
| Frontend | React 18 + TypeScript + Tailwind CSS |
| Backend | Rust — IOKit + SMC + libproc on macOS, WMI on Windows, UPower on Linux |
| Polling | 5s tick, < 5ms per poll |

## Development

```bash
git clone https://github.com/slothlabsorg/wattsorbit
cd wattsorbit

npm install
npm run tauri dev
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide and architecture notes.

## We need your help 🙏

WattsOrbit is built solo on nights and weekends. Concrete things contributors can pick up:

- 🐧 **Linux UPower expertise** — make per-USB and time-to-empty match macOS quality
- 🪟 **Windows WMI expertise** — improve charger name + cable-type detection
- 🦀 **Rust contributors** — pick a [`good-first-issue`](https://github.com/slothlabsorg/wattsorbit/issues?q=label%3Agood-first-issue) on the tracker
- ⚛️ **React contributors** — UI polish, accessibility, charts on the dashboard
- 📊 **Charts/graphs** — historical wattage view, export to CSV
- 🌍 **i18n** — translations welcome
- 🧪 **Beta testers** — particularly on Windows + Linux laptop hardware

## Sponsor / fund the project

WattsOrbit is free forever. If it saves your battery, consider supporting the project:

- ☕ [Ko-fi](https://ko-fi.com/slothlabs) — one-time or recurring
- ❤️ [GitHub Sponsors](https://github.com/sponsors/slothlabsorg) — monthly tiers
- ⭐ Star this repo — it helps others find the project

Your contributions go to the **$99/year Apple Developer certificate** so future macOS users get a clean install with no Gatekeeper warnings, plus signing for Windows/Linux.

## Other SlothLabs tools

| | | |
|---|---|---|
| ☁️ [CloudOrbit](https://slothlabs.org/cloudorbit) | AWS client UI for macOS · SSO sessions, EKS, kubeconfig | macOS · Win · Linux |
| 🗄️ [DataOrbit](https://slothlabs.org/dataorbit) | Native DynamoDB GUI · live streams, cross-table joins | macOS · Win · Linux |
| 🔍 [ProxyOrbit](https://slothlabs.org/proxyorbit) | Free Charles Proxy alternative | macOS · Win · Linux |
| 🔐 [BastionOrbit](https://slothlabs.org/bastionorbit) | SSH tunnel manager with auto-expiry TTL | macOS · Win · Linux |
| 🧜 [Mermaid Preview](https://slothlabs.org/mermaid-preview) | Mermaid IntelliJ / JetBrains plugin | All JetBrains IDEs |

## License

Source-available under the [Functional Source License 1.1 (FSL-1.1-MIT)](LICENSE). Free to use, read, and contribute to — cannot be forked into a competing product. Converts to MIT on 2028-01-01.
