# AÏKO Runtime Verification Report

**Date:** 2026-06-03
**Auth mode intended:** `AIKO_AUTH_MODE=optional`
**Port intended:** `3001`
**Package manager:** npm (`package-lock.json` is the only lockfile)

## Dependency audit

| Check | Result |
|---|---|
| `package.json` declares `next` | ✅ `next@14.2.35` is in `dependencies`. |
| React runtime deps | ✅ `react` and `react-dom` are declared. |
| Lockfile | ✅ `package-lock.json` exists; no pnpm/yarn lockfile found. |
| npm registry | ✅ `.npmrc` pins `registry=https://registry.npmjs.org/`. |
| `node_modules` before install | ❌ Missing. |
| `node_modules` after attempted install | ⚠️ Partial only; `node_modules/next` exists but `node_modules/.bin/next` is missing. |

## Install attempt

Commands run:

```bash
rm -rf .next
npm install
```

Observed result:

- npm emitted `Unknown env config "http-proxy"` warnings.
- npm emitted `MaxListenersExceededWarning` while installing.
- The command did not complete or print normal install completion after an extended wait.
- The process was terminated to avoid continuing a hung install.
- `node_modules` was left partial and unusable for Next.js build/dev because `node_modules/.bin/next` is missing.

This means the container still cannot be considered install/runtime ready. A normal developer/deployment environment must complete `npm install` cleanly.

## Build and tests

| Command | Result |
|---|---|
| `npm test` | ✅ Passed: 136/136 tests. |
| `npm run build` | ❌ Failed: `sh: 1: next: not found`. |
| `npx tsc --noEmit` | ⚠️ Not valid until dependencies install; it reports missing React/Next/Node/Playwright type packages from incomplete `node_modules`. |
| `npm run setup:check` | ✅ Completed and printed no secrets. |
| `git diff --check` | ✅ Passed. |

## Dev server / HTTP runtime check

Command requested:

```bash
AIKO_AUTH_MODE=optional PORT=3001 npm run dev
```

Result: not run after build failure. It would fail for the same reason as build: `node_modules/.bin/next` is missing.

Therefore these routes are **not runtime-verified in this container**:

- `/setup`
- `/connect-ai`
- `/ceo`
- `/start-campaign`
- `/operator-skills`
- `/files`
- `/agents`
- `/projects`

## Setup checker output summary

`npm run setup:check` reported:

- Node version: `v20.20.2`
- npm installed: yes (`11.4.2`)
- `DATABASE_URL`: missing
- `AIKO_AUTH_MODE`: optional
- Ollama reachable: no
- ChatGPT OAuth configured: no
- Claude OAuth configured: no
- Claude Code CLI detected: no
- `CLAUDE_CODE_OAUTH_TOKEN`: missing
- `OPENAI_API_KEY`: missing
- `ANTHROPIC_API_KEY`: missing

Suggested next step: set `DATABASE_URL` before running AÏKO.

## Current provider reality in this container

| Provider path | Reality |
|---|---|
| ChatGPT/Codex OAuth | Not connected and not configured. Missing required OpenAI OAuth env vars. |
| OpenAI API key | Not connected/verified; no env key and no DB profile available. |
| Claude OAuth | Not connected and not configured. Missing Claude OAuth env vars. |
| Claude Code local | Not detected. |
| Anthropic API key | Not connected/verified; no env key and no DB profile available. |
| Ollama | Not reachable. |
| CEO brain | Not resolved/verified because no `DATABASE_URL`, no running app, and no provider profile. |

## Remaining runtime blockers

1. Complete `npm install` so `node_modules/.bin/next` exists.
2. Set `DATABASE_URL` and run migrations through `039_web_operator_skills.sql`.
3. Configure at least one real provider/auth profile and assign it to CEO.
4. Run `npm run build` successfully.
5. Start `AIKO_AUTH_MODE=optional PORT=3001 npm run dev`.
6. Manually verify `/setup`, `/connect-ai`, `/ceo`, `/start-campaign`, `/operator-skills`, `/files`, `/agents`, and `/projects`.
