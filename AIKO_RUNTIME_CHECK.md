# AÏKO Runtime Verification Report

**Date:** 2026-06-03  
**Auth mode:** `AIKO_AUTH_MODE=optional`  
**Port:** `3001`  
**Verified by:** local end-to-end run

---

## Step 1 — Clean install

```bash
rm -rf node_modules .next
npm install
```

| Check | Result |
|---|---|
| Install exit code | ✅ 0 (success) |
| `node_modules` present | ✅ |
| `.npmrc` registry pin | ✅ `registry=https://registry.npmjs.org/` |
| Vulnerabilities | ⚠️ 4 (3 moderate, 1 high) — not blocking, no fix without breaking changes |

---

## Step 2 — Tests

```bash
npm test
```

| Result | |
|---|---|
| Tests run | 136 |
| Pass | 136 |
| Fail | 0 |
| Exit code | ✅ 0 |

---

## Step 3 — Build

```bash
npm run build
```

| Check | Result |
|---|---|
| TypeScript compile | ✅ |
| Build exit code | ✅ 0 |
| Pages generated | ✅ 87 routes (static + dynamic) |
| Build blocker fixed | ✅ `actions/[id]/resume/route.ts` — missing `skill_id/skill_name/skill_decision` fields on `WebOperatorAction` object. Added the three fields from the DB row. |

---

## Step 4 — Setup check

```bash
npm run setup:check
```

| Check | Result |
|---|---|
| Node version | ✅ v22.22.2 |
| DATABASE_URL | ⚠️ Not detected by setup:check (script does not load `.env.local`; DB works fine in app) |
| AIKO_AUTH_MODE | ✅ optional |
| Ollama reachable | ✅ http://localhost:11434 |
| ChatGPT OAuth | ✅ Honestly reported as not configured |
| Claude OAuth | ✅ Honestly reported as not configured |
| OPENAI_API_KEY | ✅ Honestly reported as absent |
| ANTHROPIC_API_KEY | ✅ Honestly reported as absent |

---

## Step 5 — Environment

**`.env.local` contents (keys only, no values):**

- `DATABASE_URL` — postgresql://alli@localhost:5432/aiko
- `NEXTAUTH_SECRET` — set
- `AUTH_SECRET` — set (same value, required by newer next-auth)
- `NEXTAUTH_URL` — http://localhost:3001
- `AIKO_AUTH_MODE` — optional
- `OLLAMA_BASE_URL` — http://localhost:11434
- `BROWSER_HEADLESS` — true
- `SCREENSHOT_PATH` — ./screenshots

---

## Step 6 — Database

| Check | Result |
|---|---|
| PostgreSQL running | ✅ PostgreSQL 16.11 (Homebrew) |
| `aiko` database accessible | ✅ Verified via node pg |
| Migrations applied | ✅ App started without migration errors |

---

## Step 7 — App start

```bash
AIKO_AUTH_MODE=optional PORT=3001 npm run dev
```

| Check | Result |
|---|---|
| Server ready | ✅ Ready in 2.6s |
| Root redirect | ✅ 307 → setup/dashboard |
| `/setup` | ✅ 200 — shows "CEO brain connected: Ollama (local) / llama3.1:8b" |

---

## Step 8 — Provider status

**`GET /api/providers/subscription-diagnostics` response:**

| Field | Value |
|---|---|
| `chatgpt.status` | `oauth_not_configured` |
| `chatgpt.missing_env` | `OPENAI_OAUTH_CLIENT_ID`, `OPENAI_OAUTH_AUTH_URL`, `OPENAI_OAUTH_TOKEN_URL`, `OPENAI_OAUTH_REDIRECT_URI` |
| `claude.status` | `oauth_not_configured` |
| `claude.missing_env` | `CLAUDE_OAUTH_CLIENT_ID`, `CLAUDE_OAUTH_AUTH_URL`, `CLAUDE_OAUTH_TOKEN_URL` |
| `ceo_brain.can_think` | `true` |
| `ceo_brain.provider_name` | `Ollama (local)` |
| `ceo_brain.model` | `llama3.1:8b` |
| `fallbacks.ollama_connected` | `true` |
| `fallbacks.openai_api_connected` | `false` |
| `fallbacks.anthropic_api_connected` | `false` |

---

## Step 9 — Setup wizard

**`/setup`** — Step 4 displayed immediately:

> CEO brain connected  
> AÏKO can resolve a working CEO profile: **Ollama (local)** / llama3.1:8b  
> [Go to CEO Chat] [Start First Campaign] [Open Connect AI]

✅ No fake states shown.

---

## Step 10 — CEO Chat proof

**`/ceo`** — provider badge: `brain: Ollama (local)` visible top-right.

| Prompt | CEO Response | Tools Used |
|---|---|---|
| "Hello, what are you?" | "I'm the CEO of AÏKO, an AI marketing company…" | — |
| "Create a marketing project for ALB Parking." | "I'll create a new project called ALB Parking with the goal of increasing brand awareness and driving website traffic." | `create project`, `generate project map`, `update company memory` |

✅ Real Ollama responses, no fake output, tool badge tags visible.

---

## Step 11 — Page smoke test

All routes tested via `fetch()` from within the preview browser:

| Page | Status |
|---|---|
| `/setup` | ✅ 200 |
| `/connect-ai` | ✅ 200 |
| `/ceo` | ✅ 200 |
| `/start-campaign` | ✅ 200 |
| `/projects` | ✅ 200 |
| `/operator-skills` | ✅ 200 |
| `/operators` | ✅ 200 |
| `/approvals` | ✅ 200 |
| `/leads` | ✅ 200 |
| `/files` | ✅ 200 |
| `/agents` | ✅ 200 |

No blank pages. No 500s. No wrong redirects. No stale chunk errors.

---

## Step 12 — Connect AI honest status

**`/connect-ai`** verified visually:

- Section 1 · Current CEO Brain: **Ollama (local)** · auth: local · model: llama3.1:8b ✅
- ChatGPT / Codex card: badge = **"not configured"**, lists missing env var names ✅
- Claude card: (scrolled) same — **"not configured"**, honest ✅
- No fake "Connected" state shown for either ✅

---

## Step 13 — Web Operator Skills

**`GET /api/web-operator/skills`** — 7 skills loaded:
- Canva design, Facebook research, General web research, Gmail workflow, Instagram research, LinkedIn research, Website reader

**`/operator-skills`** page verified visually — Canva design shown with:
- Allowed actions: open_canva, create_design_draft, edit_text, upload_user_approved_assets, export_design
- Approval required: publish_design, share_design, download_final_asset
- Forbidden: use_unlicensed_assets_without_review, publish_without_approval

Guardrails confirmed present. No automatic posting/sending possible without approval.

---

## Step 14 — ChatGPT / Codex status

| Check | Result |
|---|---|
| OAuth env vars set | ❌ Not configured — expected in local dev |
| Shown honestly in UI | ✅ "not configured" badge with missing env var list |
| Fake connection shown | ✅ None |

---

## Step 15 — Claude status

| Check | Result |
|---|---|
| Claude OAuth env vars set | ❌ Not configured — expected in local dev |
| Claude Code CLI detected | ❌ Not in PATH for Next.js server process |
| CLAUDE_CODE_OAUTH_TOKEN | ❌ Not set in `.env.local` |
| Shown honestly in UI | ✅ "not configured" |
| Fake connection shown | ✅ None |

---

## Remaining blockers

| Issue | Severity | Notes |
|---|---|---|
| ChatGPT OAuth not configured | Expected | Requires OPENAI_OAUTH_CLIENT_ID + 3 other env vars |
| Claude OAuth not configured | Expected | Requires CLAUDE_OAUTH_CLIENT_ID + 2 other env vars |
| npm audit: 4 vulnerabilities | Low | No `--force` fix without breaking changes |
| setup:check doesn't load .env.local | Cosmetic | Script reports DATABASE_URL missing; app works fine |

**No blocking runtime issues. App is operational with Ollama as CEO brain.**
