# AÏKO Execution Flow

_Last updated: 2026-05-27_

## 1. Current end-to-end flow

### Research → Lead extraction → Approval → Gmail draft → Send control

```
User / CEO Chat
  │
  ▼
CEO command route (/api/ceo/command)
  ├─ reads provider brain for 'ceo' role (lib/ai/router → provider_connections)
  ├─ calls runCeoCommandAgent (lib/agents/ceo-command-agent) via LLMConfig bridge
  ├─ detects research intent → delegateSearch(query, operatorName)
  │     └─ lib/web-operator/delegation.ts
  │           ├─ canPerformAction('browse_web')   → operating_mode table
  │           ├─ getOrCreateOperatorByName(name)  → web_operators table
  │           ├─ startWebOperatorSession()         → web_operator_sessions table
  │           ├─ runWebOperatorAction(search)      → web_operator_actions table
  │           │     └─ executeWebAction()          → playwright-executor.ts (Playwright)
  │           └─ [fire-and-forget] extractLeadsFromWebOperatorAction()
  │                 └─ lib/leads.ts → callAI(role:'research') → leads table
  │
  ▼
/leads page (app/(dashboard)/leads/page.tsx)
  ├─ lists leads from GET /api/leads
  ├─ client reviews: Approve / Reject / Archive
  ├─ PATCH /api/leads/[id]  →  leads.status = 'approved'
  │
  ├─ [approved + email present] "✉ Gmail draft" button
  │     POST /api/leads/[id]/outreach-draft
  │       └─ lib/outreach/lead-outreach.ts → delegateLeadToGmailDraft()
  │             ├─ getLeadById(id)
  │             ├─ guard: status === 'approved'
  │             ├─ guard: email !== null
  │             ├─ canPerformAction('prepare_outreach')
  │             ├─ generateLeadOutreachDraft() → callAI(role:'copywriting')
  │             ├─ createLeadOutreachTask()    → agent_tasks table
  │             ├─ delegateGmailDraft()        → lib/web-operator/delegation.ts
  │             │     └─ delegateToWebOperator(create_email_draft)
  │             │           ├─ canPerformAction('browse_web')
  │             │           ├─ runWebOperatorAction(create_email_draft)
  │             │           │     ├─ auto_approval: creates approval_item → waits
  │             │           │     └─ full_access:  executes in browser immediately
  │             │           └─ web_operator_actions.status = 'completed'|'waiting_approval'
  │             └─ appends draft note to leads.notes (lead stays 'approved')
  │
  ├─ [approved + no email + has website] "🔍 Find contact" button
  │     POST /api/leads/[id]/find-contact
  │       └─ delegateReadWebsite(lead.website) → web_operator_actions (read_page)
  │             └─ [fire-and-forget] extractLeadsFromWebOperatorAction() may update email
  │
  └─ [future] "Send" button
        POST /api/leads/[id]/send
          └─ lib/outreach/lead-outreach.ts → sendLeadOutreachViaOperator()
                ├─ guard: status 'approved' or 'contacted'
                ├─ canPerformAction('send_email')  ← Full Access only
                ├─ guard: mode !== 'auto_approval' (explicit Full Access required)
                ├─ delegateSendGmail()             → send_gmail_draft action
                ├─ incrementSendCount()            → operating_mode.sends_today++
                └─ leads.status = 'contacted'
```

---

## 2. What is working

| Layer | What | Files |
|---|---|---|
| AI brains | Provider catalog, role assignments | `lib/ai/provider-catalog.ts`, `lib/ai/router.ts`, `provider_connections`, `ai_role_assignments` |
| CEO chat | Commands, context, delegation routing | `app/(dashboard)/ceo/page.tsx`, `app/api/ceo/command/route.ts`, `lib/agents/ceo-command-agent.ts` |
| PM chat | Per-project context + delegation | `app/api/projects/[id]/pm-chat/route.ts` |
| Web Operators | Named, isolated, browser profiles | `lib/web-operator/operators.ts`, `web_operators` table |
| Browser actions | Search, read_page, Gmail, screenshots | `lib/web-operator/playwright-executor.ts`, `web_operator_actions` table |
| Operator memory | Current goal/workflow, requires_user_input | `web_operators.current_goal`, `pending_action_*` columns |
| Manual takeover | Mark login completed, resume workflow | `operators.ts: markLoginCompleted()`, `/operators/[id]` page |
| Lead extraction | Auto after search/read_page, manual via button | `lib/leads.ts`, `app/api/leads/extract/route.ts` |
| Lead review | Approve / Reject / Archive / status tabs | `app/(dashboard)/leads/page.tsx`, `components/leads/ProjectLeadsPanel.tsx` |
| Outreach draft | Copywriting brain generates, operator creates Gmail draft | `lib/outreach/lead-outreach.ts`, `app/api/leads/[id]/outreach-draft/route.ts` |
| Send control | Full Access only, daily limit, mode log | `lib/operating-mode.ts`, `app/api/leads/[id]/send/route.ts` |
| Approvals | Web Operator actions in auto_approval mode → approval_items | `lib/approvals.ts`, `approval_items` table |
| Mode audit log | Every canPerformAction call logged | `mode_action_log` table |
| Operating mode | Read Only / Auto-Approval / Full Access | `lib/operating-mode.ts`, `/api/mode` |

---

## 3. Safety gates

| Gate | Where enforced | Behaviour |
|---|---|---|
| Lead must be approved | `delegateLeadToGmailDraft()` | Returns `blocked_reason: 'lead_not_approved'` if status ≠ approved |
| Email must exist | `delegateLeadToGmailDraft()` | Returns `blocked_reason: 'no_email'`; UI shows "Find contact" button instead |
| Web Operator only | All external actions | No SMTP, no Gmail API — `lib/email/sender.ts` is legacy-only and not called by new flow |
| Auto/Approval stops before send | `sendLeadOutreachViaOperator()` | Returns `blocked_reason: 'needs_full_access'` in auto_approval mode |
| Auto/Approval pauses create_email_draft | `web-operator.ts requiresApproval()` | `create_email_draft` in `AUTO_REQUIRES_APPROVAL` → creates approval_item, waits |
| Full Access required to send | `canPerformAction('send_email')` | Only `full_access` mode proceeds |
| Full Access requires confirmation token | `setMode('full_access')` | Must pass `CONFIRM_FULL_ACCESS` token |
| Daily send limit | `canPerformAction('send_email')` | Compares `sends_today >= daily_send_limit`; incremented after each send |
| Mode audit log | Every `canPerformAction()` call | Written to `mode_action_log` regardless of allow/deny |
| Login/CAPTCHA safety | `playwright-executor.ts detectGmailLogin` | Sets `requires_user_input=true`, stores pending action, halts operator |
| Manual takeover | `/operators/[id]` UI | "Mark login completed" → `markLoginCompleted()` → `resumeOperatorWorkflow()` |
| No invented contact data | `generateLeadOutreachDraft()` prompt | Explicit rule: "Do NOT invent contact details" |
| Source provenance | `leads.source_action_id`, `leads.source_text` | FK to `web_operator_actions`, original page text preserved |

---

## 4. Gaps and bugs

### 🐛 Bug A (fixed in this commit): Lead marked `contacted` after draft — not after send

**Was**: `delegateLeadToGmailDraft()` set `leads.status = 'contacted'` when the Gmail draft was successfully created in the browser.  
**Problem**: "Contacted" should mean the email was actually sent, not that a draft exists in Gmail.  
**Fix applied**: Draft creation now appends a note to `leads.notes` (e.g., `"Gmail draft prepared. Subject: '...'"`) and leaves status as `approved`. Only `sendLeadOutreachViaOperator()` sets `contacted`.

---

### 🔴 Gap B: No `source_lead_id` on `web_operator_actions`

**Problem**: When Kevin creates a Gmail draft for ALB Parking, `web_operator_actions` has no FK back to the lead. You cannot answer: "which action was for which lead?" from the operator action log.  
**Impact**: Operator action UI cannot show "this draft was for Lead X". Lead cannot show "operator action ID: Y".  
**Fix needed**: Migration `ALTER TABLE web_operator_actions ADD COLUMN IF NOT EXISTS source_lead_id UUID REFERENCES leads(id) ON DELETE SET NULL`. Pass lead ID through delegation chain.

---

### 🟡 Gap C: Outreach task `id` not passed to `web_operator_actions.source_task_id`

**Problem**: `delegateLeadToGmailDraft` creates a task via `createLeadOutreachTask()` but does NOT pass the returned task ID to `delegateGmailDraft()` → `delegateToWebOperator()`. So `web_operator_actions.source_task_id` is NULL for outreach-driven actions.  
**Impact**: Low — task tracking is incomplete but not incorrect.  
**Fix needed**: Return task ID from `createLeadOutreachTask`, pass as `taskId` to `delegateGmailDraft`.

---

### 🟡 Gap D: Legacy `approvals` table still queried in production paths

**Problem**: The original `approvals` table (migration 001) and `app/api/outreach/` routes use SMTP via `lib/email/sender.ts` (nodemailer). These are queried by:
- `app/api/ceo/status/route.ts` — counts pending approvals from `approvals` table
- `app/api/stats/route.ts` — counts sent/pending from `approvals` table
- `app/api/projects/[id]/pm-chat/route.ts` — counts from `approvals` table

The new system uses the `approval_items` table (migration 012) which is separate.  
**Impact**: CEO status and stats show old lead-level approvals separately from new Web Operator approval items.  
**Fix needed**: Mark `app/api/outreach/` routes and `lib/email/sender.ts` as legacy. Update CEO status + stats to query `approval_items` instead of (or in addition to) `approvals`.

---

### 🟡 Gap E: CEO outreach intent uses first approved lead across all projects

**Problem**: In `app/api/ceo/command/route.ts`, the `isLeadOutreachIntent` handler calls `listLeads({ project_id: result.project_id, status: 'approved' })`. If `result.project_id` is null (CEO didn't specify a project), it returns all approved leads company-wide and picks the first one. This could draft an email to the wrong project's lead.  
**Impact**: Low in practice (usually one project), but surprising.  
**Fix**: Require `project_id` to be non-null before triggering; otherwise respond asking the user to specify a project.

---

### 🟡 Gap F: No UI status update after Gmail draft button is clicked

**Problem**: After clicking "✉ Gmail draft", the user sees a one-line toast (`draftResult[lead.id]`), but the lead card doesn't show "Operator is working" or poll for completion. If the operator hits a login wall, the user has no in-page indication.  
**Impact**: UX gap — user must navigate to `/operators/[id]` to check status.  
**Fix**: Poll `/api/web-operators` status or check `requires_user_input` flag on a 5s interval after clicking.

---

### 🟡 Gap G: `send` route sends "current Gmail draft" — no specific draft targeting

**Problem**: `sendLeadOutreachViaOperator` calls `delegateSendGmail` which instructs the operator to send "the current Gmail draft". If the Gmail inbox has multiple drafts, the operator may send the wrong one.  
**Impact**: Low if user has one draft at a time.  
**Fix (future)**: Store the Gmail draft URL or compose window reference after creation; pass it to the send action.

---

## 5. Recommended next 3 steps

### Step 1 — Add `source_lead_id` to `web_operator_actions` (Gap B)
**What**: Add migration `027_lead_action_link.sql`: `ALTER TABLE web_operator_actions ADD COLUMN IF NOT EXISTS source_lead_id UUID REFERENCES leads(id) ON DELETE SET NULL`. Update `delegateLeadToGmailDraft` to pass lead ID through delegation. Show the linked lead on the operator action row in `/operators/[id]`.  
**Why**: Closes the biggest traceability gap in the outreach loop. Enables "view draft action" from lead card.

### Step 2 — Deprecate legacy `approvals`/SMTP system
**What**: Mark `app/api/outreach/` routes with a `// LEGACY` comment. Update CEO status, PM chat, and stats routes to also count from `approval_items`. Add a UI note on any pages that surface legacy approval counts.  
**Why**: Two approval systems cause confusion. The new `approval_items` system is the correct one. The old system should be silent, not actively queried.

### Step 3 — Operator status polling after "Gmail draft" click
**What**: After clicking "✉ Gmail draft", start polling `/api/web-operators` for the named operator's `status` and `requires_user_input` fields. Show a live status chip on the lead card: "Operator working…" → "Draft created ✓" or "Login required — go to /operators/Kevin".  
**Why**: Closes the UX gap that makes the outreach workflow feel blind after triggering.

---

## 6. Final recommendation

**Fix Gap C first (task ID linkage) then build Step 1 (lead→action link).**

Gap C is a two-line fix (no migration, no UI). Step 1 gives the most architectural value: once every Gmail draft action is linked to a lead, the operator action UI, the lead card, and the CEO context all become coherent. It also directly enables Step 3 (you can poll for the specific action linked to the lead, not just any operator action).

The legacy SMTP cleanup (Step 2) is safe but lower urgency — those routes are not reachable from the new UI.
