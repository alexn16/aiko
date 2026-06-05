# AÏKO Owner Operating Manual

This manual is for running the MVP locally or in a controlled hosted environment. AÏKO is designed for supervised marketing operations: planning, internal tasking, browser-based research and drafting, approval gates, reporting, files, and controlled self-improvement proposals.

## Starting AÏKO Locally

Install dependencies:

```bash
npm install
```

Set required environment variables in `.env.local`:

```bash
DATABASE_URL=postgresql://USER@localhost:5432/aiko
AIKO_AUTH_MODE=optional
NEXTAUTH_URL=http://localhost:3001
AUTH_SECRET=replace-with-strong-random-secret
NEXTAUTH_SECRET=replace-with-strong-random-secret
```

Start the app:

```bash
AIKO_AUTH_MODE=optional PORT=3001 npm run dev
```

Open:

```text
http://localhost:3001/dashboard
```

Use `/api/health` and `/dashboard` to confirm database, setup, Web Operator runtime, and storage status.

## Connecting A Brain

Open `/setup` for first-run setup or `/connect-ai` for advanced provider management.

AÏKO can use:
- Ollama local fallback when reachable.
- OpenAI-compatible API providers when configured.
- Anthropic-compatible providers when configured.
- ChatGPT/Codex direct only when OAuth is configured and connected.
- Claude only when Claude OAuth, Anthropic API, or Claude Code local auth is available.

AÏKO should show providers as not configured or not connected unless the connection actually works.

## Choosing Operating Mode

Open `/mode`.

Use a conservative mode for early MVP operation:
- Read Only: internal planning and analysis only.
- Approval required: recommended for supervised operation.
- Auto/Approval: allows safe internal automation while keeping risky external actions gated.

Do not use a mode that allows external-facing action without explicit approval.

## Creating A Project

Open `/ceo` and ask naturally:

```text
Create a marketing project for Demo Parking.
```

AÏKO creates an internal project workspace, assigns or recommends a Project Manager, records decisions, and prepares campaign context. This does not send external messages.

Open `/projects` or the project link to inspect:
- Overview.
- PM Chat.
- Reports.
- Agents.
- Activity.
- Execution Plan if available.

## Running First Campaign

Open `/start-campaign`.

Use the guided campaign flow to:
- Select or create a project.
- Create a strategy brief.
- Choose a launch template.
- Review recommended agents/operators.
- Prepare research or drafts.
- Route risky actions to approvals.

Campaign planning is internal. External posts, messages, sends, downloads, shares, and similar risky actions require approval.

## Supervising Web Operators

Open `/operators` for the fleet view or `/operators/[id]` for an active operator.

Web Operators use:
- Skills for safety policy.
- Playbooks for safe workflow plans.
- Playbook step tracking for transparent progress.
- Manual takeover for login, CAPTCHA, QR, 2FA, and security checkpoints.

For visible local validation, start the app with:

```bash
WEB_OPERATOR_HEADLESS=false AIKO_AUTH_MODE=optional PORT=3001 npm run dev
```

On the operator detail page, check:
- Current URL.
- Page title.
- Safe screenshot.
- Current playbook.
- Planned/current steps.
- Waiting reason.
- Pending action.
- Takeover and resume controls.

## Handling Login/CAPTCHA

If a website shows login, CAPTCHA, QR, 2FA, or a security checkpoint, AÏKO should enter `waiting_user`.

Use:
- `I'm taking over` when you need to control the browser manually.
- `Login / CAPTCHA completed` after you complete the challenge.
- `Resume` only when you want Kevin to continue from the same browser context.

AÏKO does not bypass login, CAPTCHA, QR, 2FA, or security checkpoints.

## Approving Risky Actions

Open `/approvals`.

Risky actions include:
- Sending messages or email.
- Posting, commenting, joining, or publishing.
- Downloading, sharing, or submitting external forms when user approval is required.
- Any action listed as an approval gate by a skill or playbook.

Approval is not the same as execution. After approval, an explicit resume or next controlled step may still be required.

## Generating Reports/Files

Ask the CEO or PM for a report:

```text
Generate an executive report for Demo Parking.
```

Open `/reports` or the project Reports tab.

For a project-specific executive report, open the project workspace and click the `Reports` tab. The global `/reports` page has its own reporting empty state and may not show the latest project executive report.

Open `/files` for generated artifacts:
- Markdown reports.
- JSON exports.
- CSV files.
- Strategy briefs.
- Decision logs.
- Project bundles.

Generated files are internal artifacts unless you explicitly export or use them elsewhere.

## Managing Self-Improvement Proposals

Open `/system`.

When a strategy requires a missing capability, AÏKO creates:
- A System Improvement Proposal.
- A Codex-ready implementation prompt.
- Safety rules.
- Approval gates.
- Forbidden actions.
- Lifecycle status.

Lifecycle states include:
- Proposed.
- Approved for implementation.
- Implementation in progress.
- Implemented pending validation.
- Validated available.
- Rejected.
- Archived.

The user may copy the prompt into Codex or another coding tool externally. AÏKO does not silently modify its own code.

For Web Operator capability proposals, validation is blocked unless the referenced skill and playbook exist in the database. Do not mark a capability available unless implementation and validation are real.

## What AÏKO Will Not Do Automatically

AÏKO will not:
- Bypass login, CAPTCHA, QR, 2FA, or security checkpoints.
- Send email, WhatsApp, Facebook, LinkedIn, Gmail, or other messages without approval.
- Post, comment, join, publish, download, or share without the required approval gate.
- Scrape private data or private profiles.
- Use native platform APIs unless explicitly implemented and approved.
- Claim ChatGPT/Codex or Claude is connected when credentials are missing.
- Modify its own source code from inside the app.
- Mark missing capabilities as available without validation.
- Fake completed work.

## Troubleshooting

### `next` Missing

Run:

```bash
npm install
```

Then retry `npm run build`.

### `DATABASE_URL` Missing

Set `DATABASE_URL` in `.env.local` or your deployment secret manager. Run:

```bash
npm run setup:check
```

### Database Unreachable

Check PostgreSQL is running and the connection string is correct. `/api/health` should return a safe database error label, not a stack trace.

### Playwright Browser Missing

Install Chromium:

```bash
npx playwright install chromium
```

Reload `/api/health` and `/operators`.

### Ollama Not Reachable

Start Ollama locally and confirm `OLLAMA_BASE_URL`, usually:

```bash
OLLAMA_BASE_URL=http://localhost:11434
```

Run `npm run setup:check`.

### ChatGPT OAuth Not Configured

Set the required `OPENAI_OAUTH_*` variables. Until OAuth works, ChatGPT/Codex should remain shown as not configured or disconnected.

### Claude Not Connected

Configure Anthropic API, Claude OAuth, or local Claude Code auth. Until one works, Claude should remain shown as disconnected.

### Web Operator Waiting For User

Open `/operators/[id]`, complete the login/CAPTCHA/QR/security step manually, then click `Login / CAPTCHA completed` and `Resume` when ready.

### Improvement Proposal Cannot Validate

Check the proposal guard message. If the required skill or playbook does not exist in the database, validation must remain blocked.
