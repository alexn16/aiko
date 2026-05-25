# AÏKO — AI Marketing Operating System

AÏKO is a self-hosted, agent-based operating system for marketing execution.
It coordinates specialized AI agents for lead research, enrichment, copy generation,
outreach monitoring, qualification, reporting, and strategy — with a mandatory human approval gate before external sends.

## Default interface: CEO Chat

**CEO Chat is the primary AÏKO interface.** When you open the app, you land directly in the CEO Chat at `/ceo`.

AÏKO behaves like a ChatGPT-style CEO for an AI marketing company. You speak naturally to the CEO, and it coordinates projects, assigns Project Managers, builds project memory, and orchestrates agents — all through conversation.

**The app requires a real connected AI provider before CEO Chat works.**
On first launch, AÏKO shows the setup screen where you connect your AI brain (OpenAI API, Anthropic API, Ollama, or a custom endpoint). The CEO Chat is disabled until a provider is connected and tested.

Example exchange:

> **You:** Work on Foreman.
>
> **AÏKO CEO:** Understood. I'll open Foreman as a dedicated marketing project. I'm assigning Kenji as Project Manager — Foreman is a B2B industrial product and needs a structured outbound strategy. Kenji will coordinate Research, Lead Generation, Copywriting, and Outreach. The first step is to define Foreman's target buyer profile and campaign angles. I'll prepare the workspace now.

## Architecture principle: Web Operator first

AÏKO does not build separate native integrations for every platform. All external work is performed by the **Web Operator** — a browser automation layer powered by Playwright. Agents think and plan internally, then delegate real-world actions to the Web Operator, which operates websites like a human.

Native APIs (SMTP, Gmail API, LinkedIn API, CRM APIs) are not part of the core architecture. The Web Operator handles:
- Web search (via browser)
- Reading websites
- Preparing email drafts in Gmail/Outlook web
- LinkedIn interaction
- Form filling and submission
- Any web-based tool or platform

This means AÏKO can work with any platform that has a web interface — without requiring a separate API integration for each one.

## What AÏKO is

- **Chat-first**: the CEO Chat is the home screen, not a dashboard.
- **Marketing-only**: built for outreach, validation, growth, and campaign operations.
- **Agent-based**: multiple focused agents coordinated by a CEO layer.
- **Always-running workflow**: live status and activity stream across the dashboard.
- **Human-supervised**: outbound actions route through the Approval Center.
- **Provider-agnostic**: connects to OpenAI, Anthropic, Ollama, or any compatible endpoint.
- **Self-hostable**: Next.js + PostgreSQL + Playwright via Docker Compose.

## AÏKO Brain — Provider Catalog

AÏKO uses an OpenClaw-style provider catalog (`lib/ai/provider-catalog.ts`) to manage AI brains:

- **AÏKO Brain** = selectable AI provider (any catalog entry)
- **AÏKO Hands** = Web Operators (Playwright browser automation)
- **AÏKO Permissions** = Operating Mode (research / full-access / locked)

The catalog covers 26 providers across 6 categories:
- **Subscription / OAuth**: ChatGPT, Claude direct (OAuth flow not yet built)
- **Direct API**: OpenAI, Anthropic, Gemini, Mistral, OpenRouter, Qwen, Moonshot, MiniMax, StepFun, BytePlus, DeepInfra, Fireworks, Chutes, Synthetic
- **Gateway**: OpenRouter, Vercel AI Gateway, Cloudflare AI Gateway, Amazon Bedrock (planned), Alibaba Model Studio (planned), Qianfan (planned)
- **Local**: Ollama
- **Custom**: OpenAI-compatible endpoint, Anthropic-compatible endpoint
- **Future / Specialized**: ComfyUI, fal, Runway (not yet integrated)

The router dispatches based on `compatibility` field (openai_compatible → openai-compat adapter, anthropic_messages → Anthropic SDK). Not every catalog entry has a fully implemented adapter; unsupported entries show as "planned" or "not available in this build".

Each provider is tested before being activated. Role assignments let you choose which AI brain powers each agent role (CEO, Research, Copywriting, Review, QA, Project Manager, Local Fallback).

## Product surfaces

- `/ceo` — **CEO Chat** (default home). Speak to the CEO, create projects, coordinate the company.
- `/connect-ai` — Connect and manage AI providers, assign roles.
- `/dashboard` — operational overview (metrics, active agents, activity)
- `/office` — Live Office (run agents, monitor activity, browser stream)
- `/leads` — lead table, scraping, enrichment
- `/approval` — approval queue (the sending gate)
- `/campaigns` — campaign tracking
- `/reports` — generated performance summaries
- `/tools` — Tool Connections (configure web search, website reader, email)
- `/tool-runs` — Tool execution log
- `/operator` — Web Operator control room (single-session view, filter by operator)
- `/operators` — Web Operator fleet management (all named operators)
- `/mode` — Operating Mode settings and audit log
- `/settings` — SMTP and legacy model configuration
- `/functions` — in-app system documentation
- `/system` — Capability map, strategy checker, and improvement proposals
- `/projects` — multi-project overview
- `/projects/[id]` — per-project workspace (memory, agents, activity)

## CEO Chat vs Project Manager Chat

AÏKO has two levels of AI conversation:

**CEO Chat (`/ceo`)**
Global company-level brain. The CEO understands all projects, all PMs, and the company's overall priorities. Use it to create projects, assign PMs, change strategy, run reviews, and manage the company as a whole.

**Project Manager Chat (`/projects/[id]` → PM Chat tab)**
Project-specific execution brain. Each assigned PM (Kenji, Mara, or Sven) manages only their project. Use the PM Chat to coordinate execution: campaigns, lead strategy, outreach drafts, project memory, blockers, and upward reports to CEO.

The PM has full context about their project: target market, value proposition, project memory, assigned agents, recent activity, and pending approvals. They coordinate agents operationally — never sending external messages without client approval.

Each project workspace has tabbed views:
- **Overview** — stats, memory, agents, activity summary + "Open PM Chat" button
- **PM Chat** — direct conversation with the assigned PM
- **Reports** — PM progress reports
- **Agents** — all agents for this project
- **Activity** — full activity log

## CEO Multi-Project System

AÏKO has a global CEO layer that operates across all projects.

**CEO Chat (`/ceo` → Chat tab)**
The CEO understands all active projects, assigned Project Managers (Kenji, Mara, Sven), and company memory. Issue natural-language commands and the CEO executes structured actions: create projects, assign PMs, update priorities, generate pipeline maps. The response is conversational — not raw JSON or a log output.

**CEO Reviews (`/ceo` → Reviews tab)**
The CEO can perform a full company review at any time. Click "Run review" on the CEO page to trigger it. The review:
- Inspects every active project for blockers, stale activity, missing PMs, pending approvals, and undefined next steps
- Generates a structured executive memo with findings per project and prioritised recommended actions
- Updates company memory with the latest summary and priorities
- Saves a full history of all past reviews

Reviews are read-only analysis — no emails sent, no approvals changed.

## Internal agent communication

AÏKO has a structured internal messaging layer so agents can coordinate with each other across the reporting chain — without sending anything externally.

**Message types:**
- `instruction` — CEO or PM issuing a task to a subordinate
- `report` — PM or agent reporting status upward
- `handoff` — passing work between agents (e.g. Research → Lead Gen)
- `blocker` — flagging a blocked item for attention
- `update` — general status update
- `approval_request` — requesting a human decision

**How it works:**
- All messages are stored in `agent_messages` with `from_role`, `to_role`, `message_type`, `subject`, `content`, and `status`
- `status` progresses: `sent` → `acknowledged` → `resolved`
- Messages are scoped to a project (`project_id`) or global (company-wide)
- The CEO automatically sends an instruction to the assigned PM whenever a project is created
- PMs automatically report upward to the CEO when generating progress reports
- CEO reviews automatically generate follow-up instructions for recommended actions

**UI surfaces:**
- **Project workspace → Comms tab** — all internal messages for that project; compose new messages
- **Live Office** — global view of all agent communications across every project

**API:**
- `GET /api/agent-messages` — list messages (filter by project_id, from_role, to_role, message_type, status)
- `POST /api/agent-messages` — create a message
- `PATCH /api/agent-messages/[id]` — update status (acknowledged/resolved)
- `POST /api/projects/[id]/agent-discussion` — project-scoped shorthand

**Library (`lib/agents/internal-communication.ts`):**
- `sendAgentMessage()` — low-level send
- `createInstruction()` — typed helper for instructions
- `createManagerReport()` — typed helper for PM → CEO reports
- `createHandoff()` — typed helper for agent-to-agent handoffs
- `createBlocker()` — typed helper for flagging blockers

## Agent task tracking

Every internal instruction, handoff, or approval request automatically creates a task. Tasks track what each agent role is working on — separate from external outreach.

**Statuses:** planned → in_progress → waiting / review / blocked → completed / cancelled

**Task types:** research, strategy, lead_generation, copywriting, qa_review, outreach_preparation, report, approval_preparation, project_map, memory_update, client_update

**Priority:** low, normal, high, urgent

**Auto-created from messages:**
- `instruction` → planned task for recipient
- `handoff` → planned task for recipient
- `approval_request` → review task for recipient
- `blocker` → blocked task for sender

**UI surfaces:**
- **Project workspace → Tasks tab** — project-scoped task list with action buttons
- **Live Office** — global task view across all projects

**API:**
- `GET /api/agent-tasks` — list tasks (filter by project_id, owner_role, status, task_type)
- `POST /api/agent-tasks` — create task
- `PATCH /api/agent-tasks/[id]` — update status, priority, output

**Safety:** Tasks are internal only. No external messages are sent when tasks are created or completed. Outreach tasks only prepare drafts — sending still requires approval.

## Task execution outputs

Agents produce visible deliverables when executing tasks. Outputs are stored internally and never sent externally without approval.

**Output types:** research_brief, lead_list, outreach_draft, qa_review, report, campaign_proposal, project_map_update, memory_update, approval_item, note

**Output statuses:** draft → ready → reviewed → approved / rejected / archived

**How outputs are generated:**
- Click "Generate output" on any task card — the assigned agent AI generates an appropriate deliverable
- Output type is inferred from task_type (research → research_brief, copywriting → outreach_draft, etc.)
- External-facing outputs (outreach_draft, approval_item) automatically require approval

**UI surfaces:**
- **Task cards** — show output count, "Generate output" button, inline output expand
- **Project workspace → Outputs tab** — all outputs for the project
- **Live Office** — global outputs view with approval filter

**API:**
- `GET /api/task-outputs` — list outputs (filter by project_id, task_id, output_type, status)
- `POST /api/task-outputs` — create output manually
- `PATCH /api/task-outputs/[id]` — update status or content
- `POST /api/agent-tasks/[id]/generate-output` — generate AI output for a task

**Safety:** Generating outputs never sends external messages. Outreach drafts and approval items require explicit approval before any external action.

## Approval Center (`/approvals`)

External-facing outputs (outreach drafts, campaign proposals, approval items) automatically create entries in the Approval Center when generated.

**Flow:**
1. Agent generates an output with `requires_approval = true`
2. An approval item is created automatically in `approval_items`
3. Client reviews the item in the Approval Center
4. Client can approve, request changes, or reject

**On approve:** linked output marked approved, PM notified via internal message
**On reject:** linked output marked rejected, owner agent notified
**On changes requested:** output reset to draft, owner agent receives a new revision task

**UI:** `/approvals` — full approval queue with filters and inline editing

**API:**
- `GET /api/approval-items` — list items (filter by project_id, status, item_type)
- `POST /api/approval-items` — create manually
- `PATCH /api/approval-items/[id]` — approve / reject / request changes

**Safety:** Approving an item is internal permission only. It does not send any external emails or messages. External sends remain a separate explicit action.

## Campaign Builder (`/campaigns`)

Approved outputs and approval items can be organized into structured marketing campaigns.

**Flow:**
1. Outputs and approval items are approved in the Approval Center
2. PM builds a campaign manually or generates one via AI from all approved assets
3. Campaign items are sequenced and reviewed
4. Campaign is approved internally
5. Launching/sending remains a future explicit action

**Campaign statuses:** draft → ready_for_review → approved → active → paused → completed → archived

**Channels:** email, linkedin, instagram, content, mixed, manual

**AI generation:** `POST /api/campaigns/generate` — builds a full campaign plan from all approved project outputs

**UI:**
- `/campaigns` — campaign list with filters and status controls
- `/campaigns/[id]` — campaign detail with sequenced items
- **Project workspace → Campaigns tab** — project-scoped campaign management

**API:**
- `GET /api/campaigns` — list campaigns
- `POST /api/campaigns` — create campaign
- `GET /api/campaigns/[id]` — campaign detail with items
- `PATCH /api/campaigns/[id]` — update campaign
- `POST /api/campaigns/[id]/items` — add approved output/approval item
- `PATCH /api/campaigns/[id]/items/[itemId]` — update item
- `POST /api/campaigns/generate` — AI-generate campaign from approved assets

**Safety:** Campaign approval is internal only. No emails or messages are sent. Launching externally requires a separate, future explicit action.

## Campaign Launch Readiness

Before any external sending exists, AÏKO evaluates whether a campaign is ready to launch.

**This is not sending.** It is a safety and readiness checklist.

**Checks performed:**
- Campaign has objective, audience, channel, strategy, success metric
- Campaign has at least one item
- No campaign items are rejected
- All external-facing items linked to the campaign are approved
- Campaign is not archived
- Project has an assigned PM
- Project has memory and map available

**Readiness score:** 0–100 (required checks = 70%, optional = 30%)

**Statuses:** not_ready | needs_attention | ready | blocked

**UI:** Launch Readiness panel on campaign detail page (`/campaigns/[id]`)

**API:**
- `GET /api/campaigns/[id]/launch-checks` — list recent checks
- `POST /api/campaigns/[id]/launch-checks` — run a new check

**Safety:** Running a readiness check does not launch or send anything externally. A future explicit launch/send step will be added separately.

## System Capabilities & Self-Improvement

AÏKO can identify when a marketing strategy requires capabilities it doesn't have. It creates structured improvement proposals — but never silently modifies itself.

### Capability map
Every AÏKO feature is tracked as a `system_capability` with a status: available, partial, missing, planned, or blocked. Categories: research, leads, outreach, email, browser, approvals, reporting, automation, integrations.

**Currently available:** CEO Chat, PM Chat, Website Reader, Web Operator, Lead Capture, Lead Enrichment, Task Tracking, Task Outputs, Approval Center, Campaign Builder, Launch Readiness, Operating Modes, Reporting, CEO Reviews, PM Reports

**Currently missing/partial:** Email Sending, Reply Tracking, CRM Sync, Calendar Booking, LinkedIn Operator (partial), Web Search (partial — needs API key)

### Strategy capability check

The CEO automatically checks capabilities when a strategy is described. If gaps exist:
1. CEO explains what's missing in plain language
2. A System Improvement Proposal is created with `status = draft`
3. Proposal includes an AI-generated implementation prompt for the developer
4. User reviews and approves the proposal
5. Developer applies the implementation

### Safety
- AÏKO never edits its own code automatically
- No silent migrations or deployments
- Every system change is proposed, reviewed, and logged
- The implementation prompt is a plan — a human or AI developer applies it

**UI:** `/system` — Capability map, strategy checker, and improvement proposals

**API:**
- `GET /api/system/capabilities` — list all capabilities
- `POST /api/system/check-strategy` — check a strategy against current capabilities
- `GET /api/system/improvements` — list proposals
- `POST /api/system/improvements` — create a proposal
- `PATCH /api/system/improvements/[id]` — approve/reject

## Core architecture

- **Frontend**: Next.js App Router (`app/`)
- **API layer**: route handlers under `app/api/`
- **Agent layer**: `lib/agents/` + `lib/agents/orchestrator.ts`
- **AI router**: `lib/ai/router.ts` — universal `callAI()` / `streamAI()` entry point
- **Provider adapters**: `lib/ai/providers/` — OpenAI-compatible and Anthropic SDK
- **Provider DB**: `provider_connections` + `ai_role_assignments` tables
- **Realtime updates**: SSE from `/api/agents/stream`
- **Persistence**: PostgreSQL tables for projects, agents, leads, approvals, logs

## Operating Mode

AÏKO has three operating modes that control what agents are allowed to do. Mode is set globally and enforced across all agent actions.

### Read Only (default)
AÏKO can think, plan, read internal project data, and prepare suggestions.
- Generate outputs, tasks, reviews, reports, campaign plans
- Cannot browse the web or research external sites
- Cannot send emails or external messages

### Auto / Approval Required
AÏKO can browse the web, research leads, and prepare outreach drafts.
- Everything in Read Only
- Browse web, find leads, prepare email drafts
- Cannot send emails without client approval
- All outreach goes through the Approval Center first

### Full Access
AÏKO can send approved campaign emails and follow up within daily limits.
- Everything in Auto mode
- Send approved outreach automatically
- Auto-follow-up within configured limits
- Requires explicit confirmation to enable (`CONFIRM_FULL_ACCESS`)
- Daily send limit enforced (configurable)
- Full audit log of all actions
- Global pause button available at all times

### Safety controls
- **Pause button** — immediately halts all agent actions from any mode
- **Daily send limit** — caps outbound sends per day in Full Access
- **Audit log** — every action attempt is logged with result
- **Confirmation gate** — Full Access requires typing a confirmation token

**UI:** `/mode` — Operating Mode settings and audit log
**API:** `GET/PATCH /api/mode`, `GET /api/mode/log`

## Web Operator Agent (`/operator`)

The Web Operator is AÏKO's hands on the internet. Instead of building separate native API integrations for every service, the Web Operator can operate websites and web apps through a browser runtime.

**What the Web Operator can do (when runtime is connected):**
- Search the web and read results
- Open and read any public web page
- Fill forms and prepare drafts
- Open Gmail/Outlook web and prepare email drafts
- Use LinkedIn, CRMs, and any web app through the browser
- Copy data, download reports, navigate logged-in sites

**Operating Mode controls what it can do:**
- **Read Only** — browse_web blocked; no web automation
- **Auto / Approval Required** — can browse and prepare; stops before sending/submitting and requests approval
- **Full Access** — can perform approved actions within daily limits

**Dangerous actions always require approval** unless explicitly pre-approved:
send_email, submit_form, post_publicly, download_file (in auto mode)

**Browser runtime:** The data model, API, and approval flow are active now. Browser execution requires a Playwright runtime. When connected, actions execute. When not connected, all requests are logged and return a clear "runtime not configured" message.

**UI:** `/operator` — Web Operator control room (session, actions, pending approvals, runtime status)

**API:**
- `POST /api/web-operator/session` — start a session
- `POST /api/web-operator/action` — request an action
- `GET /api/web-operator/actions` — action log
- `POST /api/web-operator/approve-action` — approve a pending browser action
- `GET /api/web-operator/status` — current status

**Safety:** Every action is logged. Risky actions create approval items. The global pause button stops all operator actions immediately.

### Lead extraction

When a Web Operator completes a search or reads a website, AÏKO automatically extracts structured lead candidates using AI analysis.

**What is extracted:** company name, website, location, category, contact details (only if visible in source), relevance reason, confidence score

**What is never invented:** email addresses, phone numbers, LinkedIn URLs — these are only included if found in the actual source text

**Lead status flow:** discovered → needs_review → approved / rejected → contacted → replied → interested / not_interested

**Auto-extraction:** Search and read_page actions with a project context automatically trigger lead extraction in the background.

**Manual extraction:** "Extract leads" button on operator action cards, or via `POST /api/leads/extract`

**UI:**
- `/leads` — company-wide lead management with status filters and approval workflow
- **Project workspace → Leads tab** — project-scoped lead list with extract and manual add

**Safety:** Leads must be reviewed before any outreach. Contact is never automated without explicit approval.

### Agent delegation

Agents do not browse directly — they delegate to the Web Operator:

```
Research Agent → "Search parking managers in Coruña" → Web Operator → Playwright → results saved as output
PM Agent → "Research Foreman buyers" → Web Operator → search + read pages → research brief output
Outreach Agent → "Prepare Gmail draft" → Web Operator → create_email_draft → approval if needed
```

The CEO and PM chat automatically detect web research intent and delegate to the Web Operator. Delegation results appear as action chips in the chat interface.

**Delegation API:** `POST /api/web-operator/delegate`
```json
{
  "requestedByRole": "Research Agent",
  "actionType": "search",
  "query": "parking garage managers Coruña Spain",
  "projectId": "...",
  "instruction": "Find companies managing parking facilities in Coruña"
}
```

**`lib/web-operator/delegation.ts`:** `delegateToWebOperator`, `delegateSearch`, `delegateReadWebsite`, `delegateEmailDraft`, `delegateExternalAction`

### Multiple operators

AÏKO supports multiple named Web Operators running in parallel, each with an isolated browser context (separate cookies, sessions, and storage state).

**Examples:**
- Kevin — dedicated to Gmail and email outreach
- Hana — researching companies and reading websites
- Default — general-purpose browser tasks

Name an operator in CEO Chat or PM Chat to route tasks to them:
> "Kevin, open Gmail."
> "Hana, research parking management companies in Coruña."
> "Ask Kevin to search for leads."

Each operator's browser profile is isolated — cookies and login sessions never mix between operators. Profiles are persisted in `.operator-profiles/` at the project root.

### Operator memory

Each operator maintains memory across instructions:
- **current_goal** — what the operator is working toward
- **current_workflow** — active context (gmail, research, etc.)
- **last_instruction** — most recent task
- **requires_user_input** — true when operator is waiting for login, CAPTCHA, or verification
- **waiting_reason** — explanation of what the operator needs

### Live supervision and manual takeover

When a Web Operator encounters login, CAPTCHA, verification, or security prompts, it pauses automatically and sets `requires_user_input = true`.

**Operator detail page:** `/operators/[id]` — see current state, latest screenshot, pending action, and take control.

**Manual takeover flow:**
1. Operator pauses with "Waiting for user input" notice
2. User opens the operator browser window and completes login/CAPTCHA manually
3. User clicks "Mark login completed" in AÏKO
4. AÏKO verifies the login state via browser detection
5. If confirmed: operator resumes the pending workflow automatically

**CEO Chat control commands:**
- `"Kevin is logged in now"` → marks login complete, resumes pending workflow
- `"Kevin, continue"` → resumes workflow
- `"Kevin, stop"` → pauses operator
- `"Clear Kevin's workflow"` → clears all workflow memory

**Safety:** AÏKO never automates CAPTCHA solving, phone verification bypass, or login credential submission. These always require direct user action.

### Gmail browser workflow

The Web Operator can operate Gmail through the browser — no Gmail API required.

**Supported actions:** `open_gmail` → `detect_gmail_login` → `create_email_draft` → `fill_gmail_to` → `fill_gmail_subject` → `fill_gmail_body` → `send_gmail_draft`

**Login:** If Gmail is not logged in, the operator stops and sets `requires_user_input = true`. The user must log in manually — the operator never bypasses login, CAPTCHA, or phone verification.

**Sending:** `send_gmail_draft` requires Full Access mode. In Auto/Approval mode, sending stops and creates an approval item.

**Example flow:**
> "Kevin, open Gmail." → Kevin opens mail.google.com in his isolated browser
> "Kevin, prepare an email to maria@company.com about ALB Parking." → Kevin composes the draft
> "Kevin, send it." → (Full Access) Kevin clicks Send | (Auto mode) Approval item created

**UI:** `/operators` — manage all operators, view their status, screenshots, and actions

**API:**
- `GET /api/web-operators` — list all operators
- `POST /api/web-operators` — create a new operator `{ name, role?, project_id? }`
- `GET /api/web-operators/[id]` — get operator status + recent actions
- `PATCH /api/web-operators/[id]` — update status, assign project

### Reliability features
- **Screenshots** — captured after every action (open_url, search, read_page, click, fill_form). Stored in `/public/screenshots/`. Sensitive pages (login, auth) are flagged and not displayed.
- **Session recovery** — if the browser crashes or closes, the Web Operator detects it and restarts the session automatically for safe actions.
- **Safe retry** — non-risky actions (search, open_url, read_page, copy_data) are retried once on failure.
- **Structured failure reasons** — `navigation_timeout`, `network_error`, `selector_not_found`, `browser_not_available`, `access_blocked`, `unknown_error`
- **Page state capture** — after each action, the current URL, page title, and a text preview are saved.
- **Operator isolation** — each named operator gets a dedicated `BrowserContext` with separate cookies, storage, and session state.

## Tool Connections (`/tools`)

AÏKO uses external tools to execute real research. Tools are only available in Auto/Approval Required or Full Access mode.

### Web Search
Search the internet for companies, leads, and market data. Supports:
- **Tavily** — recommended for structured search results
- **Brave Search API** — privacy-focused web search
- **SerpAPI** — Google search results via API

Configure at `/tools`. Add your API key — it is stored server-side only.

### Website Reader
Read and extract text content from public web pages. No API key required — uses plain fetch with a reasonable timeout and user agent. Available as long as Auto/Approval or Full Access mode is active.

### Tool Runs Log (`/tool-runs`)
Every tool execution is logged: agent role, project, tool, input, output, status, and the operating mode at time of execution. Blocked attempts are also logged.

**API:**
- `POST /api/tools/web-search` — run web search
- `POST /api/tools/read-website` — read a URL
- `GET /api/tool-runs` — list tool executions
- `GET /api/tool-connections` — list configured tools
- `POST /api/tool-connections/test` — test a connection

**Safety:** All tool executions check operating mode first. Read Only mode blocks all external tool use. Tool API keys are stored server-side and never returned to the client.

## Key safety invariant

AÏKO does **not** send outreach directly from generation.
Messages are generated into approvals and only sent after explicit approval through the send route.
In Read Only mode, no external sends are possible at all. In Auto / Approval Required mode, all outreach requires explicit client approval before sending.

## Local development

### Prerequisites

- Node.js 20+
- PostgreSQL

### Run

```bash
npm install
npm run dev
```

Open `http://localhost:3001` (or whichever port is configured).

On first launch with no provider configured, AÏKO shows the setup screen.

## Validation commands

Available scripts from `package.json`:

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`

## Self-hosting

Use Docker Compose to run the full stack (app + database):

```bash
docker compose up -d
```

## Documentation references

- `AIKO_MAP.md` — structural map of the system
- `AIKO_FUNCTIONS.md` — capability and behavior reference
