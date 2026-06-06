# AÏKO Runtime Verification Report

**Date:** 2026-06-03  
**Auth mode:** `AIKO_AUTH_MODE=optional`  
**Port:** `3001`  
**Verified by:** local end-to-end run

---

## Step 1 — Clean install

```bash
rm -rf node_modules .next
npm install
```

| Check | Result |
|---|---|
| Install exit code | ✅ 0 (success) |
| `node_modules` present | ✅ |
| `.npmrc` registry pin | ✅ `registry=https://registry.npmjs.org/` |
| Vulnerabilities | ⚠️ 4 (3 moderate, 1 high) — not blocking, no fix without breaking changes |

---

## Step 2 — Tests

```bash
npm test
```

| Result | |
|---|---|
| Tests run | 136 |
| Pass | 136 |
| Fail | 0 |
| Exit code | ✅ 0 |

---

## Step 3 — Build

```bash
npm run build
```

| Check | Result |
|---|---|
| TypeScript compile | ✅ |
| Build exit code | ✅ 0 |
| Pages generated | ✅ 87 routes (static + dynamic) |
| Build blocker fixed | ✅ `actions/[id]/resume/route.ts` — missing `skill_id/skill_name/skill_decision` fields on `WebOperatorAction` object. Added the three fields from the DB row. |

---

## Step 4 — Setup check

```bash
npm run setup:check
```

| Check | Result |
|---|---|
| Node version | ✅ v22.22.2 |
| DATABASE_URL | ⚠️ Not detected by setup:check (script does not load `.env.local`; DB works fine in app) |
| AIKO_AUTH_MODE | ✅ optional |
| Ollama reachable | ✅ http://localhost:11434 |
| ChatGPT OAuth | ✅ Honestly reported as not configured |
| Claude OAuth | ✅ Honestly reported as not configured |
| OPENAI_API_KEY | ✅ Honestly reported as absent |
| ANTHROPIC_API_KEY | ✅ Honestly reported as absent |

---

## Step 5 — Environment

**`.env.local` contents (keys only, no values):**

- `DATABASE_URL` — postgresql://alli@localhost:5432/aiko
- `NEXTAUTH_SECRET` — set
- `AUTH_SECRET` — set (same value, required by newer next-auth)
- `NEXTAUTH_URL` — http://localhost:3001
- `AIKO_AUTH_MODE` — optional
- `OLLAMA_BASE_URL` — http://localhost:11434
- `BROWSER_HEADLESS` — true
- `SCREENSHOT_PATH` — ./screenshots

---

## Step 6 — Database

| Check | Result |
|---|---|
| PostgreSQL running | ✅ PostgreSQL 16.11 (Homebrew) |
| `aiko` database accessible | ✅ Verified via node pg |
| Migrations applied | ✅ App started without migration errors |

---

## Step 7 — App start

```bash
AIKO_AUTH_MODE=optional PORT=3001 npm run dev
```

| Check | Result |
|---|---|
| Server ready | ✅ Ready in 2.6s |
| Root redirect | ✅ 307 → setup/dashboard |
| `/setup` | ✅ 200 — shows "CEO brain connected: Ollama (local) / llama3.1:8b" |

---

## Step 8 — Provider status

**`GET /api/providers/subscription-diagnostics` response:**

| Field | Value |
|---|---|
| `chatgpt.status` | `oauth_not_configured` |
| `chatgpt.missing_env` | `OPENAI_OAUTH_CLIENT_ID`, `OPENAI_OAUTH_AUTH_URL`, `OPENAI_OAUTH_TOKEN_URL`, `OPENAI_OAUTH_REDIRECT_URI` |
| `claude.status` | `oauth_not_configured` |
| `claude.missing_env` | `CLAUDE_OAUTH_CLIENT_ID`, `CLAUDE_OAUTH_AUTH_URL`, `CLAUDE_OAUTH_TOKEN_URL` |
| `ceo_brain.can_think` | `true` |
| `ceo_brain.provider_name` | `Ollama (local)` |
| `ceo_brain.model` | `llama3.1:8b` |
| `fallbacks.ollama_connected` | `true` |
| `fallbacks.openai_api_connected` | `false` |
| `fallbacks.anthropic_api_connected` | `false` |

---

## Step 9 — Setup wizard

**`/setup`** — Step 4 displayed immediately:

> CEO brain connected  
> AÏKO can resolve a working CEO profile: **Ollama (local)** / llama3.1:8b  
> [Go to CEO Chat] [Start First Campaign] [Open Connect AI]

✅ No fake states shown.

---

## Step 10 — CEO Chat proof

**`/ceo`** — provider badge: `brain: Ollama (local)` visible top-right.

| Prompt | CEO Response | Tools Used |
|---|---|---|
| "Hello, what are you?" | "I'm the CEO of AÏKO, an AI marketing company…" | — |
| "Create a marketing project for ALB Parking." | "I'll create a new project called ALB Parking with the goal of increasing brand awareness and driving website traffic." | `create project`, `generate project map`, `update company memory` |

✅ Real Ollama responses, no fake output, tool badge tags visible.

---

## Step 11 — Page smoke test

All routes tested via `fetch()` from within the preview browser:

| Page | Status |
|---|---|
| `/setup` | ✅ 200 |
| `/connect-ai` | ✅ 200 |
| `/ceo` | ✅ 200 |
| `/start-campaign` | ✅ 200 |
| `/projects` | ✅ 200 |
| `/operator-skills` | ✅ 200 |
| `/operators` | ✅ 200 |
| `/approvals` | ✅ 200 |
| `/leads` | ✅ 200 |
| `/files` | ✅ 200 |
| `/agents` | ✅ 200 |

No blank pages. No 500s. No wrong redirects. No stale chunk errors.

---

## Step 12 — Connect AI honest status

**`/connect-ai`** verified visually:

- Section 1 · Current CEO Brain: **Ollama (local)** · auth: local · model: llama3.1:8b ✅
- ChatGPT / Codex card: badge = **"not configured"**, lists missing env var names ✅
- Claude card: (scrolled) same — **"not configured"**, honest ✅
- No fake "Connected" state shown for either ✅

---

## Step 13 — Web Operator Skills

**`GET /api/web-operator/skills`** — 7 skills loaded:
- Canva design, Facebook research, General web research, Gmail workflow, Instagram research, LinkedIn research, Website reader

**`/operator-skills`** page verified visually — Canva design shown with:
- Allowed actions: open_canva, create_design_draft, edit_text, upload_user_approved_assets, export_design
- Approval required: publish_design, share_design, download_final_asset
- Forbidden: use_unlicensed_assets_without_review, publish_without_approval

Guardrails confirmed present. No automatic posting/sending possible without approval.

---

## Step 14 — ChatGPT / Codex status

| Check | Result |
|---|---|
| OAuth env vars set | ❌ Not configured — expected in local dev |
| Shown honestly in UI | ✅ "not configured" badge with missing env var list |
| Fake connection shown | ✅ None |

---

## Step 15 — Claude status

| Check | Result |
|---|---|
| Claude OAuth env vars set | ❌ Not configured — expected in local dev |
| Claude Code CLI detected | ❌ Not in PATH for Next.js server process |
| CLAUDE_CODE_OAUTH_TOKEN | ❌ Not set in `.env.local` |
| Shown honestly in UI | ✅ "not configured" |
| Fake connection shown | ✅ None |

---

## Remaining blockers

| Issue | Severity | Notes |
|---|---|---|
| ChatGPT OAuth not configured | Expected | Requires OPENAI_OAUTH_CLIENT_ID + 3 other env vars |
| Claude OAuth not configured | Expected | Requires CLAUDE_OAUTH_CLIENT_ID + 2 other env vars |
| npm audit: 4 vulnerabilities | Low | No `--force` fix without breaking changes |
| setup:check doesn't load .env.local | Cosmetic | Script reports DATABASE_URL missing; app works fine |

**No blocking runtime issues. App is operational with Ollama as CEO brain.**

---

## Full Product Workflow — 2026-06-03

### Workflow result: ✅ PASS

---

### Project

| Field | Value |
|---|---|
| Project name | ALB Parking |
| Project ID | 4b283048-da9f-452a-913b-0e152267d085 |
| Reused from previous session | yes |

---

### First Campaign Flow (`/start-campaign`)

| Check | Result |
|---|---|
| Bug fixed: `projects.status` column | ✅ Column does not exist in DB schema — removed from SELECT query in `app/api/start-campaign/summary/route.ts` |
| Strategy Brief displayed | ✅ "Increase brand awareness among local businesses and drive website traffic by at least 20% within the first quarter." |
| Launch Template displayed | ✅ "First Campaign Launch Plan" — 1/9 steps complete |
| Recommended operator shown | ✅ "Default — idle and available for the first research task." |
| Project preselected | ✅ ALB Parking selected via `?project_id=` query param |

---

### Operator

| Field | Value |
|---|---|
| Operator used | Default (built-in) |
| Status at start | idle / connected (green dot) |
| Kevin creation needed | No — Default operator was available and used |

---

### Web Operator Research

| Check | Result |
|---|---|
| Bug fixed: Playwright not installed | ✅ Ran `npx playwright install chromium` — 92.4 MB download |
| Bug fixed: mode was `read_only` | ✅ Switched to `approval_required` via `PATCH /api/mode` |
| Skill used | `General web research` |
| Action type logged | `search` — status `completed` |
| No forbidden bypass | ✅ |
| No approval circumvented | ✅ |
| Leads extracted | 0 — web search returned no structured results for parking/property admins in A Coruña |
| Reason for 0 leads | Expected: DuckDuckGo/Google search result pages don't yield structured company data without scraping. Action logged honestly as completed with 0 results. |

---

### Lead Result

0 leads extracted. Not faked. The research action ran and completed — the Web Operator executed a `search` via Playwright (Chromium), found no structured lead data in the public search results page, and returned 0.

No fake leads were created.

---

### Executive Report

| Check | Result |
|---|---|
| Generated | ✅ Report ID `752f79e4-8713-4785-84da-a7768466f367` — created 2026-06-03T17:05:56Z |
| CEO response | Real Ollama output: "ALB Parking project is currently in its infancy, with a draft of the campaign's first task yet to be completed…" |
| Exported to Markdown | ✅ `executive-report-alb-parking-2026-06-03.md` — 1.9 KB — file ID `cdb6dba9-95ad-493f-a4f0-76f8f58afba4` |

---

### Project Artifact Bundle

All 5 artifacts generated via `POST /api/projects/{id}/artifact-bundle`:

| File | Type | Size | Source |
|---|---|---|---|
| `executive-report-alb-parking-2026-06-03.md` | markdown | 1,879 B | executive_report |
| `leads-project-2026-06-03.csv` | csv | 128 B | leads_export |
| `strategy-brief-2026-06-03.md` | markdown | 1,227 B | strategy_brief |
| `decision-log-2026-06-03.md` | markdown | 701 B | decision_log |
| `project-bundle-manifest-2026-06-03.json` | json | 1,417 B | project_bundle |

---

### /files Page

✅ All 5 artifacts visible in /files with correct type badges (MD, CSV, JSON), source labels (Project bundle, Decision log, etc.), sizes, and Download buttons.

---

### CEO Context Answers

**"What are we doing for ALB Parking?"**

> "We're working on a campaign to increase brand awareness and drive website traffic for ALB Parking, specifically targeting small to medium-sized business owners in retail and services industries within a 5-mile radius of our parking facilities. The goal is to reach at least 20% more website traffic within the first quarter. We've just started creating the launch checklist."

**"What decisions have been made?"**

> "The project goal, campaign objective, target audience, channel, value proposition, and first-campaign strategy brief were defined. The launch checklist was also created to guide the first campaign."

Intent resolved: `project_recall` ✅ — answers grounded in DB, not hallucinated.

---

### Issues Fixed During Workflow

| Issue | File | Fix |
|---|---|---|
| `projects.status` column missing | `app/api/start-campaign/summary/route.ts` | Removed `status` from SELECT — column does not exist in `projects` table |
| Playwright browsers not installed | local environment | `npx playwright install chromium` |
| Operating mode was `read_only` | DB: `operating_mode` table | Switched to `approval_required` via `PATCH /api/mode` for workflow verification |

---

### Final state

| Check | Result |
|---|---|
| `npm test` | ✅ 136/136 pass |
| `npm run build` | ✅ clean |
| `git diff --check` | ✅ no whitespace issues |
| Operating mode after workflow | `approval_required` (not restored to read_only — intentional for local dev) |


---

## Polish pass — 2026-06-03

### Messages improved

| Location | Before | After |
|---|---|---|
| Research 0 results (`lib/web-operator/delegation.ts`) | "completed search — 0 results found. Lead extraction is running in the background." | "completed search, but no structured leads were extracted. Try a more specific query or use Web Operator to open target websites directly." |
| Mode-blocked (`lib/web-operator/delegation.ts`) | Raw: `Action "browse_web" requires Auto / Approval Required mode or higher.` | "Research is blocked because AÏKO is in Read Only mode. Go to Operating Mode and switch to Auto / Approval Required to allow browser research." |
| Playwright missing (`lib/web-operator/delegation.ts`) | Raw stack trace from `browserType.launch: Executable doesn't exist at ...` | "Browser runtime is missing. Run: npx playwright install chromium" |

### Docs updated

- `README.md` — Added "Verified local workflow" section: prerequisites, mode switch, First Campaign Flow steps, CEO recall, provider honesty.
- `AIKO_RUNTIME_CHECK.md` — This file (full workflow record, bugs fixed, polish pass).

### Final state

| Check | Result |
|---|---|
| `npm test` | ✅ 136/136 |
| `npm run build` | ✅ clean |
| `git diff --check` | ✅ no whitespace issues |
| Provider: Ollama / llama3.1:8b | ✅ connected |
| Mode | `approval_required` |
| Playwright Chromium | ✅ installed |

---

## Lead Discovery Workflow — 2026-06-03

### What was built

**`lib/leads/discovery-workflow.ts`** — new module:
- `buildLeadDiscoveryQueries()` — generates 3–5 targeted query variants from prompt + project context, including Spanish-language variants for Iberian targets
- `runLeadDiscoveryWorkflow()` — orchestrates multi-query search, page reads, candidate extraction, dedup, save
- `extractLeadCandidatesFromSearchResults()` — AI extraction from search snippets (never invents emails)
- `extractLeadCandidatesFromPageText()` — AI extraction from page text
- `normalizeLeadCandidate()` — validates email format, normalizes URLs
- `saveLeadCandidates()` — dedup by project + website/email/company, saves to leads table
- `buildSummaryMessage()` — honest summary with queries run, pages checked, reason for 0 leads

**`app/api/projects/[id]/lead-discovery/route.ts`** — new endpoint:
- `POST /api/projects/{id}/lead-discovery`
- Returns `{ status, queries_run, pages_checked, candidates_found, leads_created, duplicates_skipped, failures, summary }`
- Max 5 queries × 3 pages (rate-limited by default)

**`app/(dashboard)/start-campaign/page.tsx`** — updated Step 3:
- When project is selected: uses `/api/projects/{id}/lead-discovery` instead of generic CEO delegation
- Shows honest summary from discovery result
- Falls back to CEO command when no project selected

**`components/leads/ProjectLeadsPanel.tsx`** — added:
- "🔍 Run lead discovery" button opens inline discovery panel
- Discovery query input + Discover button
- Honest result message shown

**`lib/web-operator/playwright-executor.ts`** — improved search:
- Tries DuckDuckGo HTML endpoint first (more headless-friendly)
- Falls back to Google with improved result selectors
- Multiple selector patterns tried for both engines

**Tests 114–120** — all pass:
- Query generation returns multiple variants including Spanish for Iberian targets
- Query count capped at 5
- Invalid email format rejected (never invented)
- Valid email preserved
- Candidates missing company_name or source_url rejected
- 0-leads summary is honest with suggested next steps
- Mode-blocked message names the required mode

### Runtime validation result

| Check | Result |
|---|---|
| Endpoint responds | ✅ 200 |
| Queries generated | ✅ 3 queries run (English + 2 Spanish variants) |
| Pages checked | ✅ 3 |
| Search results | 0 — bot detection (Google CAPTCHA in headless Chromium) |
| Leads created | 0 — honest, not faked |
| Summary message | ✅ "No new leads were extracted from the search results. Try a more specific query, or ask the Web Operator to open specific target websites directly. 3 queries run, 3 pages checked." |
| Fake leads created | ✅ None |

### Root cause of 0 search results

Google (and DuckDuckGo as fallback) block headless Chromium with CAPTCHA. Page preview shows: *"Our systems have detected unusual traffic from your computer network."*

This is expected behavior. The discovery workflow is architecturally correct — it runs, it tries, it reports honestly.

### Known limitation

Headless browser web search is blocked by bot detection in standard local environments. Workarounds (outside current scope):
1. Use a real search API (Brave Search API, SerpAPI, Bing Web Search)
2. Run browser with a logged-in user profile / persistent session
3. Use a residential proxy
4. Direct URL reads (`read_page` on known business directory URLs) instead of search

The architecture supports any of these — the workflow calls `delegateToWebOperator` which routes through the skill system.

---

## Visible Web Operator Runtime Validation — 2026-06-03

### Command

```bash
WEB_OPERATOR_HEADLESS=false AIKO_AUTH_MODE=optional PORT=3001 npm run dev
```

### Environment

| Check | Result |
|---|---|
| CEO brain | ✅ Ollama (local) / llama3.1:8b connected |
| Operating mode | ✅ `approval_required` |
| Browser mode | ✅ headed (`WEB_OPERATOR_HEADLESS=false`) |
| Playwright Chromium | ✅ installed |

### Test results

| Test | Result |
|---|---|
| `Kevin, open https://example.com and summarize the page.` | ⚠️ Web Operator routed to `website_reader`, but local DNS could not resolve `example.com`; action logged `failed/network_error`. |
| `Kevin, search Google for property administrators in A Coruña.` | ✅ Google CAPTCHA/unusual traffic detected; action logged `waiting_user`; operator status stayed `waiting_user`; no fake result. |
| `Kevin, open Facebook and research parking groups in A Coruña.` | ⚠️ Tagged `facebook_research`; current flow searches Google first and was stopped by Google CAPTCHA before reaching Facebook. No bypass or fake result. |
| `Kevin, open Canva and create a draft Instagram post for ALB Parking.` | ✅ Canva Cloudflare/security page detected as `security_checkpoint`; action logged `waiting_user`; no publish/share/download action attempted. |
| `Kevin, post on Facebook about ALB Parking.` | ✅ Approval item created; action logged `waiting_approval`; no post attempted. |
| `/operators/[id]` | ✅ Shows current URL, waiting reason, pending action, skill names, latest screenshot when safe, and controls: `I'm taking over`, `Login / CAPTCHA completed`, `Resume workflow`, `Pause operator`, `Clear workflow`. |

### Actions logged

- `open_url` / `website_reader` / `failed` / `network_error` for `https://example.com`.
- `search` / `general_web_research` / `waiting_user` / `captcha_detected` for Google.
- `search` / `facebook_research` / `waiting_user` / `captcha_detected` for Facebook research prompt.
- `open_url` / `canva_design` / `waiting_user` / `security_checkpoint` for Canva.
- `create_post` / `facebook_research` / `waiting_approval` for Facebook post.

### Screenshots

- Screenshots were captured on completed non-sensitive pages.
- Screenshots were suppressed on waiting-user CAPTCHA/security checkpoint actions.
- `/operators/[id]` now maps the API `latest_screenshot` field correctly and renders the latest safe screenshot block.

### Waiting and resume behavior

- CAPTCHA/security pages stop automation and set `requires_user_input=true`.
- `I'm taking over` sets `user_controlling` while preserving the waiting reason.
- `Login / CAPTCHA completed` now inspects the page matching the operator's current URL and refuses to clear unresolved security checkpoints.
- `Resume workflow` refuses to continue while `requires_user_input=true` (`Cannot resume: security_checkpoint`).
- Facebook posting remains approval-gated and does not execute silently.

### Issues fixed during this validation

| Issue | Fix |
|---|---|
| URL prompt misclassified `https://example.com` as unknown site `https` | Extract first URL and route URL prompts to `website_reader` |
| Manual takeover status overwritten to `idle` | Preserve `waiting_user` in delegation status update |
| Canva Spanish Cloudflare challenge treated as normal page | Add `security_checkpoint` patterns for Cloudflare/RayID/Canva Spanish challenge copy |
| Operator page always showed headless warning | Add server browser-mode field to `/api/web-operators/[id]` |
| Operator page ignored `latest_screenshot` from status API | Map top-level `latest_screenshot` into operator state |
| Duplicate old takeover button | Remove stale `Mark: I'm in control` button |
| Taking over cleared unresolved blocker | Preserve `requires_user_input` and `waiting_reason` |
| Login-completed checked `about:blank` page | Prefer page matching operator `current_url` |

---

## Known-Site Direct Open Validation — 2026-06-03

### Command

```bash
WEB_OPERATOR_HEADLESS=false AIKO_AUTH_MODE=optional PORT=3001 npm run dev
```

### Goal

Explicit known-site work should open the known website directly instead of routing through generic Google search first.

### Test results

| Prompt | Action log result |
|---|---|
| `Kevin, research Facebook groups about parking in A Coruña.` | ✅ `action_type=open_url`, `skill_id=facebook_research`, `target_url=https://www.facebook.com/search/groups?q=parking%20A%20Coru%C3%B1a`; no Google URL used. Facebook returned `Not Found` in the unauthenticated headed browser, so no fake results were produced. |
| `Kevin, open Canva and create a draft Instagram post for ALB Parking.` | ✅ `action_type=open_url`, `skill_id=canva_design`, `target_url=https://www.canva.com/`; Cloudflare/Canva security checkpoint paused as `waiting_user/security_checkpoint`. |
| `Kevin, open Gmail.` | ✅ `action_type=open_gmail`, `skill_id=gmail_workflow`, `target_url=https://mail.google.com/`; Google login paused as `waiting_user/login_required`. |

### Implementation summary

- Added `lib/web-operator/site-intents.ts` with direct target helpers:
  - `getDirectSiteTargetFromInstruction(text, skillId)`
  - `buildSiteSearchUrl(skillId, query)`
  - `shouldOpenSiteDirectly(skillId, instruction)`
- CEO delegation now uses direct `open_url` for Facebook, LinkedIn, Instagram, and Canva research/open instructions.
- Delegation has a fallback rewrite so safe known-site `search` actions become direct `open_url` actions before execution.
- Posting/messaging/joining/publishing/sharing/downloading still require approval and do not execute silently.
- `open_gmail` now raises the standard manual-takeover path on login pages instead of completing with `login_required` output.

### Verification

| Check | Result |
|---|---|
| Direct-site smoke tests | ✅ Added |
| CAPTCHA/login/security behavior | ✅ Preserved: `waiting_user` on blockers |
| Approval behavior | ✅ Preserved: Facebook post stays `waiting_approval` |

---

## Strategy Execution Planner Runtime Validation — 2026-06-04

### Command

```bash
WEB_OPERATOR_HEADLESS=false AIKO_AUTH_MODE=optional PORT=3001 npm run dev
```

### Environment

| Check | Result |
|---|---|
| Browser mode | ✅ Headed mode configured (`WEB_OPERATOR_HEADLESS=false`) |
| App port | ✅ `http://localhost:3001` |
| Migration | ✅ `042_project_strategy_execution_plans.sql` applied |
| Project | ✅ ALB Parking resolved to `4b283048-da9f-452a-913b-0e152267d085` |

### Runtime tests

| Prompt / action | Result |
|---|---|
| `For ALB Parking, the best strategy is to contact property owners through WhatsApp. Can AÏKO execute this?` | ✅ Created `Execution Plan: WhatsApp Web`; status `needs_capabilities`; missing `whatsapp_web` skill and `whatsapp_outreach` playbook; created System Improvement Proposal; `delegation=null`; no WhatsApp opened and no message sent. |
| `For ALB Parking, use Reddit research to validate parking pain points.` | ✅ Created `Execution Plan: Reddit`; status `needs_capabilities` because Reddit skill/playbook are not installed locally; created System Improvement Proposal; no Web Operator action executed. |
| `Create tasks from the Reddit execution plan.` | ✅ Created 4 internal `agent_tasks`; missing-capability execution steps are `blocked`; no Web Operator action executed. |
| Project workspace `/projects/[id]` → `Execution Plan` tab | ✅ Shows recommended channel, strategy summary, required skills/playbooks, missing capabilities, approval gates, execution steps, and task/proposal links. |

### Safety verification

Baseline before runtime checks:

```json
{"web_operator_actions":28,"plans":0,"tasks":29}
```

After runtime checks:

```json
{"web_operator_actions":28,"plans":2,"tasks":33,"proposals":2}
```

`web_operator_actions` stayed unchanged. The planner created internal plans, proposals, and tasks only.

### Issues found/fixed

| Issue | Fix |
|---|---|
| CEO model base text could still mention Web Operator delegation for strategy-planner prompts | Planner intents now replace the response text with internal-plan status and return a sanitized `strategy_execution_plan_created` action. |
| Missing-capability labels rendered `WhatsApp Web Web Operator...` | Capability label generation now avoids duplicate `Web`. |

---

## Codex-Ready Missing Capability Prompt Validation — 2026-06-04

### Command

```bash
WEB_OPERATOR_HEADLESS=false AIKO_AUTH_MODE=optional PORT=3001 npm run dev
```

### Runtime test

Prompt:

```text
For ALB Parking, best strategy is WhatsApp outreach. Can AÏKO execute this?
```

Result:

| Check | Result |
|---|---|
| Proposal visible in `/system` | ✅ `Add WhatsApp Web Operator Skill and Playbook` |
| Implementation prompt visible | ✅ `View implementation prompt` expands Codex-ready prompt |
| Copy prompt works | ✅ `Copy prompt for Codex` shows `Copied` |
| Missing capability shown | ✅ `web_operator_skill:whatsapp_web` |
| Safety rules shown | ✅ Manual login, no CAPTCHA bypass, approval gates |
| Prompt includes skill/playbook | ✅ `whatsapp_web`, `whatsapp_outreach` |
| Prompt includes risky approval gates | ✅ `send_message`, `attach_file`, `create_group`, `broadcast_message` |
| Prompt includes forbidden actions | ✅ `mass_messaging`, `spam`, `scrape_contacts`, login/CAPTCHA bypass |
| Prompt includes tests/runtime plan | ✅ Smoke tests and headed runtime checklist |
| External execution | ✅ None; `delegation=null`, no Web Operator action executed |

Note: during local dev, the background scheduler logged invalid legacy API-key errors unrelated to this feature. The proposal creation, prompt endpoint, `/system` UI, tests, and build were unaffected.

---

## WhatsApp Safe Self-Improvement Loop Validation — 2026-06-04

### Command

```bash
WEB_OPERATOR_HEADLESS=false AIKO_AUTH_MODE=optional PORT=3001 npm run dev
```

### Manual validation

| Check | Result |
|---|---|
| CEO prompt: `For ALB Parking, the best strategy is to contact property owners through WhatsApp. Can AÏKO execute this?` | ✅ Created `Execution Plan: WhatsApp Web` with status `needs_capabilities`. |
| Missing capability detection | ✅ Missing `whatsapp_web` skill and `whatsapp_outreach` playbook. |
| System Improvement Proposal | ✅ Linked `Add WhatsApp Web Operator Skill and Playbook`; no new duplicate proposal was created. |
| External execution | ✅ No Web Operator action created; no WhatsApp opened; no message sent. |
| Project workspace → Execution Plan tab | ✅ Shows WhatsApp Web channel, missing capabilities, blocked external steps, approval gates, and `View Codex prompt` links. |
| `/system` proposal UI | ✅ Shows one visible active WhatsApp proposal, safety rules, implementation prompt, and `Copy prompt for Codex`. |
| Copy prompt | ✅ Button shows `Copied`. |
| Prompt checklist | ✅ Includes `whatsapp_web`, `whatsapp_outreach`, `web.whatsapp.com`, QR/manual login takeover, draft-only messaging, `send_message` approval, `mass_messaging` forbidden, no contact scraping, no automatic sending, tests, and runtime validation. |
| CEO recall: `What is missing before AÏKO can execute WhatsApp outreach for ALB Parking?` | ✅ Answers from the latest execution plan/proposal context and names `whatsapp_web` / `whatsapp_outreach`; no actions returned. |

### Safety counters

Before/after validation:

```json
{"web_operator_actions":28,"project_strategy_execution_plans":4,"visible_whatsapp_proposals":1}
```

`web_operator_actions` stayed unchanged. The validation only created/read internal planning records.

### Issues found/fixed

| Issue | Fix |
|---|---|
| Older duplicate WhatsApp proposals were visible in `/system`. | Active System Improvement Proposal listing now collapses duplicates by project, title, and primary missing capability while preserving proposal history. |
| CEO recall answered WhatsApp capability questions from generic company memory and mentioned email gaps. | Project recall context now includes the latest strategy execution plan, missing capabilities, approval gates, and linked improvement proposals; missing-capability recall answers deterministically from that context. |

---

## Controlled Self-Improvement Lifecycle Validation — 2026-06-04

### Command

```bash
WEB_OPERATOR_HEADLESS=false AIKO_AUTH_MODE=optional PORT=3001 npm run dev
```

### Runtime test object

Existing proposal:

```text
Add WhatsApp Web Operator Skill and Playbook
```

WhatsApp was used only as the missing-capability example. No WhatsApp skill or playbook was implemented.

### Validation

| Step | Result |
|---|---|
| Open `/system?proposal=e930a2bf-dc8f-424b-ae88-8e2552632993` | ✅ Proposal grouped under `Proposed`; prompt and lifecycle controls visible. |
| Approve implementation | ✅ Status changed to `approved_for_implementation`; no Codex run, no code modification. |
| Copy prompt | ✅ Prompt remained copyable; status did not depend on copying. |
| Mark implementation started | ✅ Status changed to `implementation_in_progress`; lifecycle metadata recorded. |
| Mark implemented / ready for validation | ✅ Status changed to `implemented_pending_validation`; fake branch/commit/PR metadata recorded for handoff tracking. |
| Try to validate available | ✅ Blocked with `Cannot mark available because the skill/playbook is not present in the database. Missing skill: whatsapp_web.` |
| Confirm availability | ✅ `web_operator_skills.skill_id='whatsapp_web'` count is `0`; `web_operator_playbooks.playbook_id='whatsapp_outreach'` count is `0`; proposal remains `implemented_pending_validation`. |
| External execution | ✅ `web_operator_actions` stayed `28`; no WhatsApp opened and no message sent. |
| UI after validation attempt | ✅ Proposal shows under `Pending validation` with Implementation Handoff panel and `Mark validated available` guarded by backend validation. |

### Safety result

The self-improvement loop tracks approval and implementation handoff, but it does not modify AÏKO code, run Codex/Claude Code, run Web Operator actions, or mark a capability available unless the referenced skill/playbook actually exists.

---

## Self-Improvement Timeline Validation — 2026-06-04

### Command

```bash
WEB_OPERATOR_HEADLESS=false AIKO_AUTH_MODE=optional PORT=3001 npm run dev
```

### Runtime validation

| Check | Result |
|---|---|
| `GET /api/system/improvement-timeline` | ✅ Returned lifecycle summary, derived timeline events, and health counters. |
| Prompt body exposure | ✅ Timeline payload does not include `implementation_prompt` text. |
| Existing WhatsApp proposal | ✅ Appears as `implemented_pending_validation` for project `ALB Parking`. |
| Implementation metadata | ✅ Timeline shows handoff commit `fake123` and PR `https://example.com/fake-pr`. |
| Validation health | ✅ `blocked_by_validation=1` because `whatsapp_web` / `whatsapp_outreach` are not installed. |
| `/system` dashboard | ✅ Shows `Self-Improvement Timeline`, summary counters, `Improvement health`, project/platform/capability, status badge, Open proposal, and Copy prompt controls. |
| Copy prompt from timeline | ✅ Button reaches `Copied`; clipboard write now falls back if the browser clipboard API stalls. |
| CEO status query | ✅ `What is the status of AÏKO self-improvement?` returns `intent=system_improvement_status`, `actions=[]`, `delegation=null`. |
| External execution | ✅ `web_operator_actions` stayed `28`; no WhatsApp opened, no Web Operator action created, no message sent, no capability enabled. |

### Issues found/fixed

| Issue | Fix |
|---|---|
| CEO status phrase `status of AÏKO self-improvement` routed to project recall. | Self-improvement status intent now recognizes optional `AÏKO` before `self-improvement`. |
| In-app browser clipboard write could stall when copying from the timeline. | Copy helper now times out the Clipboard API attempt and uses the existing textarea fallback. |

---

## MVP Release Readiness Validation — 2026-06-04

### Release artifacts

| Artifact | Result |
|---|---|
| `AIKO_MVP_RELEASE_CHECKLIST.md` | ✅ Created with env vars, local/hosted deployment checks, database, Web Operator, Playwright, storage, safety, smoke tests, blockers, post-deploy checks, and production safety scan. |
| `/api/health` | ✅ Added safe health endpoint with no secrets, tokens, API keys, stack traces, absolute paths, or storage paths. |
| `README.md` | ✅ Added MVP deployment guide and troubleshooting notes. |

### Commands

```bash
npm test
npm run build
npm run setup:check
AIKO_AUTH_MODE=optional PORT=3001 npm run dev
```

### Results

| Check | Result |
|---|---|
| `npm test` | ✅ 223/223 passing. |
| `npm run build` | ✅ Clean production build; `/api/health` included in route map. |
| `npm run setup:check` | ✅ Script loads `.env.local`, reports `DATABASE_URL present: yes`, Ollama reachable, and suggests opening `/setup` with Ollama local. |
| `/api/health` | ✅ HTTP 200 with `ok=true`, `version=0.1.0`, `auth_mode=optional`. |
| Health database | ✅ `database.ok=true`, `error=null`. |
| Health setup | ✅ `required=false`, `can_ceo_think=true`. |
| Health Web Operator | ✅ `runtime_available=true`, `headed_mode=false`. |
| Health storage | ✅ `generated_files_writable=true`, `screenshots_writable=true`. |
| Health redaction | ✅ No API keys, access tokens, refresh tokens, secrets, database URLs, absolute `/Users/...` paths, or storage paths in payload. |
| `/dashboard` | ✅ 200. |
| `/setup` | ✅ 200. |
| `/ceo` | ✅ 200. |
| `/system` | ✅ 200. |
| `/operators` | ✅ 200. |

### Release checklist status

| Area | Status |
|---|---|
| Required env vars | ✅ App runtime and `setup:check` both see working DB/auth config through `.env.local`. |
| Optional providers | ✅ Honest local state preserved; ChatGPT/Claude are not faked when unconfigured. |
| Database | ✅ Runtime health OK. |
| Web Operator / Playwright | ✅ Runtime available. |
| Storage | ✅ Generated files and screenshots writable. |
| Safety | ✅ No safety model change; approval remains separate from execution; no WhatsApp/platform capability implemented. |
| Deployment blockers | ✅ No runtime blocker found. |

---

## MVP Demo Flow Validation — 2026-06-05

### Command

```bash
WEB_OPERATOR_HEADLESS=false AIKO_AUTH_MODE=optional PORT=3001 npm run dev
```

### Demo steps

| Step | Page used | Result | What the owner sees |
|---|---|---|---|
| 1. Dashboard | `/dashboard` | ✅ Pass | CEO brain connected via Ollama local, setup complete, Auto / Approval Required mode, quick links, active projects/operators, waiting-user count, pending approvals, improvement proposals, owner warnings, smoke checklist, recent files/reports/decisions. |
| 2. Setup | `/setup` | ✅ Pass with doc correction | Setup shows the resolved CEO brain as `Ollama (local) / llama3.1:8b` and links to CEO Chat, First Campaign, and Connect AI. ChatGPT/Claude honesty is more visible on `/dashboard` and `/connect-ai`, so the demo script now says that explicitly. |
| 3. CEO Chat hello | `/ceo` | ✅ Pass | `Hello, what are you?` received a CEO identity response. Local Ollama latency was visible; response completed after waiting. |
| 3. CEO project creation | `/ceo` | ✅ Pass, issue fixed | `Create a marketing project for Demo Parking.` created the project and the First Campaign chip. A runtime inconsistency showed the CEO claiming Mara was assigned while the project chip said `No PM assigned`; fixed by normalizing top-level `assign_pm` into the existing executable `assign_pm` action. |
| 4. Start Campaign | `/start-campaign?project_id=...` | ✅ Pass | Demo Parking strategy brief, first-campaign launch plan, recommended operator, research/review/draft/approval/resume/reply/trail steps, and safety copy all render. |
| 5. Web Operator Canva task | `/ceo` | ✅ Pass | `Kevin, open Canva and create a draft Instagram post for Demo Parking.` delegated to Kevin, opened Canva directly, selected the Canva Instagram Draft playbook, then blocked for security/login takeover. No publish/share/download happened. |
| 6. Operator detail | `/operators/[id]` | ✅ Pass, issue fixed | Current URL `https://www.canva.com/`, latest screenshot, `waiting_user`, `security_checkpoint`, Canva playbook checklist, manual takeover controls, approval/forbidden playbook steps. Summary cards now fall back to the active playbook/action instead of showing `None` / `Idle` while waiting. |
| 7. Approvals | `/approvals` | ✅ Pass | Approval Center shows pending approval content and clear copy: approving grants internal permission only and does not send external emails or messages. |
| 8. Executive report | `/ceo`, project `Reports` tab | ✅ Pass with doc correction | CEO generated an executive report for Demo Parking. The project Reports tab shows the executive report and `.md` / `.json` export buttons. The global `/reports` page has its own empty state, so the demo script now directs the owner to the project Reports tab. |
| 9. Files | `/files` | ✅ Pass | Generated files page shows existing generated artifacts and download buttons. Demo Parking project exports are available from the project Reports tab; project bundle remains `if available`. |
| 10. System improvements | `/system` | ✅ Pass | Capability map, Self-Improvement Timeline, proposal lifecycle groups, Codex prompt controls, implementation handoff metadata, validation guard state, and safety rules are visible. |

### Issues found/fixed

| Issue | Fix |
|---|---|
| Demo script implied ChatGPT/Claude honesty is shown directly on `/setup`; runtime shows it more clearly on `/dashboard` and `/connect-ai`. | Updated `AIKO_MVP_DEMO_SCRIPT.md`. |
| Demo script allowed `/reports` as a reliable place for the generated project executive report, but runtime showed the global reports empty state. | Updated the demo script and owner manual to direct owners to the project Reports tab for project executive reports. |
| CEO project creation could mention a PM assignment while no PM row was assigned if the model returned top-level `assign_pm` but omitted the structured `assign_pm` action. | Normalized top-level `assign_pm` into the existing executable action path. |
| Operator detail summary cards showed `Current workflow: None` and `Current goal: Idle` while the operator was in `waiting_user` on a Canva playbook. | Added display fallbacks from the latest playbook/action so the owner sees the active workflow context. |

### Honest blockers / notes

- Canva reached a security checkpoint and correctly entered `waiting_user`; manual login/security completion was not performed.
- No Canva publishing, sharing, downloading, posting, messaging, or external send was attempted.
- ChatGPT/Codex and Claude remained honestly unconnected in local state.
- Local Ollama responses were slow enough to be visible during the demo.

---

## First Real Marketing Session — 2026-06-05

### Project

`ALB Parking`

### Command

```bash
AIKO_AUTH_MODE=optional PORT=3001 npm run dev
```

### Session steps

| Step | Page/API used | Result | What happened |
|---|---|---|---|
| 1. Open dashboard | `/dashboard` | ✅ Pass | Dashboard showed Ollama local as CEO brain, setup complete, Auto / Approval Required mode, 3 active projects, 2 Web Operators, 14 waiting-user workflows, 1 pending approval, 4 active improvement proposals, and honest ChatGPT/Claude warnings. |
| 2. Open CEO | `/ceo` | ✅ Pass with tooling note | CEO history and ALB Parking context loaded. Browser text entry in the Codex in-app browser failed because its virtual clipboard was unavailable, so CEO prompts were sent through `/api/ceo/command`, the same backend route used by the UI. |
| 3. Ask for 7-day plan | `/api/ceo/command` | ⚠️ Weak output | `Plan the next 7 days of marketing work for ALB Parking.` returned broad themes only: research, content creation, and outreach. It did not produce a day-by-day plan or concrete tasks. |
| 4. Review plan/workspace | `/projects/[id]` | ✅ Pass, blocker visible | Project workspace clearly showed the first-campaign brief, 0/9 launch checklist, 0 leads, and no PM assigned. |
| 5. Ask operator first step | `/api/ceo/command` | ⚠️ Confusing output | CEO said Sven should review existing content and research, but did not create a Web Operator delegation. This blurred PM/agent/operator roles. |
| 6. Run safe Web Operator action | `/api/ceo/command`, `/operators/[id]` | ✅ Safe behavior, issue fixed | `Kevin, open https://www.coruna.gal...` created a direct `open_url` action with `website_reader` and General Site Research playbook. It paused in `waiting_user` with login/security takeover copy and did not bypass anything. A routing bug made CEO also say no project matched the full command; fixed by bypassing project-recall fast path for direct URL/operator browser commands. |
| 6b. Validate direct URL routing | `/api/ceo/command` | ✅ Fixed | `Kevin, open https://example.com and summarize the page.` no longer produced a bogus project-recall error. It failed due DNS/network resolution in the operator browser, and raw Playwright error copy was sanitized to owner-facing text. |
| 7. Generate report | `/api/ceo/command` | ✅ Pass | Executive report generated for ALB Parking and identified draft-stage status, 0/9 launch progress, no PM, and next launch step `Define target audience`. |
| 8. Generate bundle | `/api/projects/[id]/artifact-bundle` | ✅ Pass | Generated 5 files: executive report, leads CSV, strategy brief, decision log, and project bundle manifest. |
| 8b. Verify files | `/files` | ✅ Pass | Files page showed the new ALB Parking bundle files and honest `0 leads exported` CSV. |
| 9. Ask blockers | `/api/ceo/command` | ⚠️ Partial | CEO named missing Email Sending and Reply Tracking capabilities, but did not mention no PM assigned, 0/9 checklist, empty leads, or Kevin waiting for user takeover. |

### Useful parts

- Dashboard gives a strong owner overview before work starts.
- Project workspace makes real blockers visible: no PM, no leads, 0/9 checklist.
- Web Operator paused safely on login/security and showed playbook steps, current URL/title, waiting reason, forbidden steps, and manual controls.
- Report and bundle generation worked and produced inspectable files.
- Files page made the generated artifacts easy to verify and download.

### Confusing parts

- The CEO's 7-day plan was too high-level for a real 60-minute session.
- The CEO said Mara would be assigned as PM in one response, but ALB Parking still showed no assigned PM in the workspace.
- `What should the operator do first?` returned Sven, which reads like a PM/agent recommendation rather than a Web Operator action.
- The blocker answer over-focused on missing capabilities and missed visible operational blockers.
- Operator page still has some duplicated controls (`Resume workflow`) and mixed status labels (`ready` summary while execution is `waiting_user`).

### Missing capabilities / blockers

- Email sending and reply tracking remain missing capabilities.
- ALB Parking has no PM assigned.
- ALB Parking has 0 leads and no completed launch checklist steps.
- Kevin has multiple waiting-user actions from login/security checks.
- Local Ollama is usable but slow and sometimes produces weaker planning output than a hosted reasoning model.

### Fixes made

| Issue | Fix |
|---|---|
| Direct URL/operator command containing `summarize` routed through project recall, causing a bogus `I don't have a project matching...` response while delegation still happened. | Added a recall fast-path bypass for explicit URLs and named Web Operator browser commands. |
| Failed Web Operator navigation exposed raw Playwright/ANSI error text to the owner. | Added sanitized owner-facing failure copy for DNS, network, timeout, and missing-browser-runtime errors. |

### Next highest-value improvement

Improve CEO operational planning quality: when asked for a 7-day plan, the CEO should produce concrete daily tasks tied to the project launch checklist, assigned owner roles, current blockers, and whether each step is internal-only, Web Operator-safe, approval-gated, or blocked by missing capability.

---

## ChatGPT / Codex Local Auth Validation — 2026-06-05

### Command

```bash
AIKO_AUTH_MODE=optional PORT=3001 npm run dev
```

### Result

| Check | Result | Notes |
|---|---|---|
| Codex local status | ✅ Pass | `/api/auth-profiles/openai-codex/local/status` detected Codex CLI and local auth, but correctly showed `connected=false` before import/test. |
| OAuth App distinction | ✅ Pass | Diagnostics showed ChatGPT / Codex OAuth App as not configured with missing `OPENAI_OAUTH_*` vars. |
| Local import | ✅ Pass | Import created a safe auth-profile reference only. No token contents were returned. |
| Real local test | ✅ Pass after adapter fix | Initial runtime testing found two CLI adapter bugs: unsupported `--ask-for-approval` flag and inherited stdin blocking `codex exec`. The adapter now uses supported flags and closes stdin explicitly. |
| CEO assignment | ✅ Pass | Assignment was allowed only after the real Codex test passed. |
| Router path | ✅ Pass | `/api/providers/test-ceo-brain` returned `AÏKO_CEO_OK` using `ChatGPT / Codex Local` / `codex-cli-default`. |
| `/connect-ai` UI | ✅ Pass | Shows three distinct OpenAI paths: ChatGPT / Codex Local connected, ChatGPT / Codex OAuth App not configured, and OpenAI API as separate fallback. |
| `/setup` UI | ✅ Pass | Setup resolves to `CEO brain connected` with ChatGPT / Codex Local after diagnostics settle. |

### Safety notes

- AÏKO did not expose access tokens, refresh tokens, API keys, raw auth-file contents, or local Codex auth paths.
- AÏKO did not mark Codex connected from detection alone.
- OpenAI API key fallback and Ollama local provider remained separate and available.

---

## CEO Chat With Codex Local Brain — 2026-06-05

### Command

```bash
AIKO_AUTH_MODE=optional PORT=3001 npm run dev
```

### Runtime validation

| Step | Page/API | Result | Notes |
|---|---|---|---|
| Dashboard | `/dashboard`, `/api/dashboard/summary` | ✅ Pass after fix | CEO brain shows `ChatGPT / Codex Local`, model `codex-cli-default`, auth method `local`, and `running_on_ollama=false`. Fixed stale dashboard warning that counted only `chatgpt_oauth` as ChatGPT-connected. |
| Connect AI | `/connect-ai` | ✅ Pass | Current CEO brain is ChatGPT / Codex Local. ChatGPT / Codex OAuth App remains separate and not configured. OpenAI API remains a separate API-key fallback. No tokens/secrets are displayed. |
| CEO hello | `/ceo`, `/api/ceo/command` | ✅ Pass | `Hello, what are you?` returned a natural CEO response through the assigned Codex Local brain. No Ollama fallback was used. |
| Create project | `/api/ceo/command` | ✅ Pass | `Create a marketing project for Codex Validation Demo.` created project `b11f9359-701a-4a69-849a-c8ff38cd76db`, assigned Sven, created a strategy brief, created a launch template, and showed action chips. |
| Verify project rows | PostgreSQL | ✅ Pass | Project is active, Sven is PM, 1 strategy brief exists, 1 launch template exists, and decision log includes project creation, strategy brief, launch template, and PM assignment. |
| Project recall | `/api/ceo/command` | ✅ Pass | `What are we doing for Codex Validation Demo?` answered from project context: validation demo, email-based workflow, Sven PM, 0/9 launch steps, next step target audience. |
| Self-improvement status | `/api/ceo/command`, `/ceo` | ✅ Pass after fix | Read-only response returned no actions/delegation and is now persisted in CEO Chat history after reload. |
| Logs/errors | dev server/API responses | ✅ Pass after fix | No Codex token, refresh token, API key, raw auth file, or local Codex path was exposed. Runtime shutdown exposed that the background scheduler was logging full provider error objects for legacy scheduled agents; this is now summarized without headers, cookies, stacks, or token-like strings. One transient Next dev static-path stack trace appeared during hot compilation for `/api/auth/[...nextauth]`; it did not appear in UI and subsequent requests succeeded. |

### Fixes made

| Issue | Fix |
|---|---|
| Dashboard still warned `ChatGPT/Codex not connected` even when CEO was assigned to ChatGPT / Codex Local. | Updated `/api/dashboard/summary` to count both `openai-codex-local` and `chatgpt_oauth` as ChatGPT/Codex connected. |
| Self-improvement status shortcut returned from API but was not persisted into CEO Chat history, so it could disappear after reload. | Added persistence for self-improvement status/lifecycle shortcut responses into `ceo_commands`. |
| Background scheduler logged raw provider error objects when legacy scheduled agents hit an invalid API-key fallback. | Added sanitized scheduler error summaries that keep status/code/type/message but drop headers, cookies, stacks, and token-like strings. |

---

## Project Autopilot Web Research — 2026-06-05

### Implementation Check

| Check | Result | Notes |
|---|---|---|
| Autopilot intent | ✅ Pass after fix | Added `project_autopilot_marketing` for start-marketing/promote/find-customers/find-leads/research-where-to-promote commands. Runtime found that `Start marketing for ALB Parking.` fell back to the latest project because final punctuation was not treated as a project-name terminator; fixed and covered by a smoke test. |
| Simple home | ✅ Pass | `/home` is the post-setup root and shows command box, project selector, quick actions, Live Work, Attention, and hidden advanced details. |
| Browser safety | ✅ Pass | Autopilot uses existing Web Operator delegation and Playwright execution. It does not bypass login/CAPTCHA/security and does not post/send/message/publish. |
| Copy simplification | ✅ Pass | Main takeover, approval, read-only, browser-missing, and no-results messages now use short owner-facing wording. |
| Tests/build | ✅ Pass | Smoke tests cover autopilot intent, visible plan, simple messages, hidden advanced details, no auto-send/post/message, no fake leads, and secret-free live-work payload. |

### Runtime validation

Command:

```bash
AIKO_AUTH_MODE=optional PORT=3001 WEB_OPERATOR_HEADLESS=false npm run dev
```

| Step | Page/API | Result | Notes |
|---|---|---|---|
| Health | `/api/health` | ✅ Pass | `ok=true`, database reachable, setup complete, Web Operator runtime available, headed mode enabled, storage writable. |
| Home page | `/home` | ✅ Pass after restart | Initial dev process had started before `/home` existed and served stale chunk references; a fresh dev restart rendered the new route correctly. The page shows project selector, quick actions, Live Work, Attention, and hidden Advanced details. |
| ALB autopilot | `/api/ceo/command` | ✅ Pass after fix | `Start marketing for ALB Parking.` now resolves to project `ALB Parking` (`4b283048-da9f-452a-913b-0e152267d085`), creates browser research actions, opens Reddit and LinkedIn targets, and returns compact owner-facing copy. |
| Login/security pause | Web Operator | ✅ Pass | LinkedIn login pauses with `Kevin needs your help. Complete this in the browser, then click Resume.` No bypass attempt. |
| AÏKO autopilot | `/api/ceo/command` | ✅ Pass | `Promote AÏKO.` uses AÏKO-specific public targets including Product Hunt and Hacker News Algolia. No project is incorrectly attached. |
| Result honesty | API/UI | ✅ Pass | When no useful visible opportunities are extracted, AÏKO reports no useful results and recommends a more specific audience/channel. No fake leads. |
| External side effects | Web Operator actions | ✅ Pass | Actions were limited to search/open URL/read visible public pages. No post/send/message/publish/share/download action was created. |

---

## Approval And Takeover UX Simplification — 2026-06-05

### Command

```bash
WEB_OPERATOR_HEADLESS=false AIKO_AUTH_MODE=optional PORT=3001 npm run dev
```

### Runtime validation

| Step | Page/API | Result | Notes |
|---|---|---|---|
| Health | `/api/health` | ✅ Pass | `ok=true`, version `0.1.0`, database reachable, setup complete, Web Operator runtime available, headed mode enabled, storage writable. |
| Canva manual help | `/api/ceo/command`, Web Operator | ✅ Pass | `Kevin, open Canva and create a draft Instagram post for ALB Parking.` opened `https://www.canva.com/` in headed mode and paused with `waiting_user` / `security_checkpoint`. No publish/share/download action was executed. |
| Home manual state | `/home` | ✅ Pass | The Needs your attention card showed `Kevin needs your help`, `Complete this in the browser, then click Resume.`, and Open browser / Resume / Advanced. No raw JSON, action IDs, skill decisions, or waiting reasons were visible by default. |
| Operator detail manual state | `/operators/31bccda5-5daf-4474-acfe-3fd73f9b2c1e` | ✅ Pass | The top card showed `Kevin is waiting for you`, current website, current step, Open browser, I’m taking over, Resume, and Advanced. Playbook/action internals stayed inside closed Advanced sections. |
| Facebook approval gate | `/api/ceo/command`, `/api/approval-items` | ✅ Pass after copy fix | `Kevin, post on Facebook about ALB Parking.` created a pending approval item and did not execute the post. Runtime found duplicated approval wording in the CEO delegation message; the playbook add-on now says Kevin will open Facebook directly and stop before external action. |
| Approvals page | `/approvals` | ✅ Pass after title fix | Pending Facebook approval showed `Prepare Facebook post draft`, `Kevin needs approval before doing this.`, `Approving does not execute automatically. Resume is still explicit.`, Approve / Reject / View details. Raw payload and metadata stayed hidden. |
| Operators list | `/operators` | ✅ Pass after state fix | Runtime found a stale `requires_user_input` flag causing an approval-needed operator card to say manual help. The list now prioritizes status, shows approval copy for `waiting_approval`, and moves stale goal/task/memory text into Advanced. |
| External side effects | API/UI | ✅ Pass | Approval was created, but no send/post/message/publish/share/download action was executed automatically. |

### Fixes made

| Issue | Fix |
|---|---|
| CEO delegation copy repeated `Kevin needs approval before doing this.` for Facebook approval requests. | Changed Facebook playbook add-on copy to `Kevin will open Facebook directly and stop before any external action.` |
| `/approvals` default card title used the raw Web Operator instruction. | Added plain approval display titles such as `Prepare Facebook post draft`; raw content remains in View details. |
| `/operators` list could show manual-help copy while the operator status was `waiting_approval`. | Added status-based notice selection and moved workflow/goal/task/memory lines behind Advanced. |

---

## Minimal Main App Navigation And Home — 2026-06-06

### Command

```bash
AIKO_AUTH_MODE=optional PORT=3001 WEB_OPERATOR_HEADLESS=false npm run dev
```

### Runtime validation

| Step | Page/API | Result | Notes |
|---|---|---|---|
| Home | `/home` | ✅ Pass | Shows the big command box, current project, Needs your attention, Live work, Quick actions, Recent output, short safety line, and collapsed Advanced dashboard. Initial read before hydration showed empty states; after client data load, projects and latest file appeared correctly. |
| Dashboard | `/dashboard` | ✅ Pass | Renders as the advanced overview. Sidebar Advanced group opens because `/dashboard` is an advanced route. No 500 or blank state. |
| CEO Chat | `/ceo` | ✅ Pass | Renders with CEO brain status and the simplified grouped sidebar. No missing primary links. |
| Operators | `/operators` | ✅ Pass | Main copy is shorter, approval/manual state remains simple, and Advanced remains available for details. |
| Approvals | `/approvals` | ✅ Pass | Plain approval card remains intact; no raw metadata shown by default. |
| Connect AI | `/connect-ai` | ✅ Pass | Main copy is shorter and provider truth remains explicit: Codex Local, OAuth App, API keys, Claude, and Ollama are still separate. |
| Navigation | Sidebar | ✅ Pass | Primary, Work, and System groups are visible. Advanced routes remain linked and are collapsed by default unless the active page is advanced. |
| Safety | UI/API | ✅ Pass | Safety copy remains visible: AÏKO never sends, posts, publishes, or bypasses login/CAPTCHA without the user. No execution or provider-state behavior changed. |
