# AÏKO Provider Connection Audit

## Correction applied

AÏKO now treats `provider_connections` as OpenClaw-style **auth profiles** rather than confusing subscription cards. The model is:

`provider catalog → auth profile → auth method → model selection → role assignment → test call`

Google login is only AÏKO user identity. It is not provider authentication.

## Schema / auth profile fields

The existing `provider_connections` table remains the storage system. Migration `038_auth_profiles.sql` adds auth-profile vocabulary without duplicating the system:

- `id`
- `provider_catalog_id`
- `display_name`
- `auth_method`: `oauth | api_key | local | cli | none`
- `compatibility`
- `base_url`
- `model`
- `account_email`
- `status`: `connected | not_configured | not_connected | needs_reauth | error`
- `last_error`
- `last_tested_at`
- `capabilities`
- `created_at`
- `updated_at`
- `api_key_encrypted`
- `oauth_access_token_encrypted`
- `oauth_refresh_token_encrypted`
- `token_expires_at`
- `local_token_reference`

Legacy token columns remain for compatibility, but API responses select only safe profile metadata and never return API keys or OAuth tokens.

## Providers that are truly working now

| Provider profile | Auth method | Compatibility | Working condition |
|---|---:|---|---|
| Ollama / Local | `local` / `none` | `ollama_native` | Works when an Ollama-compatible local endpoint is running at the configured base URL and the selected model exists. |
| ChatGPT / Codex Local | `local` / `cli` | `openai_codex` | Works only when Codex CLI/app auth is detected locally, imported as a safe reference, and a real Codex CLI test call succeeds. |
| OpenAI API | `api_key` | `openai_compatible` | Works with a valid OpenAI Platform API key and model. This is not ChatGPT/Codex OAuth. |
| Anthropic API | `api_key` | `anthropic_messages` | Works with a valid Anthropic API key and model. This is not Claude account or Claude Code auth. |
| OpenRouter | `api_key` | `openai_compatible` | Works with a valid OpenRouter API key and routable model. |
| Custom OpenAI-compatible | `api_key` or no key | `openai_compatible` | Works when the configured endpoint implements OpenAI chat completions. |
| Custom Anthropic-compatible | `api_key` or no key | `anthropic_messages` | Works when the configured endpoint implements Anthropic Messages. |

## API-key only providers

The reliable API-key path is first-class for `openai_api`, `anthropic_api`, `openrouter`, and supported OpenAI-compatible/custom providers. They are created from `/connect-ai`, saved to `provider_connections`, tested by `POST /api/providers/:id/test`, and assignable to CEO through `POST /api/providers/roles`.

## ChatGPT / Codex local auth

Catalog id: `openai-codex-local` (UI label: ChatGPT / Codex Local). Auth method: `local`. Compatibility: `openai_codex`.

This is the OpenClaw-style local path. It does not require `OPENAI_OAUTH_*` env vars. The owner signs in with Codex locally, AÏKO detects the CLI/auth indicator, imports a safe auth-profile reference, and runs a real Codex CLI test before the profile can be assigned to CEO.

Safe detection checks:

- `codex` CLI on `PATH`
- `CODEX_HOME` when set, otherwise the default Codex home
- `OPENAI_CODEX_AUTH_FILE` when set
- Codex auth file existence and safe metadata shape
- AÏKO-managed auth profile reference

AÏKO never returns Codex token contents, refresh tokens, API keys, raw auth file contents, or local secret paths. Detection/import alone is not connection; connected requires a passing test call.

## OAuth-capable but not configured

### ChatGPT / Codex

Catalog id: `chatgpt_oauth` (UI label: ChatGPT / Codex OAuth App). Auth method: `oauth`. This is intentionally separate from `openai-codex-local` and `openai_api`.

Required env vars:

- `OPENAI_OAUTH_CLIENT_ID`
- `OPENAI_OAUTH_AUTH_URL`
- `OPENAI_OAUTH_TOKEN_URL`
- `OPENAI_OAUTH_REDIRECT_URI`
- `OPENAI_OAUTH_CLIENT_SECRET` only when the OAuth provider requires it

If any required env var is missing, `/connect-ai` marks ChatGPT/Codex OAuth App as **not configured**, shows the exact missing names, disables Connect, and tells the user to use ChatGPT / Codex Local, OpenAI API key, or Ollama instead.

### Claude account OAuth

Catalog id: `claude_oauth`. AÏKO does not pretend Claude subscription OAuth works unless real `CLAUDE_OAUTH_*` settings are provided and the exchange succeeds. The preferred reliable path is Anthropic API key. Claude OAuth is shown only as configured/not configured diagnostics.

## Claude Code local profile

Catalog id: `claude-code-local`. Auth method: `cli`. Compatibility: `claude_code_cli`.

AÏKO detects whether the server has a `claude` CLI or `CLAUDE_CODE_OAUTH_TOKEN`. If neither is available, `/connect-ai` reports **Claude Code local auth not detected** and points users to Anthropic API key. It is never shown as connected unless a real test succeeds.

## Placeholders / unavailable

Catalog entries whose compatibility is not implemented in the router (`google_gemini`, `aws_bedrock`, media providers, planned gateways) must remain unavailable/planned in the UI and must not be shown as connected. The router supports only:

- `openai_compatible`
- `openai_codex`
- `ollama_native`
- `anthropic_messages`
- `claude_code_cli`

## Exact route from role assignment to `callAI`

1. `/connect-ai` displays sanitized auth profiles from `GET /api/providers` and diagnostics from `GET /api/auth-profiles/diagnostics`.
2. The user clicks **Assign CEO**, which posts `{ role: 'ceo', provider_id }` to `POST /api/providers/roles`.
3. `ai_role_assignments.provider_id` points to `provider_connections.id`.
4. Agents call `callAI({ role: 'ceo', messages, userId })` in `lib/ai/router.ts`.
5. `getProviderForRole()` resolves in this order:
   1. role-specific assigned auth profile
   2. `local_fallback` role assignment
   3. any connected user auth profile
   4. global role assignment
   5. any connected global auth profile
   6. legacy `model_configs` only if no auth profile exists
6. The router reads `auth_method`, `compatibility`, `model`, `base_url`, and server-side secrets/tokens.
7. Dispatch is sent to OpenAI-compatible, Codex CLI, Anthropic Messages, Ollama-compatible, or Claude Code CLI adapters.
8. `POST /api/providers/test-ceo-brain` verifies the exact CEO path through `callAI({ role: 'ceo' })`.

## Compatibility aliases

New ChatGPT/Codex auth profile routes exist at:

Local Codex auth:

- `GET /api/auth-profiles/openai-codex/local/status`
- `POST /api/auth-profiles/openai-codex/local/import`
- `POST /api/auth-profiles/openai-codex/local/test`
- `POST /api/auth-profiles/openai-codex/local/assign-ceo`

OAuth App auth:

- `GET /api/auth-profiles/openai-codex/start`
- `GET /api/auth-profiles/openai-codex/callback`
- `POST /api/auth-profiles/openai-codex/refresh`
- `POST /api/auth-profiles/openai-codex/disconnect`

Existing `/api/providers/oauth/chatgpt/*` routes remain for compatibility.
