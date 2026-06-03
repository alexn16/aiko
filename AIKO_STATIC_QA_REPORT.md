# AÏKO Exhaustive Static QA Report Before Local Runtime

**Date:** 2026-06-03
**Scope:** Static QA audit of pages, API routes, migrations/schema usage, core flows, safety-sensitive paths, active vs legacy systems, and local command checks before running a local HTTP server.

## Executive answer

1. **Is the app logically connected end-to-end in code?** Yes. The static path is connected from first-run setup → auth profile creation/test → CEO role assignment → `callAI(role:'ceo')` → CEO Chat/project/report/operator flows. It is not HTTP-runtime verified in this container.
2. **Can CEO Chat work like ChatGPT once a brain is connected?** Yes in code. `/ceo` keeps chat state and `/api/ceo/command` refuses to fake a response if no provider resolves; `runCeoCommandAgent` uses `callAI` for the CEO brain.
3. **Fully wired flows:** first-run setup, Connect AI auth profiles, CEO command/action execution, project creation, strategy brief/launch template/decision log, Web Operator skill policy and approval gating, approval/resume, generated files, custom agent drafts, project recall/reporting.
4. **Partially wired/runtime-dependent flows:** actual provider calls, OAuth exchanges, Playwright browser actions, Ollama/Claude CLI detection, generated file/screenshot storage, and all HTTP UI behavior until `npm install`/build/dev server are available.
5. **Depends on runtime/provider setup:** CEO Chat, PM/report generation, strategy briefs, custom agent generation, lead extraction/enrichment, Web Operator execution, OAuth profile connection, files/download verification.
6. **Legacy systems remain:** legacy `approvals`, legacy `model_configs`, hidden/debug tool routes, older direct web/tool routes, jobs/settings/SMTP surfaces, compatibility OAuth aliases, `/approval` redirect.
7. **Issue fixed in this QA pass:** `/api/providers/brain` smart-default role assignment used `ON CONFLICT ON CONSTRAINT` against partial unique indexes. That can fail in Postgres because the migration creates indexes, not constraints. It now uses the same DELETE+INSERT strategy as `/api/providers/roles`.
8. **Remaining before local run:** complete `npm install`, set `DATABASE_URL`, run migrations, connect a real provider, run build, start dev server, manually test pages/flows.

---

## Static commands and audit methods used

- Listed every `page.tsx` and `route.ts` under `app/`.
- Parsed UI `fetch('/api/...')` and dynamic ``fetch(`/api/...`)`` references and confirmed literal route endpoints exist.
- Checked aliased imports (`@/...`) in `app`, `components`, `lib`, and `scripts`; no missing local import target was found.
- Searched migrations for table/column creation and searched code for `ON CONFLICT`, provider secrets, tokens, file writes, browser/send/post/message patterns, and legacy route usage.
- Ran `npm test`, `npm run build`, `npx tsc --noEmit`, `npm run setup:check`, and `git diff --check`.

---

## 1. Full route/page audit

| Page | Status | APIs used | Potential issue | Fix applied / no action |
|---|---|---|---|---|
| `/` | Safe statically | `/api/setup/state` via setup gate/root logic | Runtime redirect not verified without server. | No action. |
| `/setup` | Safe statically | `/api/setup/state`, `/api/providers`, `/api/providers/[id]/test`, `/api/providers/roles`, `/api/providers/test-ceo-brain`, `/api/setup/complete`, `/api/auth-profiles/diagnostics` | Depends on DB/provider runtime. | No action. |
| `/connect-ai` | Safe statically | `/api/providers`, `/api/providers/roles`, `/api/auth-profiles/diagnostics`, `/api/providers/[id]/test`, `/api/providers/brain`, OAuth routes | Requires honest diagnostics and provider rows. | No action; routes exist. |
| `/ceo` | Safe statically | `/api/ceo/command`, `/api/ceo/status`, `/api/ceo/memory`, `/api/ceo/reviews`, `/api/providers/diagnostics` | Real chat depends on connected brain. | No action. |
| `/dashboard` | Safe statically | `/api/stats` | Runtime data not verified. | No action. |
| `/start-campaign` | Safe statically | `/api/start-campaign/summary`, `/api/leads/[id]/outreach-draft`, `/api/web-operator/actions/[id]/resume`, `/api/leads/[id]/check-reply` | Browser/reply flows depend on Web Operator runtime. | No action. |
| `/projects` | Safe statically | `/api/projects`, `/api/projects/search` | Runtime DB not verified. | No action. |
| `/projects/[id]` | Safe statically | `/api/projects/[id]/*`, `/api/files`, `/api/leads`, `/api/approval-items`, `/api/web-operator/actions` | Many project tabs depend on DB/provider/browser runtime. | No action. |
| `/operators` | Safe statically | `/api/web-operators`, `/api/web-operator/actions` | Browser runtime not verified. | No action. |
| `/operators/[id]` | Safe statically | `/api/web-operators/[id]`, `/api/web-operator/actions`, `/api/web-operator/actions/[id]/resume` | Resume requires approval/runtime. | No action. |
| `/operator` | Safe statically | `/api/web-operator/status`, `/api/web-operator/action`, `/api/web-operator/session`, `/api/approval-items` | Playwright unavailable until install/runtime. | No action. |
| `/operator-skills` | Safe statically | `/api/web-operator/skills` | Skill DB table migration must run; helper has fallback catalog. | No action. |
| `/approvals` | Safe statically | `/api/approval-items`, `/api/approval-items/[id]`, `/api/campaigns`, `/api/web-operator/actions`, resume endpoint | Must keep approval as internal permission only. | No action. |
| `/approval` | Legacy compatibility | Redirects to `/approvals` | Deprecated route remains linked only as compatibility. | Cleanup later. |
| `/leads` | Safe statically | `/api/leads`, `/api/agents`, `/api/leads/[id]`, outreach/find-contact routes | Lead outreach/browser steps runtime-dependent. | No action. |
| `/campaigns` | Safe statically | `/api/campaigns` | Runtime DB not verified. | No action. |
| `/campaigns/[id]` | Safe statically | `/api/campaigns/[id]`, items, launch checks, execution trail | Launch/approval runtime-dependent. | No action. |
| `/files` | Safe statically | `/api/files`, `/api/files/[id]`, download route | Storage path/download runtime not verified. | No action. |
| `/agents` | Safe statically | `/api/agents`, `/api/custom-agents`, `/api/custom-agents/[id]` | Custom agent generation depends on AI brain. | No action. |
| `/mode` | Safe statically | `/api/mode`, `/api/mode/log` | DB mode row runtime not verified. | No action. |
| `/system` | Safe statically | `/api/system/capabilities`, `/api/system/improvements`, `/api/system/check-strategy` | AI prompt generation runtime-dependent. | No action. |
| `/reports` | Safe statically | `/api/reports/generate`, project report APIs | AI/report/file runtime-dependent. | No action. |
| `/login` | Safe statically | NextAuth routes, `/api/auth/diagnostics` | Optional mode should not require login. | No action; middleware allows optional mode. |
| `/office`, `/team`, `/settings`, `/functions`, `/tools`, `/tool-runs` | Mixed active/debug | agent/tool/settings APIs | Some are debug/legacy surfaces. | Documented cleanup later. |

### Page-level static findings

- `useSearchParams`/`useRouter` usage observed in client components where relevant.
- Active UI API endpoints found by static grep exist as route files.
- Setup and Connect AI are public in middleware, and optional auth mode allows dashboard routes while SetupGate handles no-brain redirection.
- Build-time Suspense requirements could not be verified because Next build cannot run in this container.

---

## 2. API Safety Findings

| API group | Status | Findings |
|---|---|---|
| setup | Safe statically | Setup completion checks CEO brain; no fake completion found. |
| auth / diagnostics | Safe statically | Auth diagnostics expose status/config info, not provider secrets. |
| auth-profiles | Safe statically | Diagnostics sanitize profile rows and report missing env var names/booleans only. |
| providers | Needs fix found/fixed | Provider CRUD/test/diagnostics exist. Fixed `/api/providers/brain` `ON CONFLICT ON CONSTRAINT` issue for smart defaults. Secrets are intended to be redacted. |
| provider OAuth | Legacy compatibility + active OAuth | ChatGPT/Claude OAuth routes are honest when env missing. Connected state depends on profile/token/test; no fake connected state documented. |
| ceo | Safe statically | `/api/ceo/command` checks provider before `runCeoCommandAgent`; returns no-brain 503 if none resolves. |
| projects / context / strategy / launch / decisions | Safe statically | Mutations are intentional; AI-dependent generation is internal only. |
| executive reports / reports | Safe statically | Saves report records/files; no external send. Runtime file storage must be verified. |
| files | Safe statically | Download/delete/list routes exist. Path traversal needs runtime/filesystem verification; static docs flag storage checks. |
| leads / lead export | Safe with legacy review note | CSV tests cover no `source_text`/secrets. Outreach/browser paths route through Web Operator helpers; legacy send routes remain cleanup/safety review items. |
| approvals / approval-items | Safe active path; legacy present | `approval_items` is active. Legacy `approvals` remains compatibility/cleanup later. Approval/resume tests cover no automatic execution. |
| web operator | Safe statically | Operating mode, skill decision, approval, and resume gates exist. Browser execution depends on Playwright runtime. |
| web operator skills | Safe statically | Read-only list route; default catalog fallback. |
| custom agents | Safe statically | Creates drafts/specs; constraints prevent secrets/approval bypass. Does not auto-run by default. |
| campaigns | Safe statically | Campaign generation/items/launch checks route through approval surfaces; runtime check needed. |
| mode | Safe statically | Mode controls mutation intentionally; impacts sensitive actions. |
| system improvements | Safe statically | Capability/proposal routes mutate internal records only. |
| legacy/debug routes | Legacy / cleanup later | `/api/tools/*`, `/api/browser/run`, `tool-connections`, `jobs`, SMTP settings, `model-configs` remain exposed and should be governed/hidden in production. |

---

## 3. Schema Compatibility Findings

| Area | Status | Findings / action |
|---|---|---|
| Users and optional/global mode | Safe statically | `users` exists; provider and role tables support nullable `user_id`. |
| Auth profiles | Safe statically | `provider_connections` exists and migration 038 adds auth-profile fields, encrypted token fields, local references, capabilities, status normalization. |
| Role assignment | Fixed bug | Migration creates partial unique indexes `ai_role_asgn_global_uniq` and `ai_role_asgn_user_uniq`; `/api/providers/brain` incorrectly used `ON CONFLICT ON CONSTRAINT` against index names. Fixed to DELETE+INSERT. |
| Project tables | Safe statically | `projects`, memory/map/PM, strategy brief, launch template, decisions, reports all exist in migrations. |
| Generated files | Safe statically | `generated_files` exists and is extended with source entity metadata. Writable path must be runtime-checked. |
| Custom agents | Safe statically | `custom_agents` exists. |
| Leads | Safe statically | Base and extension migrations provide source action/reply status columns. |
| Approval tables | Active + legacy | `approval_items` is active; `approvals` legacy table remains. |
| Web Operator | Safe statically | Sessions/actions/operators/memory/takeover/reliability/action lead IDs exist. |
| Web Operator Skills | Safe statically | `web_operator_skills` table exists; action skill metadata columns are nullable. |
| Campaigns | Safe statically | `campaigns`, `campaign_items`, launch checks exist. |
| Operating mode | Safe statically | `operating_mode` and `mode_action_log` exist. |
| System capabilities | Safe statically | `system_capabilities` and `system_improvement_proposals` exist. |
| Task/output tables | Safe statically | `agent_messages`, `agent_tasks`, `agent_task_outputs` exist. |
| Legacy tools/jobs/settings | Legacy | Tables exist but are not preferred external-action path. |

---

## 4. Core flow audit diagrams

### Flow A — First-run setup

```text
/ → SetupGate → GET /api/setup/state → /setup
  → POST /api/providers
  → POST /api/providers/[id]/test
  → POST /api/providers/roles (ceo)
  → POST /api/providers/test-ceo-brain
  → POST /api/setup/complete
  → /ceo
```

Findings: no-brain state routes to setup; optional mode does not require Google login; completion verifies CEO can think; no fake completion found.

### Flow B — Connect AI

```text
/connect-ai
  → GET /api/providers + /api/providers/roles + /api/auth-profiles/diagnostics
  → profile create/test
  → assign CEO
  → brain verification
```

Findings: ChatGPT/Codex and Claude diagnostics report not-configured/missing env honestly; OpenAI API, Anthropic API, and Ollama remain separate fallback profiles.

### Flow C — CEO Chat

```text
/ceo → POST /api/ceo/command
  → getProviderForRole('ceo') or connected fallback
  → runCeoCommandAgent
  → callAI({ role: 'ceo' })
  → execute internal actions
  → return natural response + chips + delegation metadata
```

Findings: no fake response without provider; recall/report fast paths are scoped to those intents; project creation can create project/PM/memory/map/strategy/launch/decision artifacts; custom agent requests create drafts; web instructions route to Web Operator Skills.

### Flow D — Web Operator

```text
CEO/PM/delegate → resolve skill → validate skill action
  → operating mode check
  → approval if mode/skill requires it
  → Playwright executor
  → web_operator_actions
  → execution trail
```

Findings: forbidden skill actions are blocked before browser execution; approval-required actions become approval items; resume requires approval; Gmail/Facebook/Canva/LinkedIn are browser workflows, not native APIs.

### Flow E — Approvals

```text
approval_items → /approvals → approve/reject
  → no external execution
  → explicit resume
  → action log/update
```

Findings: active Web Operator uses `approval_items`; `/approval` is a redirect/compat route; approving alone does not send.

### Flow F — Leads

```text
research/Web Operator → lead extraction → lead review
  → outreach draft → approval → resume
  → reply check via browser → execution trail → CSV export
```

Findings: tests cover no `source_text`/secrets in CSV and rejected filtering. Reply/contact/outreach browser flows depend on Web Operator runtime.

### Flow G — Files/artifacts

```text
executive report / lead CSV / artifact bundle
  → generated_files
  → /files + project Files tab
  → download route
```

Findings: file surfaces are wired; runtime must verify writable storage and no absolute path exposure.

### Flow H — Custom agents

```text
CEO request → custom agent generator → custom_agents draft → /agents
```

Findings: constraints are present; custom agents do not auto-run; constraints prevent bypassing approvals/Web Operator.

### Flow I — Project recall/report

```text
recall intent → project lookup/context → callAI/read-only response → chips
report intent → project context → saved report → report/project chips
```

Findings: recall should not mutate; executive report intentionally saves a report record.

---

## 5. Safety Findings

| Check | Status | Finding |
|---|---|---|
| Tokens/API keys/secrets returned to frontend | Safe statically | Diagnostics/provider serializers intentionally omit token/key fields. Runtime endpoint tests still needed. |
| ChatGPT/Claude fake connected states | Safe statically | Diagnostics require env configuration and profile/token/test reality; current environment is explicitly not connected. |
| Email/post/message/publish actions | Safe statically for Web Operator | Web Operator Skills and operating mode require approval for sensitive actions. Legacy send routes remain review items. |
| Approval bypass | Safe active path | Approval alone does not execute; explicit resume route exists and tests cover this. |
| Web Operator forbidden actions | Safe statically | Skill validation blocks forbidden actions before browser runtime. |
| Login/CAPTCHA bypass | Safe statically | Skill rules forbid bypass and Claude/Web Operator docs state manual login/takeover. |
| Mass messaging | Safe statically | Facebook/Instagram/LinkedIn skills forbid mass automation/messaging. |
| Screenshots on sensitive pages | Needs runtime verification | Screenshot helper and page-state sensitivity are intended, but Playwright runtime not verified. |
| Claude CLI child process | Safe statically | Uses `execFile`, not shell, and is intended as timeout-limited detection/call path. Runtime not verified. |
| File writes/downloads | Needs runtime verification | Generated file and screenshot writes use configured paths; deployment checklist requires writable/safe storage verification. |
| `source_text` exports | Safe by tests | Existing tests cover CSV omission of `source_text`/secrets. |

---

## 6. Type/import/static check results

| Check | Result |
|---|---|
| Local `@/...` import target scan | ✅ No missing local alias import targets found. |
| Literal UI `/api/...` endpoint scan | ✅ Literal fetched endpoints exist as route files. |
| `npm test` | ✅ 136/136 passing. |
| `npm run build` | ⚠️ Blocked: `sh: 1: next: not found` because dependencies are incomplete. |
| `npx tsc --noEmit` | ⚠️ Blocked/noisy because dependencies/types are incomplete; errors include missing `react`, `next`, `@types/node`, `playwright`, etc. Do not treat as a valid type result until `npm install` completes. |
| `git diff --check` | ✅ Passed after docs/fix. |

---

## 7. Issues fixed in this pass

| Issue | Risk | Fix |
|---|---|---|
| `/api/providers/brain` used `ON CONFLICT ON CONSTRAINT ai_role_asgn_*` even though migration 027 creates partial unique indexes, not constraints. | Smart-default role assignment could fail in Postgres. | Replaced with DELETE+INSERT per role/user, matching `/api/providers/roles`. |

---

## 8. Issues remaining before local run

1. Complete dependency installation so `node_modules/.bin/next` exists.
2. Set `DATABASE_URL` and run all migrations through `039_web_operator_skills.sql`.
3. Configure a real provider/auth profile and assign it to CEO.
4. Run `npm run build` successfully after install.
5. Install Playwright browsers before Web Operator runtime tests.
6. Start `AIKO_AUTH_MODE=optional PORT=3001 npm run dev`.
7. Manually verify `/setup`, `/connect-ai`, `/ceo`, `/start-campaign`, `/operator-skills`, `/files`, `/agents`, `/projects`, `/approvals`, and `/leads`.
8. Test provider truth states: ChatGPT/Codex OAuth not configured if env missing; Claude not configured/not detected if env/CLI missing; no fake connected states.
9. Test approval safety: approving does not send; explicit resume executes only approved, allowed browser action.

## 9. Exact local run checklist next

```bash
rm -rf node_modules .next
npm install
npm test
npx tsc --noEmit
npm run build
npm run setup:check
AIKO_AUTH_MODE=optional PORT=3001 npm run dev
```

Then in the browser/API:

1. Open `/setup` and connect/test a provider.
2. Assign provider to CEO and run Brain Verification.
3. Open `/ceo` and ask `Hello, what are you?`.
4. Create and recall a project.
5. Generate an executive report.
6. Create a custom agent draft.
7. Ask `Kevin, research Facebook groups about parking in A Coruña.` and verify Web Operator Skill/approval behavior.
8. Verify `/operator-skills`, `/approvals`, `/files`, `/agents`, `/projects`, `/start-campaign`, and `/leads`.
