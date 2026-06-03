# AÏKO App Map, Connection Audit, and Readiness Notes

**Date:** 2026-06-03
**Scope:** Static code audit plus local command checks. HTTP runtime could not be verified because `npm install` did not complete and `next` is unavailable in `node_modules/.bin`.

## Executive conclusion

AÏKO is architecturally wired around these active paths:

- AI brain/auth profiles: `provider_connections` as auth profiles → `ai_role_assignments` → `callAI(role:'ceo')`.
- First-run setup: `/setup` → provider creation/test → CEO role assignment → `/api/providers/test-ceo-brain` → setup complete.
- CEO Chat: `/ceo` → `/api/ceo/command` → `runCeoCommandAgent()` → `callAI({ role: 'ceo' })` → persistence/actions/chips.
- External website work: CEO/PM/delegation → Web Operator Skills → approval policy → browser action → `web_operator_actions` → execution trail.

The app is connected end-to-end in code, but it is **not runtime-verified in this container**. A real deployment still needs a working `DATABASE_URL`, completed npm install, migrations, a connected CEO brain profile, and a Playwright browser runtime for Web Operator execution.

---

## 1. Pages map

| Page | Purpose | Main components / modules | API routes used | Auth/setup state | Empty state | Known dependencies |
|---|---|---|---|---|---|---|
| `/` | Root entry; redirects users toward setup/CEO depending state. | `app/page.tsx`, `SetupGate` | `/api/setup/state` | Optional mode public; setup gate should redirect if no CEO brain. | Setup required path. | Next app router, setup-state. |
| `/setup` | OpenClaw-style first-run wizard: choose provider, test, assign CEO, complete setup. | `app/setup/page.tsx` | `/api/setup/state`, `/api/providers`, `/api/providers/[id]/test`, `/api/providers/roles`, `/api/providers/test-ceo-brain`, `/api/setup/complete`, `/api/auth-profiles/diagnostics` | Public in optional mode; may require login by hosted policy in required mode. | Shows provider cards and honest not-configured states. | Postgres, provider routes, real provider/Ollama for success. |
| `/connect-ai` | Advanced auth profile management. | `app/(dashboard)/connect-ai/page.tsx`, provider catalog | `/api/providers`, `/api/providers/roles`, `/api/auth-profiles/diagnostics`, `/api/providers/[id]/test`, `/api/providers/brain`, OAuth routes | Public in optional mode; advanced settings. | No profiles: add-profile cards and diagnostics. | Postgres, provider credentials, OAuth env if used. |
| `/ceo` | ChatGPT-style CEO Chat plus CEO review tab. | `app/(dashboard)/ceo/page.tsx` | `/api/ceo/command`, `/api/ceo/status`, `/api/ceo/memory`, `/api/ceo/reviews`, `/api/providers/diagnostics` | Should be setup-gated; no fake answer without brain. | Welcome message and provider/setup error if brain missing. | Connected CEO auth profile; Postgres. |
| `/dashboard` | Dashboard overview. | `app/(dashboard)/dashboard/page.tsx` | `/api/stats`, other summary APIs | Setup-gated dashboard. | Summary cards zero/empty. | Postgres. |
| `/start-campaign` | First campaign flow: project/operator/channel/research/leads/drafts/approval. | `app/(dashboard)/start-campaign/page.tsx` | `/api/start-campaign/summary`, campaigns/leads/operators/project APIs | Setup-gated dashboard. | Prompts to select/create project. | Postgres, Web Operator for browser steps, approvals. |
| `/projects` | Project list/workspaces entry. | `app/(dashboard)/projects/page.tsx` | `/api/projects`, `/api/projects/search` | Setup-gated dashboard. | No projects yet. | Postgres. |
| `/projects/[id]` | Project workspace tabs: overview, PM chat, reports, agents, activity, approvals, leads, operator, decisions, files. | `ProjectWorkspaceTabs`, PM chat/report components | `/api/projects/[id]/*`, `/api/leads`, `/api/approval-items`, `/api/web-operator/actions`, `/api/files` | Setup-gated dashboard. | Project not found / empty workspace. | Postgres; AI brain for PM/report generation. |
| `/operators` | Named Web Operator fleet management. | `app/(dashboard)/operators/page.tsx` | `/api/web-operators`, `/api/web-operator/actions` | Setup-gated dashboard. | No operators: create/default operator. | Postgres. |
| `/operators/[id]` | Single named operator status, memory, pending workflow, recent actions. | `app/(dashboard)/operators/[id]/page.tsx` | `/api/web-operators/[id]`, `/api/web-operator/actions`, resume endpoint | Setup-gated dashboard. | Operator not found. | Postgres, Playwright for action execution. |
| `/operator` | Web Operator control room / single-session view. | `app/(dashboard)/operator/page.tsx` | `/api/web-operator/status`, `/api/web-operator/action`, `/api/web-operator/session`, `/api/approval-items` | Setup-gated dashboard. | No active session/actions. | Postgres, Playwright. |
| `/operator-skills` | Lists governed website workflow skill profiles. | `app/(dashboard)/operator-skills/page.tsx` | `/api/web-operator/skills` | Setup-gated dashboard. | Loading/no skills fallback; helper has default catalog. | Postgres migration or in-code fallback. |
| `/approvals` | Approval center for generated outputs/operator actions. | `app/(dashboard)/approvals/page.tsx` | `/api/approval-items`, `/api/approval-items/[id]`, `/api/web-operator/actions/[id]/resume` | Setup-gated dashboard. | No pending approval items. | Postgres. |
| `/approval` | Compatibility redirect page. | `app/(dashboard)/approval/page.tsx` | None; redirects to `/approvals`. | Setup-gated dashboard. | n/a | Next navigation. |
| `/leads` | Lead list/review/enrichment/outreach actions. | `app/(dashboard)/leads/page.tsx` | `/api/leads`, `/api/leads/*`, `/api/leads/export`, `/api/approval-items` | Setup-gated dashboard. | No leads. | Postgres; AI brain for extraction/enrichment; Web Operator for browser contact/reply. |
| `/campaigns` | Campaign list. | `app/(dashboard)/campaigns/page.tsx` | `/api/campaigns` | Setup-gated dashboard. | No campaigns. | Postgres. |
| `/campaigns/[id]` | Campaign detail/items/launch checks/execution trail. | `app/(dashboard)/campaigns/[id]/page.tsx`, `CampaignExecutionTrail` | `/api/campaigns/[id]/*` | Setup-gated dashboard. | Campaign not found / no items. | Postgres, approvals. |
| `/files` | Generated files list/download/delete. | `app/(dashboard)/files/page.tsx` | `/api/files`, `/api/files/[id]`, `/api/files/[id]/download` | Setup-gated dashboard. | No generated files. | Postgres, writable generated-files storage. |
| `/agents` | Built-in/custom agents page. | `app/(dashboard)/agents/page.tsx` | `/api/agents`, `/api/custom-agents`, `/api/custom-agents/[id]` | Setup-gated dashboard. | Built-in agents always show; custom empty. | Postgres; AI brain for custom spec generation. |
| `/mode` | Operating mode and safety controls. | `app/(dashboard)/mode/page.tsx` | `/api/mode`, `/api/mode/log` | Setup-gated dashboard. | Defaults to read-only if no DB row. | Postgres. |
| `/system` | System capabilities and improvement proposals. | `app/(dashboard)/system/page.tsx` | `/api/system/capabilities`, `/api/system/improvements`, `/api/system/check-strategy` | Setup-gated dashboard. | No proposals / seeded capabilities. | Postgres; AI brain for generated prompts. |
| `/reports` | Company/reporting surface. | `app/(dashboard)/reports/page.tsx` | `/api/reports/generate`, project report APIs | Setup-gated dashboard. | No reports generated. | Postgres; AI brain. |
| `/login` | Optional/required identity login page. | `app/login/page.tsx`, NextAuth | `/api/auth/*`, `/api/auth/diagnostics` | Public. Optional mode does not require login. | Shows setup hints if auth env missing. | NextAuth env for required mode. |
| `/office`, `/team`, `/settings`, `/functions`, `/tools`, `/tool-runs` | Supporting dashboards/debug/admin pages. | Dashboard pages under `app/(dashboard)` | agent/tool/settings APIs | Setup-gated dashboard except optional mode public routing. | Empty/debug states. | Postgres; some are legacy/debug surfaces. |

---

## 2. API route map by group

All API routes are under `app/api`. Mutating routes must be treated as server-side only. Routes marked “external/browser” can initiate browser automation or external provider calls.

| Group | Routes / methods | Purpose | Main DB tables | Mutates data? | External/browser actions? | Safety notes |
|---|---|---|---|---:|---:|---|
| setup | `GET /api/setup`, `GET /api/setup/state`, `POST /api/setup/complete` | First-run setup state and completion. | `provider_connections`, `ai_role_assignments` | Complete mutates only if CEO brain works. | Provider test indirectly via caller. | Must not fake setup complete. |
| auth-profiles | `GET /api/auth-profiles/diagnostics`; OpenAI Codex alias routes start/callback/refresh/disconnect | Auth profile diagnostics and compatibility OAuth route aliases. | `provider_connections`, `ai_role_assignments` | OAuth callback/refresh/disconnect mutate via aliased routes. | OAuth provider calls. | Diagnostics sanitizes secrets; missing env names only. |
| providers | `GET/POST /api/providers`, `PATCH/DELETE /api/providers/[id]`, `POST /api/providers/[id]/test`, role/brain/diagnostics/test-ceo-brain, OAuth routes | Auth profile CRUD/test/assignment/diagnostics. | `provider_connections`, `ai_role_assignments` | Yes. | Provider test/OAuth. | Must never return encrypted keys/tokens. ChatGPT/Claude OAuth connected only with token/profile/test. |
| ceo | `POST /api/ceo/command`, `GET /api/ceo/status`, `GET /api/ceo/memory`, `GET/POST /api/ceo/reviews` | CEO chat/review/status/memory. | `ceo_commands`, `company_memory`, projects, reports, approvals | Command/reviews mutate. | AI provider via `callAI`; may delegate Web Operator. | No provider = 503; no fake CEO response. |
| projects/context | `GET/POST/PUT /api/projects`, `GET /api/projects/[id]`, `GET /api/projects/search`, `GET /api/projects/[id]/context` | Project CRUD/search/context. | `projects`, `project_memory`, `project_map`, PM tables | Yes for create/update. | No direct external. | Project context feeds AI prompts. |
| PM/project work | `GET/POST /api/projects/[id]/pm-chat`, `/pm-reports`, `/agent-discussion` | PM chat, PM reports, agent discussion. | project chats/reports/messages/tasks | Yes. | AI provider; may delegate Web Operator from PM chat. | External actions must route through Web Operator. |
| strategy/launch/decisions | `/strategy-brief`, `/launch-template`, `/decisions` | Strategy brief, launch checklist, decision log. | `project_strategy_briefs`, `project_launch_templates`, `project_decisions` | Yes. | AI provider for strategy generation. | No automatic external sends. |
| executive reports/files | `/projects/[id]/executive-reports`, export route, `/api/reports/generate`, `/api/files/*`, artifact bundle | Reports and generated files. | `project_executive_reports`, `generated_files` | Yes. | AI provider for report generation. | Downloads only generated files; no secrets. |
| leads/export | `/api/leads`, `/api/leads/[id]`, enrich/extract/export/scrape/find-contact/outreach/check-reply/send | Lead CRUD, AI extraction/enrichment, CSV export, outreach workflows. | `leads`, `web_operator_actions`, `approval_items`, `generated_files` | Yes. | AI provider; Web Operator for find/reply/draft/send. | Sending must require approval/resume; legacy send routes need continued monitoring. |
| approvals | `/api/approval-items`, `/api/approval-items/[id]`, `/api/approvals`, `/api/approvals/update` | Active and legacy approval records. | `approval_items`; legacy `approvals` | Yes. | No direct external action. | Approval alone must not execute; explicit resume required. Legacy approvals are cleanup later. |
| web operator | `/api/web-operator/action`, actions/list/resume, approve-action, delegate, session, status; `/api/web-operators/*` | Browser action execution, delegation, sessions, named operators. | `web_operators`, `web_operator_sessions`, `web_operator_actions`, `approval_items` | Yes. | Yes: Playwright browser runtime. | Operating mode + skill policy + approval gates. |
| web operator skills | `GET /api/web-operator/skills` | Lists skill catalog/rules. | `web_operator_skills` or code fallback | No. | No. | Browser workflows only; no native platform APIs. |
| custom agents/agents | `/api/agents/*`, `/api/custom-agents/*`, agent tasks/messages/outputs | Built-in/custom agents, tasks, messages, outputs. | `custom_agents`, `agents`, `agent_tasks`, `agent_messages`, `agent_task_outputs` | Yes. | AI provider for generated specs/outputs. | Custom agent constraints forbid secrets/approval bypass. |
| campaigns | `/api/campaigns/*` | Campaign generation, items, launch checks, execution trail. | `campaigns`, `campaign_items`, `approval_items`, operator actions | Yes. | AI provider for generation; Web Operator via downstream actions. | Approval before launch/send. |
| mode | `GET/PATCH /api/mode`, `GET /api/mode/log` | Operating mode and audit log. | `operating_mode`, `mode_action_log` | PATCH mutates. | No. | Controls approval/browser permissions. |
| system improvements | `/api/system/capabilities`, `/api/system/improvements`, `/api/system/check-strategy` | Capability registry and improvement proposals. | `system_capabilities`, `system_improvement_proposals` | Yes. | AI provider for implementation prompt. | Unknown website skill requests create proposals. |
| auth diagnostics | `/api/auth/*` | NextAuth, current user, auth diagnostics. | `users` and NextAuth session state | Login mutates session. | OAuth identity only. | Google login is identity, not AI provider auth. |
| tools/browser/debug | `/api/tools/web-search`, `/api/tools/read-website`, `/api/browser/run`, tool connections/runs | Legacy/debug tools and web helpers. | `tool_connections`, `tool_runs` | Yes for runs/connections. | Browser/search-like behavior. | Cleanup later if superseded by Web Operator. |
| jobs/settings/stats/chat | jobs, SMTP settings, stats, generic chat | Legacy/support utilities. | `jobs`, `settings`, stats tables | Yes where applicable. | SMTP/settings can be risky if enabled. | Legacy cleanup and safety review recommended. |

---

## 3. Database table map

| Table | Owner / active path | Status | Notes |
|---|---|---|---|
| `provider_connections` | Auth profiles/provider router/setup/connect-ai | Active | Conceptually auth profiles. Extended by migrations 025, 028, 038. |
| `ai_role_assignments` | Role → auth profile resolution | Active | CEO role assignment is required for deterministic brain. |
| `model_configs` | Legacy model config fallback | Legacy/deprecated | Router uses only final fallback when no profile exists; keep until migrated out. |
| `projects`, `project_memory`, `project_map`, `project_managers` | CEO/project workspace/PM assignment | Active | Core company/project memory. |
| `project_strategy_briefs`, `project_launch_templates`, `project_decisions` | First campaign/project planning | Active | Strategy, setup checklist, and decision log. |
| `project_executive_reports` | Reports/export | Active | Generates report records and files. |
| `generated_files` | `/files`, exports, bundles | Active | Requires writable storage path. |
| `custom_agents` | `/agents`, CEO custom-agent creation | Active | Draft/approve/edit custom agents. |
| `leads` | Lead capture/review/outreach | Active | Extended with source action/reply state. |
| `approval_items` | Approval center/current approvals | Active | Current approval system. |
| `approvals` | Initial migration legacy approvals | Legacy/deprecated | Still has old API/page compatibility; cleanup later. |
| `web_operators`, `web_operator_sessions`, `web_operator_actions` | Web Operator browser automation | Active | Action rows now include skill metadata. |
| `web_operator_skills` | Governed website workflows | Active | Default skills seeded by migration 039; helper has fallback catalog. |
| `campaigns`, `campaign_items`, `campaign_launch_checks` | Campaign flow | Active | Approval-linked campaign items. |
| `operating_mode`, `mode_action_log` | Safety mode controls | Active | Blocks or approval-gates sensitive operations. |
| `system_capabilities`, `system_improvement_proposals` | Capability gap/self-improvement | Active | Unknown website skill requests go here. |
| `agents`, `agent_logs`, `agent_messages`, `agent_tasks`, `agent_task_outputs` | Built-in/team/task surfaces | Mixed active/legacy | Messages/tasks/outputs active; `agent_logs` appears legacy. |
| `company_memory`, `ceo_commands`, `ceo_reviews` | CEO memory/history/reviews | Active | CEO command history and review snapshots. |
| `project_manager_reports`, `project_manager_chats` | PM reports/chat | Active | PM chat/report generation. |
| `jobs` | Legacy jobs system | Cleanup later | Still exposed by job routes. |
| `settings` | Settings/SMTP | Cleanup later / risky | SMTP routes exist; external sending should not bypass approval. |
| `tool_connections`, `tool_runs` | Legacy/debug tools | Cleanup later | Web Operator is the preferred external-action path. |
| `users` | Optional/required identity | Active | Google/NextAuth identity only, not provider auth. |

---

## 4. Core flow maps

### A. First-run setup

`/` → `SetupGate`/setup state → `/setup` → user selects provider/auth method → `POST /api/providers` → `POST /api/providers/[id]/test` → `POST /api/providers/roles` with `role='ceo'` → `POST /api/providers/test-ceo-brain` → `POST /api/setup/complete` → `/ceo` or `/start-campaign`.

Setup is complete only when a connected auth profile exists and CEO can resolve/test a working brain.

### B. Connect AI advanced

`/connect-ai` → loads saved auth profiles and diagnostics → add/test profile → assign CEO via `/api/providers/roles` → verify via `/api/providers/test-ceo-brain` → diagnostics show real resolved CEO profile.

### C. CEO Chat

`/ceo` → user message remains in local chat list → `POST /api/ceo/command` → route checks `getProviderForRole('ceo')`/fallback provider → `runCeoCommandAgent()` → `callAI({ role: 'ceo' })` → parse JSON response/actions → execute allowed internal actions → return natural response plus chips/delegation metadata.

If no provider resolves, `/api/ceo/command` returns `503` with a clear no-brain error; it does not generate a fake CEO reply.

### D. Create project

CEO create-project instruction → `runCeoCommandAgent` returns `create_project`, `assign_pm`, memory, and map actions → DB inserts project/PM/memory/map → strategy brief generated → operator recommendation → launch template created → decision log updated → response includes `start_campaign_url` and project chips.

### E. First campaign

`/start-campaign` → select project/operator/channel → strategy/research → lead extraction/review → Gmail/browser draft → `approval_items` → user approves/rejects → explicit resume executes approved browser action → reply check → execution trail.

### F. Web Operator

CEO/PM/delegation → `delegateToWebOperator` → recommended Web Operator Skill → unknown website proposal if no skill → operating mode check → skill validation → approval if required → Playwright browser execution → `web_operator_actions` log → execution trail.

### G. Approval/resume

Approval item created → user approves/rejects → no external execution occurs on approval → user explicitly resumes action → resume route re-checks approval and operating mode → browser action executes if allowed.

### H. Files/artifacts

Executive reports, CSV lead exports, and project artifact bundles → `generated_files` → `/files` list → download route streams/returns file. Storage path must be writable.

### I. Custom agent

CEO custom-agent request → custom agent generator uses `callAI` → `custom_agents` draft → `/agents` displays/edit/delete/activate.

### J. Project recall/reporting

CEO recall/report intent → project lookup/context → report or recall helper uses `callAI` where appropriate → response includes project/report/start-campaign chips.

---

## 5. CEO Chat verification checklist

Static audit result: CEO Chat is designed to feel like ChatGPT-style chat when a real CEO brain profile is connected.

Confirmed in code:

- User writes natural instruction in `/ceo` chat UI.
- User messages remain visible in local state/history.
- Assistant messages are rendered from `/api/ceo/command` responses.
- Loading/error states exist.
- `/api/ceo/command` checks for a provider before `runCeoCommandAgent` and returns no-brain `503` if none resolves.
- `runCeoCommandAgent` imports and uses `callAI`.
- CEO can create projects, recall projects, generate reports, create custom agents through active helper flows, and delegate Web Operator actions when allowed.
- Response chips exist for project, first campaign, reports, leads/agents depending response type.
- CEO brain/provider diagnostics are fetched in the page and should show real provider/model/auth state.
- Optional local mode is reported through diagnostics/auth mode.

Manual checklist to run after runtime is available:

1. `Hello, what are you?`
2. `Create a marketing project for ALB Parking.`
3. `What are we doing for ALB Parking?`
4. `Generate an executive report for ALB Parking.`
5. `Create an agent for influencer outreach.`
6. `Kevin, research Facebook groups about parking in A Coruña.`

Expected behavior: natural CEO response, no raw JSON, no fake provider answer, safe Web Operator delegation chip where relevant, approval item for any send/post/message/publish action.

---

## 6. Current provider reality

This container has no `DATABASE_URL` and no running Next server, so provider profile rows could not be queried live. Environment-level reality from `npm run setup:check`:

| Provider path | Current reality in this container | Truth requirement |
|---|---|---|
| ChatGPT/Codex OAuth | Not configured; missing `OPENAI_OAUTH_CLIENT_ID`, `OPENAI_OAUTH_AUTH_URL`, `OPENAI_OAUTH_TOKEN_URL`, `OPENAI_OAUTH_REDIRECT_URI`. | Must show: “ChatGPT/Codex OAuth not configured. Use OpenAI API key or Ollama.” Connected only with env + token/profile + successful test. |
| OpenAI API key | No `OPENAI_API_KEY` env in this shell and no DB profile verified. | Separate API-key auth profile; reliable fallback if user adds key/profile. |
| Claude OAuth | Not configured; missing `CLAUDE_OAUTH_CLIENT_ID`, `CLAUDE_OAUTH_AUTH_URL`, `CLAUDE_OAUTH_TOKEN_URL`. | Must not show connected unless real OAuth exchange/profile/test exists. |
| Claude Code local | Not detected; `claude` CLI/token not detected by setup check. | Show detected only when CLI/local auth/token is actually available and testable. |
| Anthropic API key | No `ANTHROPIC_API_KEY` env in this shell and no DB profile verified. | Separate API-key fallback. |
| Ollama | Not reachable in setup check. | Local fallback if Ollama service is running and profile test passes. |
| CEO brain resolved provider | Not runtime-verified because no DB/server. | Must resolve via assigned connected auth profile or fail clearly. |

---

## 7. Broken/duplicate systems audit

### Critical issues

1. **Runtime not verified in this container.** `npm install` did not complete, `node_modules/.bin/next` is missing, `npm run build` fails with `next: not found`, and no HTTP pages could be opened.
2. **No `DATABASE_URL` in this shell.** Setup check cannot verify migrations, provider rows, CEO brain, projects, or Web Operator actions against a live DB.
3. **No real provider connected in this environment.** ChatGPT/Codex, Claude, OpenAI API, Anthropic API, Ollama, and CEO brain are not live-verified.

### Medium issues

1. **Legacy approval table and routes remain.** `approval_items` is active; legacy `approvals` table/API still exists for compatibility and should be cleaned up later.
2. **Legacy `model_configs` remains.** Router should only use it as final fallback; it is still exposed by `/api/model-configs` and should be clearly deprecated.
3. **Legacy/direct tool surfaces remain.** `/api/tools/*`, `/api/browser/run`, `tool_connections`, and `tool_runs` overlap conceptually with Web Operator and should be reviewed so active user flows do not bypass skill/approval policy.
4. **Legacy outreach send routes remain.** `/api/outreach/send`, `/api/outreach/approve-and-send`, and `/api/leads/[id]/send` need continued safety review to ensure no direct SMTP/API send bypasses Web Operator approval policy.
5. **`callLLM` still exists in older agent modules.** Active CEO/PM/report paths use `callAI`, but old modules should remain documented as legacy/dead until removed or migrated.

### Cleanup later

- Hidden/debug pages `/tools`, `/tool-runs`, `/functions`, old jobs routes, SMTP settings, and old browser tool routes should be marked debug/legacy in navigation or removed when no longer needed.
- Migration numbering has both `025_execution_trail.sql` and `025_provider_catalog.sql`; this works as filenames but is confusing for operators.
- Normalize route naming (`/operator` vs `/operators`, `/approval` redirect vs `/approvals`) once stability is confirmed.

---

## 8. Runtime/deployment check result

Commands attempted on 2026-06-03:

| Command | Result |
|---|---|
| `rm -rf .next` | ✅ Completed. |
| `npm install` | ⚠️ Started but did not complete; it emitted npm proxy warnings and a `MaxListenersExceededWarning`, left partial `node_modules`, and had to be terminated after no progress. |
| `npm test` | ✅ 135/135 tests passed. |
| `npm run build` | ❌ Failed: `sh: 1: next: not found`. |
| `npm run setup:check` | ✅ Completed; reported missing `DATABASE_URL`, no provider env keys, no Ollama, no Claude CLI. |
| `git diff --check` | ✅ Passed. |
| `AIKO_AUTH_MODE=optional PORT=3001 npm run dev` | Not run after build failure; would fail for the same missing `next` binary. |

No browser/manual route verification was performed. Do not treat `/setup`, `/connect-ai`, `/ceo`, `/start-campaign`, `/operator-skills`, `/files`, `/agents`, or `/projects` as runtime-verified until dependencies install and the server starts.
