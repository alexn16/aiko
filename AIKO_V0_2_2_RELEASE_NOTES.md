# AÏKO v0.2.2 — Daily-Use Polish Release Notes

**Date:** 2026-06-07
**Type:** Daily-use fixes
**From:** v0.2.1

---

## What changed and why it matters

### Daily brief is now actionable

**Before:** `today_summary = "3 items need attention before work flows smoothly."` — generic, no project name, no concrete step. Greeting said "Good evening" in the afternoon.

**After:**
- Greeting is simply **"Today"** — no clock dependency.
- `today_summary` shows the **first specific waiting operator message** ("Kevin needs your help in Chrome. Log in to Chrome, then click Resume."), or the first blocked task with its project name. You can act on it immediately.
- Priority items include project names and use clean titles — no more `"Item approved: Web Operator: Kevin, prepare the requested Facebook action..."`.
- Stale browser blockers are deprioritized to the bottom of the list so fresh ones stay visible.

### Compound prefix stripping fixed

Raw titles like `"Item approved: Web Operator: Kevin, prepare..."` previously passed through because the normalizer only ran one pass. The normalizer now loops until the title is stable, so stacked prefixes like `"Item approved: Web Operator:"` are fully stripped to `"Kevin, prepare the requested Facebook action but do not post,…"`.

### Project names embedded in commands resolve correctly

**Before:** `"Write a short email to introduce ALB Parking to potential business clients."` → created output for Codex Validation Demo (wrong project — the regex only matched `"for X"` or `"on X"` patterns).

**After:** `resolveProjectFromCommand` scans all active project names for the longest case-insensitive substring match anywhere in the command text. Longest match wins. Falls back to trigger-word pattern, then latest active project — only if nothing matches.

Examples:
- "introduce **ALB Parking** to clients" → ALB Parking ✅
- "Create a LinkedIn post for **AÏKO**" → AÏKO ✅
- "Promote **Codex Validation Demo**" → Codex Validation Demo ✅

### Stale browser blockers can be cleared safely

Kevin and Default operators can remain stuck in `waiting_user` from old sessions. These permanent amber banners erode trust in `/home`.

**New behavior:**
- Browser blockers older than `STALE_BLOCKER_HOURS` (default: 8) appear as **"Old browser blocker"** at the bottom of priority items.
- `/home` attention card shows **"Old blocker"** state with three buttons: **Resume**, **Clear blocker**, **Open operator**.
- **Clear blocker** resets the operator to idle, clears pending workflow state, writes a note — does NOT mark any action as completed, does NOT execute anything.
- Fresh waiting states (< 8h) still show **"Kevin needs your help in Chrome."**

---

## How to validate locally

```bash
# Start with Normal Chrome
WEB_OPERATOR_BROWSER_MODE=system_chrome \
WEB_OPERATOR_HEADLESS=false \
AIKO_AUTH_MODE=optional \
PORT=3001 \
npm run dev

# 1. Check daily brief
curl http://localhost:3001/api/daily-brief | python3 -m json.tool
# Expect: greeting="Today", specific today_summary, no "Item approved: Web Operator:" in titles

# 2. Test embedded project name
# In CEO Chat: "Write a short email to introduce ALB Parking to clients. Save it."
# Expect: project_id = ALB Parking, file saved as alb-parking-email-draft.md

# 3. Test LinkedIn (AÏKO project)
# In CEO Chat: "Create a LinkedIn post for AÏKO."
# Expect: intent=content_creation, no browser action

# 4. If Kevin is stuck in waiting_user from an old session
# Open /home, look for "Old blocker" attention state
# Click "Clear blocker" — Kevin should become idle, nothing executed
```

---

## Known limitations

- `today_summary` uses the first priority item — if that item is a stale blocker, it may still appear until the stale threshold is crossed.
- `resolveProjectFromCommand` does substring matching; a project named "ALB" would match inside "ALBA". Longest-first ordering mitigates this but ambiguous names may need disambiguation in a future release.
- The LLM CEO response text may still mention the wrong project by name (it uses context memory), even if the actual `project_id` resolves correctly. The file is saved to the right project; only the prose may be inconsistent.

---

## Safety guarantees (unchanged)

- `clear_stale_blocker` resets to idle only. No action is completed. No action is executed.
- Project resolution is read-only — it only reads project names, never writes.
- `npm test` and `npm run build` never open a browser.
- No auto-send, post, publish, or message.
