# AÏKO Web Operator Runtime Report

**Date:** 2026-06-03  
**Audit scope:** Browser session visibility, CAPTCHA/login detection, manual takeover flow

---

## Part 1 — System audit findings

### Screenshot visibility
| Check | Result |
|---|---|
| Screenshots captured after each action | ✅ `capturePageState()` in `playwright-executor.ts` takes screenshots |
| Screenshots shown in `/operators/[id]` | ✅ `operator.latest_screenshot` rendered as `<img>` |
| Screenshots suppressed on sensitive pages | ✅ `isSensitivePage()` skips screenshots on login/password URLs |
| Per-action screenshot stored | ✅ `web_operator_actions.screenshot_url` column |

### Session persistence
| Check | Result |
|---|---|
| Per-operator browser context | ✅ `getOperatorContext(profileKey)` in `playwright-executor.ts` |
| Persistent cookie/localStorage | ✅ `storageState` saved to `.operator-profiles/{key}.json` |
| Session survives login | ✅ `saveOperatorStorageState()` called after each action |
| Contexts isolated per operator | ✅ `operatorContexts: Map<string, BrowserContext>` keyed by `browser_profile_key` |

### Headless mode
| Check | Before | After |
|---|---|---|
| Env var | `BROWSER_HEADLESS` | `WEB_OPERATOR_HEADLESS` (priority), `BROWSER_HEADLESS` (fallback) |
| Default | `true` (headless) | `true` (headless) |
| Visible browser | Set `BROWSER_HEADLESS=false` | Set `WEB_OPERATOR_HEADLESS=false` |
| Headed mode note | Not documented | Documented in `.env.local` comment |

### CAPTCHA / login detection
| Check | Before | After |
|---|---|---|
| Login URL detection | Partial (`isSensitivePage` — only for screenshot suppression) | ✅ Full: `detectPageState()` in `page-state-detector.ts` |
| CAPTCHA text detection | ❌ None | ✅ Detects: unusual traffic, verify you are human, recaptcha, hcaptcha, comprueba que eres humano |
| Security checkpoint | ❌ None | ✅ Detects: security checkpoint, suspicious activity, verify your identity, verify it's you |
| 2FA detection | ❌ None | ✅ Detects: two-factor, 2FA, authentication code, verification code |
| Spanish language signals | ❌ None | ✅ contraseña, iniciar sesión, comprueba que eres humano, verificación en dos pasos |
| Action on detection | n/a | ✅ Throws `ManualTakeoverRequired` error → `waiting_user` operator status |
| Auto-bypass attempt | n/a | ✅ Explicitly forbidden — error thrown, automation stopped |

### waiting_user state
| Check | Before | After |
|---|---|---|
| Set on CAPTCHA | ❌ | ✅ `runWebOperatorAction` catches `ManualTakeoverRequired`, sets `waiting_user=true` on operator |
| Set on login wall | ❌ (Gmail-only) | ✅ Generic — all sites |
| Pending action stored | ✅ | ✅ |
| Message shown in UI | Generic "waiting for user input" | ✅ Specific: reason-aware message with instructions |

### Resume flow
| Check | Result |
|---|---|
| Resume uses same profile key | ✅ `resumeOperatorWorkflow` uses `op.browser_profile_key` |
| Cookies/session preserved | ✅ `storageState` persisted to file |
| Risky action still requires approval after resume | ✅ `requiresApproval()` check happens in `runWebOperatorAction` before every action |
| `markLoginCompleted` generic (not Gmail-specific) | ✅ Now uses `detectPageState()` on current browser page |

### /operators/[id] UI
| Check | Before | After |
|---|---|---|
| Waiting banner | "Operator waiting for user input" (generic) | ✅ "⚠ Kevin needs your help" with reason-specific message |
| CAPTCHA message | Generic | ✅ "A CAPTCHA appeared. Please solve it… The operator will not attempt to bypass it automatically." |
| Login message | Generic | ✅ "Login is required. Please sign in in the browser, then click Login / CAPTCHA completed." |
| 2FA message | None | ✅ "Two-factor authentication is required." |
| Headed mode hint | None | ✅ Shows hint to set `WEB_OPERATOR_HEADLESS=false` if headless |
| "I'm taking over" button | "Mark: I'm in control" | ✅ Renamed to "I'm taking over" |
| Resume button | ✅ Exists | ✅ Present |

### CEO Chat
| Check | Before | After |
|---|---|---|
| Delegation message | "Research delegated to Web Operator" | ✅ Includes: "will open the site in their browser session. If a login, CAPTCHA, or security check appears, they will pause and ask you to take over — they will not bypass it automatically." |
| CAPTCHA/login result | Generic error | ✅ "[Operator] needs your help. Please solve the CAPTCHA, complete the login…" |

---

## Part 2 — What was built

### New file: `lib/web-operator/page-state-detector.ts`
```
detectPageState(page) → PageState
isLoginRequired(page) → boolean
isCaptchaDetected(page) → boolean
isSecurityCheckpoint(page) → boolean
isManualTakeoverRequired(page) → boolean
ManualTakeoverRequired extends Error  (structured error for caller)
```

Detects:
- Login walls (URL patterns, title patterns, body text — EN + ES)
- CAPTCHA (URL patterns, body text — EN + ES)
- Security checkpoints
- Two-factor authentication / 2FA

Never bypasses. Never auto-solves. Throws structured error to stop automation.

### Updated: `lib/browser/controller.ts`
- Added `WEB_OPERATOR_HEADLESS` env var (priority over `BROWSER_HEADLESS`)
- Default: `true` (headless, server-safe)
- `WEB_OPERATOR_HEADLESS=false` opens a visible browser window

### Updated: `lib/web-operator/playwright-executor.ts`
- Imports `detectPageState`, `ManualTakeoverRequired`
- `open_url`/`read_page`: calls `detectPageState()` after `goto()`, throws if manual takeover required
- `search`: calls `detectPageState()` after DDG goto and after Google goto

### Updated: `lib/web-operator/web-operator.ts`
- `runWebOperatorAction` return type includes `waiting_user?: boolean`
- Catch block handles `ManualTakeoverRequired`: marks action as `waiting_user`, sets operator `status=waiting_user`, stores pending action

### Updated: `lib/web-operator/delegation.ts`
- Handles `waiting_user` result: returns clean "[Operator] needs your help" message
- Browser session and takeover note appended to delegation results

### Updated: `lib/web-operator/operators.ts`
- `markLoginCompleted()` is now generic (not Gmail-only)
- Uses `detectPageState()` on the actual browser page
- Falls back to trusting the user's claim if browser context unavailable

### Updated: `app/api/ceo/command/route.ts`
- Appends browser session + manual takeover policy note to delegation messages

### Updated: `app/(dashboard)/operators/[id]/page.tsx`
- Reason-aware waiting banner: specific message per CAPTCHA/login/2FA/checkpoint
- "I'm taking over" button (renamed from "Mark: I'm in control")
- "✓ Login / CAPTCHA completed" button (clearer action)
- Headed mode hint when `WEB_OPERATOR_HEADLESS` is not `false`
- `waitingReasonLabel()` helper

### Updated: `.env.local`
- `WEB_OPERATOR_HEADLESS=false` option documented in comment

---

## Part 3 — Runtime validation

### Test setup
```bash
WEB_OPERATOR_HEADLESS=false AIKO_AUTH_MODE=optional PORT=3001 npm run dev
```

### Expected flow for "Kevin, open Facebook and research parking groups in A Coruña"
1. CEO routes to Facebook research skill
2. Delegation calls `delegateToWebOperator` with `action_type=search`, `skill_id=facebook_research`
3. Playwright opens `https://html.duckduckgo.com/html/?q=...`
4. `detectPageState()` runs after `goto()`
5. If CAPTCHA detected → `ManualTakeoverRequired` thrown
6. `runWebOperatorAction` catches it → sets operator `status=waiting_user`
7. UI at `/operators/[id]` shows: "⚠ Kevin needs your help — A CAPTCHA appeared. Please solve it in the browser, then click Login / CAPTCHA completed."
8. Browser window is visible (headed mode)
9. User solves CAPTCHA manually
10. User clicks "✓ Login / CAPTCHA completed"
11. `markLoginCompleted()` calls `detectPageState()` on current page
12. If page is clear → operator set to `ready_to_resume`
13. User clicks "Resume workflow"
14. Kevin continues from same browser context (cookies preserved)

### Facebook approval requirement
Facebook post/comment/join/message → `ALWAYS_REQUIRES_APPROVAL` → `waiting_approval` → approval item created → must be approved in `/approvals` before execution.

### Canva approval requirement
`publish_design`, `share_design`, `download_final_asset` → `ALWAYS_REQUIRES_APPROVAL`

---

## Remaining notes

- **Headed mode requires local dev** — browser window only works locally; server deployments must use headless + screenshot-only visibility.
- **Screenshot refresh** — `/operators/[id]` polls every 10s and shows `latest_screenshot`.
- **Persistent profiles** — stored in `.operator-profiles/` (gitignored). Delete to reset sessions.
- **CAPTCHA bypass is never attempted** — `ManualTakeoverRequired` throws before any further automation.

---

## Headed Runtime Validation — 2026-06-03

### Setup

```bash
WEB_OPERATOR_HEADLESS=false AIKO_AUTH_MODE=optional PORT=3001 npm run dev
```

| Check | Result |
|---|---|
| Browser mode | ✅ Headed (`WEB_OPERATOR_HEADLESS=false`) |
| CEO brain | ✅ Connected: Ollama (local) / llama3.1:8b |
| Operating mode | ✅ `approval_required` |
| Playwright Chromium | ✅ Installed: Chromium v1223 |

### Tests run

| Test | Result |
|---|---|
| Generic URL open: `https://example.com` | ⚠️ Routed correctly to `website_reader` after fix, but local DNS could not resolve `example.com`; action logged `failed/network_error`. |
| Google search | ✅ Google unusual-traffic/CAPTCHA detected; action logged `waiting_user`; operator stayed `waiting_user`; no fake results. |
| Facebook research | ⚠️ Routed to `facebook_research`, but current research path searches Google first; Google CAPTCHA stopped automation before Facebook. No bypass and no fake result. |
| Canva draft | ✅ Canva Cloudflare/security challenge detected after fix; action logged `waiting_user` with `security_checkpoint`; no publishing/downloading/sharing. |
| Facebook post | ✅ `create_post` created approval item and action logged `waiting_approval`; no post attempted. |
| Operator page | ✅ Shows current URL, waiting reason, pending action, skill names, latest screenshot when safe, and buttons: `I'm taking over`, `Login / CAPTCHA completed`, `Resume workflow`, `Pause operator`, `Clear workflow`. |

### Actions and screenshots observed

| Action | Skill | Status | Screenshot |
|---|---|---|---|
| `open_url https://example.com` | Website reader | `failed/network_error` | None (navigation failed before page load) |
| Google search | General web research | `waiting_user/captcha_detected` | None (manual takeover page) |
| Facebook research | Facebook research | `waiting_user/captcha_detected` | None (manual takeover page) |
| Canva open | Canva design | `waiting_user/security_checkpoint` | Suppressed after detector fix |
| Facebook post | Facebook research | `waiting_approval` | None (approval created before browser execution) |

### Runtime bugs fixed

1. URL instructions such as `open https://example.com` were classified as an unknown website named `https`. Fixed URL extraction and routed public URL prompts to the existing `website_reader` skill.
2. `delegateToWebOperator()` overwrote `waiting_user` operator status back to `idle`. Fixed status precedence so manual takeover state is preserved.
3. Canva/Cloudflare Spanish challenge pages (`Un momento…`, `RayID`, Canva help copy) were treated as normal pages. Added security checkpoint detection.
4. `/operators/[id]` always displayed the headless-mode warning because browser mode was read from a missing client meta tag. Added server-provided browser mode in the operator API.
5. `/operators/[id]` ignored top-level `latest_screenshot` from the status API. Fixed mapping so safe screenshots render on the detail page.
6. Duplicate stale `Mark: I'm in control` control remained on the detail page. Removed it; the visible takeover button is now `I'm taking over`.
7. `markUserControlling()` cleared `requires_user_input`, hiding unresolved CAPTCHA/security blockers. It now preserves the waiting reason until `markLoginCompleted()` verifies the page is clear.
8. `markLoginCompleted()` inspected the first browser context page, which could be `about:blank`. It now prefers the page matching the operator's current URL.

### Resume behavior

- `I'm taking over` marks the operator `user_controlling` while preserving `requires_user_input=true` and the waiting reason.
- `Login / CAPTCHA completed` refuses to clear the blocker while the browser still shows `security_checkpoint`.
- `Resume workflow` returns `Cannot resume: security_checkpoint` until manual intervention is actually complete.
- Risky Facebook posting remains approval-gated before and after manual-control flows.

---

## Known-Site Direct Open Validation — 2026-06-03

### Change

Explicit known-site operator instructions now open the target site directly instead of starting with generic Google/DDG search.

| Skill | Direct target |
|---|---|
| `facebook_research` | `https://www.facebook.com/search/groups?q={query}` |
| `linkedin_research` | `https://www.linkedin.com/search/results/companies/?keywords={query}` |
| `instagram_research` | `https://www.instagram.com/` |
| `canva_design` | `https://www.canva.com/` |
| `gmail_workflow` | `https://mail.google.com/` |
| `website_reader` | Validated exact HTTP(S) URL from the instruction |

### Runtime validation

Command:

```bash
WEB_OPERATOR_HEADLESS=false AIKO_AUTH_MODE=optional PORT=3001 npm run dev
```

| Prompt | Result |
|---|---|
| `Kevin, research Facebook groups about parking in A Coruña.` | ✅ Action logged as `open_url`, skill `facebook_research`, target URL `https://www.facebook.com/search/groups?q=parking%20A%20Coru%C3%B1a`; no Google navigation. Facebook returned `Not Found` unauthenticated, but no fake result was produced. |
| `Kevin, open Canva and create a draft Instagram post for ALB Parking.` | ✅ Action logged as `open_url`, skill `canva_design`, target URL `https://www.canva.com/`; Canva security checkpoint paused as `waiting_user/security_checkpoint`. |
| `Kevin, open Gmail.` | ✅ Action logged as `open_gmail`, skill `gmail_workflow`, target URL `https://mail.google.com/`; Google login paused as `waiting_user/login_required`. |

### Fixes in this pass

1. Added `lib/web-operator/site-intents.ts` for direct known-site target resolution.
2. Updated CEO delegation for Facebook/LinkedIn/Instagram/Canva to use direct `open_url` instead of generic `search`.
3. Added a delegation-level guard that rewrites safe known-site `search` actions to direct `open_url`, so non-CEO callers do not accidentally reintroduce Google-first routing.
4. Updated CEO copy to say the operator will open the known site directly.
5. Fixed `open_gmail` so Gmail login pages use the standard `waiting_user/login_required` path instead of logging a completed action with `login_required` output.
