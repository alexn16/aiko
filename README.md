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

### Role assignments

Each AÏKO agent role can be assigned a specific AI brain:

| Role | Description | Recommended capability |
|------|-------------|----------------------|
| CEO | Strategic decisions | reasoning |
| Project Manager | Sprint tracking | reasoning |
| Research | Lead discovery | research |
| Copywriting | Outreach writing | writing |
| Review | Quality review | reasoning |
| QA | Quality checks | reasoning |
| Local Fallback | Offline fallback | local |

First-run setup is at `/setup`; advanced role/profile management remains at `/connect-ai`.

**How routing works**: Every active AI call goes through `callAI(role)` in `lib/ai/router.ts`, which resolves the provider from `ai_role_assignments` → `provider_connections`. The provider adapter (OpenAI-compatible or Anthropic SDK) is selected based on the `compatibility` column. See `AIKO_BRAIN_ROUTING_REPORT.md` for the full routing diagram and debug guide.

**Legacy note**: Some background agents (`copywriting-agent.ts`, `research-agent.ts`, etc.) still use `callLLM` from `lib/models/provider.ts` — these are not reachable from the current UI and are safe to ignore. `model_configs` is checked by the setup-state/router path as a final legacy fallback only. All active features (CEO Chat, CEO Reviews, PM Chat, Reports, Lead extraction, Outreach drafting) use `callAI(role)`.

**ChatGPT/Claude OAuth**: The catalog lists "ChatGPT direct" and "Claude direct" as OAuth-based entries. The OAuth flow is implemented — see `OPENAI_OAUTH_*` / `CLAUDE_OAUTH_*` env vars. In `AIKO_AUTH_MODE=optional`, the OAuth flow works without Google login. If env vars are missing, the cards show "not configured" and fall back to API key connections.

## Product surfaces

- `/ceo` — **CEO Chat** (default home). Speak to the CEO, create projects, coordinate the company.
- `/connect-ai` — Connect and manage AI providers, assign roles.
- `/dashboard` — operational overview (metrics, active agents, activity)
- `/office` — Live Office (run agents, monitor activity, browser stream)
- `/leads` — lead table, scraping, enrichment
- `/approvals` — **Approval Center** (canonical). Review and approve agent outputs before external use. `/approval` redirects here.
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

**Web Operator approval flow (resumable):**
1. A risky browser action (e.g. `send_gmail_draft`) is requested.
2. `runWebOperatorAction` creates an `approval_items` row (`item_type=web_operator_action`) and sets the action status to `waiting_approval`.
3. The item appears in the Approval Center (`/approvals`). The user reviews and clicks **Approve**.
4. Approval updates `approval_items.status=approved` and `web_operator_actions.status=approved`. **No action is executed automatically.**
5. The Approval Center shows a green **"▶ Resume operator action"** button. The user clicks it to execute.
6. `POST /api/web-operator/actions/[id]/resume` re-checks the operating mode at resume time, then executes via Playwright. The action is logged as `completed` or `failed`.
7. Every resume attempt is logged. Duplicate resumes are blocked (idempotent guard on `status=completed`).

Also visible from `/operators/[id]` — actions with `status=approved` show a **▶ Resume** button directly in the action log.

**API:**
- `GET /api/approval-items` — list items (filter by project_id, status, item_type)
- `POST /api/approval-items` — create manually
- `PATCH /api/approval-items/[id]` — approve / reject / request changes
- `POST /api/web-operator/actions/[id]/resume` — execute an approved-but-pending action

**Canonical data model:**
- Table: `approval_items` (see `lib/db/migrations/012_approval_items.sql`)
- Library: `lib/approvals.ts` (`createApprovalItem`, `updateApprovalStatus`, `getApprovalSummaryForProject`)
- API: `/api/approval-items` (GET, POST, PATCH /[id])

**Legacy (deprecated):** The `approvals` table and `/api/approvals` route exist for the outreach email "Approve & Send" flow. They are separate from `approval_items` and should not be mixed. Do not add new callers of `/api/approvals`.

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

## Execution Trails

Every business object that has Web Operator activity shows a chronological execution trail.

**What the trail shows:**
- Lead approved → Gmail draft prepared → Approval requested → Approved → Action resumed → Email sent (or failed/blocked)
- Each step is a separate, distinct event — approval ≠ send
- Screenshots visible only for non-sensitive actions
- Links back to Approval Center for pending/approved items

**Accessing trails:**
- **Lead detail** — expandable "▼ Execution trail" section in `ProjectLeadsPanel` (per lead)
- **Campaign detail** — "Execution trail" section in campaign view
- **API:** `GET /api/leads/[id]/execution-trail`, `GET /api/campaigns/[id]/execution-trail`, `GET /api/projects/[id]/execution-trail`

**Data model:** `web_operator_actions.lead_id` links operator actions to specific leads. The trail joins `web_operator_actions` ↔ `approval_items` via `approval_item_id`.

**Safety:**
- `approval_approved` event ≠ `email_sent` event — always separate
- Sensitive screenshots (`is_sensitive=true`) are never exposed
- "Approved — waiting for explicit resume." shown until resume is clicked

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

## Lead-to-Gmail outreach workflow

Approved leads with email addresses can become Gmail drafts through a named Web Operator:

1. Research → Lead extracted → Reviewed → **Approved**
2. Click "✉ Gmail draft" on an approved lead (or tell CEO "prepare outreach for approved leads")
3. AÏKO Copywriting brain generates subject + body based on lead context
4. Named Web Operator opens Gmail and creates the draft
5. Draft stays as draft — no auto-send
6. Send requires Full Access mode + manual confirmation

**Safety rules:**
- Only approved leads can be drafted
- Leads with no email: "Find contact" delegates website visit to Web Operator
- No SMTP, no Gmail API — browser only
- Daily send limits enforced by Operating Mode
- Single-lead outreach only — no bulk send in this version

## CEO Project Recall

The CEO Chat can answer questions about existing projects using real project data — no hallucination, no fake status.

**Trigger phrases** (detected automatically, before calling the full CEO agent):
- "What are we doing for ALB Parking?"
- "Summarize Foreman."
- "Status of ALB Parking"
- "Who is assigned to ALB Parking?"
- "Next step for ALB Parking"
- "Tell me about Foreman"
- "What has Kevin done for ALB Parking?"

**Data sources used** (read-only, no mutations):
- `projects` — name, goal, status
- `project_managers` — assigned PM and focus
- `project_memory` — notes, next steps, blockers
- `project_strategy_briefs` — objective, audience, channel, value prop, operator recommendation
- `project_launch_templates` — checklist progress and next uncompleted step
- `leads` — total, approved, contacted, replied counts
- `approval_items` + `web_operator_actions` — pending approvals and recent actions
- Execution trail events

**How it works:**
1. Command matches a recall pattern → extract project name hint
2. `findProjectByNameOrAlias()` searches by exact then partial match (case-insensitive)
3. `getProjectContext()` aggregates all data above into a single object
4. `getProjectExecutiveSummary()` formats it as compact plaintext
5. `getProjectNextStep()` derives the most actionable next step
6. `callAI(role:'ceo')` generates a concise conversational answer from the context
7. Response includes quick-navigation chips: Open project · First Campaign Flow · Leads

**If no project found:** Returns a clear message listing all active project names.

**Quick navigation chips** appear after recall answers:
- 📁 Open project → `/projects/[id]`
- ▶ First Campaign Flow → `/start-campaign?project_id=[id]`
- 👥 Leads → `/leads?project_id=[id]`

**APIs:**
- `GET /api/projects/[id]/context` — full project context + executive summary text + next step
- `GET /api/projects/search?q=` — find project by name (exact or partial)

**Safety:** Read-only. No mutations. No new tasks, operators, or projects created. If data is missing, the CEO says so explicitly.

## CEO Strategy Brief

When the CEO creates a new project, AÏKO automatically generates a **First Campaign Strategy Brief** using the CEO AI role. The brief is guidance only — it does not research, contact, send, or approve anything.

**What gets generated:**
- Campaign objective
- First target audience
- Suggested research prompt (pre-fills the research field in the First Campaign Flow)
- Recommended first channel (default: email)
- Value proposition
- Risks and assumptions
- Next actions
- **Recommended Web Operator** (see below)

**AI generation:** `generateStrategyBriefFromProject()` calls `callAI(role:'ceo')` to produce a JSON brief. If AI fails for any reason, a safe fallback brief is created from the project name and goal.

**Idempotency:** Only one brief per project. Additional calls return the existing brief.

**CEO Chat:** When a project is created, the `strategy_brief` summary (including recommended operator name) is included in the CEO response alongside `start_campaign_url`. If an operator is recommended, the CEO response text includes: `"I recommend <Name> as the first Web Operator for this campaign."`

**Project workspace:** Each project's Overview tab shows a "First Campaign Strategy Brief" strip with the objective, audience, channel, **operator recommendation**, value prop, and a "▶ Open First Campaign Flow" button. If no operator exists, a "create one" link is shown.

**`/start-campaign` page:** The strategy brief appears as a collapsible card above the launch checklist. The research prompt field (step 3) is pre-filled from the brief. Clicking "↓ Use in Step 3" copies the brief's research prompt into the field. **User edits are never overwritten automatically.** The recommended operator section shows the name, reason, and a "Use this operator" button that selects it in Step 2 without triggering any action.

**API:**
- `GET /api/projects/[id]/strategy-brief` — returns or creates a brief on demand; computes operator recommendation on-demand if not yet saved; returns `operator_available` boolean
- `PATCH /api/projects/[id]/strategy-brief` — update any field (editing `research_prompt` does NOT trigger research; setting `recommended_operator_id` does NOT trigger any Web Operator action)

**Safety:** Brief is guidance only. It never triggers automation, Web Operator actions, email sends, or any external interaction.

## Operator Recommendation

The Strategy Brief includes an operator recommendation computed at brief-generation time (and lazily on first GET if missed).

**Priority order:**
1. Operator already assigned to this project (`project_id` match) → "Kevin is already assigned to this project."
2. Any idle operator → "Kevin is idle and available for the first research task."
3. Any operator named/keyed "Default" → "Default Operator is available as a fallback."
4. Any other operator (not idle, not default) → mentions name and current status.
5. No operators exist → `operator_available=false`, reason: "No operator exists yet. Create one before running research."

**"Use this operator" button** in `/start-campaign`: calls `setSelectedOperator(id)` in local React state only. No API call, no browser session, no Web Operator action triggered. It simply pre-selects the operator in Step 2's dropdown.

## Project Launch Template

When the CEO creates a new project, AÏKO automatically creates a **First Campaign Launch Template** — a 9-step checklist that guides the user through the complete marketing loop.

**What gets created automatically:**
- `project_launch_templates` row with `status=draft`
- Default 9-item checklist: define audience → choose operator → research → review leads → draft → approve → resume → check replies → trail

**Checklist completion** is derived live from the summary data — no manual tracking required:
- Operator selected → ✓ Choose operator
- Leads exist → ✓ Research leads
- Approved leads → ✓ Review leads
- Completed draft action → ✓ Prepare draft
- Completed send action → ✓ Resume/send
- Reply check action exists → ✓ Check replies
- Trail events exist → ✓ Review trail
- Two items (define audience, approve actions) remain manual — they require user judgment.

**CEO Chat:** When a project is created, the response includes `start_campaign_url` and the chip **"▶ Open First Campaign Flow"** appears in the chat.

**Project workspace:** Each project's Overview tab shows a "First Campaign Launch Plan" strip with a mini progress bar and the "▶ Open First Campaign Flow" button.

**`/start-campaign?project_id=...`:** The URL query param preselects the project and displays the live checklist at the top of the page.

**API:**
- `GET /api/projects/[id]/launch-template` — returns or creates the template on demand
- `PATCH /api/projects/[id]/launch-template` — update status, goal, audience hint, checklist
- `GET /api/start-campaign/summary?project_id=...` — now includes `launch_template` with computed completion

**Safety:** Template is guidance only. It does not trigger any automation, execution, or sending.

## First Campaign Flow (`/start-campaign`)

A single guided page that walks the user through the complete AÏKO marketing loop. No new automation — it surfaces and connects existing features in one place.

**9 steps:**
1. **Project** — select or create a project (scopes all data)
2. **Operator** — choose a named Web Operator (shows live status)
3. **Research** — enter a search prompt, delegates to existing CEO command route
4. **Review leads** — shows discovered/needs_review/approved counts, links to /leads
5. **Gmail draft** — lists approved leads with email; one-click "Prepare draft" per lead
6. **Approval** — shows pending `approval_items`, links to Approval Center
7. **Resume** — shows approved-but-not-resumed actions with "▶ Resume" button
8. **Reply check** — shows contacted leads, "📬 Check reply" button per lead
9. **Execution trail** — shows last 8 events from the project's operator actions

**Summary endpoint:** `GET /api/start-campaign/summary?project_id=...` — aggregates projects, operators, lead counts, approved leads, pending approvals, resume candidates, contacted leads, and recent trail events from existing tables. No new business logic.

**Nav:** "▶ First Campaign" link appears in the sidebar Command section.

**Safety microcopy on every step:** "Nothing is sent automatically." / "Approval does not send." / "Resume is the explicit execution step." / "All external work happens through Web Operator."

**UX details:**
- Progress strip at top shows live step completion
- Each step card has a green left border when done, amber when action is needed
- All action buttons show loading / success (green) / error (red) state
- Buttons are `opacity: 0.45` + `cursor: not-allowed` when disabled
- Empty states guide the user to the right canonical page
- Hints appear when prerequisites are missing (no project, no operator)
- Summary auto-refreshes after every action (research, draft, resume, reply check)
- `fetchSummary` failure shows a retry screen instead of hanging on load

**Safety:** Nothing is sent or executed automatically. Every action button goes through the existing approval/mode rules.

## Gmail reply-status check workflow

After outreach is sent, you can check for replies through the browser (no Gmail API, no IMAP):

1. Click **"📬 Check reply"** on any lead that has an email address (Project workspace → Leads tab)
2. Web Operator opens Gmail, searches for emails from that lead's address
3. Returns a summary: how many threads found, latest subject + snippet
4. Result is shown inline and recorded in the lead's execution trail
5. CEO Chat: *"Check for replies from our leads"* — AÏKO checks the most recently contacted lead

**Safety constraints:**
- Browser-only — no Gmail API, no IMAP, no SMTP
- Reads only subject line + snippet from thread-list view — no full message body opened
- Does NOT open individual emails (prevents read-receipts and content exposure)
- Does NOT open attachments
- Does NOT follow external links in email content
- Sensitive screenshots (login pages) are automatically suppressed
- User handles login / 2-FA prompts manually (Web Operator detects login-required state and pauses)
- One lead at a time — no bulk inbox scraping

**New DB fields on `leads`:** `last_checked_at`, `last_reply_at`, `reply_summary`

**API:** `POST /api/leads/[id]/check-reply` — triggers check; `GET /api/leads/[id]/check-reply` — reads current reply status

**New action types:** `check_gmail_reply`, `search_gmail`

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

AÏKO is an npm project and uses `package-lock.json`. Public dependencies are resolved from the public npm registry; `.npmrc` pins `registry=https://registry.npmjs.org/` and `legacy-peer-deps=true` so npm can install the current Next 14 / React 18 tree consistently.

```bash
rm -rf node_modules .next
npm install
AIKO_AUTH_MODE=optional PORT=3001 npm run dev
```

Open `http://localhost:3001` (or whichever port is configured).

If install fails with `403 Forbidden`, first check local registry/proxy configuration:

```bash
npm config get registry
npm config list --location=project
npm config list --location=user
```

The expected registry is `https://registry.npmjs.org/`. Do not commit registry credentials or auth tokens.

On first launch with no provider configured, AÏKO shows the setup screen.


### OpenClaw-style first-run setup

AÏKO initializes like OpenClaw:

```text
Install app → first-run wizard → choose provider/auth profile → connect/test provider → assign CEO brain → enter app
```

1. Install dependencies with npm:

   ```bash
   npm install
   ```

2. Set `DATABASE_URL` and run the app:

   ```bash
   AIKO_AUTH_MODE=optional PORT=3001 npm run dev
   ```

3. Open `http://localhost:3001/setup`. If no working CEO brain exists, AÏKO redirects dashboard pages to `/setup` automatically.
4. Choose a provider path:
   - **ChatGPT / Codex OAuth** when `OPENAI_OAUTH_CLIENT_ID`, `OPENAI_OAUTH_AUTH_URL`, `OPENAI_OAUTH_TOKEN_URL`, and `OPENAI_OAUTH_REDIRECT_URI` are configured.
   - **OpenAI API key** as the reliable OpenAI fallback when ChatGPT OAuth is not configured.
   - **Claude Code local / Claude OAuth** only when local CLI/auth or OAuth env vars are detected.
   - **Anthropic API key** as the reliable Claude fallback.
   - **Ollama local** as the easiest offline/local path when Ollama is running and a model is pulled.
   - **OpenRouter** or custom compatible endpoints for advanced routing.
5. Click **Test & Connect**. AÏKO creates an auth profile, runs the provider test, assigns it to CEO, then runs Brain Verification.
6. When setup succeeds, use **Go to CEO Chat** or **Start First Campaign**.

Google login is optional AÏKO identity in `AIKO_AUTH_MODE=optional`; it does not connect provider accounts. Provider auth is separate and stored as auth profiles. Without ChatGPT/Codex OAuth env vars, use OpenAI API key or Ollama instead. Without Claude Code/Claude OAuth, use Anthropic API key instead.

You can inspect local readiness without printing secrets:

```bash
npm run setup:check
```

### Local setup — environment variables

Copy `.env.example` to `.env.local` and fill in your values.

#### Auth mode (controls whether login is required)

```
AIKO_AUTH_MODE=optional   # default — AI provider setup works without Google login
# AIKO_AUTH_MODE=required # use this for multi-user / hosted deployments
```

For a full walkthrough of the zero-login local flow, see **[AIKO_LOCAL_E2E_TEST.md](./AIKO_LOCAL_E2E_TEST.md)**.

**`AIKO_AUTH_MODE=optional` (default — local / OpenClaw-style use)**
- **All routes** are accessible without signing in — this is local single-user mode
- Connect a brain at `/setup`, then go straight to `/ceo` — no Google account required
- Provider connections and role assignments are stored with `user_id = null` (global)
- ChatGPT/Codex OAuth and Claude OAuth flow works without Google login
- Google login is available at `/login` but never mandatory
- SetupGate redirects to `/setup` if no CEO brain is configured
- A "Local mode" badge appears in the CEO top bar when not signed in

**`AIKO_AUTH_MODE=required` (multi-user / hosted deployments)**
- All dashboard routes require a signed-in session; unauthenticated requests → `/login`
- Provider connections are scoped to the signed-in user's `user_id`
- Google login is mandatory before any dashboard access or provider setup

#### Google login (optional in local mode, required when AIKO_AUTH_MODE=required)

```
NEXTAUTH_SECRET=        # openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3001
GOOGLE_CLIENT_ID=       # from console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_SECRET=
```

Create a Google OAuth app:
1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Create an OAuth 2.0 Client ID (web application)
3. Add authorized redirect URI: `{NEXTAUTH_URL}/api/auth/callback/google`

> **Note:** Google login identifies the AÏKO user. It does **not** connect ChatGPT or Claude.
> In `AIKO_AUTH_MODE=optional`, you can connect AI providers and run CEO Chat without Google login.

#### AI provider (at least one required for CEO Chat)

Connect an AI brain via `/setup`. The fastest path is Ollama local, OpenAI API key, or Anthropic API key — no Google login required in local mode.

| Provider | What you need | Where to get it |
|---|---|---|
| OpenAI API | API key | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| Anthropic API | API key | [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) |
| OpenRouter | API key | [openrouter.ai/keys](https://openrouter.ai/keys) |
| Ollama | Local install | `ollama pull llama3.2 && ollama serve` |

#### Optional: ChatGPT subscription OAuth

Allows users to connect their ChatGPT subscription account instead of using an API key.
Requires registering an OAuth app with OpenAI (when publicly available).

```
OPENAI_OAUTH_CLIENT_ID=
OPENAI_OAUTH_CLIENT_SECRET=
OPENAI_OAUTH_AUTH_URL=
OPENAI_OAUTH_TOKEN_URL=
OPENAI_OAUTH_SCOPE=openid profile email
```

Redirect URI to register: `{NEXTAUTH_URL}/api/providers/oauth/chatgpt/callback`

If these vars are not set, the ChatGPT OAuth card shows "not configured" — the app falls back to API key connections. No fake success, no silent failure.

#### Optional: Claude account OAuth

Allows users to connect their Claude.ai account instead of using an Anthropic API key.
Requires registering an OAuth app with Anthropic (when publicly available).

```
CLAUDE_OAUTH_CLIENT_ID=
CLAUDE_OAUTH_CLIENT_SECRET=
CLAUDE_OAUTH_AUTH_URL=
CLAUDE_OAUTH_TOKEN_URL=
CLAUDE_OAUTH_SCOPE=openid profile email
```

Redirect URI to register: `{NEXTAUTH_URL}/api/providers/oauth/claude/callback`

Same fallback behaviour: if vars are missing, the Claude OAuth card shows "not configured" and API key connections work normally.

#### Verify your setup

After starting the app, go to `/setup` for first-run connection or `/connect-ai` for advanced auth-profile diagnostics to see:
- Which env vars are configured (boolean only — no values shown)
- Whether you are signed in, and your internal user ID
- Whether ChatGPT / Claude OAuth is fully configured
- Which API-key providers are connected
- CEO brain status and last error

Or call the endpoint directly:
```
GET /api/auth/diagnostics
```

## Auth troubleshooting

### Blank page or 500 error after running `npm run build`

Running `npm run build` while the dev server is active corrupts the `.next/` directory — the dev server tries to load production chunks it doesn't know about.

**Fix:**
```bash
# Stop the dev server (kill the process on port 3001)
kill $(lsof -ti :3001)
# Remove the stale build artifacts
rm -rf .next
# Restart the dev server
npm run dev
```

### `OAuthSignin` error / "client_id is required"

The `GOOGLE_CLIENT_ID` (or `GOOGLE_CLIENT_SECRET`) env var is missing or empty.

**Fix:** Add both vars to `.env.local`, then **restart the dev server** (env vars are read at startup).

The `/login` page will show step-by-step setup instructions when credentials are missing.

### `redirect_uri_mismatch` from Google

The redirect URI registered in Google Cloud Console doesn't match what AÏKO sends.

**Fix:**
1. Check `NEXTAUTH_URL` in `.env.local` — it must match the URL you open in the browser (e.g. `http://localhost:3001`).
2. In [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials), ensure the OAuth client has this exact redirect URI:
   ```
   {NEXTAUTH_URL}/api/auth/callback/google
   ```
   e.g. `http://localhost:3001/api/auth/callback/google`
3. Trailing slashes matter — match exactly.

### Sign-in completes but session is not created

The JWT is not being signed, usually because `NEXTAUTH_SECRET` / `AUTH_SECRET` is missing.

**Fix:**
1. Ensure `.env.local` has `NEXTAUTH_SECRET=` set (generate with `openssl rand -base64 32`).
2. Check the database: the `users` table must exist. Run `npm run db:migrate` if it's missing.
3. Restart the dev server after any `.env.local` change.

## Validation commands

Available scripts from `package.json`:

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm test` — runs brain-routing smoke tests (no API keys or DB required)

## Self-hosting

Use Docker Compose to run the full stack (app + database):

```bash
docker compose up -d
```

## Documentation references

- `AIKO_MAP.md` — structural map of the system
- `AIKO_FUNCTIONS.md` — capability and behavior reference

## Project Decision Log

AÏKO records important project decisions so the CEO can explain why the project is moving in a certain direction.

**What is recorded automatically:**
- `project_created` — when the CEO creates a new project (idempotent, once per project)
- `strategy_brief_created` — when the first-campaign brief is generated (idempotent)
- `launch_template_created` — when the launch checklist is created (idempotent)
- `operator_recommended` — when a Web Operator is recommended for the first campaign (idempotent)
- `pm_assigned` — each time the CEO assigns a Project Manager
- `operator_changed` — when the user manually changes the recommended operator in the brief
- `research_prompt_changed` — when the user saves an updated research prompt in the brief
- `approval_approved / approval_rejected / approval_changes_requested` — when the user acts on an approval item
- `lead_approved / lead_rejected` — when the user approves or rejects a lead

**What is NOT recorded:** page loads, read-only views, internal polls, Web Operator browsing steps.

**CEO Recall:** The Decision Log is included in `getProjectContext()` and `getProjectExecutiveSummary()` so the CEO can answer questions like:
- "Why are we targeting property administrators?"
- "Why did we choose Kevin as operator?"
- "What decisions have been made for ALB Parking?"

**UI:** Each project workspace has a "Decision Log" tab showing a chronological list with type badges, title, summary, actor role, and timestamp.

**API:**
- `GET /api/projects/[id]/decisions` — returns decisions (newest first). Query params: `limit`, `offset`, `types` (comma-separated).
- `POST /api/projects/[id]/decisions` — record a new decision. Pass `idempotent: true` to skip if the type already exists.

**Safety:** The Decision Log is read-only memory. It does not execute any action, trigger the Web Operator, or send any message.

## Executive Project Reports

For any project, AÏKO can generate a concise executive report summarising current strategy, progress, decisions, risks, and recommended next steps.

**Triggering from CEO Chat:**
- `"Generate an executive report for ALB Parking."`
- `"Give me a report on Foreman."`
- `"Weekly report for this project."`

The CEO fast-path detects these commands, generates the report, and returns chips linking to the project Reports tab.

**Report contents:**
- Prose summary (AI-generated, or deterministic fallback if AI is unavailable)
- Strategy snapshot: goal, objective, target audience, channel, value prop, PM, operator
- Progress snapshot: launch checklist progress, lead pipeline, pending approvals
- Risks / blockers derived from project context
- Recommended next step

**Project workspace:** The "Reports" tab now shows Executive Reports at the top, with a "Generate report" button and an expandable list of previous reports. PM Reports remain below.

**API:**
- `GET /api/projects/[id]/executive-reports` — returns `{ reports, latest }`, newest first
- `POST /api/projects/[id]/executive-reports` — generate and save a new report

**Safety:** Read-only except saving the report record. No Web Operator actions. No external sends. If the AI brain is unavailable, a deterministic fallback report is generated from structured project data.

## Generated Files & Exports

AÏKO can export project data to downloadable files stored in `storage/generated-files/`.

### Lead CSV Export

Export the lead pipeline for any project or status filter to a CSV file.

**From `/leads` page:** Click "↓ Export CSV" to export all non-rejected leads (optionally filtered by status tab).

**From project workspace Leads tab:** Click "↓ Export CSV" to export leads scoped to that project.

**CSV columns:** `company_name`, `contact_name`, `email`, `phone`, `website`, `linkedin_url`, `location`, `category`, `score`, `status`, `source_url`, `notes`, `created_at`, `updated_at`.

**Safety:** `source_text` (raw scraped HTML) is never included. Rejected/archived leads excluded by default. No outreach triggered.

**API:** `POST /api/leads/export` — body: `{ project_id?, status?, include_rejected?, title? }`

### Executive Report Export

Export any executive report to Markdown or JSON from the project Reports tab.

**API:** `POST /api/projects/[id]/executive-reports/[reportId]/export` — body: `{ format: "markdown"|"json", overwrite?: boolean }`

### Project Artifact Bundle

Generate a complete internal project package as generated files. All files appear in the project Files tab and `/files` page.

**Bundle contents:**
1. **Executive report** (Markdown) — latest report or auto-generated fallback
2. **Leads CSV** — all non-rejected project leads (headers-only if no leads)
3. **Strategy brief** (Markdown) — first-campaign brief or empty-state placeholder
4. **Decision log** (Markdown) — all recorded project decisions, or empty-state note
5. **Manifest** (JSON) — links all files with metadata, project ID, project name, ISO timestamp

**From project workspace Files tab:** Click "📦 Generate project bundle". Download links for all components appear immediately after generation.

**API:** `POST /api/projects/[id]/artifact-bundle` — returns `{ files, manifest, download_urls, file_count }`

**Safety:** All files are internal only. No data is sent externally. No outreach triggered. No Web Operator actions. Absolute storage paths never exposed. `source_text` never included.

### `/files` page

All generated files from all sources are listed at `/files`. Each file shows its type badge (MD/CSV/JSON), filename, size, creation date, generating role, and source label:

| `source_entity_type`  | Label shown         |
|-----------------------|---------------------|
| `executive_report`    | Executive report    |
| `leads_export`        | Leads export        |
| `strategy_brief`      | Strategy brief      |
| `decision_log`        | Decision log        |
| `project_bundle`      | Project bundle      |

## OpenClaw-style AI auth profiles

AÏKO uses auth profiles for provider connections:

`provider catalog → auth profile → auth method → model selection → role assignment → test call`

Important distinctions:

- ChatGPT/Codex OAuth (`chatgpt_oauth`) is separate from OpenAI API key (`openai_api`).
- Anthropic API key (`anthropic_api`) is separate from Claude account/Claude Code local auth.
- Google login is optional AÏKO user identity only; it does not connect ChatGPT, Claude, OpenAI API, or Anthropic API.
- Ollama, OpenAI API key, Anthropic API key, OpenRouter, and custom endpoint profiles are the reliable working paths unless OAuth is explicitly configured.

ChatGPT/Codex OAuth requires these env vars before the Connect button is enabled:

- `OPENAI_OAUTH_CLIENT_ID`
- `OPENAI_OAUTH_AUTH_URL`
- `OPENAI_OAUTH_TOKEN_URL`
- `OPENAI_OAUTH_REDIRECT_URI`
- `OPENAI_OAUTH_CLIENT_SECRET` only if required by the OAuth provider

The `/connect-ai` page shows the current CEO brain, saved auth profiles, add-profile cards, diagnostics, missing OAuth variables, Claude Code local detection, and API fallback availability without exposing secrets.

## Web Operator Skills for website workflows

AÏKO routes website work through **Web Operator Skills** instead of native platform APIs. Skills are guardrail profiles for browser workflows such as Canva, Facebook, LinkedIn, Instagram, Gmail, public website reading, and general web research.

- Canva, Facebook, LinkedIn, Instagram, and Gmail workflows are **browser actions**, not native platform API integrations.
- Manual login/takeover is expected. AÏKO does not store passwords, bypass CAPTCHA, bypass 2FA, or bypass platform protections.
- Posting, messaging, emailing, sharing, publishing, joining groups, and downloading final assets require approval before the Web Operator proceeds.
- Forbidden actions such as CAPTCHA solving, paywall bypass, mass messaging, private-profile scraping, and unapproved publishing are blocked and logged.
- The skill catalog is visible at `/operator-skills`; operator action rows and execution trails show which skill governed each action.

Default skills include `general_web_research`, `gmail_workflow`, `canva_design`, `facebook_research`, `linkedin_research`, `instagram_research`, and `website_reader`. If the CEO asks an operator to use an unknown website, AÏKO creates a System Improvement Proposal for a new skill instead of attempting unsafe unknown automation.
