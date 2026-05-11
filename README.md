# WattsOrbit

**Cross-platform menu-bar power monitor.** See exactly what's draining your battery — per-app power draw, system totals, and time-to-empty — without opening your OS's built-in task manager.

Part of the [SlothLabs](https://slothlabs.org) family — native Rust, free forever.

> **v1.0 ships for macOS, Windows, and Linux.** Builds are unsigned in this release (SmartScreen / Gatekeeper will warn on first launch) and real-device smoke-testing on Windows + Linux is ongoing — please file issues if anything looks off.

---

## What it does

WattsOrbit lives in your tray / menu bar. Click the icon to see a compact panel with your battery percentage, current charge/discharge rate in watts, and a ranked list of apps by power consumption. It polls every few seconds using native OS power APIs, so the data is always fresh.

---

## Features

| Feature | macOS | Windows | Linux |
|---|:---:|:---:|:---:|
| Tray / menu-bar icon with live watt reading | ✅ | ✅ | ✅ |
| Battery % + charge state | ✅ | ✅ | ✅ |
| System-level discharge rate (watts) | ✅ | ✅ | ✅ |
| Per-USB-device power list | ✅ | ✅ | ✅ |
| Time-to-empty / time-to-full estimate | ✅ | ✅ | ⚠ partial |
| Battery health (cycle count, max capacity) | ✅ | ✅ | ✅ |
| Charger name + cable-type detection | ✅ | ⚠ generic | ⚠ generic |
| Native notifications (weak charger, low battery, 80 % wear) | ✅ osascript | ✅ Toast XML | ✅ notify-send |
| Open OS power settings from the popup | ✅ | ✅ ms-settings | ✅ GNOME/KDE |
| 5-second polling with smooth updates | ✅ | ✅ | ✅ |
| Launch at login | ✅ | ✅ | ✅ |

---

## Installation

### macOS

Grab the latest `.dmg` from the [Releases](https://github.com/slothlabsorg/wattsorbit/releases) page. Drag to Applications and launch — the icon appears in your menu bar immediately.

First launch will show "unverified developer" (the app isn't notarized yet). Right-click → **Open** → **Open** once to trust it.

```bash
# Homebrew — coming soon
brew install slothlabs/tap/wattsorbit
```

### Windows

Download the latest `.msi` from the [Releases](https://github.com/slothlabsorg/wattsorbit/releases) page and double-click to install. The tray icon appears after first launch.

SmartScreen may warn on first run — the installer is unsigned at this stage. Click **More info** → **Run anyway**.

Alternative portable `.exe` is also attached to every release.

```powershell
# winget — coming soon
winget install SlothLabs.WattsOrbit
```

### Linux

Two packaging formats are produced on every release, for both `x86_64` (Intel/AMD) and `aarch64` (ARM — Raspberry Pi 4/5, AWS Graviton, Apple-Silicon VMs running Linux under UTM/Parallels):

```bash
# Debian / Ubuntu — pick the architecture matching `dpkg --print-architecture`
sudo dpkg -i wattsorbit_<version>_amd64.deb      # x86_64
sudo dpkg -i wattsorbit_<version>_arm64.deb      # aarch64

# Any distro (self-contained)
chmod +x WattsOrbit_<version>_amd64.AppImage     # x86_64
chmod +x WattsOrbit_<version>_aarch64.AppImage   # aarch64
./WattsOrbit_<version>_amd64.AppImage
```

Installing the wrong-architecture `.deb` fails with "package architecture (amd64) does not match system (arm64)" — check with `uname -m` (x86_64 → amd64, aarch64 → arm64).

Runtime requirements: `libwebkit2gtk-4.1`, `libayatana-appindicator3`, `libnotify-bin` (for tray notifications). The `.deb` declares these automatically; for the `.AppImage` install them via your package manager.

Wayland note: the tray appears via XEmbed / AppIndicator. On GNOME you may need the [AppIndicator extension](https://extensions.gnome.org/extension/615/appindicator-support/) for the icon to show up.

---

## Usage

1. Launch WattsOrbit — it goes straight to the tray (no Dock / Taskbar icon)
2. Click the bolt icon to open the power panel
3. See current watts, battery status, and top power-consuming USB devices
4. Click anywhere outside to dismiss
5. Right-click / menu → **Open Dashboard** for history graphs and battery health

---

## Development

Requirements: Node 18+, Rust stable, Tauri v2 CLI. Tauri v2 on Linux additionally needs the WebKitGTK development headers (see [CI installation step](.github/workflows/ci.yml) for the exact package list).

```bash
npm install
npm run tauri dev
```

On Linux, install the webview toolchain first:

```bash
# Debian / Ubuntu
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev \
                 librsvg2-dev libsoup-3.0-dev build-essential libxdo-dev

# Fedora
sudo dnf install webkit2gtk4.1-devel gtk3-devel libayatana-appindicator3-devel \
                 librsvg2-devel libsoup3-devel libxdo-devel
```

On Windows, the Microsoft **WebView2 Runtime** (pre-installed on Windows 11) is the only prerequisite beyond Node + Rust.

> The macOS build uses `macOSPrivateApi: true` in `tauri.conf.json` for NSPanel non-activating-popup behavior. That flag is macOS-only and is ignored on Windows/Linux — no functional difference.

---

## Testing

```bash
# Unit tests (Vitest)
npm test

# Playwright screenshot suite
npm run screenshots
```

Rust unit tests run per-platform (CI covers all three):

```bash
cd src-tauri
cargo test
```

---

## Contributing

1. Fork the repo and create a branch: `git checkout -b my-feature`
2. Make your changes — CI will build on macOS, Windows, and Linux runners
3. Open a pull request — all PRs require review before merging to `main`
4. Direct pushes to `main` are disabled

Platform-specific code lives behind `#[cfg(target_os = "...")]` gates in `src-tauri/src/commands/power.rs` (battery/USB data fetch) and `src-tauri/src/main.rs` (notifications, open-URL, open-settings).

For significant changes (especially new data sources or UI reworks), open an issue first to discuss the approach.

---

## Roadmap

### v1.1 — Signing + distribution
- macOS notarization (Developer ID certificate + app-specific password)
- Windows EV code-signing certificate
- winget manifest + Homebrew tap + (optionally) Flatpak
- Linux: UPower D-Bus fallback when `/sys/class/power_supply` lacks fields

### v1.2 — Features
- Configurable poll interval
- Spark-line history chart in the popup
- Alert when discharge exceeds a user-set threshold
- Per-process power attribution on Linux via `intel_gpu_top` / `powertop` where available

### v2.0 — Desktop widget
- Always-on mini HUD for power-user streams / live editing

---

## Support the project

WattsOrbit is free and built on nights and weekends. If it saves you time, consider supporting continued development:

- [Ko-fi](https://ko-fi.com/slothlabs)
- [GitHub Sponsors](https://github.com/sponsors/slothlabsorg)
- [Polar.sh](https://polar.sh/slothlabs)

---

## License

MIT © SlothLabs
