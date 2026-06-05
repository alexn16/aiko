# AÏKO MVP Release Notes

## What AÏKO Is

AÏKO is an AI Marketing Operating System: a virtual marketing company with a CEO, agents, Web Operators, approvals, reports, files, and controlled self-improvement.

The MVP is designed for local/private evaluation first. It can be prepared for hosted/team use, but it is not production SaaS until the hosted-mode checklist, auth policy, storage policy, and deployment safety checks are completed.

## What Works Now

- CEO Chat as the primary interface for project creation, project recall, strategy discussion, executive reporting, and delegation.
- First-run setup and AI provider routing for Ollama local, OpenAI-compatible providers, Anthropic-compatible providers, ChatGPT/Codex OAuth when configured, and Claude connection paths when configured.
- Project workspaces with strategy briefs, campaign flow, project memory, reports, decisions, generated files, and task planning.
- Web Operators using Playwright browser sessions, visible headed mode, manual takeover, current URL/title/screenshot state, and action logging.
- Web Operator Skills, Playbooks, and playbook step tracking for safe workflow planning and owner visibility.
- Approval Center for risky external-facing actions. Approval is separate from execution.
- Strategy Execution Planner that turns strategy into internal plans, required agents, skills, playbooks, approvals, tasks, and missing capability proposals.
- System Improvement Proposals with Codex-ready implementation prompts, lifecycle tracking, validation guards, and self-improvement timeline.
- MVP Dashboard with setup status, brain status, warnings, counts, recent activity, quick links, and manual smoke-test checklist.
- Branding assets, release checklist, owner manual, and demo script.

## What Is Verified

- Unit/smoke test suite passes in the current MVP state.
- Production build succeeds.
- `/api/health` returns safe health data without secrets.
- `/dashboard`, `/setup`, `/ceo`, `/system`, `/operators`, and `/brand` have been runtime-checked during MVP readiness work.
- Headed Web Operator mode has been validated with `WEB_OPERATOR_HEADLESS=false`.
- Manual takeover, login/CAPTCHA/security pauses, and approval gates have been validated in representative flows.
- Missing capability planning has been validated with WhatsApp used only as an example missing capability.

## Provider Truth

- ChatGPT/Codex is connected only when OAuth is configured and a real connected OAuth profile exists.
- Claude is connected only when Claude OAuth, Anthropic API, or Claude Code auth is actually available.
- Ollama is a local fallback and must be reachable at `OLLAMA_BASE_URL`.
- Unsupported or unconfigured providers are shown honestly as unavailable, not simulated.

## Safety Model

- AÏKO never bypasses login, CAPTCHA, QR, or security checks.
- AÏKO does not send, post, publish, message, download, share, join groups, or perform similar risky actions without approval.
- AÏKO does not use native platform APIs unless explicitly implemented and approved.
- AÏKO does not scrape private data or fake external results.
- Self-improvement is controlled: AÏKO creates proposals and prompts, but does not silently modify code or auto-approve new capabilities.

## Known Limitations

- This is an MVP, not a finished multi-tenant SaaS product.
- Some provider catalog entries are planned or configuration-only unless a working adapter and credentials are available.
- Native platform capabilities such as WhatsApp, Meta Business Suite, LinkedIn APIs, Gmail APIs, and CRM integrations are not assumed.
- Missing platform capabilities become System Improvement Proposals, not automatic implementations.
- Web Operator selectors are intentionally conservative; unknown or unsafe site workflows may require manual supervision.
- Hosted/team deployment requires the hosted checklist, secure auth mode, production storage, database backups, and access control review.

## Run Locally

```bash
npm install
cp .env.example .env.local
npm run doctor
AIKO_AUTH_MODE=optional PORT=3001 npm run dev
```

Open `http://localhost:3001/dashboard`, then connect a real brain at `/setup`.

For visible Web Operator validation:

```bash
WEB_OPERATOR_HEADLESS=false AIKO_AUTH_MODE=optional PORT=3001 npm run dev
```

## Recommended First Project Flow

1. Open `/dashboard` and confirm setup status, brain status, warnings, and quick links.
2. Open `/setup` and connect Ollama, OpenAI, Anthropic, ChatGPT/Codex OAuth, or Claude if configured.
3. Open `/ceo` and ask: `Create a marketing project for Demo Parking.`
4. Open `/start-campaign` and review the campaign launch flow.
5. Ask Kevin to open a known safe site or create a draft, then supervise the Web Operator in `/operators/[id]`.
6. Review approvals in `/approvals` before any external-facing action.
7. Generate an executive report and export files.
8. Open `/system` to inspect missing capability proposals and the self-improvement timeline.

## Release Readiness References

- `AIKO_MVP_RELEASE_CHECKLIST.md`
- `AIKO_OWNER_OPERATING_MANUAL.md`
- `AIKO_MVP_DEMO_SCRIPT.md`
- `AIKO_DEMO_COMMANDS.md`
- `AIKO_DEPLOYMENT_CHECKLIST.md`
- `AIKO_APP_MAP.md`
