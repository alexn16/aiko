# AÏKO Chrome Runtime Audit

## Current Browser Setup

### What opens
- **Playwright bundled Chromium** — not system Google Chrome
- `chromium.launch({ headless, slowMo })` in `lib/browser/controller.ts:25`
- No `executablePath` → Playwright uses its own Chromium download

### Profile/storage
- **No `userDataDir`** — no traditional Chrome profile
- **Storage state JSON files** at `.operator-profiles/{profileKey}.json`
- Per-operator context with saved cookies/localStorage
- Logins persist between AÏKO restarts via these JSON files
- But does NOT share sessions with the user's real Chrome browser

### Env vars
| Var | Effect |
|---|---|
| `WEB_OPERATOR_HEADLESS=false` | Shows browser window |
| `BROWSER_HEADLESS=false` | Legacy fallback |
| Default | Headless Chromium |

### Result for the owner
- Kevin opens a Playwright Chromium window (different from the user's Chrome)
- No existing Chrome logins are available
- Every site requires fresh login unless the `.operator-profiles/*.json` has saved state

---

## What Must Change

Goal: Kevin uses a real Chrome instance that feels like a human assistant using the owner's browser.

Recommended: `WEB_OPERATOR_BROWSER_MODE=system_chrome`

This uses `launchPersistentContext` with:
- `executablePath` pointing to installed Google Chrome
- `userDataDir` pointing to a dedicated AÏKO Chrome profile
- `headless: false` (shows browser to owner)
- Existing logins in that profile persist naturally

### Browser Modes Added

| Mode | Browser | Profile | Logins |
|---|---|---|---|
| `isolated` | Playwright Chromium | Temp context | None (current default) |
| `persistent` | Playwright Chromium | `.operator-profiles/{key}/` dir | Persist via userDataDir |
| `system_chrome` | Installed Chrome | Configured Chrome profile | Real Chrome logins |

### Env vars added
```
WEB_OPERATOR_BROWSER_MODE=system_chrome     # isolated | persistent | system_chrome
WEB_OPERATOR_CHROME_EXECUTABLE_PATH=        # override Chrome path
WEB_OPERATOR_CHROME_USER_DATA_DIR=          # override Chrome data dir
WEB_OPERATOR_CHROME_PROFILE_DIRECTORY=      # override profile dir name (e.g. "AÏKO")
```

### macOS defaults
- Chrome executable: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- Chrome data dir: `~/Library/Application Support/Google/Chrome`

### Recommended local setup
1. Open Chrome → Add new profile → name it "AÏKO"
2. Log into Canva, Gmail, LinkedIn manually once
3. Set `WEB_OPERATOR_BROWSER_MODE=system_chrome` in `.env.local`
4. Set `WEB_OPERATOR_CHROME_PROFILE_DIRECTORY=AÏKO`

### Safety limits unchanged
- No bypassing login/CAPTCHA/security
- No exporting cookies or tokens
- No auto-send/post/publish
- No Chrome launch during npm test or npm run build

---

## Chrome Owner Workflow Polish — 2026-06-07

### UI improvements

**`/connect-ai` BrowserModeCard:**
- Shows Chrome found/not found, profile directory, ready status with check/warning icons
- "Show setup steps" toggle reveals a 4-step numbered guide
- "If Chrome is already open" warning inline (no Advanced needed)
- Full filesystem paths never shown (only mode label, found status, profile name)

**`/operators` per-card browser status:**
- "Browser: Normal Chrome · [project name]" shown on each card
- `operatorNotice` distinguishes profile_locked, login_required, captcha_detected, security_checkpoint with Chrome-specific copy

**`/home` attention card:**
- New `profile_locked` attention state takes priority over `manual`
- Shows "Chrome profile is already open." with "Open setup" and "Use AÏKO profile" buttons
- `manual` state shows "Kevin needs your help in Chrome." (Chrome-specific copy)

### Operator page copy improvements

| Waiting reason | Message |
|---|---|
| `profile_locked` | "Chrome profile is already open. Close Chrome or use a dedicated AÏKO Chrome profile." |
| `login_required` | "Kevin needs your help. Log in to Chrome, then click Resume." |
| `captcha_detected` | "Kevin needs your help. Complete the CAPTCHA in Chrome, then click Resume." |
| `security_checkpoint` | "Kevin needs your help. Complete the security check in Chrome, then click Resume." |
