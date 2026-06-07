# AÏKO Resume Blocker Audit

## Problem Found

The owner could tell CEO Chat that the browser was unblocked, but AÏKO could still show raw system messages or behave as if nothing changed.

### Source of "Agents are paused. Resume to continue."

`lib/operating-mode.ts:181` — the `canPerformAction()` function returns this when `operating_mode.paused = true`. This is a **global operating mode pause**, not a Web Operator browser state.

This message could surface via:
- `resumeReadyOperatorWork()` returning `modeCheck.reason` directly — now mapped to owner-friendly text
- Work cycle `stopped_reason: 'operating_mode'` message — remains technical but never reaches owner UI directly
- `/home` `sanitizeMessage()` — now maps "Agents are paused" to "Intensive Work is paused. Resume when ready."

### State Separation

| State | What it means | How to resolve |
|---|---|---|
| `waiting_user` / `user_controlling` | Browser needs manual help (login, CAPTCHA, security) | Owner completes in browser, clicks Resume |
| `ready_to_resume` | Browser blocker cleared, Kevin can continue | Click Resume or say "continue" |
| `waiting_approval` | Action needs approval before executing | Approve or reject in /approvals |
| Missing capability | Native integration not built yet | View proposal in /system |
| `operating_mode.paused = true` | Global Intensive Work pause | Start Intensive Work again |

### Over-broad "continue"/"resume" matching

The orchestrator and `isManualTakeoverCompletedIntent` matched bare "continue" and "resume" unconditionally, routing any use of these words as a browser resume attempt — even when no browser work was waiting.

Fixed by splitting into:
- `isExplicitBrowserResumeIntent()` — unambiguous browser phrases ("I logged in", "captcha completed", "browser is unblocked", etc.) — always route to `manual_takeover_completed`
- `isAmbiguousBrowserResumeIntent()` — bare "continue" / "resume" — only route to `manual_takeover_completed` if `findResolvableManualBlockers()` returns operators

## Fixes Applied

### lib/web-operator/resume-controller.ts
- Split `isManualTakeoverCompletedIntent` into `isExplicitBrowserResumeIntent` and `isAmbiguousBrowserResumeIntent`
- `resumeReadyOperatorWork` now maps raw `modeCheck.reason` to owner-friendly messages:
  - "Agents are paused..." → "AÏKO is paused. Resume Intensive Work first."
  - Read Only mode → "AÏKO is in Read Only mode. Switch to Approval mode..."
  - Approval needed → "This action needs approval before Kevin can continue."
- Added `still_waiting_user_count` to `ResumeSummary`
- Per-operator try/catch (prior PR) already ensures one operator failure doesn't stop others

### lib/brain/orchestrator.ts
- `manual_takeover_completed` still fires on explicit browser phrases (confidence 0.94)
- Bare "continue"/"resume" fires with reduced confidence (0.72) — handler confirms with DB check

### app/api/ceo/command/route.ts
- `handleManualTakeoverCompletedCommand` calls `findResolvableManualBlockers()` before acting on ambiguous phrases
- Falls through to regular chat if no browser work is waiting

### app/(dashboard)/home/page.tsx
- New `intensive_paused` attention state when `paused_reason` is set and `enabled = false`
- `sanitizeMessage` maps "Agents are paused" to "Intensive Work is paused. Resume when ready."
- Attention card now shows "Intensive Work is paused." with "Resume Intensive Work" button
- Distinct messages for each state:
  - manual → "Kevin needs your help. Complete this in the browser, then click Resume."
  - ready → "Kevin is ready to continue."
  - approval → "Kevin needs approval before doing this."
  - missing → "AÏKO cannot do this yet."
  - intensive_paused → "Intensive Work is paused."
  - working → current task
  - idle → "Kevin is idle."

## Safety Notes

- No login/CAPTCHA/security bypass is added.
- No send/post/message/publish action is auto-approved.
- Read Only mode still blocks browser execution.
- Missing capabilities are not marked available.
- Approval remains separate from execution.
- `findResolvableManualBlockers()` is read-only — no state change on its own.
