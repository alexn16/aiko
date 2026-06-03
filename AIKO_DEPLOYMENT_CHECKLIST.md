# AÏKO Deployment Readiness Checklist

**Date:** 2026-06-03

## 1. Required environment variables

| Variable | Required for | Notes |
|---|---|---|
| `DATABASE_URL` | All runtime persistence | Required before migrations, setup, CEO brain, projects, approvals, operators, and files can work. |
| `AIKO_AUTH_MODE` | Auth/setup mode | `optional` for local single-user; `required` for hosted/team deployments. Defaults should be explicit in deployment. |
| `NEXTAUTH_URL` | NextAuth callbacks/session URLs | Required for hosted auth; should match deployed public origin. |
| `AUTH_SECRET` or `NEXTAUTH_SECRET` | NextAuth/session signing | Required for stable sessions. Do not commit. |
| File/generated storage path variables if configured | Generated files/artifacts | Ensure generated-files and screenshot paths are writable by the runtime user. |
| Operating mode default/config | Safety policy | Confirm desired default: read-only/auto-approval/full-access. |

## 2. Optional provider environment variables

| Variable(s) | Provider path | Notes |
|---|---|---|
| `OPENAI_OAUTH_CLIENT_ID`, `OPENAI_OAUTH_AUTH_URL`, `OPENAI_OAUTH_TOKEN_URL`, `OPENAI_OAUTH_REDIRECT_URI`, optional `OPENAI_OAUTH_CLIENT_SECRET` | ChatGPT/Codex OAuth | Requires public HTTPS redirect URL in hosted deployments. Separate from OpenAI API key. |
| `OPENAI_API_KEY` | OpenAI API fallback | Can be entered through UI profile setup; if using env bootstrap, never expose value. |
| `ANTHROPIC_API_KEY` | Anthropic API fallback | Separate from Claude account/Claude Code. |
| `CLAUDE_OAUTH_CLIENT_ID`, `CLAUDE_OAUTH_AUTH_URL`, `CLAUDE_OAUTH_TOKEN_URL`, optional `CLAUDE_OAUTH_CLIENT_SECRET` | Claude OAuth | Only mark configured when these exist and exchange works. |
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude Code local/CLI | Only use if Claude Code local auth is actually available and testable. |
| `OLLAMA_BASE_URL` | Ollama local | Defaults commonly to `http://localhost:11434`; service must be reachable by the app container. |
| OpenRouter/custom endpoint keys | OpenRouter/custom profiles | Add through auth profiles; never return secrets to frontend. |

## 3. Services needed

- Postgres database with all migrations applied through `039_web_operator_skills.sql`.
- Node.js and npm matching the lockfile install path.
- Next.js dependencies installed (`node_modules/.bin/next` must exist).
- Playwright package and browser runtime installed for Web Operator execution.
- Writable filesystem/storage for generated files and screenshots.
- Optional: Ollama service and models.
- Optional: Claude CLI/local auth.
- Optional: public HTTPS domain for OAuth redirects.

## 4. Deployment blockers to check

| Blocker | Required check |
|---|---|
| Dependencies | `npm install` completes and `node_modules/.bin/next` exists. |
| Build | `npm run build` succeeds. |
| Migrations | Run all SQL migrations in order; confirm auth profile and Web Operator skill columns exist. |
| Database | `DATABASE_URL` set and reachable from deployment. |
| Storage | Generated file and screenshot paths writable. |
| Playwright | Browser binaries installed and executable. |
| Secrets | Diagnostics and provider APIs never return API keys/tokens; only missing env names/booleans. |
| OAuth | Redirect URLs match deployed HTTPS origin exactly. |
| Auth mode | Decide `optional` vs `required`; required mode needs complete NextAuth config. |
| CEO brain | `/api/providers/test-ceo-brain` succeeds after assigning a provider to CEO. |
| Approval safety | Approving an item does not execute; explicit resume does. |

## 5. Deployment modes

### Local single-user mode

```bash
AIKO_AUTH_MODE=optional
```

- Google login is optional identity only.
- `/setup` and `/connect-ai` should be usable without login.
- Best first provider paths: Ollama local, OpenAI API key, Anthropic API key.

### Hosted/team mode

```bash
AIKO_AUTH_MODE=required
```

- Dashboard/provider setup may require login depending current middleware policy.
- Configure `NEXTAUTH_URL` and `AUTH_SECRET`/`NEXTAUTH_SECRET`.
- Use HTTPS for OAuth callbacks.

## 6. Pre-deploy commands

Run these from a clean checkout:

```bash
rm -rf node_modules .next
npm install
npm test
npm run build
npm run setup:check
git diff --check
```

Expected:

- `npm install` completes.
- `npm test` passes.
- `npm run build` passes.
- `setup:check` prints no secrets and identifies only intentionally missing optional providers.

## 7. Post-deploy manual checks

1. Open `/setup`.
2. Connect a real provider (Ollama, OpenAI API key, Anthropic API key, or configured OAuth).
3. Run provider test and assign CEO.
4. Run Brain Verification (`/api/providers/test-ceo-brain`).
5. Open `/ceo` and ask `Hello, what are you?`.
6. Create a project and open the first campaign flow.
7. Open `/connect-ai` and confirm diagnostics are honest.
8. Open `/operator-skills` and confirm skill catalog renders.
9. Open `/files`, `/agents`, `/projects`, `/approvals`, `/start-campaign`.
10. Test a Web Operator action in read-only/approval mode before any browser execution in production.

## 8. Current container readiness status

- `DATABASE_URL`: missing.
- `npm install`: attempted but did not complete; partial `node_modules` lacks `node_modules/.bin/next`.
- `npm test`: passed 136/136.
- `npm run build`: failed because `next` binary is missing.
- `npm run setup:check`: passed as a diagnostic command and reported no configured provider envs.
- Runtime HTTP checks: not performed because the server cannot start without Next.js dependencies.
