# AÏKO Provider Connection Audit

**Date:** 2026-06-01  
**Auditor:** Runtime inspection of routes, catalog, router, and adapters

---

## Summary

| Provider | Type | State | Notes |
|----------|------|-------|-------|
| Ollama (local) | Local | ✅ Working | `llama3.1:8b` assigned to CEO |
| Anthropic API | API key | ✅ Ready | Full adapter; needs `ANTHROPIC_API_KEY` |
| OpenAI API | API key | ✅ Ready | Full adapter; needs `OPENAI_API_KEY` |
| OpenRouter | API key | ✅ Ready | OpenAI-compat adapter; needs key |
| Custom OpenAI-compat | API key | ✅ Ready | Any OpenAI-compat endpoint |
| Custom Anthropic-compat | API key | ✅ Ready | Any Anthropic-compat endpoint |
| ChatGPT OAuth | OAuth | ⚠ Needs env vars | Routes real (PKCE); `OPENAI_OAUTH_*` vars not set |
| Claude Account OAuth | OAuth | ⚠ Needs env vars | Routes real (PKCE); `CLAUDE_OAUTH_*` vars not set |
| Claude Code CLI | CLI bridge | ✗ Not installed | `~/.config/claude/` not found |
| Google Gemini | API key | 🔜 Planned | Adapter not yet written |
| AWS Bedrock | AWS creds | 🔜 Planned | Adapter not yet written |

---

## What Works Today

### Ollama (local)
- Running at `http://localhost:11434`  
- Model `llama3.1:8b` installed and assigned to CEO role  
- Uses `openai_compat` adapter against Ollama's OpenAI-compatible endpoint  
- Zero config beyond starting Ollama  

### Anthropic API (`anthropic_api`)
- Full adapter at `lib/ai/providers/anthropic.ts`  
- Uses official `@anthropic-ai/sdk`  
- Supports `callAnthropic`, `streamAnthropic`, `testAnthropic`  
- Converts OpenAI-style messages to Anthropic format automatically  
- Supports `claude-opus-4-5`, `claude-sonnet-4-5`, `claude-haiku-4-5`, etc.  
- **To activate:** go to `/connect-ai` → "Anthropic API" → enter your API key  

### OpenAI API (`openai_api`)
- Full adapter at `lib/ai/providers/openai-compat.ts`  
- Uses official `openai` SDK  
- Supports streaming, JSON mode, tool calls (upstream)  
- **To activate:** go to `/connect-ai` → "OpenAI API" → enter your API key  

### Other OpenAI-compatible providers
Works with: OpenRouter, Mistral, Qwen, Moonshot, Fireworks, DeepInfra, Chutes, custom endpoints.  
Same adapter, different base URLs.

---

## OAuth Providers — Honest State

### ChatGPT / Codex OAuth
- **Route implementation:** Real PKCE flow at `app/api/providers/oauth/chatgpt/start` and `…/callback`
- **State validation:** yes  
- **Token storage:** stored in `provider_connections.oauth_access_token`  
- **Token refresh:** auto-refresh via `lib/ai/router.ts` `resolveProviderKey()`  
- **Missing env vars (all required to activate):**
  - `OPENAI_OAUTH_CLIENT_ID`
  - `OPENAI_OAUTH_CLIENT_SECRET`
  - `OPENAI_OAUTH_AUTH_URL`
  - `OPENAI_OAUTH_TOKEN_URL`
  - `OPENAI_OAUTH_SCOPE` (optional, has default)
- **Current behavior:** `/api/providers/oauth/chatgpt/start` returns `HTTP 422` with `{"error":"OAuth not configured","configured":false}` if env vars are missing. No redirect is started, no misleading redirect.
- **Recommendation:** Use OpenAI API key instead until OAuth credentials are obtained from OpenAI.

### Claude Account OAuth
- **Route implementation:** Real PKCE flow at `app/api/providers/oauth/claude/start` and `…/callback`
- **Missing env vars:**
  - `CLAUDE_OAUTH_CLIENT_ID`
  - `CLAUDE_OAUTH_CLIENT_SECRET`
  - `CLAUDE_OAUTH_AUTH_URL`
  - `CLAUDE_OAUTH_TOKEN_URL`
  - `CLAUDE_OAUTH_SCOPE` (optional)
- **Current behavior:** Same as ChatGPT OAuth — honest 422 if not configured.
- **Recommendation:** Use Anthropic API key instead. Claude account OAuth requires a registered OAuth application with Anthropic.

---

## Claude Code CLI
- Checked: `which claude`, `~/.config/claude/`, `$CLAUDE_CODE_OAUTH_TOKEN`  
- **Status: not installed.** No CLI bridge is possible.  
- If Claude Code CLI is later installed, a `claude_code` provider catalog entry and adapter would need to be written to bridge CLI → `callAI()`. This is a future option only.

---

## Router Architecture

File: `lib/ai/router.ts`

- `callAI(role, messages, opts)` — single entry point for all AI calls
- `resolveProviderKey(connection)` — handles `api_key` and `oauth` auth types; auto-refreshes OAuth tokens
- `dispatchCall(connection, messages, opts)` — routes by `compatibility`:
  - `anthropic_messages` → `callAnthropic()`
  - `openai_compatible` / `ollama_native` → `callOpenAICompat()`
  - others → error
- `NeedsReauthError` — distinct class with `providerId`; callers catch and redirect to `/connect-ai`

---

## Catalog Status After This Audit

The catalog entries for `chatgpt_oauth` and `claude_oauth` have been updated from `not_available_in_this_build` to `available` (the routes ARE implemented), with updated notes explaining env var requirements. This is the honest state: the feature is built, it just needs operator configuration.

---

## Recommended Next Steps

1. **Immediate (no code required):** Go to `/connect-ai` → "Anthropic API" → enter an Anthropic API key. Assign it to CEO for higher-quality reasoning than `llama3.1:8b`.
2. **If you want ChatGPT OAuth:** Register an OAuth application with OpenAI, set `OPENAI_OAUTH_*` env vars, restart server.
3. **If you want Claude OAuth:** Register an OAuth application with Anthropic, set `CLAUDE_OAUTH_*` env vars, restart server.
4. **Claude Code CLI:** Not a current option. Use Anthropic API key instead.
