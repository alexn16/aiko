# AÏKO Runtime Check

**Date:** 2026-06-01  
**Port:** 3001  
**URL:** http://localhost:3001  
**Auth mode:** optional (no Google login required)

---

## Environment

| Item | Status |
|------|--------|
| DATABASE_URL | `postgresql://alli@localhost:5432/aiko` ✓ |
| NEXTAUTH_SECRET | set ✓ |
| NEXTAUTH_URL | `http://localhost:3001` ✓ |
| AIKO_AUTH_MODE | `optional` (added to .env.local) ✓ |
| PostgreSQL | Running (v16.11) ✓ |
| Ollama | Running at `http://localhost:11434` ✓ |

---

## Migrations

All 34 migrations applied cleanly.

Migrations 025_execution_trail through 034_project_executive_reports were pending and applied manually before this run (they now auto-apply on next server start via `instrumentation.ts`).

---

## Build & Tests

```
npm run build   → ✓ Compiled successfully
npm test        → 80/80 pass, 0 fail
```

---

## App startup

```
npm run dev     → ✓ Ready in 2.3s (port 3001)
```

No errors in startup log.

---

## Page health

| Page | Status |
|------|--------|
| `/` | 307 → `/ceo` (correct: brain connected, optional mode) |
| `/connect-ai` | 200 ✓ |
| `/ceo` | 200 ✓ |
| `/start-campaign` | 200 ✓ |
| `/projects` | 200 ✓ |
| `/leads` | 200 ✓ |
| `/operators` | 200 ✓ |
| `/approvals` | 200 ✓ |

---

## Diagnostics

`GET /api/auth/diagnostics`:
```json
{
  "auth_mode": "optional",
  "can_configure_without_login": true,
  "api_providers": { "ollama_connected": true },
  "ceo_brain": {
    "can_ceo_think": true,
    "assigned_provider": "Ollama (local)",
    "model": "llama3.1:8b"
  }
}
```

`GET /api/providers/diagnostics`:
```json
{
  "ok": true,
  "can_ceo_think": true,
  "ceo_provider": { "name": "Ollama (local)", "model": "llama3.1:8b" }
}
```

---

## Ollama

- Running at `http://localhost:11434`
- Models installed: `llama3.1:8b`, `qwen2.5:7b-instruct`, `qwen2.5-coder:7b`, `qwen2.5:0.5b`
- `llama3.1:8b` confirmed present ✓

---

## Brain Verification

`POST /api/providers/test-ceo-brain`:
```json
{
  "success": true,
  "provider": { "name": "Ollama (local)", "model": "llama3.1:8b" },
  "response": "AÏKO_CEO_OK I am ready to process your request."
}
```

---

## CEO Chat

`POST /api/ceo/command` — `"Hello, what are you?"`:
```
intent: general
response: "I'm the CEO of AÏKO, an AI marketing company..."
```
Real Ollama response ✓. No fake fallback. No login required.

`POST /api/ceo/command` — `"What decisions have been made for RapidBuild?"`:
```
intent: project_recall
response: "The following key decisions have been made for RapidBuild: Kenji was assigned as PM..."
```
Decision log context used correctly ✓.

`POST /api/ceo/command` — `"Generate an executive report for RapidBuild"`:
```
intent: executive_report
chips: ["📊 View reports", "📁 Open project", "▶ First Campaign Flow"]
response: "Here's the executive report for RapidBuild..."
```
Report generated and chips returned ✓.

---

## Fixes Made

1. **`AIKO_AUTH_MODE=optional` added to `.env.local`** — was missing (code defaulted correctly, but explicit is better).

2. **`p.status` column bug in `lib/project-context.ts`** — `projects` table has no `status` column, only `active` (boolean). Fixed query to use `CASE WHEN p.active THEN 'active' ELSE 'inactive' END AS status`. This caused executive reports and CEO recall (project context) to 500.

3. **Recall patterns extended in `ceo-command-agent.ts`** — Added patterns for `"what decisions have been made for X"` and `"why did we..."` so they route through the fast-path recall that includes decision log context rather than the full CEO agent that lacks it.

4. **Migrations applied manually** — Migrations 025_execution_trail through 034 were not yet applied to the local DB. Applied via migration script. Future server starts will auto-apply via `instrumentation.ts`.

---

## Remaining Manual Steps

None required for core use. The app is fully functional.

Optional:
- Connect a second AI provider (OpenAI API, Anthropic API) via `/connect-ai` if you want a faster/higher-quality brain than `llama3.1:8b`.
- Google OAuth (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) is not configured — not needed in `optional` mode.
