# AÏKO — AI Marketing Operating System

AÏKO is a self-hosted, agent-based operating system for marketing execution.
It coordinates specialized AI agents for lead research, enrichment, copy generation,
outreach monitoring, qualification, reporting, and strategy — with a mandatory human approval gate before external sends.

## What AÏKO is

- **Marketing-only**: built for outreach, validation, growth, and campaign operations.
- **Agent-based**: multiple focused agents coordinated by an orchestrator.
- **Always-running workflow**: live status and activity stream across the dashboard.
- **Human-supervised**: outbound actions route through the Approval Center.
- **Model-flexible**: OpenAI-compatible provider routing per agent.
- **Self-hostable**: Next.js + PostgreSQL + Playwright via Docker Compose.

## Product surfaces

- `/` — AÏKO overview and quick entry points
- `/dashboard` — operational overview (metrics, active agents, activity)
- `/office` — Live Office (run agents, monitor activity, browser stream, read-only model source: Configured/Fallback) and reporting relationships
- `/leads` — lead table, scraping, enrichment
- `/approval` — approval queue (the sending gate)
- `/campaigns` — campaign tracking
- `/reports` — generated performance summaries
- `/settings` — model + SMTP configuration
- `/map` and `/functions` — in-app system documentation

## Core architecture

- **Frontend**: Next.js App Router (`app/`)
- **API layer**: route handlers under `app/api/`
- **Agent layer**: `lib/agents/` + `lib/agents/orchestrator.ts`
- **Model router**: `lib/models/provider.ts` with per-agent configs from DB
- **Realtime updates**: SSE from `/api/agents/stream`
- **Persistence**: PostgreSQL tables for projects, agents, leads, approvals, logs
- **Browser automation**: Playwright-driven browser agent

## Key safety invariant

AÏKO does **not** send outreach directly from generation.
Messages are generated into approvals and only sent after explicit approval through the send route.

## Local development

### Prerequisites

- Node.js 20+
- PostgreSQL

### Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

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
