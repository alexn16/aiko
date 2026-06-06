# AÏKO Resume Blocker Audit

## Problem Found

The owner could tell CEO Chat that the browser was unblocked, but AÏKO could still show:

```text
Agents are paused. Resume to continue.
```

That text comes from `lib/operating-mode.ts` when `operating_mode.paused=true`. It is a global mode gate, not a Web Operator login/CAPTCHA/security state.

Browser manual takeover state lives separately on `web_operators`:

- `waiting_user`
- `user_controlling`
- `ready_to_resume`
- `requires_user_input`
- `waiting_reason`

The bad runtime behavior happened because broad owner phrases such as “all is unblocked” or “use the browser now” were not routed to a real resume flow. Name-specific commands like “Kevin, continue” had partial handling, but generic browser-unblock phrases could fall through to normal CEO text.

## State Separation

- Browser help needed: login, CAPTCHA, security checkpoint, or manual takeover.
- Ready to resume: the owner completed browser help and Kevin can continue if mode permits.
- Approval needed: a risky action is pending approval and must not execute automatically.
- Missing capability: native integration or skill/playbook is not available.
- Global pause: operating mode paused all agent actions.

Missing capabilities such as CRM sync, calendar booking, or native email send are not browser blockers and must not be marked available by resume.

## Fix Applied

Added `lib/web-operator/resume-controller.ts`.

It provides:

- `isManualTakeoverCompletedIntent()`
- `findResolvableManualBlockers()`
- `markManualBlockerResolved()`
- `resumeReadyOperatorWork()`
- `resumeAllSafeBrowserWork()`
- `getResumeSummary()`

When the owner says the browser is unblocked, AÏKO now:

1. Detects `manual_takeover_completed`.
2. Clears true global pause if present.
3. Finds operators in manual-browser states.
4. Marks manual blockers resolved.
5. Resumes pending browser work only if operating mode permits.
6. Leaves approvals pending.
7. Leaves missing capabilities unavailable.

## UI Fixes

`/home` now separates:

- “Kevin needs your help”
- “Kevin is ready to continue”
- “Approval needed”
- “AÏKO cannot do this yet”

The `/home` Resume button now calls `/api/web-operator/resume-browser-work` instead of only linking to the operator page.

`/operators/[id]` Resume now clears manual blocker state before calling the workflow resume logic.

## CEO Chat Fix

CEO Chat now intercepts `manual_takeover_completed` before generic AI response.

Example response:

```text
Kevin can continue in the browser now. I resumed the browser work that was waiting for your help. Anything that requires approval will still wait for approval. Native integrations that are not built, like CRM sync or calendar booking, remain unavailable.
```

If nothing is resumable:

```text
No browser task is currently waiting for manual help. The remaining blockers are missing capabilities or approvals.
```

## Safety

- No login/CAPTCHA/security bypass is added.
- No send/post/message/publish action is auto-approved.
- Read Only mode still blocks browser execution.
- Missing capabilities are not marked available.
- Approval remains separate from execution.
