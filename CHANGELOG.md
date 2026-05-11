# Changelog

All notable changes to WattsOrbit will be documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2026-05-10

First public release of WattsOrbit — a cross-platform tray power monitor for
macOS, Windows, and Linux.

### New Features

**Power monitoring**
- Menu-bar icon with live watt reading that polls every 5 seconds using
  macOS private power APIs (`IOPSCopyPowerSourcesInfo`, SMC keys) — no need
  to open Activity Monitor to see what's draining your battery.
- Compact popup with battery %, charge/discharge rate, time-to-empty /
  time-to-full, charger detection (USB-C cable wattage), and temperature.
- Per-app power consumption list, ranked by current draw.
- Connected-device list showing USB devices with their current draw (useful
  for spotting a SSD or dock that's quietly eating your battery).
- Dedicated dashboard window with history graphs, charge sessions timeline,
  battery-health panel (cycle count, max capacity, design capacity).
- Native macOS notifications:
  - Weak charger — when the adapter delivers less than the system pulls
    (e.g. 30 W brick on a 60 W laptop).
  - Low battery + draining USB devices.
  - Charge-limit warning at 80 % (stay-above-80 % wear guidance).
  - Sustained high charge (80 % for 30+ min while plugged in).

**Popup & tray**
- Tray icon click shows the popup over fullscreen app spaces without
  pulling the user out of their fullscreen context. Implemented by swapping
  the NSWindow backing class to NSPanel with the non-activating style +
  `FullScreenAuxiliary` collection behaviour.
- Dashboard window reopens cleanly after the red-close button — it's
  hidden (not destroyed) on `CloseRequested`, then brought back with
  `unminimize + show + activateIgnoringOtherApps + makeKeyAndOrderFront`.
- External links from the popup / dashboard open the system browser through
  a sanitised `open_external_url` Rust command (http(s) only).
- `UpdateBanner` also surfaces inside the dashboard, not just the popup.

**Platform / release**
- Tauri 2 autostart plugin for "Launch at login" toggle.
- In-app updater with changelog popup — users get notified and can install
  without leaving the app.
- Crash reporting scaffolding wired in so we can triage issues shipped
  to real users.
- Release workflow produces builds for five targets on every tag via
  `tauri-apps/tauri-action`: macOS Apple Silicon (`aarch64-apple-darwin`),
  macOS Intel (`x86_64-apple-darwin`), Linux x86_64 (`.deb` + `.AppImage`
  on `ubuntu-22.04`), Linux aarch64 (`.deb` + `.AppImage` on
  `ubuntu-22.04-arm`, for Raspberry Pi / Graviton / Linux-on-Apple-Silicon
  VMs), and Windows x86_64 (`.msi` + `.nsis-setup.exe`).
- CI (`ci.yml`) runs `cargo check` + `cargo test` on `macos-latest`,
  `ubuntu-22.04`, `ubuntu-22.04-arm`, and `windows-latest` — regressions
  on any OS/arch block `main`.

**Windows support**
- Battery data via WMI: `Win32_Battery` for %/state/runtime, plus
  `BatteryStaticData`, `BatteryFullChargedCapacity`, `BatteryCycleCount`
  from `root/wmi` for battery-health fields (cycle count, design vs current
  capacity, health %).
- USB devices enumerated via `Get-PnpDevice -Class USB`, hub/controller
  entries filtered out.
- Native toasts via `Windows.UI.Notifications` (raw `ToastGeneric` XML).
- "Open System Settings" opens `ms-settings:batterysaver` via `cmd /C start`.
- External links open through the Windows shell (`cmd /C start ""`).

**Linux support**
- Battery data via `/sys/class/power_supply/BAT*`: `capacity`, `status`,
  `power_now`, `energy_now` for runtime; `cycle_count`, `charge_full_design`,
  `charge_full`, `temp` for battery health.
- AC detection via `/sys/class/power_supply/AC/online`.
- USB devices via `lsusb` (hubs filtered out).
- Notifications via `notify-send` (libnotify).
- "Open System Settings" tries `gnome-control-center power`,
  `systemsettings5 powerdevilglobalconfig`, then falls back to `xdg-open`.
- External links via `xdg-open`.
- `.deb` now declares its runtime dependencies (`libwebkit2gtk-4.1-0 (>=
  2.38)`, `libgtk-3-0`, `libayatana-appindicator3-1`, `libnotify-bin`) so
  `sudo apt install ./wattsorbit_<version>_<arch>.deb` pulls WebKitGTK
  automatically on fresh systems. Previously the deps list was empty,
  and installing via `dpkg -i` on a machine without WebKitGTK 4.1 would
  silently succeed then crash at launch with `libwebkit2gtk-4.1.so.0:
  cannot open shared object file`.

All three platforms share the same `PowerStatus` payload and React UI —
platform-specific code lives behind `#[cfg(target_os = ...)]` gates in
`src-tauri/src/commands/power.rs` and `src-tauri/src/main.rs`.

**Testing**
- Playwright screenshot suite for the popup and dashboard, plus an
  interaction / smoke suite (23 tests, all green).
- Native e2e script (`tests/native/dashboard-reopen.mjs`) that drives the
  compiled binary via AppleScript to validate the dashboard-reopen and
  tray-popup flows — things a browser-only Playwright run can't cover.

### Bug Fixes

- Fixed dashboard window not reopening after the first close — the
  `CloseRequested` path now correctly prevents destroy and re-shows the
  window on demand.
- Fixed tray popup being pulled out of the fullscreen space by the app
  activation call; the non-activating NSPanel conversion lets it float
  over fullscreen without a space switch.
- Fixed battery health / charge-state display inconsistencies.
- Fixed external links opening inside the webview instead of the browser.
- Fixed time-to-full / time-to-empty flipping states near the boundary.

### Known limitations

- Artifacts are unsigned on all three platforms — macOS shows "unverified
  developer", Windows shows SmartScreen, Linux has no equivalent gate.
  Signing/notarization secrets wiring is a follow-up.
- Windows and Linux builds are shipping as a first pass — the Rust backend,
  CI, and installer pipeline are in place but real-device smoke-testing
  (tray icon contrast, notification behaviour across desktop environments,
  tray click-to-popup geometry) is ongoing. Please file issues.
- Linux tray requires AppIndicator support — on vanilla GNOME users need
  the AppIndicator extension for the icon to appear.

[1.0.0]: https://github.com/slothlabsorg/wattsorbit/releases/tag/v1.0.0
