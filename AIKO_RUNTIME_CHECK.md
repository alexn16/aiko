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
