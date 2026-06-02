# AÏKO Runtime Verification Report

**Date:** 2026-06-02  
**Port:** 3001  
**Auth mode:** `AIKO_AUTH_MODE=optional` (no Google login required)

---

## Core pages (all returned HTTP 200)

| Page | Status |
|---|---|
| / (root → /dashboard) | ✅ 200 |
| /dashboard | ✅ 200 |
| /connect-ai | ✅ 200 |
| /files | ✅ 200 |
| /agents | ✅ 200 |
| /projects | ✅ 200 |
| /leads | ✅ 200 |
| /office | ✅ 200 |
| /system | ✅ 200 |
| /settings | ✅ 200 |

---

## Provider / OAuth honest state

- **OpenAI (API key):** configured if `OPENAI_API_KEY` is set — no fake state  
- **ChatGPT OAuth:** `GET /api/auth/chatgpt/start` → HTTP 422 `{"configured":false}` when env vars absent ✅  
- **Anthropic (API key):** configured if `ANTHROPIC_API_KEY` is set — no fake state  
- **Claude OAuth:** `GET /api/auth/claude/start` → HTTP 422 `{"configured":false}` when env vars absent ✅  
- **Ollama:** `GET /api/providers/ollama/status` → reports actual connection result (not faked) ✅

---

## Generated files

| Step | Result |
|---|---|
| POST /api/files (create markdown) | ✅ Created, returned `{file: {...}}` |
| File on disk at `storage/generated-files/{uuid}/filename.md` | ✅ Confirmed |
| DB `storage_path` is relative (not absolute) | ✅ `generated-files/{uuid}/filename.md` |
| GET /api/files (list) | ✅ File appears |
| GET /api/files/{id}/download | ✅ `Content-Disposition: attachment`, correct MIME |
| DELETE /api/files/{id} | ✅ Removed from list |
| Path traversal guard: filenames sanitised via `path.basename` | ✅ |
| `/files` page loads with generate form | ✅ — title, type selector, content textarea, Save button |
| File appears in list immediately after save | ✅ optimistic prepend |
| Project Files tab (`/projects/[id]` → Files) | ✅ Filters by `project_id` |

---

## Custom agents

| Step | Result |
|---|---|
| GET /api/custom-agents → 5 built-in agents | ✅ |
| POST /api/custom-agents `{name, purpose}` → draft agent | ✅ status=draft |
| All 5 security constraints present | ✅ `must_delegate_to_web_operator`, `inherits_operating_mode`, `cannot_bypass_approvals`, `cannot_send_emails_directly`, `cannot_access_secrets` |
| PATCH /api/custom-agents/{id} `{status:"active"}` | ✅ |
| DELETE /api/custom-agents/{id} → archives (not hard-delete) | ✅ status=archived |
| `/agents` page shows built-in + custom sections | ✅ |
| "New agent" button opens create form | ✅ AI-generated mode + manual mode |
| AI-generated spec path (POST `{need:"..."}`) | ✅ spec generated, constraints enforced |

---

## CEO custom agent fast-path

- Input: `"Create an agent for influencer outreach."`
- Result: `intent=create_agent`, agent spec returned without triggering full CEO context ✅
- Pattern regex: `/create\s+(an?\s+)?(new\s+)?agent\s+(for|to|that)\s+/i` ✅

---

## Build & tests

```
npm run build   →  ✅  no errors, /files and /agents in output
npm test        →  ✅  90/90 passing (0 failures)
npx tsc --noEmit → ✅  no type errors
```

---

## Issues found & fixed during runtime verification

| Issue | Fix |
|---|---|
| `Buffer` not assignable to `BodyInit` in download route | Cast via `as unknown as BodyInit` |
| `db.query<T>()` generic not supported | Stripped generic params from all db calls |
| `callAI(role, messages, opts)` wrong signature | Changed to `callAI({role, messages, ...})` |
| Create-agent regex didn't match "an agent" (article) | Fixed `(a\s+)?` → `(an?\s+)?` |
| Dev server defaulted to port 3000 | Started with `PORT=3001 npm run dev` |
| `/files` page had no generate form | Added `GenerateFileForm` component (title, type, content, save) |
| `/agents` page had no create form | Added `CreateAgentForm` component (AI-generated + manual modes) |
