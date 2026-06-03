# Changelog

All notable changes to WattsOrbit will be documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.4.1] — 2026-06-03

### Other Changes
- Pipeline validation release — same code as v1.4.0, confirms end-to-end updater flow.

---

## [1.4.0] — 2026-06-03

### Bug Fixes

**Linux — power data now works correctly**
- AC adapter detection was hardcoded to `/sys/class/power_supply/AC/online`, which doesn't
  exist on most Linux laptops (common names: `ACAD`, `ADP0`, `ADP1`, `AC0`). The app now
  scans all power supply entries for the one with `type = Mains` — no more "always discharging"
  even when plugged in, and `watts_in` now shows the correct value.
- Added fallback power reading: if `power_now` doesn't exist (common on AMD/Intel laptops that
  expose `current_now` + `voltage_now` instead), watts are derived from `current_now × voltage_now`.
- Added fallback for time-remaining: if `energy_now` is absent, derived from
  `charge_now × voltage_now`.

**Windows — tray popup now appears**
- The popup was positioned at `tray_y + 14 px`. With the Windows taskbar at the bottom of the
  screen (e.g. tray at y ≈ 1055 on a 1080 p display), the popup rendered entirely off-screen.
  Now detects whether the tray is in the upper or lower half of the screen and positions the
  popup **above** the icon when at the bottom (`y = tray_y − popup_height − 8`).
- Dashboard window now reliably comes to the foreground via a brief `always_on_top` toggle,
  bypassing Windows focus-stealing prevention.

**All platforms — popup no longer hides immediately on open**
- Added a 500 ms grace period after `window.show()` during which blur events are ignored.
  On Linux and Windows the window manager can deliver a `Focused(false)` event before the
  focus grant arrives, causing the popup to vanish the instant it appeared.

### New Features

**Linux — tray menu "Power Status" item**
- AppIndicator (the Linux tray backend) does not fire left-click events — only the context
  menu is reachable. Added **Power Status** as the first menu item so Linux users can open
  the popup directly from the tray. The popup opens anchored to the bottom-right corner of
  the screen (where the notification area lives).

**Dashboard landing — version info + Check for Updates**
- Installed version (`v1.4.0`) is now shown in the footer of the landing page.
- If an update is already detected, a pill shows the available version and opens the
  update modal on click.
- **Check for updates** button: clicking it spins a reload icon while checking; shows
  `✓ Up to date` for 4 s if nothing is found, or opens the update modal if a newer
  version is available.

---

## [1.3.0] — 2026-06-02

### Other Changes
- Test release to validate the end-to-end update pipeline (in-app updater + Homebrew cask).

---

## [1.2.1] — 2026-05-23

### Bug Fixes
- Tray popup now closes when clicking anywhere outside it
- Header badge `white-space: nowrap` — "On Battery" no longer wraps to two lines
- Temperature shown as plain text without background pill to reduce header crowding
- Temperature hidden below 28 °C to reduce noise when battery is cool
- Popup gap from menu bar increased from 8 to 14 px

---

## [1.2.0] — 2026-05-22

### New Features
- Tray popup: compact amber pill shows available version instead of full modal overlay
- Dashboard: sticky update banner with Update Now and 1 h snooze (persists across navigations)
- Dashboard: dock icon appears when dashboard opens, hides when closed (macOS only)
- `open_dashboard` Tauri command wired to pill click and bell update item

---

## [1.1.1] — 2026-05-21

### Bug Fixes
- Minor stability fix

---

## [1.1.0] — 2026-05-20

### New Features
- **NewsBell** in the tray popup header — unread dot + dropdown with release notes and announcements
- **News screen** in the Dashboard — full feed with markdown rendering, badges, pull-to-refresh
- **UpdaterModal** — replaces UpdateBanner with a proper changelog view, download progress bar,
  and in-app install + relaunch
- Homebrew Cask auto-update on release publish

---

## [1.0.0] — 2026-05-10

First public release of WattsOrbit.

### New Features

**Power monitoring**
- Menu-bar / tray icon with live watt reading, polling every 5 s
- Compact popup: battery %, charge/discharge rate, time-to-empty / time-to-full, charger
  detection (USB-C wattage), temperature
- Connected-device list showing USB devices with their estimated current draw
- Dashboard window: history power-flow chart (last 2 h), charge sessions timeline,
  battery-health panel (cycle count, max capacity vs design capacity, health %)
- Native notifications: weak charger, low battery + draining USB devices, charge-limit
  warning at 80 %, sustained high charge (80 % for 30+ min while plugged in)

**macOS**
- Tray popup floats over fullscreen app spaces without pulling the user out — implemented
  via NSPanel class swap + non-activating style + `FullScreenAuxiliary` collection behaviour
- Dashboard reopens cleanly after the red-close button (hidden not destroyed)
- Battery data from `pmset` + `ioreg`

**Windows**
- Battery data via WMI (`Win32_Battery`, `BatteryStaticData`, `BatteryFullChargedCapacity`,
  `BatteryCycleCount`)
- USB devices via `Get-PnpDevice -Class USB` (hubs/controllers filtered)
- Native toast notifications via `Windows.UI.Notifications`

**Linux**
- Battery data via `/sys/class/power_supply/BAT*`
- USB devices via `lsusb`
- Notifications via `notify-send` (libnotify)
- `.deb` declares all runtime dependencies so `apt install ./wattsorbit.deb` pulls WebKitGTK
  automatically

**Release pipeline**
- Tauri 2 in-app updater with changelog popup — users install without leaving the app
- Builds for 5 targets on every tag: macOS Apple Silicon, macOS Intel, Windows x86_64,
  Linux x86_64, Linux aarch64 (Raspberry Pi / ARM VMs)
- CI runs `cargo check` + `cargo test` on all four OS/arch combinations — regressions on
  any platform block `main`
- Autostart plugin for "Launch at login"

[1.4.1]: https://github.com/slothlabsorg/wattsorbit/releases/tag/v1.4.1
[1.4.0]: https://github.com/slothlabsorg/wattsorbit/releases/tag/v1.4.0
[1.3.0]: https://github.com/slothlabsorg/wattsorbit/releases/tag/v1.3.0
[1.2.1]: https://github.com/slothlabsorg/wattsorbit/releases/tag/v1.2.1
[1.2.0]: https://github.com/slothlabsorg/wattsorbit/releases/tag/v1.2.0
[1.1.1]: https://github.com/slothlabsorg/wattsorbit/releases/tag/v1.1.1
[1.1.0]: https://github.com/slothlabsorg/wattsorbit/releases/tag/v1.1.0
[1.0.0]: https://github.com/slothlabsorg/wattsorbit/releases/tag/v1.0.0
