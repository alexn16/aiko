# AÏKO Brain Routing Report

_Last updated: 2026-06-01 (rev 6 — provider audit, generated files, custom agents)_

---

## 0. Authentication model

AÏKO follows **OpenClaw-style provider auth**: AI brain connections are independent of Google login.
Google login is optional account identity, not a prerequisite for connecting ChatGPT or Claude.

| Identity layer | What it does | What it does NOT do |
|---|---|---|
| **Google login** | Identifies the AÏKO user in multi-user mode | Connects ChatGPT or Claude |
| **ChatGPT / Codex OAuth** | Connects ChatGPT subscription brain directly | Require Google login |
| **Claude account OAuth** | Connects Claude subscription brain directly | Require Google login |
| **OpenAI API key** | Separate API brain (billing via OpenAI account) | Same as ChatGPT OAuth |
| **Anthropic API key** | Separate API brain (billing via Anthropic account) | Same as Claude account OAuth |

### AIKO_AUTH_MODE

`AIKO_AUTH_MODE` (env var) controls whether Google login is required:

| Mode | Default | Behavior |
|---|---|---|
| `optional` | **Yes** | `/connect-ai` and all `/api/providers/**` routes work without session. Provider rows stored with `user_id = null` (global). ChatGPT/Claude OAuth work without Google login. |
| `required` | No | All dashboard routes require a session. Provider rows are user-scoped. Use for multi-user / hosted deployments. |

### Login flow (when signed in)
1. User visits any protected route → redirected to `/login`
2. User clicks "Sign in with Google" → NextAuth handles Google OAuth
3. Google returns sub + email → AÏKO upserts `users` row
4. Session JWT stores `user.id` (our UUID)
5. Provider connections are now scoped to that `user.id`

### Flow in optional mode (no login)
1. User visits `/connect-ai` → no redirect, page loads
2. User connects ChatGPT via OAuth or API key
3. Provider row stored with `user_id = null` (global / single-user)
4. CEO Chat resolves provider from global fallback
5. Google login available as optional step at any time

### Per-user provider isolation
- `provider_connections.user_id` — owner of the connection (`null` = global)
- `ai_role_assignments.user_id` — owner of the assignment (`null` = global)
- `getAllProviders(userId)` returns only that user's providers; `null` → global providers
- `getProviderForRole(role, userId)` resolves: user assignment → user fallback → global assignment → global fallback
- User A cannot see User B's providers

### OAuth connection types

| Provider | Catalog ID | Auth type | Env vars needed | Requires Google login? |
|---|---|---|---|---|
| ChatGPT | `chatgpt_oauth` | `oauth` | `OPENAI_OAUTH_CLIENT_ID` + `AUTH_URL` + `TOKEN_URL` | No (optional mode) |
| Claude | `claude_oauth` | `oauth` | `CLAUDE_OAUTH_CLIENT_ID` + `AUTH_URL` + `TOKEN_URL` | No (optional mode) |

When env vars are missing → routes return `{ configured: false, error: "...not configured..." }` — no fake success.

OAuth tokens are stored as `oauth_access_token` / `oauth_refresh_token` in `provider_connections`.  
When expired, `dispatchCall` auto-refreshes. On refresh failure → `status = 'needs_reauth'` → `NeedsReauthError` thrown.

In `AIKO_AUTH_MODE=optional` with no session, OAuth callback stores token under `user_id = null`.

### Environment variables

```
# Auth mode (default: optional)
AIKO_AUTH_MODE=optional   # or 'required' for hosted/multi-user

# Google login (optional in local mode)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=          # openssl rand -base64 32
NEXTAUTH_URL=             # http://localhost:3001 for dev

# ChatGPT OAuth (optional — for subscription OAuth)
OPENAI_OAUTH_CLIENT_ID=
OPENAI_OAUTH_AUTH_URL=
OPENAI_OAUTH_TOKEN_URL=

# Claude OAuth (optional — for subscription OAuth)
CLAUDE_OAUTH_CLIENT_ID=
CLAUDE_OAUTH_AUTH_URL=
CLAUDE_OAUTH_TOKEN_URL=
```

---

## 1. Canonical AI call path

```
User action (CEO chat, review, report, outreach)
  │
  ▼
callAI({ role: 'ceo' | 'research' | 'copywriting' | 'review' | ..., messages })
  │   lib/ai/router.ts
  │
  ▼
getProviderForRole(role)
  ├─ 1. Query ai_role_assignments WHERE role = $1 → JOIN provider_connections WHERE status='connected'
  └─ 2. Fallback: SELECT * FROM provider_connections WHERE status='connected' LIMIT 1
  │
  ▼
getCompatibility(provider)
  ├─ reads provider_connections.compatibility column (set by catalog on creation)
  └─ falls back to type-based mapping for legacy rows:
       openai_api / ollama / openai_compatible / custom → 'openai_compatible'
       anthropic_api / anthropic_compatible / claude_direct  → 'anthropic_messages'
  │
  ├─ 'openai_compatible' → lib/ai/providers/openai-compat.ts
  │     callOpenAICompat(baseURL, key, model, messages)
  │
  └─ 'anthropic_messages' → lib/ai/providers/anthropic.ts
        callAnthropic(key, model, messages)
```

---

## 2. Database tables

| Table | Purpose |
|---|---|
| `provider_connections` | User-configured AI providers: type, base_url, model, api_key_encrypted, status |
| `ai_role_assignments` | Maps each AÏKO role to a `provider_connections.id` |
| `model_configs` | **Legacy only** — old per-agent config rows; no longer queried by active features |

### Key columns in `provider_connections`

| Column | Notes |
|---|---|
| `type` | Provider identifier (e.g. `openai_api`, `anthropic_api`, `ollama`) |
| `compatibility` | Adapter selector: `openai_compatible` or `anthropic_messages` — set on create from catalog |
| `api_key_encrypted` | Stored server-side; **never returned** in `getAllProviders()` API output (query hard-codes `'' as api_key_encrypted`) |
| `status` | `connected` (last test passed), `disconnected`, `error` |
| `last_error` | Error message from most recent failed test |
| `provider_catalog_id` | FK to `lib/ai/provider-catalog.ts` entry id |

---

## 3. Role assignment behavior

AÏKO defines 7 roles:

| Role | Default use |
|---|---|
| `ceo` | CEO Chat, CEO reviews, CEO command agent |
| `project_manager` | PM chat (`/api/projects/[id]/pm-chat`) |
| `research` | Lead extraction, web research summaries |
| `copywriting` | Outreach draft generation |
| `review` | Campaign review, reporting agent |
| `qa` | Quality assurance checks |
| `local_fallback` | Intended for local Ollama when cloud is unavailable |

**Fallback order:**
1. Role-specific assignment from `ai_role_assignments` → connected provider
2. Any connected provider (first row by `created_at ASC`)
3. If none → `callAI` throws `"No AI provider connected. Go to Connect AI to add one."`

**Smart defaults** (`POST /api/providers/brain { action: 'apply_defaults' }`):
- Fills only empty slots — never overrides existing assignments
- Assigns by capability tags from the catalog (e.g. `reasoning` → `ceo`, `local` → `local_fallback`)

---

## 4. Active features using `callAI` (correct path)

| Feature | Route | Role used |
|---|---|---|
| CEO Chat | `POST /api/ceo/command` → `runCeoCommandAgent` | `ceo` |
| CEO Reviews | `POST /api/ceo/reviews` → `runCeoReviewAgent` | `ceo` |
| PM Chat | `POST /api/projects/[id]/pm-chat` | `project_manager` |
| Chat (general) | `POST /api/chat` | `ceo` (streamed) |
| Lead extraction | `lib/leads.ts extractLeadsFromWebOperatorAction` | `research` |
| Outreach copywriting | `lib/outreach/lead-outreach.ts generateLeadOutreachDraft` | `copywriting` |
| Task output generation | `lib/agents/task-outputs.ts` | `review` |
| Campaign analysis | `lib/campaigns.ts`, `lib/campaign-launch-readiness.ts` | `review` |
| Reporting | `POST /api/reports/generate` → `runReportingAgent` | `review` |
| System improvements | `lib/system-improvements.ts` | `review` |
| Executive reports | `lib/project-executive-report.ts` | `ceo` |
| Project recall | `runRecallQuery` in `ceo-command-agent.ts` | `ceo` |
| Custom agent spec generation | `lib/custom-agents.ts generateAgentSpecFromNeed` | `ceo` |

---

## 5. Remaining legacy `callLLM` usages

These files still use `callLLM` from `lib/models/provider.ts`. They are **safe** because they are called only by API routes that are not active in the current UI, or are reached only via the legacy `model_configs` table which is only populated if users had the old setup.

| Agent file | Calling route | Active in UI? | Notes |
|---|---|---|---|
| `ceo-agent.ts` | Not called by any route | ❌ No | Orphaned legacy file |
| `copywriting-agent.ts` | Old outreach routes (`/api/outreach/`) | ❌ No | Pre-Web-Operator SMTP path |
| `research-agent.ts` | `POST /api/leads/scrape` | ❌ No | Pre-Web-Operator lead scraping |
| `browser-agent.ts` | `POST /api/browser/run` | ❌ No | Pre-Web-Operator browser path |
| `quality-agent.ts` | Old agent runner | ❌ No | Not reached from any UI |
| `strategy-agent.ts` | Old agent runner | ❌ No | Not reached from any UI |
| `social-media-agent.ts` | Old agent runner | ❌ No | Not reached from any UI |
| `reporting-agent.ts` | `POST /api/reports/generate` | ✅ **Migrated** | Now uses `callAI(role:'review')` |
| `ceo-review-agent.ts` | `POST /api/ceo/reviews` | ✅ **Migrated** | Now uses `callAI(role:'ceo')` |
| `project-manager-report-agent.ts` | `POST /api/projects/[id]/pm-reports` | ❌ No UI trigger | Low priority; not visible in UI |
| `evaluator-agent.ts` | Old task pipeline | ❌ No | Not reached |
| `orchestrator.ts` | Old task pipeline | ❌ No | Not reached |
| `sales-validation-agent.ts` | Old pipeline | ❌ No | Not reached |
| `custom-agent.ts` | Old pipeline | ❌ No | Not reached |
| `project-manager-agent.ts` | Old pipeline | ❌ No | Not reached |

**Rule**: `callLLM` is now only used in agents that are unreachable from the current UI. All active reasoning goes through `callAI(role)`.

---

## 6. How to debug "CEO cannot think"

### Step 1 — Check diagnostics
```
GET /api/providers/diagnostics
```
Look for:
- `can_ceo_think: false` → no provider resolves for CEO role
- `summary.connected === 0` → no provider is marked connected
- `ceo_role_assignment.provider_id === null` → CEO role has no explicit assignment

### Step 2 — Check provider status
```
GET /api/providers
```
- If `status === 'error'`, check `last_error` field on that provider
- If `status === 'disconnected'`, provider was never successfully tested

### Step 3 — Run a connection test
```
POST /api/providers/{id}/test
```
This makes a real test call with a minimal prompt. Updates `status` and `last_error` in the DB.

### Step 4 — Assign CEO role
```
POST /api/providers/brain
{ "action": "apply_defaults" }
```
Or manually assign via `/connect-ai` → Role Assignments section.

### Step 5 — Use Brain Verification panel (easiest)
Open `/connect-ai` → scroll to **Brain verification** section.

The panel shows:
- **CEO can think** — live flag from `/api/providers/diagnostics`
- **Provider / Model / Compatibility** — which provider resolves for CEO
- **Role assignment** — whether CEO has an explicit assignment or is using fallback

Click **⚡ Send test CEO message** to fire a real `callAI(role:'ceo')` call with:
```
"Reply with exactly: AÏKO_CEO_OK followed by one short sentence confirming you are ready."
```

- ✓ Green result + provider name/model = brain is fully working
- ✗ Red result + error text = fix the shown error (key issue, model not found, etc.)

This calls `POST /api/providers/test-ceo-brain` which:
1. Resolves the CEO provider through the canonical router
2. Calls `callAI(role:'ceo', messages)` — real inference, no fake success
3. Returns provider name, model, and raw response
4. Creates no CEO commands, no tasks, no memory mutations

### Step 5b — Test from /ceo directly
If the CEO brain is offline, `/ceo` now shows a **CEO Offline** panel instead of the chat. The panel:
- Explains the specific reason (no provider / provider error / no CEO assignment)
- Shows last error text from the provider
- Shows connected / errored / total provider counts from diagnostics
- Has **⚡ Test CEO brain** button (same as Connect AI panel — calls `POST /api/providers/test-ceo-brain`)
- On success: reloads page state and enables chat automatically
- On failure: shows specific error with link to `/connect-ai`

The top bar also switches to a red "CEO brain offline" badge (instead of green) when `can_ceo_think` is false.

### Step 6 — Send a real CEO chat message
Once the offline panel disappears (or if it was never shown), go to `/ceo` and type:
> "What is the current status of the company?"

If you see a real executive-style response, the full routing chain is working.

**If the message fails** (provider errors mid-session), the chat now:
- Keeps your message visible with a red error bubble (not silently removed)
- Shows a specific error: "AÏKO CEO has no working brain" (503) or "Provider error: …" (502)
- Shows a dismissible error banner above the input with "Connect AI →" link

---

## 7. How to verify with different provider types

### End-to-end manual checklist

1. **Connect provider** — `/connect-ai` → pick provider → enter key/URL/model → Save & connect → green "Connection successful"
2. **Assign CEO** — `/connect-ai` → Role Assignments → set CEO → save  
   *(or click "Apply smart defaults" to auto-assign by capability)*
3. **Run Brain Verification** — `/connect-ai` → Brain verification → ⚡ Send test CEO message → expect green ✓
4. **Send real CEO message** — `/ceo` → type a command → expect a real AI response

If step 3 fails but step 1 passed, check:
- Does the model name match what the provider supports? (e.g. Anthropic uses `claude-opus-4-5`, not `gpt-4o`)
- Is the API key valid and has credits?
- For Ollama: is `ollama serve` running and the model pulled?

### OpenAI
1. Get key from [platform.openai.com](https://platform.openai.com/api-keys)
2. `/connect-ai` → OpenAI API → enter key → select `gpt-4o` → Save & connect
3. Test should pass; CEO chat should respond

### Anthropic
1. Get key from [console.anthropic.com](https://console.anthropic.com/settings/keys)
2. `/connect-ai` → Anthropic API → enter key → select `claude-opus-4-5` → Save & connect
3. **No base URL needed** — Anthropic SDK uses its own endpoint
4. CEO chat should respond via `anthropic_messages` adapter

### Ollama (local)
1. Run Ollama locally: `ollama pull llama3.2 && ollama serve`
2. `/connect-ai` → Ollama → base URL `http://localhost:11434/v1` → no key needed → Save & connect
3. CEO chat should respond

### OpenRouter
1. Get key from [openrouter.ai](https://openrouter.ai/keys)
2. `/connect-ai` → OpenRouter → base URL `https://openrouter.ai/api/v1` → enter key → model e.g. `openai/gpt-4o` → Save & connect
3. Uses `openai_compatible` adapter

---

## 8. What `model_configs` (legacy) does

- Table from migration `001`; populated only by the old `/settings` model configuration form
- Still read by `lib/models/config.ts` (`getModelConfig`, `getAllModelConfigs`)
- No longer read by any active AI route (CEO chat, reviews, reporting, etc.)
- Still checked by `GET /api/setup` as a final fallback for SetupGate
- **Safe to ignore** unless you specifically populated it

---

## 9. API key security

- **Never returned** in `GET /api/providers` — the SQL query hard-codes `'' as api_key_encrypted`
- **Never wiped** by `PATCH /api/providers/{id}` unless a non-empty `api_key` string is explicitly provided
- Stored as plain text in `provider_connections.api_key_encrypted` — encryption at rest depends on DB host configuration
- Not logged anywhere in the application

---

## 10. Connection flow (new provider)

```
1. POST /api/providers { name, type, base_url, model, api_key, compatibility }
   → INSERT INTO provider_connections (status='disconnected') RETURNING id

2. POST /api/providers/{id}/test
   → testProvider(id) → reads real api_key_encrypted
   → dispatches real test call via openai-compat or anthropic adapter
   → on success: UPDATE status='connected', last_tested_at=NOW()
   → on failure: UPDATE status='error', last_error=message

3. (Optional) POST /api/providers/brain { action: 'apply_defaults' }
   → assigns roles by capability tags, fills only empty slots

4. GET /api/providers/diagnostics
   → confirms can_ceo_think = true
```

---

## 11. CEO fast-paths (rev 6)

The `runCeoCommandAgent` function short-circuits the full CEO agent for specific patterns:

| Fast-path | Pattern examples | Handler |
|---|---|---|
| Executive report | "Generate an executive report for X" | `runReportQuery` |
| Project recall | "What are we doing for X", "Summarize X", "Why did we..." | `runRecallQuery` |
| Create agent | "Create an agent for X", "Build an agent to Y" | `runCreateAgentQuery` |

Order: report → create agent → recall → full CEO agent.

Fast-paths are tried sequentially; if one throws, falls through to the next.

---

## 12. Generated Files (rev 6)

Files generated by AÏKO agents are stored with DB metadata + disk content.

**Database:** `generated_files` table (migration 035)  
**Disk storage:** `storage/generated-files/{uuid}/{filename}` (relative to project root)  
**Security:**
- Path traversal prevented — all resolved paths validated against `STORAGE_BASE`
- File IDs are UUIDs — no user-controlled path components
- Content never injected into AI prompts
- API keys and secrets never written to files

**API:**
- `GET /api/files` — list files (optional `?project_id=`)
- `POST /api/files` — create file with content
- `GET /api/files/[id]` — file metadata
- `GET /api/files/[id]/download` — file content (streamed with `Content-Disposition: attachment`)
- `DELETE /api/files/[id]` — deletes DB record and disk file

**UI:** `/files` page + "Files" tab in project workspace.

---

## 13. Custom Agents (rev 6)

Custom agents are specs created by the CEO. They are **not** autonomous executors.

**Database:** `custom_agents` table (migration 036)  
**API:** `GET|POST /api/custom-agents`, `GET|PATCH|DELETE /api/custom-agents/[id]`  
**UI:** `/agents` page

**Security constraints (always enforced, cannot be overridden):**
- `must_delegate_to_web_operator` — no direct web actions
- `inherits_operating_mode` — respects manual / supervised / autonomous setting
- `cannot_bypass_approvals` — all approval-gated actions still require human approval
- `cannot_send_emails_directly` — all email via Web Operator browser session
- `cannot_access_secrets` — no env vars, API keys, or tokens

**CEO chat integration:**
- "Create an agent for X" / "Build an agent to Y" detected by `isCreateAgentIntent()`
- `generateAgentSpecFromNeed(need)` asks the CEO AI to produce a structured spec
- Falls back to a deterministic spec if AI unavailable
- Agent saved as `draft` — never auto-activates

**Built-in agents** (always shown, not stored in DB):
- Web Operator, AÏKO CEO, Project Manager, Research Agent, Copywriting Agent

---

## 14. Provider audit summary (rev 6)

See `AIKO_PROVIDER_CONNECTION_AUDIT.md` for the full audit.

| Provider | Status | Notes |
|---|---|---|
| Ollama | ✅ Working | Default CEO brain |
| Anthropic API | ✅ Ready | Enter key at `/connect-ai` |
| OpenAI API | ✅ Ready | Enter key at `/connect-ai` |
| ChatGPT OAuth | ⚠ Needs env vars | Routes built; `OPENAI_OAUTH_*` not set |
| Claude Account OAuth | ⚠ Needs env vars | Routes built; `CLAUDE_OAUTH_*` not set |
| Claude Code CLI | ✗ Not installed | N/A |

Catalog entries for `chatgpt_oauth` and `claude_oauth` updated to `status: 'available'` — the routes ARE implemented, they just need operator configuration.

---

## OpenClaw-style auth profile routing update

AÏKO brain routing now follows:

`provider catalog → auth profile → auth method → model → role assignment → test call`

`callAI({ role, messages, userId })` resolves providers through `getProviderForRole()` in this order:

1. Role-specific assigned auth profile in `ai_role_assignments`.
2. `local_fallback` assignment.
3. Any connected user-scoped auth profile.
4. Global role assignment for backward compatibility.
5. Any connected global auth profile.
6. Legacy `model_configs` only when no auth profile exists.
7. Clear error if no provider can be resolved.

Auth method boundaries:

- `oauth`: ChatGPT/Codex account tokens and any real configured OAuth flow.
- `api_key`: OpenAI API, Anthropic API, OpenRouter, and custom endpoints.
- `local`: local providers such as Ollama.
- `cli`: Claude Code CLI/local auth when detected and tested.
- `none`: local/no-secret providers.

OpenAI API key is separate from ChatGPT/Codex OAuth. Anthropic API key is separate from Claude account/Claude Code auth. Google login identifies the AÏKO user only; it is not provider auth.

`GET /api/auth-profiles/diagnostics` reports `can_ceo_think`, resolved CEO auth profile, auth method, provider, model, missing ChatGPT vars, Claude Code detection, Claude OAuth status, and API fallback availability without secrets.
