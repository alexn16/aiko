# AÏKO UX Simplification Report

## Scope

This pass audited the owner-facing approval and manual takeover surfaces:

- `/home`
- `/operators`
- `/operators/[id]`
- `/approvals`
- CEO Chat delegation copy
- Web Operator waiting and failure messages
- Start Campaign approval/result copy

The safety model was not changed. Approval gates, manual takeover, CAPTCHA/login/security pauses, and detailed logs remain intact.

## Noisy Defaults Found

- `/home` split attention into separate Live Work and Attention sections, so the main next action was less obvious.
- `/operators` showed waiting reasons, browser profile keys, current goals, task snippets, and session details in the normal card.
- `/operators/[id]` showed status cards, playbook IDs, step IDs, pending payload snippets, operator controls, and action tables by default.
- `/approvals` showed content previews and item-type metadata before the user saw the simple approval decision.
- Some shared messages still used longer policy language instead of the short owner-facing phrases.

## Simplifications Applied

- `/home` now has one primary **Needs your attention** card.
  - Manual help: `Kevin needs your help` / `Complete this in the browser, then click Resume.`
  - Approval: `Approval needed` / `Kevin needs approval before doing this.`
  - Clear: `All clear` / `AÏKO is ready.`
- `/home` exposes only the expected main buttons by default:
  - Manual help: Open browser, Resume, Advanced
  - Approval: Review, Approve, Reject, Advanced
- `/approvals` now shows simple approval cards:
  - what Kevin wants to do
  - project
  - plain reason
  - Approve / Reject
  - `View details`
- `/approvals` now repeats the safety rule: `Approving does not execute automatically. Resume is still explicit.`
- `/operators` now shows simple waiting copy and hides browser profile / waiting reason under Advanced.
- `/operators` now prioritizes the actual operator status, so approval-needed work does not show manual-help copy from stale takeover flags.
- `/operators/[id]` now starts with one plain state card:
  - `Kevin is waiting for you`
  - `Kevin is working`
  - `Approval needed`
  - `Kevin is idle`
- `/operators/[id]` keeps screenshots visible, but moves playbook IDs, step IDs, pending payloads, controls, and recent action tables behind Advanced.
- Shared copy was standardized:
  - Manual takeover: `Kevin needs your help. Complete this in the browser, then click Resume.`
  - Approval: `Kevin needs approval before doing this.`
  - Forbidden: `AÏKO cannot do this safely.`
  - Read Only: `AÏKO is in Read Only mode. Switch to Approval mode to let Kevin use the browser.`
  - Browser missing: `Browser runtime is missing. Run: npx playwright install chromium.`
  - No results: `Research finished, but no useful results were extracted.`

## Runtime Findings Fixed

- Facebook approval delegation repeated the approval sentence. The playbook add-on now says Kevin will open Facebook directly and stop before external action.
- Pending Web Operator approvals used raw instruction titles in the visible card. Approval cards now use plain titles such as `Prepare Facebook post draft`.
- The operators list showed stale goal/task lines in the default card. These now live under Advanced.

## Still Available Under Advanced

- action IDs
- skill IDs
- playbook IDs
- pending payloads
- action tables
- failure reasons
- raw approval metadata
- Web Operator profile/session details

## Safety Check

- No auto-send/post/publish/message behavior was added.
- Approval still does not execute automatically.
- Resume remains explicit.
- Login/CAPTCHA/security pauses still require manual takeover.
- Forbidden actions remain blocked.
