# AÏKO — Functions Reference
## What this system can do. Updated every time a capability changes.
## Version: 1.0

---

## HOW TO READ THIS FILE

Each function entry answers:
- **What it does** — one sentence
- **How it works** — the mechanism
- **Input** — what triggers it
- **Output** — what it produces
- **Where in code** — exact file path
- **Constraints** — what it never does

---

## AGENT FUNCTIONS

---

### Browser Agent
**What:** Opens a real web browser and navigates any website by seeing screenshots and deciding actions.
**How:** Playwright launches Chromium. Agent takes a screenshot, sends it to a multimodal LLM, receives a JSON action (click/type/scroll/navigate/extract/done/stuck), executes it, repeats. Maximum 60 steps per task.
**Input:** Free-text instruction + agentId + projectId + model config
**Output:** Extracted data (JSON), action log in agent_logs table, screenshots saved to disk
**Code:** `lib/agents/browser-agent.ts`
**Constraints:** Closes browser after every task. Never persists a browser session. Stops and asks for help if stuck for 3 steps.

---

### Research Agent
**What:** Finds new leads by navigating directories, associations, and search engines.
**How:** Plans whether the task needs the browser. If yes, constructs an extraction instruction and delegates to Browser Agent. Parses returned data and inserts leads into the database.
**Input:** URL or search instruction + projectId
**Output:** New rows in the `leads` table
**Code:** `lib/agents/research-agent.ts`
**Constraints:** Only creates new leads. Never modifies existing ones.

---

### Lead Generation Agent
**What:** Enriches existing leads with missing contact data.
**How:** Visits each lead's company website via Browser Agent. Looks for email addresses, LinkedIn profiles, and decision-maker names. Updates the lead record.
**Input:** leadId + projectId
**Output:** Updated fields on an existing lead row
**Code:** `lib/agents/leadgen-agent.ts`
**Constraints:** Only updates. Never creates or deletes leads.

---

### Copywriting Agent
**What:** Writes personalised outreach messages for each lead.
**How:** Reads lead data and project brief from DB. Calls LLM with structured prompt. Parses JSON response containing subject + body. Calls Quality Agent for review. Inserts into approvals table.
**Input:** leadId + channel (email/linkedin/whatsapp/form) + projectId
**Output:** A new row in the `approvals` table with status='pending'
**Code:** `lib/agents/copywriting-agent.ts`
**Constraints:** Never sends. Output always goes to approvals table. Word limits enforced per channel: email=120, linkedin=60, whatsapp=50.

---

### Quality Agent
**What:** Reviews every Copywriting Agent output before it reaches the Approval Center.
**How:** Receives the draft message. Checks for: spam trigger words, inappropriate tone, GDPR-sensitive language, factual claims not supported by project data. Returns pass/fail with reason.
**Input:** approvalId (pending message to review)
**Output:** Approval status set to 'quality_passed' or 'quality_rejected' with reason logged
**Code:** `lib/agents/quality-agent.ts`
**Constraints:** Runs automatically after every Copywriting Agent output. Cannot be skipped.

---

### Outreach Agent
**What:** Monitors sent messages for replies and classifies them.
**How:** Uses Browser Agent in read-only mode to check configured inbox (Gmail, LinkedIn). Identifies new replies to AÏKO-sent messages. Classifies as positive/negative/neutral. Updates lead status.
**Input:** projectId (runs on schedule)
**Output:** Updated lead statuses, new agent_logs entries, escalation to Sales Validation on positive replies
**Code:** `lib/agents/outreach-agent.ts`
**Constraints:** Read-only. Never opens compose, reply, or any write interface in the browser.

---

### Sales Validation Agent
**What:** Scores reply intent and qualifies leads.
**How:** Receives reply text. Calls LLM to score intent 1–10. Maps score to status: 1–3=cold, 4–6=warm, 7–10=hot/qualified. Updates lead status. Triggers Copywriting Agent for follow-up if score >= 7.
**Input:** leadId + reply text
**Output:** Updated lead.status, new approval queued if score >= 7
**Code:** `lib/agents/sales-validation-agent.ts`
**Constraints:** Never contacts leads directly. Scoring only.

---

### Strategy Agent
**What:** Generates ICP, messaging strategy, and channel priority from the project brief.
**How:** Reads project name, description, target market, and value prop. Calls LLM. Writes structured strategy JSON to projects.strategy column.
**Input:** projectId
**Output:** Updated projects.strategy JSONB field
**Code:** `lib/agents/strategy-agent.ts`
**Constraints:** No browser. Triggered on project creation and on manual re-run from Settings.

---

### Social Media Agent
**What:** Drafts social content for review.
**How:** Reads project brief and recent wins from DB. Generates LinkedIn post or similar content. Sends to Approval Center with channel='social'.
**Input:** projectId + platform
**Output:** New row in approvals table, channel='social'
**Code:** `lib/agents/social-media-agent.ts`
**Constraints:** No browser. No posting without approval.

---

### Reporting Agent
**What:** Generates structured weekly and daily reports from database data.
**How:** Queries leads, approvals, campaigns, and agent_logs tables. Synthesises with LLM into a structured report with sections: summary, metrics, agent performance, recommendations.
**Input:** projectId (+ optional date range)
**Output:** Structured report JSON — displayed on Reports screen
**Code:** `lib/agents/reporting-agent.ts`
**Constraints:** Read-only DB access. No browser.

---

### CEO Agent
**What:** Reads reports and produces strategic recommendations. Coordinates other agents.
**How:** Reads latest Reporting Agent output. Calls LLM to analyse KPIs and produce recommendations. Updates projects.strategy. Runs every 30 minutes automatically.
**Input:** Automatic (scheduled) or manual trigger
**Output:** Updated project strategy, new recommendations in Reports screen
**Code:** `lib/agents/ceo-agent.ts`
**Constraints:** Does not execute tasks directly. Delegates via orchestrator.

---

### Project Manager Agent
**What:** Tracks sprint progress and flags blockers.
**How:** Reads agents table for stuck/error states. Reads campaign milestones. Writes summary to agent_logs. Alerts user of overdue tasks.
**Input:** Automatic (every 30 min)
**Output:** New entries in agent_logs, status updates on Dashboard
**Code:** `lib/agents/project-manager-agent.ts`
**Constraints:** No browser. Observation and reporting only.

---

## SYSTEM FUNCTIONS

---

### Approval Center
**What:** The mandatory gate for all external actions. Nothing is sent without passing through here.
**How:** All agent outputs that involve external contact land in the `approvals` table with status='pending'. User reviews, optionally edits, then approves or rejects. Only after approval does `app/api/outreach/send/route.ts` execute.
**Code:** `app/(dashboard)/approval/page.tsx` + `app/api/outreach/send/route.ts`
**Invariant:** The only code path that sends any message is the send route. No backdoor exists.

---

### SSE Realtime Stream
**What:** Delivers live agent state, logs, and lead data to all open screens without a page refresh.
**How:** Single GET endpoint at `/api/agents/stream`. Polls PostgreSQL every 1500ms. Emits JSON events with `{ type: 'state', agents, logs }`. All screens subscribe to this one stream.
**Code:** `app/api/agents/stream/route.ts`
**Note:** No WebSockets. No external pub/sub service. Falls back to 1.5s polling naturally.

---

### Model Router
**What:** Makes every agent work with any LLM without code changes.
**How:** Single `callLLM(config, messages, options)` function in `lib/models/provider.ts`. Uses OpenAI-compatible client. Config (baseURL, apiKey, model) is per-agent and stored in DB. User configures in Settings.
**Supported providers:** Ollama (local), OpenAI, Anthropic (via proxy), Mistral, Groq, LM Studio, any OpenAI-compatible endpoint.
**Code:** `lib/models/provider.ts` + `lib/models/config.ts`

---

### Email Sender
**What:** Sends approved email messages via the user's own SMTP server.
**How:** Nodemailer with SMTP credentials stored in DB settings table. Only fires after `approval.status === 'approved'` check.
**Code:** `lib/email/sender.ts`
**Note:** No SaaS email service required. Works with Gmail, Fastmail, Zoho, or any SMTP.

---

### Activity Log
**What:** Immutable record of every agent action.
**How:** Every agent action inserts a row into `agent_logs`. Never updated or deleted. Queryable from Reports screen and Live Office.
**Code:** `lib/db/migrations/001_initial.sql` (table definition) — written by every agent file.

---

### Codebase Map
**What:** Structural documentation of the entire codebase, readable by AI agents and developers.
**How:** `AIKO_MAP.md` in project root. Contains every file, its purpose, dependencies, and change instructions. `AIKO_FUNCTIONS.md` (this file) lists all capabilities. Both are rendered in the app at `/map` and `/functions`.
**Rule:** Must be updated whenever a file is added, removed, or significantly changed.

---

### Self-Host (Docker Compose)
**What:** Runs the entire system with one command on any machine.
**How:** `docker compose up -d` starts the Next.js app and PostgreSQL. Playwright Chromium is installed in the Docker image. No external services required unless a remote model is configured.
**Code:** `docker-compose.yml` + `Dockerfile`

---

## WHAT AÏKO DOES NOT DO

- It does not send any message without user approval
- It does not store model API keys in environment variables or source code
- It does not run multiple browser sessions in parallel (MVP: sequential queue)
- It does not scrape LinkedIn aggressively (read-only, human-pace)
- It does not act outside the marketing domain
- It does not modify agent_logs (append-only)
- It does not edit existing database migrations

---

## VERSION HISTORY

```
v1.0  — 11 agents, 5 system functions, Approval Center, SSE stream, Docker self-host
```
