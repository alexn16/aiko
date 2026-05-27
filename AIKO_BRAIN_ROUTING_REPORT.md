# AÏKO Brain Routing Report

_Last updated: 2026-05-27 (rev 3 — CEO offline brain guard added)_

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
