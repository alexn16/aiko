# AÏKO Local Brain E2E Test

_Verified: 2026-05-30 · Ollama llama3.1:8b · AIKO_AUTH_MODE=optional_

This document proves the local OpenClaw-style flow from zero setup to CEO thinking —
no Google account, no cloud credentials, one terminal command.

---

## What this tests

| Step | Expected result |
|---|---|
| Open `/` with no brain configured | Redirected to `/connect-ai` |
| Connect Ollama (or any provider) | Provider row created, `user_id = null` |
| Test connection | `{"ok": true}` |
| Assign to CEO role | Role assignment saved globally |
| Brain verification | `success: true`, model responds |
| Open `/ceo` | Page loads, "CEO brain: …" badge visible |
| Send "Hello, what are you?" | CEO responds through configured provider |

---

## Prerequisites

### 1. Required env vars (minimal — no Google)

```env
# .env.local
NEXTAUTH_SECRET=any-random-string-for-local-dev
NEXTAUTH_URL=http://localhost:3001
AIKO_AUTH_MODE=optional
DATABASE_URL=postgresql://youruser@localhost:5432/aiko
```

`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` are **not required** in optional mode.

### 2. Choose one provider

**Option A — Ollama (fully local, no API key)**

```bash
# Install Ollama: https://ollama.ai
ollama pull llama3.1:8b   # or qwen2.5:7b, mistral, etc.
ollama serve              # must be running during the test
```

Verify: `curl http://localhost:11434/api/tags` should list your models.

**Option B — OpenAI API key**

```env
# No extra env var needed — key is entered in the UI at /connect-ai
```

**Option C — Anthropic API key**

Same as above — key is entered in the UI.

**Option D — OpenRouter**

Same — key entered in the UI.

---

## Run the test

### Step 1 — Start AÏKO

```bash
npm run dev          # starts on http://localhost:3001
```

### Step 2 — Open `/`

The browser should redirect to `/connect-ai` if no CEO brain exists.

If you see the dashboard instead of `/connect-ai`, a provider is already
connected from a previous session. Skip to Step 6.

### Step 3 — Connect a provider (no login needed)

At `/connect-ai`, scroll to your chosen section:

**Ollama:**
1. Click **Set up** on the Ollama card
2. Base URL: `http://localhost:11434/v1`
3. Model: `llama3.1:8b` (or whatever you pulled)
4. No API key needed
5. Click **Test connection** → should show ✓ Connection successful
6. Click **Save & connect**

**OpenAI / Anthropic / OpenRouter:**
1. Click **Set up** on the relevant card
2. Paste your API key
3. Pick a model
4. Click **Test connection** → should show ✓
5. Click **Save & connect**

### Step 4 — Assign to CEO

Scroll to **Assign AÏKO brains**. The newly connected provider appears.

Set the **CEO** row to your provider. Click **Save assignments**.

### Step 5 — Run brain verification

Scroll to **Brain verification**. Click **⚡ Send test CEO message**.

Expected:
```
✓ CEO brain is working — Ollama (local) / llama3.1:8b
AÏKO_CEO_OK I am ready to process your request.
```

The diagnostics panel (click **Show**) should show:
- `auth_mode: optional`
- `signed_in: false`
- `provider_scope: global`
- `can_ceo_think: true`

### Step 6 — Open `/ceo`

Navigate to `/ceo`. The page loads without a login prompt.

Expected top bar:
- Green badge: **CEO brain: Ollama (local) · llama3.1:8b**
- Blue badge: **○ Local mode** (shown when not signed in, auth_mode=optional)

### Step 7 — Send a message

Type **"Hello, what are you?"** and press Enter.

Expected response (verbatim from verified run):
> I'm the CEO of AÏKO, an AI marketing company. We specialize in managing
> multiple client projects and utilizing autonomous AI agents to streamline
> marketing efforts.

---

## Pass/fail checklist

```
[ ] App starts without errors
[ ] / redirects to /connect-ai when no brain connected
[ ] Provider created without Google login
[ ] Connection test returns ok: true
[ ] Role assignment saved (no error from /api/providers/roles)
[ ] /api/providers/diagnostics shows can_ceo_think: true
[ ] Brain verification returns success: true with AÏKO_CEO_OK token
[ ] /ceo loads without redirecting to /login
[ ] CEO brain badge visible in top bar
[ ] Local mode badge visible (when not signed in)
[ ] CEO responds to "Hello, what are you?" with coherent answer
[ ] No secrets (API keys / tokens) visible in any API response
```

---

## Common errors

### "No AI connected" badge on /ceo

The provider exists but the CEO role was not assigned.
Go to `/connect-ai` → Assign AÏKO brains → set CEO row → Save assignments.

### Connection test fails: `fetch failed` / `ECONNREFUSED`

**Ollama:** `ollama serve` is not running, or the base URL is wrong.
Correct URL: `http://localhost:11434/v1` (with `/v1`).

**OpenAI / Anthropic:** Check your API key. Try a smaller model first.

### Wrong model name

Ollama model names must match exactly what `ollama list` shows.
Example: `llama3.1:8b` not `llama3` or `llama3.1`.

### Brain verification fails: "CEO has no working brain"

Role assignment not saved. Repeat Step 4. Check `/api/providers/diagnostics`
for `can_ceo_think: false` and `ceo_role_assignment.provider_id: null`.

### Provider assigned but CEO responds with "No AI provider connected"

The provider `status` is not `connected`. Go to `/connect-ai`, find the
provider row, click **Test** to retest. If it fails, check credentials.

### /ceo still redirects to /login

`AIKO_AUTH_MODE` is not set or is set to `required`. Confirm `.env.local`
contains `AIKO_AUTH_MODE=optional` and restart the dev server.

### "Failed to update role assignment" error

The database migration may be missing the `ai_role_asgn_global_uniq`
constraint. This is fixed in the current codebase (roles route now uses
DELETE + INSERT). Run `npm run dev` with the latest code.

### SetupGate does not redirect to /connect-ai even with no provider

The legacy `model_configs` table may have a stale row, causing `/api/setup`
to return `configured: true`. This is harmless — navigate directly to
`/connect-ai` to connect a real provider.

---

## API smoke test (curl)

You can verify each step without a browser:

```bash
BASE=http://localhost:3001

# 1. Check diagnostics (no session required in optional mode)
curl $BASE/api/providers/diagnostics | python3 -m json.tool

# 2. Create Ollama provider
PROV=$(curl -s -X POST $BASE/api/providers \
  -H "Content-Type: application/json" \
  -d '{"name":"Ollama","type":"ollama","provider_catalog_id":"ollama",
       "compatibility":"openai_compatible",
       "base_url":"http://localhost:11434/v1","model":"llama3.1:8b"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Provider ID: $PROV"

# 3. Test connection
curl -s -X POST "$BASE/api/providers/$PROV/test"

# 4. Assign to CEO
curl -s -X POST $BASE/api/providers/roles \
  -H "Content-Type: application/json" \
  -d "{\"role\":\"ceo\",\"provider_id\":\"$PROV\"}"

# 5. Brain verification
curl -s -X POST $BASE/api/providers/test-ceo-brain

# 6. CEO command
curl -s -X POST $BASE/api/ceo/command \
  -H "Content-Type: application/json" \
  -d '{"command":"Hello, what are you?"}'
```

Expected final output:
```json
{
  "response": "I'm the CEO of AÏKO, an AI marketing company...",
  "intent": "general",
  "actions": []
}
```

---

## What "optional mode" means for data

- All provider rows are stored with `user_id = NULL` (global)
- All role assignments use `user_id = NULL` (global)
- Any user of this AÏKO instance shares the same brain configuration
- When you sign in with Google later, user-scoped providers take precedence
  over global ones — your Google account gets its own isolated setup
- Global providers remain as the fallback for unauthenticated access

To switch to per-user isolation, set `AIKO_AUTH_MODE=required` and add
Google OAuth credentials. See `README.md` for the full setup.
