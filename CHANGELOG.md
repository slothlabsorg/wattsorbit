# Changelog

All notable changes to WattsOrbit will be documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2026-05-09

First public release of WattsOrbit — a menu-bar power monitor for macOS.

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
- Release workflow produces signed macOS builds for both Apple Silicon
  (`aarch64-apple-darwin`) and Intel (`x86_64-apple-darwin`) via
  `tauri-apps/tauri-action`.

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

- macOS only in this release. Windows / Linux support is on the roadmap.

[1.0.0]: https://github.com/slothlabsorg/wattsorbit/releases/tag/v1.0.0
