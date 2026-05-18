# AÏKO — Codebase Map
## Read this file first before making any change to the codebase.
## Updated: v1.0

---

## PURPOSE OF THIS FILE

This file is the single source of truth for the structure of AÏKO.
Any AI agent, developer, or tool working on this codebase must read this file first.

It answers three questions for every file:
1. What does this file do?
2. What does it depend on?
3. What depends on it?

When you receive a task — "add a feature", "fix a bug", "refactor X" —
use this map to find exactly which files to read and which to change.
Do not guess. Do not assume. Read the relevant files, then act.

---

## SYSTEM OVERVIEW

```
User instruction
      │
      ▼
┌─────────────────────────────────────────────────────┐
│  AÏKO Frontend  (Next.js — app/)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │Dashboard │  │Live Map  │  │  Approval Center │  │
│  │/office   │  │/leads    │  │  /campaigns      │  │
│  │/reports  │  │/settings │  │  /functions      │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
└────────────────────┬────────────────────────────────┘
                     │  API Routes (app/api/)
                     ▼
┌─────────────────────────────────────────────────────┐
│  Orchestrator  (lib/agents/orchestrator.ts)         │
│  Routes tasks to the correct agent                  │
└──┬──────────┬──────────┬──────────┬─────────────────┘
   │          │          │          │
   ▼          ▼          ▼          ▼
Research   Copywriting  Outreach  Reporting
Agent      Agent        Agent     Agent
   │          │
   ▼          ▼
Browser    Approval
Agent      Center
(Playwright) (DB queue)
   │
   ▼
Real Chromium browser
(navigates real websites)
```

---

## FILE MAP

Every file in the project. Format:
  PATH — what it does | depends on | depended on by

---

### ROOT

```
aiko/
├── AIKO_MAP.md              ← YOU ARE HERE. Read before touching anything.
├── AIKO_FUNCTIONS.md        ← Human-readable list of all system capabilities.
├── docker-compose.yml       ← Starts app + postgres. Edit to add services.
├── Dockerfile               ← Builds the app container. Installs Playwright.
├── .env.example             ← Copy to .env.local. No secrets go in source.
├── package.json             ← Dependencies. Add packages here.
└── tsconfig.json            ← TypeScript config. Do not change paths without updating imports.
```

---

### APP LAYER  `app/`

#### Pages

```
app/layout.tsx
  WHAT: Root layout. Wraps all pages. Loads fonts, global CSS, auth session.
  DEPENDS ON: components/ui/*, NextAuth session provider
  DEPENDED ON BY: every page

app/(dashboard)/page.tsx                            SCREEN: Dashboard
  WHAT: Overview screen. Shows 4 metric cards, active agent grid, next-action card, activity feed.
  DEPENDS ON: components/agents/AgentGrid, components/agents/ActivityFeed, /api/agents/stream (SSE)
  DEPENDED ON BY: nothing (leaf page)
  TO CHANGE METRICS: edit the SQL queries in the SSE handler, update stat cards here.

app/(dashboard)/office/page.tsx                     SCREEN: Live Office
  WHAT: Table of all 11 agents with live status. BrowserStream viewer. Free-text instruction input.
  DEPENDS ON: components/agents/AgentCard, components/agents/BrowserStream, /api/agents/run, /api/agents/stream
  TO ADD AN AGENT: add row to agents table in DB, add definition in lib/agents/orchestrator.ts, add card here.

app/(dashboard)/leads/page.tsx                      SCREEN: Leads
  WHAT: Filterable lead table. "Start scraping" button opens ScrapeModal.
  DEPENDS ON: components/leads/LeadTable, components/leads/ScrapeModal, /api/leads/scrape
  TO ADD LEAD FIELDS: add column to DB leads table + migration, update LeadTable.tsx, update ScrapeModal.

app/(dashboard)/map/page.tsx                        SCREEN: Codebase Map
  WHAT: Renders AIKO_MAP.md and AIKO_FUNCTIONS.md as a readable, searchable reference inside the app.
  DEPENDS ON: AIKO_MAP.md, AIKO_FUNCTIONS.md (read from filesystem at request time)
  NOTE: This is NOT a geographic map. It is the structural map of the codebase.
  TO UPDATE: edit AIKO_MAP.md or AIKO_FUNCTIONS.md directly. The page re-reads on every load.

app/(dashboard)/approval/page.tsx                   SCREEN: Approval Center
  WHAT: Queue of pending outreach messages. Inline editor. Approve/Reject buttons.
  DEPENDS ON: components/approval/ApprovalQueue, /api/outreach/send
  INVARIANT: Nothing is sent from anywhere else. This is the only send path.
  TO ADD A CHANNEL: add channel type to approvals table, add send handler in /api/outreach/send.

app/(dashboard)/campaigns/page.tsx                  SCREEN: Campaigns
  WHAT: Active campaigns with stats (sent/opened/replied). Campaign timeline.
  DEPENDS ON: DB campaigns table, /api/agents/stream for live stats
  TO ADD STATS: add column to campaigns.stats JSONB, update Outreach Agent to write it.

app/(dashboard)/reports/page.tsx                    SCREEN: Reports
  WHAT: Latest report from Reporting Agent. Executive summary + metrics + recommendations.
  DEPENDS ON: /api/reports/generate (on-demand), DB agent_logs for history
  TO CHANGE REPORT FORMAT: edit lib/agents/reporting-agent.ts prompt.

app/(dashboard)/functions/page.tsx                  SCREEN: Functions Reference
  WHAT: Renders AIKO_FUNCTIONS.md. Human-readable capability list for the user.
  DEPENDS ON: AIKO_FUNCTIONS.md
  NOTE: Auto-updates when AIKO_FUNCTIONS.md is edited.

app/(dashboard)/settings/page.tsx                   SCREEN: Settings
  WHAT: Model config per agent slot. SMTP config. Project config. Agent on/off toggles.
  DEPENDS ON: DB model_configs table, DB settings table
  TO ADD A SETTING: add row to settings table, add UI input here, read in the relevant lib/ file.
```

#### API Routes

```
app/api/agents/run/route.ts
  WHAT: POST. Receives { agentId, projectId, instruction }. Starts agent task. Returns SSE stream.
  DEPENDS ON: lib/agents/orchestrator.ts
  DEPENDED ON BY: Live Office page (instruction input), Dashboard (next-action button)
  TO ADD AN AGENT TASK TYPE: add case in orchestrator.ts, not here.

app/api/agents/stop/route.ts
  WHAT: POST. Receives { agentId }. Sets agent status to 'paused'. Browser agent checks this flag.
  DEPENDS ON: DB agents table
  DEPENDED ON BY: Live Office stop button

app/api/agents/stream/route.ts
  WHAT: GET. SSE endpoint. Polls DB every 1500ms. Emits { type:'state', agents, logs }.
  DEPENDS ON: DB agents table, DB agent_logs table
  DEPENDED ON BY: Dashboard, Live Office, Leads page (all screens that show live data)
  TO ADD DATA TO THE STREAM: add query here and extend the emitted object. Update consumers.
  NOTE: All realtime UI data flows through this one endpoint. Do not create separate polling.

app/api/browser/run/route.ts
  WHAT: POST. Receives { agentId, projectId, instruction }. Runs the browser agent loop.
  DEPENDS ON: lib/agents/browser-agent.ts
  DEPENDED ON BY: lib/agents/research-agent.ts, lib/agents/leadgen-agent.ts, lib/agents/outreach-agent.ts
  NOTE: This is a long-running route (minutes). Timeout must be set to 0 in Next.js config.

app/api/leads/scrape/route.ts
  WHAT: POST. Receives { url, projectId, agentId }. Delegates to Research Agent.
  DEPENDS ON: lib/agents/research-agent.ts
  DEPENDED ON BY: Leads page ScrapeModal

app/api/leads/enrich/route.ts
  WHAT: POST. Receives { leadId, projectId }. Delegates to Lead Gen Agent.
  DEPENDS ON: lib/agents/leadgen-agent.ts
  DEPENDED ON BY: Leads page row action "Enrich"

app/api/outreach/generate/route.ts
  WHAT: POST. Receives { leadId, projectId, channel }. Runs Copywriting Agent. Output → approvals table.
  DEPENDS ON: lib/agents/copywriting-agent.ts
  DEPENDED ON BY: Leads page row action "Generate message"

app/api/outreach/send/route.ts
  WHAT: POST. Receives { approvalId }. Checks status='approved'. Sends via configured channel. Logs.
  DEPENDS ON: DB approvals table, lib/email/sender.ts
  DEPENDED ON BY: Approval Center "Approve" button
  INVARIANT: Checks status='approved' before sending. Never sends a 'pending' record.

app/api/reports/generate/route.ts
  WHAT: POST. Receives { projectId }. Runs Reporting Agent. Returns structured report.
  DEPENDS ON: lib/agents/reporting-agent.ts
  DEPENDED ON BY: Reports page "Generate" button, scheduled cron (optional)
```

---

### LIB LAYER  `lib/`

#### Models

```
lib/models/provider.ts
  WHAT: The single LLM interface. callLLM(config, messages, options) → string.
        Uses OpenAI-compatible client. Works with Ollama, OpenAI, Mistral, Groq, any endpoint.
  DEPENDS ON: openai npm package
  DEPENDED ON BY: EVERY agent file. No agent calls any LLM SDK directly.
  TO SWITCH LLM PROVIDER: change config.baseURL and config.model. Nothing else changes.
  TO ADD STREAMING: add stream:true option here and update callers.

lib/models/config.ts
  WHAT: Reads model config per agent slot from DB. Returns LLMConfig for any agent name.
  DEPENDS ON: lib/db/client.ts, DB model_configs table
  DEPENDED ON BY: lib/agents/orchestrator.ts (passes config to each agent)
```

#### Agents

```
lib/agents/orchestrator.ts
  WHAT: Central router. Receives a free-text instruction + agentId. Decides which agent function
        to call. Parses intent from instruction text using a lightweight LLM call.
  DEPENDS ON: lib/models/provider.ts, lib/models/config.ts, all agent files
  DEPENDED ON BY: app/api/agents/run/route.ts
  TO ADD AN AGENT: import it here, add a case in the routing logic, add its name to the intent parser prompt.

lib/agents/browser-agent.ts
  WHAT: The core browser loop. Takes instruction + modelConfig. Opens Playwright browser.
        Screenshot → LLM → action → screenshot loop. Supports: click, type, navigate, scroll, extract, done, stuck.
        Writes every action to agent_logs. Closes browser on completion or error.
  DEPENDS ON: lib/models/provider.ts, lib/browser/controller.ts, lib/browser/screenshot.ts, lib/db/client.ts
  DEPENDED ON BY: lib/agents/research-agent.ts, lib/agents/leadgen-agent.ts, lib/agents/outreach-agent.ts
  TO CHANGE BROWSER BEHAVIOR: edit BROWSER_SYSTEM_PROMPT constant at top of this file.
  TO ADD A NEW ACTION TYPE: add case in the switch(decision.action) block.
  MAX_STEPS: defined as constant at top. Change here only.

lib/agents/research-agent.ts
  WHAT: Finds new leads. Plans whether to use browser or LLM-only. If browser: constructs
        extraction instruction, calls browser-agent, parses extracted data, inserts into leads table.
  DEPENDS ON: lib/agents/browser-agent.ts, lib/models/provider.ts, lib/db/client.ts
  DEPENDED ON BY: app/api/leads/scrape/route.ts
  TO CHANGE EXTRACTION FIELDS: update the instruction string passed to browser-agent + the INSERT query.

lib/agents/leadgen-agent.ts
  WHAT: Enriches existing leads. Visits company website, finds missing email/LinkedIn/phone.
        Updates lead record. Does not create new leads.
  DEPENDS ON: lib/agents/browser-agent.ts, lib/db/client.ts
  DEPENDED ON BY: app/api/leads/enrich/route.ts

lib/agents/copywriting-agent.ts
  WHAT: Generates outreach messages. Reads lead + project from DB. Calls LLM with structured prompt.
        Parses JSON response. Inserts into approvals table with status='pending'. Never sends.
  DEPENDS ON: lib/models/provider.ts, lib/db/client.ts
  DEPENDED ON BY: app/api/outreach/generate/route.ts
  TO CHANGE MESSAGE STYLE: edit the system prompt and user prompt in this file.
  TO ADD A CHANNEL: add channel to the wordLimits map and adjust the prompt.

lib/agents/quality-agent.ts
  WHAT: Reviews copywriting output before it reaches the Approval Center. Checks: spam words,
        tone, GDPR language, factual claims. Can set approval status to 'rejected' with reason.
  DEPENDS ON: lib/models/provider.ts, lib/db/client.ts
  DEPENDED ON BY: lib/agents/copywriting-agent.ts (called automatically after generation)
  TO ADD A CHECK: add criteria to the quality check prompt in this file.

lib/agents/outreach-agent.ts
  WHAT: Monitors replies. Uses browser-agent in read-only mode to check Gmail/LinkedIn inbox.
        Classifies replies. Updates lead status. Calls Sales Validation for positive replies.
  DEPENDS ON: lib/agents/browser-agent.ts, lib/agents/sales-validation-agent.ts, lib/db/client.ts
  DEPENDED ON BY: lib/agents/orchestrator.ts (scheduled task)
  CONSTRAINT: read-only. Never triggers a send. Never opens Compose or New Message.

lib/agents/sales-validation-agent.ts
  WHAT: Scores lead intent 1–10 from reply text. Sets lead status to qualified/warm/cold.
        Triggers Copywriting Agent for follow-up if score >= 7.
  DEPENDS ON: lib/models/provider.ts, lib/agents/copywriting-agent.ts, lib/db/client.ts
  DEPENDED ON BY: lib/agents/outreach-agent.ts

lib/agents/strategy-agent.ts
  WHAT: Generates ICP, channel priority, and sprint goals from project brief. Writes to
        projects.strategy JSONB column. No browser.
  DEPENDS ON: lib/models/provider.ts, lib/db/client.ts
  DEPENDED ON BY: lib/agents/orchestrator.ts, Settings page (trigger on project save)

lib/agents/reporting-agent.ts
  WHAT: Queries DB for leads, approvals, campaign stats, agent logs. Formats structured report.
        Output is a JSON object with sections: summary, metrics, agentPerformance, recommendations.
  DEPENDS ON: lib/models/provider.ts, lib/db/client.ts
  DEPENDED ON BY: app/api/reports/generate/route.ts
  TO CHANGE REPORT SECTIONS: edit the DB queries and the LLM synthesis prompt in this file.

lib/agents/ceo-agent.ts
  WHAT: Reads latest report. Produces strategic recommendations. Updates projects.strategy.
        No browser. Runs every 30 minutes via setInterval in the app server startup.
  DEPENDS ON: lib/agents/reporting-agent.ts, lib/models/provider.ts, lib/db/client.ts
  DEPENDED ON BY: app/layout.tsx (starts the interval on server boot)

lib/agents/project-manager-agent.ts
  WHAT: Tracks sprint milestones. Reads agents table for stuck/error states. Writes summary
        to agent_logs. Flags blockers. No browser.
  DEPENDS ON: lib/db/client.ts, lib/models/provider.ts
  DEPENDED ON BY: lib/agents/orchestrator.ts (scheduled every 30 min)

lib/agents/social-media-agent.ts
  WHAT: Drafts social content (LinkedIn posts, etc.) from project brief and recent wins.
        Output goes to approvals table with channel='linkedin_post'. No browser.
  DEPENDS ON: lib/models/provider.ts, lib/db/client.ts
  DEPENDED ON BY: lib/agents/orchestrator.ts
```

#### Browser

```
lib/browser/controller.ts
  WHAT: Playwright wrapper. launch(), newPage(), setViewport(). Returns Page object.
        Reads BROWSER_HEADLESS env var. Handles timeout config.
  DEPENDS ON: playwright npm package
  DEPENDED ON BY: lib/agents/browser-agent.ts only. No other file touches Playwright directly.
  TO CHANGE BROWSER CONFIG: edit here. One place for all browser settings.

lib/browser/screenshot.ts
  WHAT: Takes screenshot from Playwright Page. Saves to SCREENSHOT_PATH (env var, default ./screenshots).
        Returns file path string. Optionally resizes for smaller payloads.
  DEPENDS ON: sharp (optional, for resize), filesystem
  DEPENDED ON BY: lib/agents/browser-agent.ts
```

#### Database

```
lib/db/client.ts
  WHAT: PostgreSQL client singleton. Exports db.query(). Uses pg (node-postgres).
        Reads DATABASE_URL from env. Connection pooling configured here.
  DEPENDS ON: pg npm package, DATABASE_URL env var
  DEPENDED ON BY: every agent file, every API route that touches the DB
  TO SWITCH TO DRIZZLE OR PRISMA: replace this file. Update all callers (search for db.query).

lib/db/schema.ts
  WHAT: TypeScript type definitions mirroring every DB table. Used for type-safety in queries.
        Not an ORM — purely types. Kept in sync with migrations manually.
  DEPENDS ON: nothing
  DEPENDED ON BY: type annotations across lib/ and app/api/

lib/db/migrations/001_initial.sql
  WHAT: Creates all tables from scratch. Run once. Idempotent (CREATE TABLE IF NOT EXISTS).
  TABLES: model_configs, projects, agents, agent_logs, leads, approvals, campaigns, settings
  TO ADD A COLUMN: create a new migration file (002_...) — never edit existing migrations.
  TO ADD A TABLE: create a new migration file.
```

#### Queue

```
lib/queue/agent-queue.ts
  WHAT: Sequential task queue. Ensures only one browser agent runs at a time (shared resource).
        Uses p-queue with concurrency:1 for browser tasks, concurrency:3 for LLM-only tasks.
  DEPENDS ON: p-queue npm package
  DEPENDED ON BY: app/api/agents/run/route.ts, app/api/browser/run/route.ts
  TO ALLOW PARALLEL BROWSERS: increase concurrency here (requires multiple browser instances).
```

#### Email

```
lib/email/sender.ts
  WHAT: Nodemailer wrapper. sendEmail(to, subject, body). Reads SMTP config from DB settings table.
        Validates that approval.status === 'approved' before sending (safety check, belt-and-suspenders).
  DEPENDS ON: nodemailer npm package, lib/db/client.ts
  DEPENDED ON BY: app/api/outreach/send/route.ts only. Nothing else sends email.
```

---

### COMPONENTS  `components/`

```
components/agents/AgentCard.tsx
  WHAT: Single agent card. Shows: name, role, status badge, current task, progress bar.
        Subscribes to SSE stream for live updates.
  DEPENDS ON: components/ui/StatusDot, components/ui/Badge

components/agents/AgentGrid.tsx
  WHAT: Grid of AgentCards. Configurable count (dashboard shows 4, office shows all).
  DEPENDS ON: components/agents/AgentCard

components/agents/BrowserStream.tsx
  WHAT: Shows live screenshots from an active browser agent. Polls /screenshots/{agentId}/latest
        every 1500ms when agent status is 'browsing'. Stops polling otherwise.
  DEPENDS ON: lib/browser/screenshot.ts (reads latest screenshot path)

components/agents/ActivityFeed.tsx
  WHAT: Scrolling list of recent agent_logs entries. Updates via SSE stream.
  DEPENDS ON: SSE data from /api/agents/stream

components/approval/ApprovalItem.tsx
  WHAT: Single approval card. Lead info, editable textarea for subject/body, three action buttons.
        Approve calls /api/outreach/send. Reject patches approval status in DB.
  DEPENDS ON: components/ui/Button, components/ui/Badge

components/approval/ApprovalQueue.tsx
  WHAT: Ordered list of ApprovalItems. Fetches pending approvals from DB on mount and after each action.
  DEPENDS ON: components/approval/ApprovalItem

components/leads/LeadTable.tsx
  WHAT: Sortable, filterable table. Columns: company, contact, city, status, source, actions.
        Row actions: Generate message, Enrich, Mark qualified, Reject.
  DEPENDS ON: components/ui/*

components/leads/ScrapeModal.tsx
  WHAT: Modal dialog. Input: URL + free-text instruction. On submit: POST /api/leads/scrape.
        Shows agent status while scraping runs.
  DEPENDS ON: components/ui/*, /api/leads/scrape

components/map/CodebaseMap.tsx
  WHAT: Renders AIKO_MAP.md as a searchable, syntax-highlighted document inside the app.
        Fetches from /api/map/content. Includes a search bar to jump to any file path.
        This is the structural codebase map — NOT a geographic map.
  DEPENDS ON: /api/map/content route, markdown renderer (remark or marked)

components/ui/Button.tsx     — base button component
components/ui/Badge.tsx      — status/label pill
components/ui/Card.tsx       — surface card wrapper
components/ui/StatusDot.tsx  — 5px animated dot, color by status
```

---

### DOCUMENTATION FILES (project root)

```
AIKO_MAP.md                  ← THIS FILE. Codebase structure. AI reads this first.
AIKO_FUNCTIONS.md            ← What AÏKO can do. Written for humans and AIs. Update when adding features.
```

---

## HOW TO USE THIS MAP

### "I need to add a new agent"
1. Create `lib/agents/my-new-agent.ts` — follow the pattern of any existing agent file
2. Import and add a routing case in `lib/agents/orchestrator.ts`
3. Add a row to the `agents` table in the DB (via a new migration)
4. Add the agent card to `app/(dashboard)/office/page.tsx`
5. Update `AIKO_FUNCTIONS.md` with the new capability
6. Update this file (`AIKO_MAP.md`) with the new file entry

### "I need to change how messages are written"
→ Edit `lib/agents/copywriting-agent.ts` — specifically the system prompt and user prompt strings.
→ If adding a new channel type, also update `app/api/outreach/send/route.ts`.

### "I need to add a new screen"
1. Create `app/(dashboard)/my-screen/page.tsx`
2. Add the nav item to `app/layout.tsx` sidebar
3. Create any needed components in `components/`
4. Add any needed API routes in `app/api/`
5. Update this file.

### "I need to change what data is stored about leads"
1. Create `lib/db/migrations/00X_add_lead_field.sql` — ALTER TABLE leads ADD COLUMN ...
2. Update `lib/db/schema.ts` TypeScript types
3. Update `lib/agents/research-agent.ts` INSERT query
4. Update `components/leads/LeadTable.tsx` to show the new field
5. Update this file.

### "I need to change which LLM is used"
→ The user changes it in Settings UI — it writes to `model_configs` table.
→ `lib/models/config.ts` reads from there.
→ `lib/models/provider.ts` executes the call.
→ No code change needed for model switching.

### "Something is broken in the browser agent"
→ Read `lib/agents/browser-agent.ts` — specifically BROWSER_SYSTEM_PROMPT and the action switch block.
→ Check `lib/browser/controller.ts` for Playwright config.
→ Check `lib/browser/screenshot.ts` for screenshot issues.
→ Agent logs are in the `agent_logs` table — query for action='error'.

### "I need to add a new send channel (e.g. WhatsApp)"
1. Add 'whatsapp' to the channel type in `lib/db/schema.ts`
2. Add send logic in `lib/email/sender.ts` (or create `lib/channels/whatsapp.ts`)
3. Add the case in `app/api/outreach/send/route.ts`
4. Update `lib/agents/copywriting-agent.ts` word limit for the new channel
5. Update `AIKO_FUNCTIONS.md`
6. Update this file.

---

## INVARIANTS — RULES THAT MUST NEVER BREAK

These are checked before every change. If a proposed change violates one, stop and reconsider.

```
1. SEND GATE
   The only code path that sends any external message is app/api/outreach/send/route.ts.
   It checks approval.status === 'approved' before doing anything.
   No other file may send email, post to LinkedIn, or submit any form without going through this route.

2. LLM CALLS
   Every call to any LLM goes through lib/models/provider.ts callLLM().
   No agent file imports an LLM SDK directly.
   This is what makes model-swapping work.

3. BROWSER OWNERSHIP
   Only lib/agents/browser-agent.ts opens and closes Playwright browsers.
   No other file imports playwright directly.
   One browser per task. Browser closes in the finally{} block, always.

4. LOG EVERYTHING
   Every agent action inserts a row into agent_logs.
   The log is append-only. No UPDATE or DELETE on agent_logs.

5. MIGRATIONS ONLY FORWARD
   Never edit an existing migration file.
   To change the schema, create a new migration (002_, 003_, etc.).

6. MAP STAYS CURRENT
   When any file is added, removed, or significantly changed, update AIKO_MAP.md.
   When any capability is added or removed, update AIKO_FUNCTIONS.md.
   An outdated map is worse than no map.
```

---

## DEPENDENCY GRAPH (simplified)

```
app/api/* ──────────────────► lib/agents/orchestrator.ts
                                        │
              ┌─────────────────────────┼──────────────────────────┐
              ▼                         ▼                          ▼
    lib/agents/browser-agent   lib/agents/copywriting-agent   lib/agents/reporting-agent
              │                         │                          │
              ▼                         ▼                          ▼
    lib/browser/controller    lib/models/provider.ts ◄──── lib/models/config.ts
              │                                                     │
              ▼                                                     ▼
         Playwright                                        lib/db/client.ts
                                                                    │
                                                                    ▼
                                                              PostgreSQL
```

---

## VERSION HISTORY

```
v1.0  — Initial structure. 11 agents. 8 screens. PostgreSQL. SSE realtime. Docker Compose.
```

