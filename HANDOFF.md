# WattsOrbit — Handoff Checklist

Manual items that need to be done by hand on whichever machine picks this up
next. Code work continues normally; the items below cannot be automated by an
agent because they involve Apple keys, secrets, or out-of-band testing.

Status as of last push:
- Launch date: **Friday June 5, 2026** (WattsOrbit + CloudOrbit ship together)
- v1.1.0 already tagged on GitHub — public launch comms still pending the
  June 5 date so the carousel on slothlabs.org keeps it gated.
- Site countdown: see slothlabs.org `/next/wattsorbit/` permalink

---

## 1. Apple Developer — must be done by hand

### One-time Apple setup
- [ ] developer.apple.com → Certificates → create a **Developer ID Application**
      certificate. Download the `.cer`, double-click to install in Keychain.
- [ ] Keychain Access → My Certificates → expand the Developer ID certificate →
      right-click the private key → Export → `.p12` with a strong password.
      **Save the password** — it becomes `APPLE_CERTIFICATE_PASSWORD`.
- [ ] Base64 the .p12: `base64 -i Certificates.p12 -o Certificates.b64.txt`
- [ ] appleid.apple.com → Sign-in and Security → **App-Specific Passwords** →
      generate one (label it "wattsorbit-notarize"). This is `APPLE_PASSWORD`.
- [ ] developer.apple.com → Membership → record the **Team ID**.
      This is `APPLE_TEAM_ID`.
- [ ] Confirm signing identity with `security find-identity -v -p codesigning`.
      This is `APPLE_SIGNING_IDENTITY`.

### GitHub repo secrets to add
- [ ] `APPLE_CERTIFICATE` — base64 .p12
- [ ] `APPLE_CERTIFICATE_PASSWORD`
- [ ] `APPLE_SIGNING_IDENTITY`
- [ ] `APPLE_ID`
- [ ] `APPLE_PASSWORD`
- [ ] `APPLE_TEAM_ID`
- [ ] `RELEASE_TOKEN` — fine-grained PAT, Contents:Write on this repo only.
      **Already documented in `.github/workflows/update-manifest.yml`** — the
      pull/checkout uses this PAT so the auto-commit of `latest.json` can
      bypass branch protection on `main`. Same pattern as `HOMEBREW_TAP_TOKEN`
      in `update-tap.yml`.
- [ ] `HOMEBREW_TAP_TOKEN` — already configured for the cask auto-update;
      verify it still has Contents:Write on the tap repo before launch.

### Tauri updater key (separate from Apple)
- [ ] `npx tauri signer generate -w ~/.tauri/wattsorbit.key`
- [ ] Copy public key into `src-tauri/tauri.conf.json` →
      `plugins.updater.pubkey`
- [ ] `TAURI_PRIVATE_KEY` secret = contents of `~/.tauri/wattsorbit.key`
- [ ] `TAURI_KEY_PASSWORD` secret = the password you set

### Release flow source-of-truth
- `.github/workflows/release.yml` has APPLE_* envs commented out near the
  build step. Uncomment once the secrets exist.
- `tauri.conf.json` → `bundle.macOS.signingIdentity` flips to prod string
  once the cert is on the runner.

### First end-to-end notarized release
- [ ] Tag `v1.1.1` (or whatever the next semver is — v1.1.0 already shipped
      unsigned for early testers) and push the tag.
- [ ] Watch the Actions run — must produce a signed + notarized DMG.
- [ ] Confirm Homebrew cask auto-update fires after release publishes.
- [ ] Confirm `latest.json` commit lands on main via `update-manifest.yml`.
- [ ] Pull DMG to a clean Mac, verify Gatekeeper opens it without warnings.

---

## 2. News feature — manual test plan

WattsOrbit was the first app with the News pattern; the others mirror it.

- [ ] `npm run tauri dev` opens cleanly (no Rust panics)
- [ ] Dashboard **News screen** loads articles with markdown rendered
      (bold, lists, links) — pull-to-refresh works
- [ ] **NewsBell in the tray popup** — unread dot + dropdown
- [ ] Items show right tone from `badgeTone`
- [ ] Item click opens detail or external link
- [ ] Unread state persists across app restart (and across tray-popup vs
      dashboard windows — same store)
- [ ] Feed URL: `https://slothlabs.org/news/feed.json` with `wattsorbit`
      filter applied
- [ ] Network failure → graceful error, not blank screen
- [ ] Confirm the v1.1.0 changelog item already in `wattsorbitnews.json`
      renders and the "Full changelog" link opens the GitHub release page

---

## 3. Updater feature — manual test plan

- [ ] Cold start with current version: no banner, no modal, no dot
- [ ] Cold start with `latest.json` forced higher: UpdaterModal opens
      automatically on first foreground (replaces the old banner pattern)
- [ ] Modal shows markdown changelog + "Install & Restart" + Dismiss
- [ ] Dismiss → modal closes, NewsBell shows "Update available" item
- [ ] Install & Restart → progress bar to 100% → relaunches with new version
- [ ] Bad signature in `latest.json` → updater refuses with a clear error

---

## 4. Other WattsOrbit-specific items

- [ ] **Tray popup behaviour**: clicking the menu-bar icon opens the popup;
      ⌥-click pins it; clicking outside while pinned stays open; clicking
      outside while unpinned dismisses with the 250ms blur debounce.
- [ ] **Tray popup window level**: NSStatusWindowLevel + FullScreenAuxiliary —
      confirm popup floats above full-screen apps and Mission Control.
- [ ] **BatteryBar animations**: on charge → shimmer animation, on discharge
      → drain animation, charger connect → flash. Verify on real Mac (the
      mock data path doesn't exercise the IOKit calls).
- [ ] **Per-USB-device wattage**: plug in 2-3 USB devices, confirm wattage
      breakdown updates in real time and totals match charger draw within
      ±0.5 W.
- [ ] **Battery health panel**: cycle count, design vs current capacity %,
      condition string — all populated from `system_profiler SPPowerDataType`.
- [ ] **80% charge limit alert**: with the Mac plugged in past 80%, confirm
      the smart notification fires once (not on every poll) and respects
      "don't show again today".
- [ ] **Weak charger alert**: connect a low-wattage charger, confirm the
      "delivering less than your Mac consumes" warning fires.
- [ ] **autostart LaunchAgent**: toggle Start at Login in Settings, restart,
      confirm `launchctl list | grep wattsorbit` shows the agent.
- [ ] **Dashboard window**: opens at port 1423 in dev (`npm run tauri dev`),
      closes cleanly without leaking processes (`ps aux | grep wattsorbit`
      should be empty after quit).
- [ ] **openExternalUrl wrapper**: external links from news items work in
      both windowed app and tray popup (the lib/tauri.ts wrapper falls back
      to `window.open` if Tauri shell isn't available).
- [ ] **crash.ts + ErrorBoundary**: force a runtime error in the dashboard
      route, confirm the boundary catches it and shows the recovery UI.
- [ ] `screenshots/` directory was just refreshed — verify they all render
      at 1400×900 and update the marketing site if any layout changed.

---

## 5. Pre-flight before tagging v1.1.1 (or next semver)

- [ ] `cargo test` from `src-tauri/` is green
- [ ] `npm run build` (frontend) succeeds with no TS errors
- [ ] `npm run tauri build` produces a working `.app` and `.dmg` locally
- [ ] Tray popup smoke test on a real Mac (NSStatusWindowLevel can't be
      tested in CI)
- [ ] All Apple secrets confirmed in GitHub
- [ ] `RELEASE_TOKEN` confirmed valid (regenerate if expired)
- [ ] `update-manifest.yml` dry-run test (push a pre-release tag first)
- [ ] Homebrew cask auto-update workflow runs cleanly
- [ ] News feed shows the launch announcement at the top of the bell

When everything above is green, tag and let CI ship it. WattsOrbit is the
canonical golden path — if it ships clean, the rest of the suite will follow
the same flow.
