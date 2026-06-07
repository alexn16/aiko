# AÏKO v0.2.1 — Polish Release Notes

**Date:** 2026-06-07
**Type:** Polish / reliability / UX fixes
**From:** v0.2.0

---

## What changed since v0.2.0

### Web Operator uses your real Chrome browser

AÏKO now supports three browser modes via `WEB_OPERATOR_BROWSER_MODE`:

| Mode | Browser | Logins |
|---|---|---|
| `persistent` *(new default)* | Playwright Chromium | Persist in AÏKO-managed profile dir |
| `system_chrome` | Your installed Google Chrome | Reuse existing Chrome sessions |
| `isolated` | Playwright Chromium | No login persistence |

**Recommended local setup for system_chrome:**

1. Open Chrome → create a new profile named **AÏKO**.
2. Log into Canva, Gmail, LinkedIn manually once.
3. Add to `.env.local`:
   ```
   WEB_OPERATOR_BROWSER_MODE=system_chrome
   WEB_OPERATOR_HEADLESS=false
   WEB_OPERATOR_CHROME_PROFILE_DIRECTORY=AÏKO
   ```
4. Restart AÏKO.

Kevin will reuse those logins instead of re-prompting every run.

---

### Reliability fixes

- **Intensive Work guards**: DB mutation helpers (`markWorkItem`, `enqueueWorkItem`) now throw clear errors on empty `RETURNING` results instead of silently producing corrupted state.
- **Resume loop**: one failing operator no longer silently stops the rest from being resumed.
- **`recoverSession`**: always uses isolated Playwright Chromium (never system Chrome), so it can't be blocked by a Chrome profile lock.

---

### Provider health visibility

`/api/health` now includes a `brain` field:

```json
{
  "brain": {
    "usable": false,
    "status": "runtime_unavailable",
    "provider_name": "ChatGPT / Codex Local",
    "owner_message": "ChatGPT / Codex Local is assigned, but the Codex CLI is not available on this machine.",
    "fix_action": "Open Connect AI, reinstall/sign in to Codex, or switch CEO brain to Ollama.",
    "fallback_available": true,
    "fallback_provider": "Ollama (local)"
  }
}
```

- `/home` shows an amber warning banner when the CEO brain is not usable.
- `/connect-ai` shows a runtime health badge on the assigned profile.
- Intensive Work cycle stops cleanly with an owner message when brain is unavailable (no raw `ENOENT`).
- CEO command errors from unavailable providers return 503 with owner-friendly instructions instead of generic 500.

---

### Manual unblock and resume clarity

- `"continue"` and `"resume"` only route to the browser-resume flow when browser work is actually waiting. Without waiting operators, these fall through to normal CEO chat.
- `"I logged in"`, `"browser is unblocked"`, `"captcha completed"` are always explicit browser-resume phrases.
- `/home` attention states are now clearly separated:
  - 🟡 **Chrome profile locked** → "Chrome profile is already open."
  - 🟡 **Needs your help** → "Kevin needs your help in Chrome. Complete this, then click Resume."
  - 🟡 **Ready to resume** → "Kevin is ready to continue."
  - 🟡 **Approval needed** → "Kevin needs approval before doing this."
  - 🔴 **Missing capability** → "AÏKO cannot do this yet."
  - 🟡 **Intensive Work paused** → "Intensive Work is paused."
- `resumeReadyOperatorWork` maps "Agents are paused" to "AÏKO is paused. Resume Intensive Work first." rather than surfacing the internal mode message.

---

### Cleaner task titles

`lib/tasks/task-title-normalizer.ts` provides shared normalisation used at task creation time and as a render-time fallback:

| Raw stored title | Displayed |
|---|---|
| "Blocked: Search: in this browser all is unblocked..." | "Resolve blocker" |
| "Plan the next 7 days of marketing work for ALB Parking." | "Create 7-day marketing plan" |
| "Create a LinkedIn post for AÏKO and save it." | "Draft LinkedIn post" |
| "Item approved: Web Operator: Kevin, prepare the requested Facebook..." | "Kevin, prepare the requested Facebook action but do not post" |
| "Prepare Reddit strategy inputs and draft materials internally." | "Prepare Reddit strategy inputs and draft materials" |

Task source labels: `ai_skill` → "AI plan", `strategy_execution_planner` → "Strategy plan", `intensive_work` → "Work cycle", Web Operator roles → "Web research".

Internal Web Operator sub-tasks (auto-created from agent messages) are hidden from the default `/tasks` view. Accessible via `?include_internal=true`.

---

## Known limitations

- **`system_chrome` profile lock**: if the AÏKO Chrome profile is already open in another Chrome window, `launchPersistentContext` will fail. Close that Chrome window or create a second dedicated profile. The error message is owner-friendly.
- **Codex CLI provider**: if `chatgpt_codex_local` is assigned as CEO brain but the `codex` binary is not installed, all CEO commands return a 503. Use `/connect-ai` to switch the CEO brain to Ollama or an API-key provider.
- **Intensive Work with no queue**: if the work queue is empty, a cycle runs but completes immediately. Use `POST /api/intensive-work/enqueue-project` or ask CEO Chat to "keep working on [project]".
- **Ollama model availability**: the local Ollama model must be running (`ollama serve`) for CEO commands to complete. AÏKO checks reachability in the health endpoint.

---

## Safety guarantees (unchanged from v0.2.0)

- `npm test` and `npm run build` never open a browser.
- Kevin never sends, posts, publishes, messages, or downloads without explicit owner approval.
- Login, CAPTCHA, QR, and security checkpoints always pause for human completion.
- Approval is separate from execution: approving an item does not automatically execute it.
- Missing capabilities are never silently marked available.
- No secrets, API keys, tokens, or filesystem paths are included in API responses.

---

## How to validate locally

```bash
# 1. Start with Normal Chrome
WEB_OPERATOR_BROWSER_MODE=system_chrome \
WEB_OPERATOR_HEADLESS=false \
AIKO_AUTH_MODE=optional \
PORT=3001 \
npm run dev

# 2. Check health (confirm brain.usable and browser.chrome_found)
curl http://localhost:3001/api/health | python3 -m json.tool
curl http://localhost:3001/api/browser/setup | python3 -m json.tool

# 3. Open /home — confirm attention states are clear
# 4. Open /connect-ai — confirm Browser Mode card shows Normal Chrome
# 5. Open /operators — confirm browser mode in subtitle
# 6. Ask CEO Chat: "Kevin, open Canva."
#    → Chrome should open, pause at login if not signed in
# 7. Ask CEO Chat: "Create a LinkedIn post for AÏKO and save it."
#    → Should use AI Skill, no browser, file appears in /files
# 8. Open /tasks — confirm no raw prefixes in task titles
```

---

## Tests

```
npm test   # 397 pass, 0 fail
npm run build  # clean, no type errors
```
