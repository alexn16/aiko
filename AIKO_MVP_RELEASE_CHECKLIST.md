# AÏKO MVP Release Checklist

Use this checklist before a local private deployment or hosted/team deployment. AÏKO must remain honest about provider state and must not execute risky external actions without approval.

## Required Environment Variables

- [ ] `DATABASE_URL` points to the intended PostgreSQL database.
- [ ] `AIKO_AUTH_MODE` is set to `optional` for local single-user mode or `required` for hosted/team mode.
- [ ] `NEXTAUTH_URL` matches the app URL.
- [ ] `AUTH_SECRET` or `NEXTAUTH_SECRET` is set to a strong random value.

## Optional Provider Environment Variables

- [ ] `OLLAMA_BASE_URL` is set if using Ollama local.
- [ ] `OPENAI_API_KEY` is set only if OpenAI API-key profiles are supported in this deployment.
- [ ] `ANTHROPIC_API_KEY` is set only if Anthropic API-key profiles are supported in this deployment.
- [ ] `OPENROUTER_API_KEY` is set only if OpenRouter profiles are supported in this deployment.
- [ ] `OPENAI_OAUTH_CLIENT_ID`
- [ ] `OPENAI_OAUTH_AUTH_URL`
- [ ] `OPENAI_OAUTH_TOKEN_URL`
- [ ] `OPENAI_OAUTH_REDIRECT_URI`
- [ ] `CLAUDE_OAUTH_CLIENT_ID`
- [ ] `CLAUDE_OAUTH_AUTH_URL`
- [ ] `CLAUDE_OAUTH_TOKEN_URL`
- [ ] `CLAUDE_CODE_OAUTH_TOKEN`
- [ ] `WEB_OPERATOR_HEADLESS` is set intentionally. Use `false` only when headed browser sessions are required.

## Local Single-User Mode

- [ ] `AIKO_AUTH_MODE=optional`.
- [ ] PostgreSQL is running locally.
- [ ] `DATABASE_URL` points to the local `aiko` database.
- [ ] `NEXTAUTH_URL` matches the local port, for example `http://localhost:3001`.
- [ ] At least one AI provider is connected and tested in `/setup`.
- [ ] `/dashboard` shows CEO brain connected or clearly explains setup is required.
- [ ] ChatGPT/Codex and Claude show honest `not configured` / `not connected` states unless actually connected.

## Hosted / Team Mode

- [ ] `AIKO_AUTH_MODE=required`.
- [ ] `NEXTAUTH_URL` uses the production HTTPS URL.
- [ ] `AUTH_SECRET` / `NEXTAUTH_SECRET` is unique to production.
- [ ] Database credentials are production-only.
- [ ] Provider profiles are scoped to the signed-in user or intended shared account model.
- [ ] Browser runtime and storage are available on the host.
- [ ] Logs do not include API keys, OAuth tokens, or database URLs.
- [ ] Backups are configured for PostgreSQL and generated-file storage.

## Database Checklist

- [ ] PostgreSQL is reachable from the app runtime.
- [ ] All migrations have been applied.
- [ ] `projects`, `provider_connections`, `ai_role_assignments`, `approval_items`, `web_operators`, `web_operator_actions`, `system_improvement_proposals`, and `generated_files` exist.
- [ ] `npm run setup:check` reports `DATABASE_URL present: yes`.
- [ ] `/api/health` reports `database.ok=true`.

## Web Operator Checklist

- [ ] Playwright package is installed.
- [ ] Chromium browser is installed for Playwright.
- [ ] `/api/health` reports `web_operator.runtime_available=true`.
- [ ] `/operators` loads.
- [ ] Manual takeover controls are visible on `/operators/[id]`.
- [ ] `waiting_user` states are surfaced in `/dashboard` and `/operators`.
- [ ] No operator bypasses login, CAPTCHA, QR, 2FA, or security checkpoints.

## Playwright Checklist

- [ ] Run `npx playwright install chromium` in the deployment environment.
- [ ] Headless mode is enabled for unattended hosted operation unless manual browser visibility is required.
- [ ] Headed validation can be run locally with `WEB_OPERATOR_HEADLESS=false`.
- [ ] Sensitive screenshots are skipped for login, approval, and risky external-action steps.

## Storage Checklist

- [ ] `storage/generated-files` is writable by the app process.
- [ ] Screenshot directory is writable by the app process.
- [ ] Generated files do not expose absolute host paths.
- [ ] Download endpoints use file IDs and safe filenames.
- [ ] Raw scraped `source_text` is not exported.
- [ ] `/api/health` reports generated files and screenshots writable.

## Safety Checklist

- [ ] Operating Mode is reviewed before release.
- [ ] Read Only mode blocks browser execution and external preparation.
- [ ] Approval Required / Auto mode still creates approval gates for risky steps.
- [ ] Approval does not equal execution; resume is explicit.
- [ ] Sending, posting, messaging, publishing, joining, sharing, and downloading final assets require approval.
- [ ] Forbidden skill/playbook steps are blocked.
- [ ] CAPTCHA/login/security bypass is forbidden.
- [ ] Missing capabilities create proposals instead of auto-implementation.
- [ ] System Improvement validation guard prevents claiming unavailable skills/playbooks are available.

## MVP Smoke Test Checklist

- [ ] `/api/health` returns JSON with no secrets.
- [ ] `/dashboard` renders owner overview cards and warnings.
- [ ] `/setup` shows real CEO brain/setup status.
- [ ] `/ceo` can answer with the connected CEO brain.
- [ ] `/start-campaign` loads the guided campaign flow.
- [ ] `/operators` loads operator fleet state.
- [ ] Web Operator can open `https://example.com` in a safe test.
- [ ] `/approvals` shows pending approval queue.
- [ ] `/files` shows generated file list or empty state.
- [ ] `/system` shows capability map, proposals, lifecycle, and timeline.
- [ ] Self-improvement proposal exists for a missing capability when strategy requires one.

## Production Safety Scan

- [ ] No API keys are returned by any API response.
- [ ] No access tokens or refresh tokens are returned by any API response.
- [ ] No secret storage paths or absolute server paths are exposed.
- [ ] Raw `source_text` is not exported.
- [ ] Approval does not execute external action automatically.
- [ ] Forbidden steps are blocked and logged.
- [ ] No SMTP/direct-send path is active without explicit approval and launch readiness.
- [ ] No auto-post/message/publish path is active.
- [ ] Playwright sensitive screenshots are skipped.
- [ ] ChatGPT/Codex connection is not faked when OAuth is unconfigured.
- [ ] Claude connection is not faked when API/CLI/OAuth is unavailable.

## Deployment Blockers

- [ ] `DATABASE_URL` missing or database unreachable.
- [ ] `AUTH_SECRET` / `NEXTAUTH_SECRET` missing.
- [ ] `NEXTAUTH_URL` does not match deployment URL.
- [ ] No connected CEO brain.
- [ ] Playwright Chromium missing when Web Operator use is required.
- [ ] Generated-file or screenshot storage not writable.
- [ ] `/api/health` returns `ok=false`.
- [ ] Tests or build fail.
- [ ] Dashboard exposes secrets or internal absolute paths.
- [ ] Approval/resume safety regression found.

## Post-Deploy Checks

- [ ] `GET /api/health` returns expected status for database, setup, Web Operator, and storage.
- [ ] `/dashboard` loads without 500s.
- [ ] `/setup` reflects real provider state.
- [ ] `/ceo` responds using the configured CEO brain.
- [ ] `/system` shows proposal lifecycle and timeline.
- [ ] `/operators` shows browser runtime status.
- [ ] `/approvals` is empty or shows expected pending items.
- [ ] Create a test project and confirm strategy brief, launch checklist, and decision log are created.
- [ ] Run a safe Web Operator test on `https://example.com`.
- [ ] Confirm no external send/post/message/publish happened during smoke tests.
