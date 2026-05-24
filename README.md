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

## What AÏKO is

- **Chat-first**: the CEO Chat is the home screen, not a dashboard.
- **Marketing-only**: built for outreach, validation, growth, and campaign operations.
- **Agent-based**: multiple focused agents coordinated by a CEO layer.
- **Always-running workflow**: live status and activity stream across the dashboard.
- **Human-supervised**: outbound actions route through the Approval Center.
- **Provider-agnostic**: connects to OpenAI, Anthropic, Ollama, or any compatible endpoint.
- **Self-hostable**: Next.js + PostgreSQL + Playwright via Docker Compose.

## AI Provider system

AÏKO requires at least one connected AI provider to operate. Providers are managed at `/connect-ai`.

**Supported providers:**
- OpenAI API (GPT-4o, GPT-4 Turbo, etc.)
- Anthropic API (Claude 3.5 Sonnet, Claude Opus, etc.)
- Local AI / Ollama (runs on your machine, no API key)
- Custom / OpenAI-compatible endpoint (OpenRouter, Groq, Together AI, etc.)

**Not yet supported (shown as unavailable):**
- Direct ChatGPT account connection (requires OAuth/MCP — not implemented in this build)
- Direct Claude account connection (requires OAuth/MCP — not implemented in this build)

Each provider is tested before being activated. Role assignments let you choose which AI brain powers each agent role (CEO, Research, Copywriting, Review, QA, Local Fallback).

## Product surfaces

- `/ceo` — **CEO Chat** (default home). Speak to the CEO, create projects, coordinate the company.
- `/connect-ai` — Connect and manage AI providers, assign roles.
- `/dashboard` — operational overview (metrics, active agents, activity)
- `/office` — Live Office (run agents, monitor activity, browser stream)
- `/leads` — lead table, scraping, enrichment
- `/approval` — approval queue (the sending gate)
- `/campaigns` — campaign tracking
- `/reports` — generated performance summaries
- `/mode` — Operating Mode settings and audit log
- `/settings` — SMTP and legacy model configuration
- `/functions` — in-app system documentation
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
