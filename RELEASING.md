# Release Process — SlothLabs Orbit Apps

This document covers the full release process for WattsOrbit and all other Orbit apps
(`dataorbit`, `bastionorbit`, `proxyorbit`). The pipeline is identical across all four;
the only difference is that WattsOrbit builds macOS only, while the others build
macOS + Windows + Linux.

---

## How the pipeline works

The `release.yml` workflow triggers **only on `v*` tags** (e.g. `v0.1.0`, `v1.2.3`).
It never runs on regular commits or branches.

When a tag is pushed:

1. GitHub Actions spins up one runner per target platform/architecture:
   - **WattsOrbit**: 2 runners — Apple Silicon + Intel
   - **Others**: 4 runners — Apple Silicon, Intel, Windows, Ubuntu
2. Each runner installs Node 20, Rust stable, and `npm ci`
3. `tauri-apps/tauri-action` builds the Tauri app:
   - **macOS**: produces `AppName_x.y.z_aarch64.dmg` and `AppName_x.y.z_x64.dmg`
   - **Windows**: produces `AppName_x.y.z_x64-setup.exe` and `.msi`
   - **Linux**: produces `.AppImage` and `.deb`
4. All binaries are uploaded to a **draft** GitHub Release (not public yet)
5. You review the draft, paste release notes, and click **Publish release**

The draft becomes live only when you manually publish it — nothing is ever
automatically published to users.

---

## Two levels of release

### Level 1 — Unsigned (v1 quick start, no Apple account needed)

The pipeline works right now with zero extra secrets.
`GITHUB_TOKEN` is automatically provided by GitHub Actions.

**What users experience:** On first launch macOS shows:
> "WattsOrbit.app" can't be opened because Apple cannot check it for malicious software.

The user must **right-click → Open → Open** once. After that it runs normally.
This is fine for early adopters but not ideal for a polished v1.

### Level 2 — Signed + Notarized (recommended for public release)

Requires an **Apple Developer Program** membership ($99/yr).
Once the six Apple secrets are configured, the pipeline handles everything:
keychain import, signing, notarization submission, and stapling.

Users see no warning — the app opens like any App Store app.

---

## GitHub Secrets to configure

Go to: **GitHub repo → Settings → Secrets and variables → Actions → New repository secret**

Do this for each repo separately (secrets are per-repo).

### Always required
| Secret | Value | Notes |
|--------|-------|-------|
| *(none)* | — | `GITHUB_TOKEN` is automatic, no setup needed |

### For crash reporting (Sentry)
| Secret | Value | Notes |
|--------|-------|-------|
| `VITE_SENTRY_DSN` | `https://xxx@sentry.io/yyy` | From sentry.io project settings. Leave unset to ship without Sentry. |

### For macOS code signing + notarization (Level 2)
| Secret | How to get it |
|--------|---------------|
| `APPLE_CERTIFICATE` | Export your **Developer ID Application** certificate from Keychain Access as a `.p12` file, then base64-encode it: `base64 -i cert.p12 \| pbcopy` |
| `APPLE_CERTIFICATE_PASSWORD` | The password you set when exporting the `.p12` |
| `APPLE_SIGNING_IDENTITY` | Exact string from Keychain, e.g. `Developer ID Application: Your Name (XXXXXXXXXX)` |
| `APPLE_ID` | Your Apple Developer account email |
| `APPLE_PASSWORD` | An **app-specific password** — generate at [appleid.apple.com](https://appleid.apple.com) → Sign-In and Security → App-Specific Passwords |
| `APPLE_TEAM_ID` | Your 10-character team ID — find it at [developer.apple.com/account](https://developer.apple.com/account) under Membership Details |

> **Security note**: the `.p12` file and app-specific password are sensitive.
> Never commit them. Never put them in `.env` files. GitHub Secrets are the right place.

---

## In-app updater

The app checks `latest.json` on startup and shows a banner when a newer version is available.
Users click **Update** → the app downloads, installs, and relaunches automatically.

### One-time setup per repo (do before v0.1.0)

```bash
# 1. Generate a minisign key pair
npx tauri signer generate -w ~/.tauri/wattsorbit.key
# → prints the public key (starts with "dW50cn..." or similar) to stdout
# → writes the private key to ~/.tauri/wattsorbit.key

# 2. Paste the public key into src-tauri/tauri.conf.json:
#    "plugins": { "updater": { "pubkey": "<paste here>", ... } }

# 3. Add GitHub Actions secrets (Settings → Secrets → Actions):
#    TAURI_PRIVATE_KEY  = contents of ~/.tauri/wattsorbit.key  (cat ~/.tauri/wattsorbit.key | pbcopy)
#    TAURI_KEY_PASSWORD = the password you set during generation (empty string is fine)
```

With these secrets set, `release.yml` will sign every `.app.tar.gz` artifact and attach a `.sig`
file. After you publish the draft release, the `update-manifest.yml` workflow fires automatically,
fetches those `.sig` files, and commits `latest.json` to main — so all running copies of the
app will see the update on their next check.

Without the secrets the app still builds and ships, but the updater banner will never appear
(unsigned artifacts are rejected by the updater).

---

## Checklist before tagging a release

```
[ ] Version bumped in src-tauri/tauri.conf.json  ("version": "x.y.z")
[ ] Version bumped in package.json               ("version": "x.y.z")
[ ] CHANGELOG.md updated with what changed
[ ] All changes committed and pushed to main
[ ] CI (ci.yml) passing on main
[ ] Tested locally: npm run tauri:dev
[ ] TAURI_PRIVATE_KEY / TAURI_KEY_PASSWORD secrets set (for signed updater)
```

Both version files must match the tag — if you push `v0.2.0` but `tauri.conf.json`
says `0.1.0`, the DMG filename and About screen will show the wrong version.

---

## Step-by-step: create a release

> **Shortcut:** inside Claude Code, run `/release 0.2.0` — it collects commits, writes
> CHANGELOG.md, bumps both version files, commits, tags, and pushes for you.

```bash
# 1. Bump versions (both files must match)
#    Edit src-tauri/tauri.conf.json  → "version": "0.2.0"
#    Edit package.json               → "version": "0.2.0"

# 2. Commit
git add src-tauri/tauri.conf.json package.json CHANGELOG.md
git commit -m "chore: bump version to 0.2.0"
git push origin main

# 3. Wait for CI to go green on main

# 4. Create and push the tag
git tag v0.2.0
git push origin v0.2.0

# 5. Watch the run
#    github.com/slothlabsorg/<repo>/actions
#    Two (or four) jobs run in parallel — takes ~8-12 min on macos-latest

# 6. When all jobs succeed, go to:
#    github.com/slothlabsorg/<repo>/releases
#    You will see a DRAFT release with the binaries already attached.

# 7. Edit the draft:
#    - Paste or write release notes
#    - Uncheck "Set as a pre-release" if this is stable
#    - Click "Publish release"

# 8. Done. The release is live and download counting starts immediately.
```

---

## Tracking downloads

GitHub Releases tracks download counts automatically — no backend needed.

**In the GitHub UI:**
- Releases tab → expand a release → each asset shows `X downloads`

**Via the API** (useful for displaying on the website):
```bash
curl https://api.github.com/repos/slothlabsorg/wattsorbit/releases/latest \
  | python3 -c "
import json, sys
r = json.load(sys.stdin)
total = sum(a['download_count'] for a in r['assets'])
print(f'{r[\"tag_name\"]}: {total} total downloads')
for a in r['assets']:
    print(f'  {a[\"name\"]}: {a[\"download_count\"]}')
"
```

To display a live download counter on the website, call this endpoint from a
Vercel Edge Function or a simple `getStaticProps` fetch with revalidation.

---

## If a release job fails

Common failures and fixes:

| Symptom | Cause | Fix |
|---------|-------|-----|
| `error: failed to run custom build command` | Rust compile error | Fix locally, push to main, delete + re-push tag |
| `npm ci` fails | Missing lockfile or bad package | Run `npm install` locally, commit `package-lock.json` |
| Notarization fails: `Invalid credentials` | Wrong `APPLE_ID` or `APPLE_PASSWORD` | Regenerate app-specific password, update secret |
| Notarization fails: `Team ID mismatch` | Wrong `APPLE_TEAM_ID` | Check at developer.apple.com → Membership |
| DMG produced but unsigned | One of the 6 Apple secrets is empty/missing | Check all 6 are set in the repo secrets |

To re-run after fixing: delete the tag, fix the issue, push the tag again.
```bash
git tag -d v0.2.0           # delete local tag
git push origin :v0.2.0     # delete remote tag
# fix the issue
git tag v0.2.0
git push origin v0.2.0
```

---

## WattsOrbit-specific: macOS-only

WattsOrbit uses macOS private APIs for battery/USB power data and cannot run on
Windows or Linux. The release matrix only includes `aarch64-apple-darwin` and
`x86_64-apple-darwin`. Do not add Windows/Linux targets to this app.
