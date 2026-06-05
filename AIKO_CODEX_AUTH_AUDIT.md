# AÏKO Codex Local Auth Audit

Date: 2026-06-05

## Summary

AÏKO previously exposed ChatGPT/Codex as a single OAuth-app card. That path required `OPENAI_OAUTH_*` environment variables and was honest, but it did not match the OpenClaw/Codex-style local workflow where the owner signs in through Codex on the same machine and reuses that local auth.

AÏKO now has three distinct OpenAI paths:

1. **ChatGPT / Codex Local Auth**: closest to OpenClaw-style use. It detects local Codex CLI/app auth, imports a safe auth-profile reference, tests a real `codex exec` call, and only then allows assignment to CEO.
2. **ChatGPT / Codex OAuth App**: advanced hosted/self-managed OAuth-app path. It still requires `OPENAI_OAUTH_*` variables.
3. **OpenAI API Key**: standard OpenAI Platform API-key fallback. This is not ChatGPT subscription auth.

## Why The Old AÏKO Path Required `OPENAI_OAUTH_*`

The existing `chatgpt_oauth` provider uses AÏKO-managed OAuth routes:

- `GET /api/auth-profiles/openai-codex/start`
- `GET /api/auth-profiles/openai-codex/callback`
- `POST /api/auth-profiles/openai-codex/refresh`
- compatibility aliases under `/api/providers/oauth/chatgpt/*`

Those routes use `lib/oauth-helpers.ts`, which needs:

- `OPENAI_OAUTH_CLIENT_ID`
- `OPENAI_OAUTH_AUTH_URL`
- `OPENAI_OAUTH_TOKEN_URL`
- `OPENAI_OAUTH_REDIRECT_URI`
- optional `OPENAI_OAUTH_CLIENT_SECRET`

Without those values, AÏKO cannot start an OAuth authorization-code flow safely. The UI correctly showed that OAuth app path as `not configured`.

## Why That Was Not Enough For OpenClaw-Style Login

OpenClaw/Codex-style local login is not the same as running an app-owned OAuth client. The owner signs in through Codex itself, usually by running `codex --login` or the Codex app login flow. Codex stores its own local credentials and can then make model calls from the CLI/app.

Official OpenAI Help Center guidance describes signing in with ChatGPT through Codex clients and local CLI credential storage:

- [Using Codex with your ChatGPT plan](https://help.openai.com/en/articles/11369540)
- [Codex CLI and Sign in with ChatGPT](https://help.openai.com/en/articles/11381614-api-codex-cli-and-sign-in-with-chatgpt)

AÏKO cannot assume those local credentials are usable unless it can make a real test call. It also must not read or expose token contents.

## Local Codex Indicators AÏKO Can Detect Safely

AÏKO checks only safe indicators:

- Whether `codex` is available on `PATH`.
- Whether `CODEX_HOME` is set, otherwise the default `~/.codex` location.
- Whether `OPENAI_CODEX_AUTH_FILE` is set.
- Whether a Codex auth file exists at the configured/default location.
- Whether an AÏKO auth profile reference exists for `openai-codex-local`.
- Whether a real non-interactive `codex exec` test succeeds.

AÏKO returns only safe status fields:

- `codex_cli_detected`
- `auth_file_detected`
- `auth_profile_exists`
- `connected`
- `needs_login`
- `account_email` when available
- `status`
- `can_import`
- `can_test`
- `instructions`
- `last_error`

AÏKO never returns access tokens, refresh tokens, API keys, raw auth file contents, or local secret file paths.

## Safe Integration Path

The new local provider path is:

1. Owner signs in to Codex locally outside AÏKO.
2. AÏKO detects the Codex CLI and local auth indicator.
3. AÏKO imports an auth profile reference, not token contents.
4. AÏKO runs a real `codex exec` test with a fixed harmless prompt.
5. If and only if the test succeeds, AÏKO marks the auth profile `connected`.
6. CEO assignment is allowed only for a connected profile.
7. Router calls for `compatibility='openai_codex'` use the Codex CLI adapter.

The CLI call is non-interactive and constrained:

- read-only sandbox
- no approval prompts
- ephemeral session
- timeout
- prompt passed as a single argument through `execFile`, not shell interpolation

## What Remains Impossible Or Unsupported

AÏKO still cannot:

- Open a ChatGPT/Codex browser login by itself without relying on the Codex CLI/app.
- Claim ChatGPT/Codex is connected from auth-file detection alone.
- Extract or reuse Codex tokens directly without an official supported interface.
- Use ChatGPT subscription auth on a hosted server unless the host has a working Codex local login or an official OAuth-app configuration.
- Auto-refresh or manage local Codex credentials beyond what the Codex CLI itself supports.

If Codex local auth is not present and `OPENAI_OAUTH_*` is not configured, AÏKO must say:

> ChatGPT/Codex is not connected. Use Ollama, OpenAI API key, or configure Codex local/OAuth auth.

## Files Changed

- `lib/ai/providers/codex-auth.ts`
- `lib/ai/provider-catalog.ts`
- `lib/ai/router.ts`
- `app/api/auth-profiles/openai-codex/local/*`
- `app/api/auth-profiles/diagnostics/route.ts`
- `app/(dashboard)/connect-ai/page.tsx`
- `app/setup/page.tsx`
- `scripts/aiko-setup-check.mjs`
- `scripts/aiko-doctor.mjs`
- `.env.example`

## Safety Notes

- Detection is not connection.
- Import is not connection.
- Copying or viewing status does not expose secrets.
- Assignment to CEO is blocked unless the test call succeeds.
- OpenAI API-key fallback remains separate from ChatGPT/Codex local auth.
- Ollama remains the local non-cloud fallback.
