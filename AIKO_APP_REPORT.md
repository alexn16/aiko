# AÏKO App Report

_Generated: 2026-05-24 · Updated: 2026-05-31 (execution trails, Gmail reply-status checks, First Campaign Flow, Project Launch Template)_

---

## 1. Product summary

AÏKO is a self-hosted, agent-based AI marketing operating system built on Next.js 14 + PostgreSQL. Its primary interface is a CEO Chat (`/ceo`) where users speak conversationally to an AI executive persona that coordinates multiple projects, assigns Project Managers (Kenji, Mara, Sven), and orchestrates specialized AI agents. The system is provider-agnostic: it connects to OpenAI, Anthropic, Ollama, or any OpenAI-compatible endpoint, with per-role assignments (CEO, Project Manager, Research, Copywriting, Review, QA, Local Fallback).

### Role assignment system

Each AÏKO agent role is assigned a specific AI brain via `ai_role_assignments`. `lib/ai/router.ts` is the single canonical AI entry point: `callAI(role, messages)` resolves the provider through `ai_role_assignments → provider_connections`, selects the right adapter (`openai_compatible` or `anthropic_messages`), and dispatches the call. Role → provider fallback: if no assignment exists, any connected provider is used.

**Active features using `callAI`**: CEO Chat, CEO Reviews, PM Chat, Reports, Lead extraction, Outreach copywriting, Campaign analysis, Task output generation, System improvement analysis.

**Legacy `callLLM`**: Background agents (`research-agent.ts`, `copywriting-agent.ts`, etc.) still use `callLLM` from `lib/models/provider.ts` but are not reachable from the current UI. `model_configs` table is checked by `GET /api/setup` as a final SetupGate fallback only — it is no longer the source for any active AI call.

**ChatGPT/Claude OAuth**: AÏKO follows OpenClaw-style provider auth. ChatGPT/Codex OAuth and Claude account OAuth are the real subscription-brain connections — they do not require Google login. In `AIKO_AUTH_MODE=optional` (the default for local dev), the OAuth flow works without any Google session. If OAuth env vars are missing, the cards show "not configured" and fall back to API keys. See `AIKO_BRAIN_ROUTING_REPORT.md` for details.

**Google login**: Optional account identity. Google login identifies the user in multi-user deployments and scopes provider connections to that user's `user_id`. In `AIKO_AUTH_MODE=optional` (default), it is not required to connect an AI brain or run CEO Chat. Set `AIKO_AUTH_MODE=required` for hosted/multi-user deployments.

See `AIKO_BRAIN_ROUTING_REPORT.md` for the full routing diagram, fallback order, debug guide, and per-provider verification steps.

The core workflow is: research leads → enrich → draft outreach → human approval gate → campaign assembly → readiness check → (future) external send. A mandatory operating-mode system (Read Only / Auto-Approval Required / Full Access) controls what agents can do at each stage, with a global pause button and daily send-limit enforced at the database level.

All agent-to-agent coordination happens through a structured internal messaging layer (`agent_messages`), which auto-spawns typed tasks (`agent_tasks`), which in turn produce deliverables (`agent_task_outputs`). External-facing outputs are routed automatically into `approval_items`. Approved items feed into `campaigns`, which have a launch readiness check before any sending can occur.

The system also maintains a `system_capabilities` map and a `system_improvement_proposals` table, allowing the CEO agent to detect capability gaps in a described strategy and generate structured implementation prompts for a developer — without ever modifying its own code automatically.

---

## 2. Page map

### Project Launch Template (auto-created on project creation)
- **Purpose:** 9-step first-campaign checklist created automatically when the CEO creates a project. Guidance only — no automation triggered.
- **Key file:** `lib/project-launch-template.ts` — `createProjectLaunchTemplate` (idempotent), `getProjectLaunchTemplate`, `updateProjectLaunchTemplate`, `computeChecklistCompletion`
- **Migration:** `030_project_launch_template.sql` — `project_launch_templates` table with unique active-template constraint per project.
- **CEO integration:** CEO command route creates template on `create_project` intent; response includes `start_campaign_url` and `launch_template` summary; "▶ Open First Campaign Flow" chip appears in chat.
- **Project workspace:** `LaunchTemplateStrip` component on Overview tab shows mini progress bar + "▶ Open First Campaign Flow" button.
- **APIs:** `GET/PATCH /api/projects/[id]/launch-template`; `/api/start-campaign/summary` now includes `launch_template` with live checklist completion.
- **URL preselection:** `/start-campaign?project_id=...` preselects the project and shows the checklist card at top.

### /start-campaign — First Campaign Flow
- **Purpose:** Guided 9-step page for running the first complete AÏKO marketing workflow. Not new automation — surfaces and connects existing features in one place. Each step shows current status, an action button, and a link to the canonical page.
- **Steps:** (1) Choose/create project, (2) Choose operator, (3) Research leads, (4) Review/approve, (5) Prepare Gmail draft, (6) Approve risky actions, (7) Resume approved actions, (8) Check for replies, (9) View execution trail
- **Key components:** `app/(dashboard)/start-campaign/page.tsx`
- **APIs used:** `GET /api/start-campaign/summary`, `POST /api/projects`, `POST /api/ceo/command`, `POST /api/leads/[id]/outreach-draft`, `POST /api/web-operator/actions/[id]/resume`, `POST /api/leads/[id]/check-reply`
- **Summary endpoint:** `GET /api/start-campaign/summary?project_id=...` — aggregates projects, operators, lead counts, approved leads, pending approvals, resume candidates, contacted leads, recent trail (8 events). No business logic duplication.
- **Safety:** All action buttons go through existing approval/mode rules. Nothing executes automatically.
- **UX polish:** Progress strip, card left-border color (green = done, amber = needs attention), loading/ok/error action states, disabled button styles (opacity 0.45), empty states with canonical links, prerequisite hints, safety microcopy on every step, auto-refresh after each action, `fetchSummary` failure retry screen.
- **Nav:** "▶ First Campaign" in sidebar Command section.

### /ceo — CEO Chat
- **Purpose:** Global CEO interface. Create projects, assign PMs, run company reviews, issue strategy commands, and check capability gaps. Two tabs: Chat and Reviews.
- **Key components:** `components/chat/`, `components/agents/`
- **APIs used:** `POST /api/ceo` (command), `POST /api/ceo/review`, `GET /api/ceo/reviews`, `GET /api/stats`
- **Tables:** `projects`, `company_memory`, `project_memory`, `project_map`, `project_managers`, `ceo_commands`, `ceo_reviews`, `agents`, `approval_items`, `campaigns`, `campaign_launch_checks`, `agent_tasks`, `agent_task_outputs`, `operating_mode`, `tool_connections`, `web_operator_sessions`, `system_capabilities`

### /connect-ai — AI Provider Setup
- **Purpose:** Connect AI providers from a 26-entry OpenClaw-style catalog across 6 sections (Recommended, API providers, Local, Gateway & routing, Custom endpoints, Future/Specialized). Test connections, assign providers to agent roles (CEO, Project Manager, Research, Copywriting, Review, QA, Local Fallback) with capability-based smart defaults. Available providers open a SetupDrawer driven by `ProviderCatalogEntry`; planned entries show amber "Coming soon" cards; unavailable entries show dimmed grey cards.
- **Key components:** `lib/ai/provider-catalog.ts`, `app/(dashboard)/connect-ai/page.tsx`
- **APIs used:** `GET/POST /api/providers`, `GET/PATCH /api/providers/[id]`, `POST /api/providers/[id]/test`, `GET/PATCH /api/providers/roles`, `GET/POST /api/providers/brain`, `GET /api/providers/diagnostics`
- **Tables:** `provider_connections`, `ai_role_assignments`

### /dashboard — Operational Overview
- **Purpose:** Live metrics, active agents, and activity stream across all projects.
- **Key components:** `components/agents/`
- **APIs used:** `GET /api/stats`, `GET /api/agents/stream` (SSE)
- **Tables:** `projects`, `agents`, `agent_logs`, `approvals`

### /office — Live Office
- **Purpose:** Global view of agent activity, all internal communications, tasks, outputs, and web operator sessions across all projects.
- **Key components:** `components/agents/`
- **APIs used:** `GET /api/agent-messages`, `GET /api/agent-tasks`, `GET /api/task-outputs`, `GET /api/agents/stream`
- **Tables:** `agent_messages`, `agent_tasks`, `agent_task_outputs`, `web_operator_sessions`, `web_operator_actions`

### /projects — Multi-Project Overview
- **Purpose:** List and manage all projects with PM assignments and status.
- **Key components:** `components/agents/`
- **APIs used:** `GET /api/projects`
- **Tables:** `projects`, `project_managers`

### /projects/[id] — Per-Project Workspace
- **Purpose:** Tabbed per-project workspace: Overview, PM Chat, Reports, Agents, Activity, Tasks, Outputs, Campaigns, Comms.
- **Key components:** `components/chat/`, `components/agents/`
- **APIs used:** `GET /api/projects/[id]`, `POST /api/projects/[id]/pm-chat`, `GET /api/pm-reports`, `GET /api/agent-messages`, `GET /api/agent-tasks`, `GET /api/task-outputs`, `GET /api/campaigns`, `POST /api/projects/[id]/agent-discussion`
- **Tables:** `projects`, `project_memory`, `project_map`, `project_managers`, `project_manager_chats`, `project_manager_reports`, `agent_messages`, `agent_tasks`, `agent_task_outputs`, `campaigns`, `agents`

### /approvals — Approval Center _(canonical)_
- **Purpose:** Review queue for external-facing outputs (outreach drafts, campaign proposals). Approve, reject, or request changes. On approve, linked output is marked approved and PM notified. On changes requested, a revision task is auto-created. Approving is **internal permission only** — it does not send external messages.
- **Key components:** `components/approvals/` (`ApprovalSummaryWidget`, `ProjectApprovalsPanel`)
- **APIs used:** `GET /api/approval-items`, `POST /api/approval-items`, `PATCH /api/approval-items/[id]`
- **Library:** `lib/approvals.ts`
- **Tables:** `approval_items`, `agent_task_outputs`, `agent_tasks`, `agent_messages`

### /approval — redirects to /approvals
- **Purpose:** Legacy URL kept for link compatibility. The page calls `redirect('/approvals')` immediately.

### /api/approvals — legacy outreach approvals _(deprecated, do not add callers)_
- **Purpose:** Backed by the `approvals` table — the older per-lead outreach email approval flow. Separate semantic from `approval_items`: includes `Approve & Send` which dispatches actual outreach. Not part of the canonical Approval Center.
- **Tables:** `approvals`, `leads`

### /campaigns — Campaign Builder
- **Purpose:** Build, sequence, and manage marketing campaigns from approved outputs and approval items. AI-generate full campaign plans. View launch readiness.
- **Key components:** `components/campaigns/` (incl. `CampaignExecutionTrail`)
- **APIs used:** `GET/POST /api/campaigns`, `GET/PATCH /api/campaigns/[id]`, `POST /api/campaigns/[id]/items`, `PATCH /api/campaigns/[id]/items/[itemId]`, `POST /api/campaigns/generate`, `GET/POST /api/campaigns/[id]/launch-checks`, `GET /api/campaigns/[id]/execution-trail`
- **Tables:** `campaigns`, `campaign_items`, `campaign_launch_checks`, `approval_items`, `agent_task_outputs`
- **Execution trail:** Campaign detail page shows chronological operator actions and approvals via `campaign_items → approval_items → web_operator_actions`.

### /leads — Lead Table
- **Purpose:** Lead capture, enrichment, and map view.
- **Execution trail:** Each lead card has an expandable "▼ Execution trail" section (component: `LeadExecutionTrail`). Trail queries `web_operator_actions WHERE lead_id = X` joined to `approval_items`. Data linked via `web_operator_actions.lead_id` (migration 025).
- **Trail API:** `GET /api/leads/[id]/execution-trail`
- **Gmail reply check:** "📬 Check reply" button on any lead with an email. Calls `POST /api/leads/[id]/check-reply`. Web Operator opens Gmail, searches `from:<lead_email>`, returns thread count + latest subject/snippet. No Gmail API, no IMAP, no email body opened. Result recorded in trail (`reply_found` / `reply_check` events) and persisted to `leads.reply_summary`. CEO Chat: "Check for replies from our leads" triggers the same flow.
- **Key components:** `components/leads/`, `components/map/`
- **APIs used:** `GET /api/leads`, `POST /api/leads`, `POST /api/leads/[id]/check-reply`, `GET /api/leads/[id]/check-reply`
- **Tables:** `leads` (fields: `last_checked_at`, `last_reply_at`, `reply_summary` added in migration 029)

### /operator — Web Operator Control Room
- **Purpose:** Manage browser automation sessions, view action log, approve pending browser actions, check runtime status, and resume approved actions.
- **Key components:** `components/web-operator/`
- **APIs used:** `POST /api/web-operator/session`, `POST /api/web-operator/action`, `GET /api/web-operator/actions`, `POST /api/web-operator/approve-action`, `GET /api/web-operator/status`, `POST /api/web-operator/delegate`, `POST /api/web-operator/actions/[id]/resume`, `GET /api/approval-items`, `PATCH /api/approval-items/[id]`
- **Tables:** `web_operator_sessions`, `web_operator_actions`, `approval_items`
- **Resumable approval flow:**
  1. Risky action → `approval_items` row created (`item_type=web_operator_action`), action status = `waiting_approval`
  2. User approves in `/approvals` → `approval_items.status=approved`, action status = `approved` (no auto-execute)
  3. User clicks **▶ Resume** in `/approvals` or `/operators/[id]`
  4. `POST /api/web-operator/actions/[id]/resume` re-checks mode, executes via Playwright, logs result
  5. Duplicate resumes blocked; mode re-checked at resume time; all attempts logged

### /mode — Operating Mode
- **Purpose:** Set the global operating mode (Read Only / Auto / Full Access), toggle the pause button, and view the action audit log.
- **Key components:** `components/mode/`
- **APIs used:** `GET/PATCH /api/mode`, `GET /api/mode/log`
- **Tables:** `operating_mode`, `mode_action_log`

### /tools — Tool Connections
- **Purpose:** Configure web search provider (Tavily, Brave, SerpAPI) and website reader. Add API keys (stored server-side only). Test connections.
- **Key components:** `components/tools/`
- **APIs used:** `GET /api/tool-connections`, `POST /api/tool-connections/test`, `POST /api/tools/web-search`, `POST /api/tools/read-website`
- **Tables:** `tool_connections`

### /tool-runs — Tool Execution Log
- **Purpose:** View all tool runs (web search, website reader) with input, output, status, operating mode at time of execution, and blocked attempts.
- **APIs used:** `GET /api/tool-runs`
- **Tables:** `tool_runs`

### /system — Capability Map & Improvements
- **Purpose:** View the full system capability map, run a strategy capability check, view and approve/reject improvement proposals.
- **APIs used:** `GET /api/system/capabilities`, `POST /api/system/check-strategy`, `GET/POST /api/system/improvements`, `PATCH /api/system/improvements/[id]`
- **Tables:** `system_capabilities`, `system_improvement_proposals`

### /reports — Reports
- **Purpose:** View generated PM and reporting agent performance summaries.
- **APIs used:** `GET /api/reports`, `GET /api/pm-reports`
- **Tables:** `project_manager_reports`

### /settings — Settings
- **Purpose:** SMTP configuration and legacy model configuration (`model_configs` table).
- **APIs used:** `GET /api/settings`, `PATCH /api/settings`, `GET /api/model-configs`
- **Tables:** `settings`, `model_configs`

### /functions — In-App Documentation
- **Purpose:** Static in-app documentation reference for system capabilities and behaviors.
- **Key components:** `components/`

### /team — Team View
- **Purpose:** View project manager personas and assignments.
- **Tables:** `project_managers`

---

## 3. Backend module map

### AI Provider / Router
- **What it does:** Universal entry point for all AI calls. Resolves the correct provider for a given agent role via `ai_role_assignments`, falls back to any connected provider, and dispatches to the appropriate SDK adapter based on the `compatibility` field (openai_compatible / ollama_native → OpenAI-compat adapter; anthropic_messages → Anthropic SDK). Old rows without `compatibility` fall back to type-based mapping for backward compatibility.
- **Main files:** `lib/ai/router.ts`, `lib/ai/providers/openai-compat.ts`, `lib/ai/providers/anthropic.ts`
- **Catalog:** `lib/ai/provider-catalog.ts` — OpenClaw-style catalog of 26 providers across 6 categories (subscription_oauth, direct_api, gateway, local, custom, media_special). Drives the `/connect-ai` UI. Providers with `status: available` are fully connectable; `planned` entries show as coming-soon; `not_available_in_this_build` entries are greyed out.
- **Tables:** `provider_connections`, `ai_role_assignments`
- **Migration:** `lib/db/migrations/025_provider_catalog.sql` — adds `provider_catalog_id`, `compatibility`, `auth_type`, `account_email`, `subscription_label`, `capabilities` columns; back-fills `compatibility` from type for existing rows.
- **Status:** complete (catalog upgrade 2026-05-25)

### CEO Command Agent
- **What it does:** Builds a full company context snapshot (projects, PMs, tasks, outputs, approvals, campaigns, launch readiness, operating mode, tool connections, web operator status, missing capabilities), sends it to the CEO LLM with a structured JSON prompt, and executes returned actions (create project, assign PM, update company/project memory, generate project map). Logs every command to `ceo_commands`.
- **Main files:** `lib/agents/ceo-command-agent.ts`
- **Tables:** `projects`, `project_managers`, `company_memory`, `project_memory`, `project_map`, `agents`, `ceo_commands`
- **Status:** complete

### Internal Communications
- **What it does:** Structured agent-to-agent messaging layer. Provides typed helpers (`createInstruction`, `createHandoff`, `createBlocker`, `createManagerReport`). Every message auto-spawns an `agent_task` via `createTaskFromAgentMessage` (except `report` and `update` types).
- **Main files:** `lib/agents/internal-communication.ts`
- **Tables:** `agent_messages`, `agent_tasks`
- **Status:** complete

### Task Tracking
- **What it does:** Creates, lists, and updates agent tasks. Infers task type from message subject/content. Provides per-project and company-wide summary functions used in CEO context.
- **Main files:** `lib/agents/tasks.ts`
- **Tables:** `agent_tasks`
- **Status:** complete

### Task Outputs
- **What it does:** Creates AI-generated deliverables for tasks. Auto-creates `approval_items` for outputs requiring approval (`outreach_draft`, `approval_item` types). `generateOutputForTask` loads project context, calls the LLM, parses result, and advances task to `review` status.
- **Main files:** `lib/agents/task-outputs.ts`
- **Tables:** `agent_task_outputs`, `approval_items`, `agent_tasks`
- **Status:** complete

### Approval Center (new — approval_items)
- **What it does:** CRUD for `approval_items`. `updateApprovalStatus` handles side effects: on approve, marks linked output approved and notifies PM; on reject, marks output rejected and notifies owner; on changes_requested, resets output to draft, notifies owner, and creates a revision task.
- **Main files:** `lib/approvals.ts`
- **Tables:** `approval_items`, `agent_task_outputs`, `agent_tasks`, `agent_messages`
- **Status:** complete

### Campaign Builder
- **What it does:** CRUD for `campaigns` and `campaign_items`. `generateCampaignFromApprovedItems` calls the LLM to build a campaign plan from approved outputs and approval items. Includes per-project and company-wide summary helpers.
- **Main files:** `lib/campaigns.ts`
- **Tables:** `campaigns`, `campaign_items`, `approval_items`, `agent_task_outputs`
- **Status:** complete

### Campaign Launch Readiness
- **What it does:** Runs 12 rule-based checks against a campaign (objective, audience, channel, items, no rejected items, external items approved, not archived, PM assigned, memory, map). Computes 0–100 readiness score (required=70%, optional=30%). Calls LLM for summary and recommended actions. Saves result to `campaign_launch_checks`.
- **Main files:** `lib/campaign-launch-readiness.ts`
- **Tables:** `campaign_launch_checks`, `campaigns`, `campaign_items`, `approval_items`, `project_managers`, `project_memory`, `project_map`
- **Status:** complete

### Operating Mode
- **What it does:** Enforces three operating modes with a permission table (`ACTION_REQUIREMENTS`). `canPerformAction` checks mode and pause state, logs every check to `mode_action_log`. Full Access requires `CONFIRM_FULL_ACCESS` token. Daily send counter resets automatically.
- **Main files:** `lib/operating-mode.ts`
- **Tables:** `operating_mode`, `mode_action_log`
- **Status:** complete

### Tool Router
- **What it does:** Manages `tool_connections` and `tool_runs`. `runTool` checks operating mode, checks tool availability, logs the run, then dispatches to `web-search.ts` or `website-reader.ts`. Never returns `encrypted_secret` to client.
- **Main files:** `lib/tools/tool-router.ts`, `lib/tools/web-search.ts`, `lib/tools/website-reader.ts`
- **Tables:** `tool_connections`, `tool_runs`
- **Status:** complete (web search requires API key configuration; website reader works out of the box)

### Web Operator
- **What it does:** Session and action management for Playwright browser automation. `runWebOperatorAction` checks mode, checks if action needs approval (context-dependent), routes to `playwright-executor.ts` if browser runtime available. Returns "runtime not configured" cleanly if Playwright is not running.
- **Main files:** `lib/web-operator/web-operator.ts`, `lib/web-operator/playwright-executor.ts`, `lib/web-operator/approved-executor.ts`
- **Tables:** `web_operator_sessions`, `web_operator_actions`, `approval_items`
- **Status:** partial — data model and approval flow complete; actual Playwright execution requires a connected browser runtime

### Web Operator Delegation
- **What it does:** Higher-level wrapper that agents call instead of the Web Operator directly. Checks mode, sends an internal message, resolves or starts a session, runs the action, and saves results as `agent_task_outputs`. Convenience wrappers: `delegateSearch`, `delegateReadWebsite`, `delegateEmailDraft`, `delegateExternalAction`.
- **Main files:** `lib/web-operator/delegation.ts`
- **Tables:** `web_operator_sessions`, `web_operator_actions`, `agent_task_outputs`, `agent_messages`, `agent_tasks`
- **Status:** complete (dependent on browser runtime for execution)

### System Capabilities & Improvements
- **What it does:** `system_capabilities` tracks all features with status (available/partial/missing/planned/blocked). `checkCapabilitiesForStrategy` keyword-matches a strategy text against the capability map. `generateCapabilityGapReport` calls the LLM to produce an `implementation_prompt` and creates a `system_improvement_proposals` record.
- **Main files:** `lib/system-capabilities.ts`, `lib/system-improvements.ts`
- **Tables:** `system_capabilities`, `system_improvement_proposals`
- **Status:** complete

### Legacy Model Configs
- **What it does:** Original per-agent-slot model configuration table. Predates the `provider_connections` / `ai_role_assignments` system. Still present and accessible via `/api/model-configs` and `/settings`. The `lib/models/provider.ts` file (referenced by `ceo-command-agent.ts` via `callLLM`) may still use this table.
- **Main files:** `app/api/model-configs/route.ts`
- **Tables:** `model_configs`
- **Status:** superseded by provider system but not removed; creates confusion

---

## 4. Database map

### Migrations

| # | File | Tables created |
|---|------|----------------|
| 001 | 001_initial.sql | `model_configs`, `projects`, `agents`, `agent_logs`, `leads`, `approvals`, `campaigns` (initial), `settings` |
| 002 | 002_fixes.sql | Adds indices only |
| 003 | 003_jobs_agents.sql | `jobs` |
| 004 | 004_ceo_multiproject.sql | `company_memory`, `project_memory`, `project_map`, `project_managers`, `ceo_commands` |
| 005 | 005_ceo_reviews.sql | `ceo_reviews` |
| 006 | 006_pm_reports.sql | `project_manager_reports` |
| 007 | 007_providers.sql | `provider_connections`, `ai_role_assignments` |
| 008 | 008_pm_chat.sql | `project_manager_chats` |
| 009 | 009_agent_messages.sql | `agent_messages` |
| 010 | 010_agent_tasks.sql | `agent_tasks` |
| 011 | 011_agent_task_outputs.sql | `agent_task_outputs` |
| 012 | 012_approval_items.sql | `approval_items` |
| 013 | 013_campaigns.sql | `campaign_items`; extends `campaigns` |
| 014 | 014_campaign_launch_checks.sql | `campaign_launch_checks` |
| 015 | 015_operating_mode.sql | `operating_mode`, `mode_action_log` |
| 016 | 016_tool_connections.sql | `tool_connections`, `tool_runs` |
| 017 | 017_web_operator.sql | `web_operator_sessions`, `web_operator_actions` |
| 018 | 018_web_operator_delegation.sql | Adds columns to `web_operator_actions` |
| 019 | 019_system_capabilities.sql | `system_capabilities`, `system_improvement_proposals` |

### Key tables

| Table | What it stores |
|-------|---------------|
| `projects` | Client marketing projects with name, description, target market, goal, strategy JSON, PM assignment |
| `company_memory` | Singleton row: global company summary, priorities, blockers, last review timestamp |
| `project_memory` | Per-project notes, next steps, blockers, context (one row per project) |
| `project_map` | Per-project pipeline node/edge graph for visualization |
| `project_managers` | Three PM personas (Kenji, Mara, Sven) with specialty, status, current focus |
| `agents` | One row per agent per project with live status and current task |
| `agent_messages` | Internal agent-to-agent messages with type, subject, content, status |
| `agent_tasks` | Tasks derived from messages, with type, status, priority, and output JSON |
| `agent_task_outputs` | AI-generated deliverables (research briefs, outreach drafts, reports, etc.) |
| `approval_items` | External-facing items pending human review; linked to outputs and tasks |
| `campaigns` | Marketing campaign records with objective, audience, channel, status |
| `campaign_items` | Sequenced items within a campaign, linked to approval items or outputs |
| `campaign_launch_checks` | Readiness check results per campaign (score, blockers, warnings, summary) |
| `provider_connections` | Connected AI provider configs (type, URL, model, encrypted key, status) |
| `ai_role_assignments` | Maps each agent role to a provider connection |
| `tool_connections` | External tool configs (web_search, website_reader, email) |
| `tool_runs` | Immutable log of every tool execution with input/output and permission mode |
| `web_operator_sessions` | Browser automation sessions |
| `web_operator_actions` | Individual browser actions with type, status, approval linkage |
| `operating_mode` | Singleton: current mode, pause state, daily send limit and counter |
| `mode_action_log` | Audit log of every operating mode permission check |
| `system_capabilities` | Feature flag/status map for all AÏKO capabilities |
| `system_improvement_proposals` | Developer-ready improvement proposals generated when capability gaps are found |
| `ceo_commands` | Immutable log of all CEO Chat commands and responses |
| `ceo_reviews` | Structured company-wide review results |
| `project_manager_reports` | Structured PM progress reports sent to CEO |
| `project_manager_chats` | PM Chat conversation history per project |
| `leads` | Lead records with contact, location, source, and status |
| `approvals` | Legacy outreach approval queue (lead_id + channel + body + status) |
| `model_configs` | Legacy per-agent-slot model configuration (predates provider system) |
| `jobs` | Legacy job evaluation and execution tracking |
| `settings` | SMTP and general key/value settings |

---

## 5. Duplicates and overlaps

### approvals vs approval_items

**`approvals`** (migration 001): the original approval queue. Each row is tied to a `lead_id` and contains a raw outreach message (`channel`, `subject`, `body`). Statuses are `pending`, `quality_passed`, `sent`, `approved`. It is a flat outreach-message gate.

**`approval_items`** (migration 012): the new approval system. Each row links to an `agent_task_output` and/or `agent_task`, carries a rich `item_type`, `review_note`, `decision_reason`, and supports `changes_requested` with automatic revision task creation. It integrates with campaigns.

The `ceo-command-agent.ts` still queries the old `approvals` table for its context snapshot (`COUNT(*) WHERE status IN ('pending','quality_passed')`). The new `approval_items` table has its own summary (`getApprovalSummaryForCompany`) which is also fed to the CEO context. Both counts appear in the CEO's context, which is confusing and may double-count the pending workload.

**Recommendation:** The `approvals` table should be considered legacy. Migrate any remaining routes off it (the `/approval` page) to use `approval_items`. Remove the old count query from `ceo-command-agent.ts`. The `/api/approvals` and `/approval` page should eventually be deprecated.

### /approval vs /approvals

**`/approval`** (dashboard page, `app/(dashboard)/approval/`): renders the legacy `approvals` table queue — outreach messages tied directly to leads.

**`/approvals`** (dashboard page, `app/(dashboard)/approvals/`): renders the new `approval_items` queue — richer, linked to task outputs, supports changes_requested workflow.

Both pages exist simultaneously. Users navigating to `/approval` see one system; `/approvals` shows another. The README and product documentation exclusively reference `/approval` as the approval page, which is the legacy one.

**Recommendation:** Update all documentation and navigation to point to `/approvals`. Redirect `/approval` to `/approvals`. Remove the legacy page after verifying the legacy `approvals` table is no longer being populated.

### model_configs vs provider_connections

**`model_configs`** (migration 001): original per-agent-slot config table with `base_url`, `api_key`, `model`, `context_window`. Still present, accessible at `/api/model-configs`, and rendered in `/settings`.

**`provider_connections` + `ai_role_assignments`** (migration 007): the current provider system. Supports multiple named providers of different types, connection testing, and role mapping. `lib/ai/router.ts` (`callAI` / `streamAI`) uses only this system.

However, `lib/agents/ceo-command-agent.ts` imports from `lib/models/provider` and uses `callLLM` / `LLMConfig` — which suggests a separate model-calling path that may still be reading `model_configs`. This creates a potential split-brain: some agents call via `callAI` (new router), while the CEO agent may use a different path.

**Recommendation:** Confirm whether `lib/models/provider.ts` reads from `model_configs` or delegates to `lib/ai/router.ts`. If it reads `model_configs`, migrate the CEO agent to use `callAI` from `lib/ai/router.ts` and deprecate `model_configs`. Remove `/settings` model config UI once confirmed unused.

### tool_runs vs web_operator_actions

**`tool_runs`**: logs executions of discrete tools — web search and website reader. Each row captures `tool_type`, `action`, `input`, `output`, `status`, and `permission_mode`.

**`web_operator_actions`**: logs browser automation actions — search, open_url, read_page, fill_form, create_email_draft, etc. Also captures input, output, status, `requires_approval`, and `approval_item_id`.

When the Web Operator performs a `search` action, it goes through `web_operator_actions` (via `runWebOperatorAction` → `playwright-executor`), not through `tool_runs`. When an agent calls `runTool` with `tool_type='web_search'`, it goes through `tool_runs` (via `lib/tools/web-search.ts`). There are therefore two parallel paths for "search the web" — one through the tool router and one through the web operator — with separate logs.

**Recommendation:** This overlap is functional but needs clear ownership. Define: tool router (`tool_runs`) = lightweight, API-key-based search; web operator (`web_operator_actions`) = full browser automation including search. Document which agents use which path. Consider whether `tool_runs` search entries should be cross-linked when search is done via delegation.

### web search (lib/tools/web-search.ts) vs Web Operator search

**`lib/tools/web-search.ts`**: calls Tavily, Brave, or SerpAPI directly via HTTP using a configured API key. Fast, structured, no browser needed. Requires `tool_connections` to have a `web_search` entry with a provider and key.

**Web Operator `search` action** (via `lib/web-operator/delegation.ts` → `delegateSearch`): routes through `runWebOperatorAction` → `playwright-executor`, which would use Playwright to perform a browser-based search. Requires browser runtime.

The `STRATEGY_KEYWORD_MAP` in `system-capabilities.ts` maps "research", "search online", "find companies", "web search" to the `web_research` capability, which is seeded as `partial` — "needs API key". This correctly reflects that the tool-router-based search needs a key. However, the Web Operator search path via Playwright could work independently of an API key if the browser runtime is connected. The capability map does not distinguish these two paths.

**Recommendation:** When Web Operator search is used (browser runtime connected), mark `web_research` as `available`. Add a note in the capability map distinguishing API-key search from browser search.

### Legacy jobs table

The `jobs` table (migration 003) tracks a "job evaluation → approval → execution" workflow with `status` values `evaluating | awaiting_approval | running | complete | cancelled`. There is a `GET /api/jobs` route and a jobs-related component. However, no current agent code was found generating jobs in the active agent pipeline (tasks, outputs, messages). This appears to be a superseded workflow that predates the `agent_tasks` system.

**Recommendation:** Verify whether `/api/jobs` is still called by any frontend component. If unused, mark as deprecated and plan removal.

---

## 6. Missing capabilities

### Critical (blocking real use)

- **Email Sending** (`email_sending`, seeded as `missing`): No SMTP or SendGrid sending implementation exists in the codebase. The `settings` table stores SMTP config and `nodemailer` is in `package.json`, but no `lib/email/sender.ts` or equivalent was found. Outreach campaigns reach `approved` status but have no path to external delivery. This is the most significant gap between the current state and real marketing operation.

- **Reply Tracking** (`reply_tracking`): Browser-based Gmail reply check is now implemented. Web Operator searches Gmail for emails from a lead's address, returns thread count + snippet. Persisted to `leads.reply_summary` and visible in execution trail. No Gmail API or IMAP — entirely browser-driven. Full-loop reply classification (interested / not_interested) and campaign-wide reply roll-up are future work.

### Important (needed for full operation)

- **Web Search API key** (`web_research`, seeded as `partial`): The tool router web search works but requires a Tavily, Brave, or SerpAPI key. Without a key, Research Agents cannot find leads via the tool-router path. The website reader works without a key, but structured search requires configuration.

- **Browser runtime / Playwright** (not a seeded capability gap, but a runtime dependency): The Web Operator is fully implemented at the code level, but `playwright-executor.ts` requires a running Playwright browser. In the Docker Compose deployment this works, but in a plain `npm run dev` setup it may not. The `checkBrowserRuntime` function only checks if the Playwright package is importable — not if a browser binary is available. This means the check may return `true` but actions still fail at execution.

- **LinkedIn Operator** (`linkedin_operator`, seeded as `partial`): The delegation layer can dispatch a Web Operator action targeting LinkedIn, but no LinkedIn-specific navigation logic exists in `playwright-executor.ts`. It would attempt generic browser automation against linkedin.com, which is login-walled and rate-limited.

### Later (nice to have)

- **CRM Sync** (`crm_sync`, seeded as `missing`): No Salesforce, HubSpot, or Pipedrive integration. Leads stay internal.

- **Calendar Booking** (`calendar_booking`, seeded as `missing`): No Google Calendar or Calendly integration. Meeting booking is not possible.

- **Actual email send in Full Access mode**: `operating_mode.ts` defines `send_outreach` and `send_email` as Full Access actions and increments `sends_today`, but no code actually calls `incrementSendCount` after a real send (because email sending doesn't exist yet). The counter infrastructure is ready; the send implementation is not.

---

## 7. Recommended next 3 steps

1. **Implement Email Sending** — This is the single capability that unlocks real marketing operation. Every other system (approval flow, campaigns, launch checks, operating mode daily limits) is designed around this missing piece. Without it, campaigns reach `approved` status and stop. Implementing SMTP/SendGrid email dispatch behind the `send_outreach` operating mode gate completes the primary workflow loop.

2. **Consolidate the dual approval system** — The coexistence of `approvals` (legacy) and `approval_items` (new) creates confusion for users (two approval pages), wastes developer attention (two sets of routes and components to maintain), and introduces potential double-counting in the CEO context. Redirecting `/approval` → `/approvals`, updating the CEO context query, and deprecating the old table is low-risk cleanup that makes the codebase coherent.

3. **Implement Reply Tracking** — Once email sending works, reply tracking closes the feedback loop. The Sales Validation Agent has a seeded role but no input data. IMAP polling + a simple reply classifier (using `callAI`) would feed qualified leads back into the pipeline and make the Reporting Agent's output meaningful.

---

## 8. Next implementation prompt

```
## AÏKO — Implement Email Sending (Step 1)

### Context
AÏKO is a Next.js 14 + PostgreSQL AI marketing system. The project uses `nodemailer` (already in package.json) and stores SMTP credentials in the `settings` table (key/value JSONB store). The operating mode system (`lib/operating-mode.ts`) already defines `send_outreach` and `send_email` as Full Access actions and provides `incrementSendCount()`. The approval flow is complete: `approval_items` are approved by the user; approved items are linked to `agent_task_outputs`. What is missing is the actual outbound email dispatch.

### What to build

**1. Email sender library (`lib/email/sender.ts`)**

Create a new file. Do not modify any existing files to add this — import it where needed.

- Export `getSmtpConfig(): Promise<SmtpConfig | null>` — reads the `settings` table for key `smtp` (already stored as `{ host, port, user, password, from_name, from_email, secure }`). Returns null if not configured.
- Export `sendEmail(opts: { to: string; subject: string; html: string; text?: string; project_id?: string; approval_item_id?: string }): Promise<{ success: boolean; messageId?: string; error?: string }>`.
  - Calls `canPerformAction('send_email')` from `lib/operating-mode.ts`. If not allowed, return `{ success: false, error: reason }`.
  - Loads SMTP config. If null, return `{ success: false, error: 'SMTP not configured. Go to /settings.' }`.
  - Creates a `nodemailer` transporter and sends.
  - On success: calls `incrementSendCount()` from `lib/operating-mode.ts`.
  - Logs the attempt to a new `email_sends` table (see below) with status `sent` or `failed`.
  - Returns `{ success: true, messageId }` or `{ success: false, error }`.

**2. Migration (`lib/db/migrations/020_email_sends.sql`)**

```sql
CREATE TABLE IF NOT EXISTS email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  approval_item_id UUID REFERENCES approval_items(id) ON DELETE SET NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',   -- sent | failed | bounced
  message_id TEXT,
  error TEXT,
  permission_mode TEXT NOT NULL DEFAULT 'full_access',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_sends_project ON email_sends(project_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_status ON email_sends(status);
CREATE INDEX IF NOT EXISTS idx_email_sends_created ON email_sends(created_at DESC);
```

**3. API route (`app/api/email/send/route.ts`)**

`POST /api/email/send`

Request body: `{ approval_item_id: string }` — no raw `to/subject/body` from client; pull all content from the database.

- Load the `approval_items` row. If not found or `status !== 'approved'`, return 400.
- Load the linked `agent_task_output` for the body content (`output.content` → HTML).
- Load the lead email from `leads` table if a `lead_id` is resolvable, else require `to_email` in the approval_item metadata.
- Call `sendEmail(...)` from `lib/email/sender.ts`.
- On success: update `approval_items.status` to `'sent'` and notify the PM via `createInstruction` from `lib/agents/internal-communication.ts` with message_type `update`.
- Return `{ success, messageId, error }`.

**4. Update system capability**

In `lib/system-capabilities.ts` or via a direct SQL update, mark the `email_sending` capability from `missing` to `available` after the feature is confirmed working:
```sql
UPDATE system_capabilities SET status = 'available' WHERE key = 'email_sending';
```
Do not add this to the migration — it should be run after manual verification.

### File paths to read before implementing
- `lib/operating-mode.ts` — `canPerformAction`, `incrementSendCount`
- `lib/approvals.ts` — `ApprovalItem` type, `updateApprovalStatus`
- `lib/agents/internal-communication.ts` — `createInstruction`
- `app/api/settings/route.ts` — how settings are read/written
- `lib/db/migrations/001_initial.sql` — `settings` table schema

### Safety requirements
- Never call `sendEmail` from any agent path automatically. It must only be called via the explicit `POST /api/email/send` route, which requires a human-initiated request with an `approval_item_id`.
- Always check `canPerformAction('send_email')` before sending. If mode is not Full Access or agents are paused, refuse.
- Never return SMTP credentials to the client. The `/api/settings` route must redact `password` from SMTP config in GET responses.
- The send route must validate that the approval item is `status = 'approved'` before sending. Reject any other status.

### No Tailwind, no new CSS files
Use existing className conventions found in other route handlers and page components.

### Suggested commit message
`feat: add email sending — POST /api/email/send dispatches approved approval_items via SMTP`
```

---

## Architecture simplification — 2026-05-24

### Decision: Web Operator as single external execution layer

AÏKO's architecture has been simplified. The Web Operator is now the only external execution path. Native API integrations (SMTP, Gmail API, LinkedIn API, CRM APIs, Resend, etc.) are not part of the core product.

**What this means:**
- `lib/tools/web-search.ts` and `lib/tools/website-reader.ts` remain as utility functions but are secondary to browser-based execution
- `/tools` and `/tool-runs` pages remain available but are removed from the main sidebar navigation
- All CEO and PM agent prompts now direct external actions through Web Operator delegation
- Email = Web Operator opens Gmail/Outlook web, prepares draft, requests approval, sends only if Full Access allows
- LinkedIn = Web Operator opens LinkedIn web, prepares message, requests approval
- Search = Web Operator searches via browser (or API-key provider as secondary acceleration)

**What was de-emphasized:**
- Native SMTP/email send routes
- API-key search provider configuration as primary flow
- `/tools` and `/tool-runs` from main navigation

**What remains the main flow:**
```
CEO/PM Chat
→ Agent tasks and internal messages
→ Web Operator delegation (lib/web-operator/delegation.ts)
→ Playwright browser execution (lib/web-operator/playwright-executor.ts)
→ Web operator action log (web_operator_actions table)
→ Outputs / Leads / Approval items
→ Campaign assembly
→ Launch readiness check
→ Client approval
```

### Updated next 3 steps

1. **Improve Web Operator reliability** — screenshots on every action, better error messages, session recovery after Playwright crash. This makes the operator actually usable in practice.

2. **Web Operator Gmail/email workflow** — implement `create_email_draft` action type fully: Web Operator opens Gmail/Outlook in browser, fills recipient/subject/body from task output, saves draft, shows screenshot, creates approval item. If Full Access and approved: clicks send.

3. **Lead extraction from research** — when Web Operator completes a search or read_page action, automatically extract company names, URLs, contacts from the output and create lead records. Closes the research → leads pipeline gap.

### Lead-to-Gmail outreach workflow — 2026-05-27
- `lib/outreach/lead-outreach.ts` — orchestration: load lead, check status/email/mode, generate AI draft, create tracking task, delegate to Web Operator via Gmail
- `POST /api/leads/[id]/outreach-draft` — prepare Gmail draft for a single approved lead
- `POST /api/leads/[id]/send` — send via operator (requires Full Access mode)
- `POST /api/leads/[id]/find-contact` — delegate website visit to Web Operator to find contact details
- "✉ Gmail draft" button on approved leads with email in `/leads` page and Project Leads Panel
- "🔍 Find contact" button on approved leads with no email but with website/source URL
- CEO command intent detection for "prepare outreach for approved leads" patterns
- No SMTP, no Gmail API — Web Operator browser only
- Safety: only approved leads, mode check, single-lead (no bulk), draft-only by default

### Web Operator reliability — 2026-05-24
- Screenshots per action (non-sensitive)
- Page state capture (URL, title, preview) after each action
- Session recovery on browser crash
- Safe retry for search/open_url/read_page/copy_data
- Structured failure reasons
- /operator page shows screenshots and page state
