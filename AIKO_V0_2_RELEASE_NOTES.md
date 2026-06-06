# AÏKO v0.2.0 Checkpoint Release Notes

## What Changed Since v0.1.0

AÏKO v0.2.0 keeps the v0.1.0 safety model and adds a simpler owner workflow on top of the local MVP.

- `/home` is now the main command center after setup.
- `/today` shows a Daily Brief with the highest-priority work and blockers.
- Natural commands are classified by the Brain Orchestrator before AÏKO acts.
- Project Autopilot can start marketing flows for known projects and AÏKO itself.
- AI Content Skills create internal drafts without opening websites.
- AI Research and Strategy Skills create plans, personas, campaign briefs, risk analysis, and next-step recommendations without browsing.
- AI skill outputs are more structured and actionable.
- Internal tasks are visible in `/tasks`, `/home`, and project workspaces.
- Approval, manual takeover, and navigation copy are simpler by default.

## Using the New Home Flow

Open `/home` after setup. The main screen now starts with:

- Today brief: what needs attention first.
- Command box: tell AÏKO what to do in natural language.
- Current project: selected project and recommended next action.
- Needs your attention: approvals, manual browser help, or all clear.
- Live work: Kevin's current browser/operator state.
- Next tasks and recent output.

Useful commands:

- `Promote AÏKO`
- `Start marketing for ALB Parking`
- `Plan the next 7 days for ALB Parking`
- `Create a LinkedIn post for AÏKO`
- `Open Canva`
- `Generate a report for ALB Parking`
- `What should I do today?`

## Daily Brief

The Daily Brief is available at `/today` and through `GET /api/daily-brief`.

Priority order:

1. Operators waiting for manual help.
2. Pending approvals.
3. Blocked tasks.
4. Todo or in-progress tasks.
5. Missing capability proposals.
6. Recommended next project step.
7. Recent output or reports.

The Daily Brief is read-only. It does not create tasks, approvals, Web Operator actions, browser sessions, sends, posts, publishes, messages, or resumes.

## AI Skills vs Web Operator Skills

AI Skills are internal thinking and text-generation skills. They can:

- Write drafts.
- Improve copy.
- Create strategy, plans, personas, briefs, checklists, and risk analysis.
- Save outputs as generated files when requested.
- Create internal tasks from next actions.

AI Skills do not browse, post, send, message, publish, or create Web Operator actions.

Web Operator Skills use Playwright browser sessions for supervised website work. They can:

- Open known websites directly.
- Pause for login, CAPTCHA, QR, or security checks.
- Follow safe playbooks.
- Request approval for risky actions.

Web Operator Skills do not bypass security checks and do not auto-send, auto-post, or auto-publish.

## Provider Status

- ChatGPT / Codex Local: supported when local Codex auth is detected, imported, and a real test call passes.
- Ollama: supported as a local provider when reachable.
- OpenAI API Key: supported as a Platform API-key profile.
- Anthropic API Key: supported as an API-key profile.
- ChatGPT / Codex OAuth App: requires `OPENAI_OAUTH_*` env vars and a successful OAuth flow.
- Claude: requires Anthropic API, Claude Code, or Claude OAuth when configured and tested.
- Web Operators: require Playwright and an installed browser runtime.

## Known Limitations

- AÏKO v0.2.0 remains a local/private MVP checkpoint, not a production hosted SaaS release.
- AI Skills do not use fresh web data. If current external facts are needed, AÏKO should say Web Operator research is needed.
- Internal task management is simple and does not run tasks automatically.
- Some provider catalog entries remain configuration-only unless a working adapter and credentials are available.
- Native platform APIs such as WhatsApp, Meta Business Suite, Gmail API, LinkedIn API, and CRM integrations are not included by default.
- Missing capabilities still create System Improvement Proposals; AÏKO does not implement or enable them automatically.

## Safety Model

- AÏKO does not bypass login, CAPTCHA, QR, or security checks.
- AÏKO does not send, post, publish, message, download, share, join groups, or perform similar risky external actions automatically.
- Approval is not execution. Approved risky actions still require explicit resume or execution.
- Forbidden actions remain blocked.
- Self-improvement remains controlled through proposals, Codex-ready prompts, user approval, implementation tracking, and validation guards.
