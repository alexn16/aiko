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
