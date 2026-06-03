/**
 * AÏKO Provider Router
 *
 * Single entry point for all AI calls in the app.
 * Agents never talk to providers directly — they call callAI().
 *
 * Auth model:
 *   - Provider connections belong to a user (user_id UUID).
 *   - When userId is provided, only that user's providers are used.
 *   - When userId is null/undefined (background agents), only global
 *     providers (user_id IS NULL) are used — backward-compatible fallback.
 *   - auth_type='oauth' providers use their stored oauth_access_token;
 *     if the token has expired, an attempt is made to refresh it before
 *     the call. If refresh fails, status is set to 'needs_reauth' and
 *     an error is thrown with a NeedsReauthError marker.
 */

import { db } from '@/lib/db/client'
import type { ChatMessage } from './providers/openai-compat'
import { callOpenAICompat, streamOpenAICompat, testOpenAICompat } from './providers/openai-compat'
import { callAnthropic, streamAnthropic, testAnthropic } from './providers/anthropic'
import { callClaudeCodeCli, testClaudeCodeCli } from './providers/claude-code-cli'

export type AgentRole = 'ceo' | 'research' | 'copywriting' | 'review' | 'qa' | 'local_fallback' | 'project_manager'

export interface ProviderRow {
  id: string
  name: string
  type: string
  status: string
  base_url: string | null
  model: string | null
  api_key_encrypted: string | null
  oauth_access_token_encrypted?: string | null
  oauth_refresh_token_encrypted?: string | null
  local_token_reference?: string | null
  display_name?: string | null
  auth_method?: string | null
  supports_streaming: boolean
  compatibility?: string | null
  auth_type?: string | null
  oauth_access_token?: string | null
  oauth_refresh_token?: string | null
  token_expires_at?: string | null
  user_id?: string | null
  account_email?: string | null
}

// ── Reauth error ───────────────────────────────────────────────────────────────

export class NeedsReauthError extends Error {
  public readonly providerId: string
  constructor(providerId: string, message: string) {
    super(message)
    this.name = 'NeedsReauthError'
    this.providerId = providerId
  }
}

// ── OAuth token helpers ────────────────────────────────────────────────────────

/**
 * Check if the OAuth access token for a provider is expired (or will expire
 * in the next 60 seconds, to avoid race conditions).
 */
function isTokenExpired(p: ProviderRow): boolean {
  if (!p.token_expires_at) return false
  const expiresAt = new Date(p.token_expires_at).getTime()
  return Date.now() >= expiresAt - 60_000
}

/**
 * Attempt to refresh the OAuth access token.
 * On success: updates the DB row and returns the new access token.
 * On failure: sets status='needs_reauth' and throws NeedsReauthError.
 */
async function refreshOAuthToken(p: ProviderRow): Promise<string> {
  const refreshToken = p.oauth_refresh_token_encrypted ?? p.oauth_refresh_token
  if (!refreshToken) {
    await db.query(
      `UPDATE provider_connections SET status='needs_reauth', last_error=$1, updated_at=NOW() WHERE id=$2`,
      ['No refresh token stored — please reconnect.', p.id]
    )
    throw new NeedsReauthError(p.id, `Your ${p.name} connection needs re-authentication. No refresh token available.`)
  }

  // Determine token endpoint based on catalog id / type
  const tokenUrl = getOAuthTokenUrl(p)
  if (!tokenUrl) {
    await db.query(
      `UPDATE provider_connections SET status='needs_reauth', last_error=$1, updated_at=NOW() WHERE id=$2`,
      ['OAuth token endpoint not configured.', p.id]
    )
    throw new NeedsReauthError(p.id, `Your ${p.name} connection needs re-authentication. OAuth not configured.`)
  }

  const clientId = getOAuthClientId(p)
  const clientSecret = getOAuthClientSecret(p)

  try {
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'refresh_token',
        refresh_token: refreshToken,
        client_id:     clientId,
        ...(clientSecret ? { client_secret: clientSecret } : {}),
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(err)
    }

    const data = await res.json() as {
      access_token: string
      refresh_token?: string
      expires_in?: number
    }

    const newAccessToken  = data.access_token
    const newRefreshToken = data.refresh_token ?? refreshToken
    const expiresAt = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null

    await db.query(
      `UPDATE provider_connections
       SET oauth_access_token=$1, oauth_refresh_token=$2,
           oauth_access_token_encrypted=$1, oauth_refresh_token_encrypted=$2,
           token_expires_at=$3, status='connected', last_error=NULL, updated_at=NOW()
       WHERE id=$4`,
      [newAccessToken, newRefreshToken, expiresAt, p.id]
    )

    return newAccessToken
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await db.query(
      `UPDATE provider_connections SET status='needs_reauth', last_error=$1, updated_at=NOW() WHERE id=$2`,
      [msg, p.id]
    )
    throw new NeedsReauthError(p.id, `Your ${p.name} connection needs re-authentication: ${msg}`)
  }
}

function getOAuthTokenUrl(p: ProviderRow): string | null {
  const catalogId = (p as { provider_catalog_id?: string }).provider_catalog_id
  if (catalogId === 'chatgpt_oauth') return process.env.OPENAI_OAUTH_TOKEN_URL ?? null
  if (catalogId === 'claude_oauth')  return process.env.CLAUDE_OAUTH_TOKEN_URL  ?? null
  return null
}

function getOAuthClientId(p: ProviderRow): string {
  const catalogId = (p as { provider_catalog_id?: string }).provider_catalog_id
  if (catalogId === 'chatgpt_oauth') return process.env.OPENAI_OAUTH_CLIENT_ID ?? ''
  if (catalogId === 'claude_oauth')  return process.env.CLAUDE_OAUTH_CLIENT_ID  ?? ''
  return ''
}

function getOAuthClientSecret(p: ProviderRow): string {
  const catalogId = (p as { provider_catalog_id?: string }).provider_catalog_id
  if (catalogId === 'chatgpt_oauth') return process.env.OPENAI_OAUTH_CLIENT_SECRET ?? ''
  if (catalogId === 'claude_oauth')  return process.env.CLAUDE_OAUTH_CLIENT_SECRET  ?? ''
  return ''
}

/**
 * Get the active API key for a provider.
 * For oauth providers, returns the (potentially refreshed) access token.
 * For api_key providers, returns the stored encrypted key.
 */
async function resolveProviderKey(p: ProviderRow): Promise<string> {
  const method = p.auth_method ?? p.auth_type
  if (method !== 'oauth') {
    return p.api_key_encrypted ?? ''
  }

  // OAuth flow
  const accessToken = p.oauth_access_token_encrypted ?? p.oauth_access_token
  if (!accessToken) {
    throw new NeedsReauthError(p.id, `Your ${p.name} connection needs re-authentication. Please reconnect.`)
  }

  if (isTokenExpired(p)) {
    return refreshOAuthToken(p)
  }

  return accessToken
}

// ── Provider lookup ────────────────────────────────────────────────────────────

/**
 * Resolves which provider handles a given role.
 *
 * Lookup order when userId provided:
 *   1. User-scoped role assignment → connected provider
 *   2. User/global local_fallback role assignment → connected provider
 *   3. Any connected provider owned by this user
 *   4. Global (user_id IS NULL) role assignment → connected provider
 *   5. Any global connected provider
 *   6. Legacy model_configs only when no auth profile exists
 *
 * Lookup order when userId is null/undefined (background agents):
 *   1. Global role assignment → connected provider
 *   2. Any global connected provider
 */
export async function getProviderForRole(
  role: AgentRole,
  userId?: string | null
): Promise<ProviderRow | null> {
  if (userId) {
    // 1. User-scoped role assignment
    const assigned = await db.query(
      `SELECT p.* FROM provider_connections p
       JOIN ai_role_assignments r ON r.provider_id = p.id
       WHERE r.role = $1 AND r.user_id = $2
         AND p.status IN ('connected', 'needs_reauth')`,
      [role, userId]
    )
    if (assigned.rows[0]) return assigned.rows[0]

    // 2. Local fallback role assignment, first user-scoped then global
    const localFallback = await db.query(
      `SELECT p.* FROM provider_connections p
       JOIN ai_role_assignments r ON r.provider_id = p.id
       WHERE r.role = 'local_fallback'
         AND (r.user_id = $1 OR r.user_id IS NULL)
         AND p.status IN ('connected', 'needs_reauth')
       ORDER BY r.user_id NULLS LAST
       LIMIT 1`,
      [userId]
    )
    if (localFallback.rows[0]) return localFallback.rows[0]

    // 3. Any connected provider for this user
    const fallback = await db.query(
      `SELECT * FROM provider_connections
       WHERE status IN ('connected', 'needs_reauth') AND user_id = $1
       ORDER BY created_at ASC LIMIT 1`,
      [userId]
    )
    if (fallback.rows[0]) return fallback.rows[0]
  }

  // 3. Global (no user) role assignment — backward-compat / background tasks
  const globalAssigned = await db.query(
    `SELECT p.* FROM provider_connections p
     JOIN ai_role_assignments r ON r.provider_id = p.id
     WHERE r.role = $1 AND r.user_id IS NULL
       AND p.status IN ('connected', 'needs_reauth')`,
    [role]
  )
  if (globalAssigned.rows[0]) return globalAssigned.rows[0]

  if (role !== 'local_fallback') {
    const globalLocalFallback = await db.query(
      `SELECT p.* FROM provider_connections p
       JOIN ai_role_assignments r ON r.provider_id = p.id
       WHERE r.role = 'local_fallback' AND r.user_id IS NULL
         AND p.status IN ('connected', 'needs_reauth')
       LIMIT 1`
    )
    if (globalLocalFallback.rows[0]) return globalLocalFallback.rows[0]
  }

  // 4. Any global connected auth profile
  const globalFallback = await db.query(
    `SELECT * FROM provider_connections
     WHERE status IN ('connected', 'needs_reauth') AND user_id IS NULL
     ORDER BY created_at ASC LIMIT 1`
  )
  if (globalFallback.rows[0]) return globalFallback.rows[0]

  return getLegacyModelConfigProvider(role)
}

async function getLegacyModelConfigProvider(role: AgentRole): Promise<ProviderRow | null> {
  try {
    const res = await db.query(
      `SELECT id::text, 'Legacy model config' AS name, 'legacy_model_config' AS type, 'connected' AS status,
              base_url, model, api_key AS api_key_encrypted, true AS supports_streaming,
              false AS supports_tools, true AS supports_chat,
              'openai_compatible' AS compatibility,
              NULL AS provider_catalog_id, 'api_key' AS auth_type, 'api_key' AS auth_method,
              NULL AS account_email, NULL AS token_expires_at, NULL AS user_id
       FROM model_configs
       WHERE agent_slot = $1 OR agent_slot = 'default'
       ORDER BY CASE WHEN agent_slot = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [role]
    )
    return res.rows[0] ?? null
  } catch {
    return null
  }
}

/** Returns any connected provider for a user (or global if no userId). */
export async function getAnyConnectedProvider(userId?: string | null): Promise<ProviderRow | null> {
  if (userId) {
    const res = await db.query(
      `SELECT * FROM provider_connections
       WHERE status IN ('connected', 'needs_reauth') AND user_id = $1
       ORDER BY created_at ASC LIMIT 1`,
      [userId]
    )
    if (res.rows[0]) return res.rows[0]
  }
  const res = await db.query(
    `SELECT * FROM provider_connections
     WHERE status IN ('connected', 'needs_reauth') AND user_id IS NULL
     ORDER BY created_at ASC LIMIT 1`
  )
  return res.rows[0] ?? null
}

export async function getAllProviders(userId?: string | null): Promise<ProviderRow[]> {
  if (userId) {
    const res = await db.query(
      `SELECT id, name, type, status, base_url, model,
              '' as api_key_encrypted,
              supports_chat, supports_tools, supports_streaming,
              compatibility, provider_catalog_id, auth_type, auth_method, display_name,
              account_email, token_expires_at,
              last_tested_at, last_error, created_at, updated_at,
              user_id
       FROM provider_connections
       WHERE user_id = $1
       ORDER BY created_at`,
      [userId]
    )
    return res.rows
  }
  // Global providers (backward compat)
  const res = await db.query(
    `SELECT id, name, type, status, base_url, model,
            '' as api_key_encrypted,
            supports_chat, supports_tools, supports_streaming,
            compatibility, provider_catalog_id, auth_type, auth_method, display_name,
            account_email, token_expires_at,
            last_tested_at, last_error, created_at, updated_at,
            user_id
     FROM provider_connections
     ORDER BY created_at`
  )
  return res.rows
}

export async function getRoleAssignments(userId?: string | null): Promise<Record<string, string | null>> {
  let res
  if (userId) {
    res = await db.query(
      `SELECT role, provider_id FROM ai_role_assignments WHERE user_id = $1`,
      [userId]
    )
  } else {
    res = await db.query(
      `SELECT role, provider_id FROM ai_role_assignments WHERE user_id IS NULL`
    )
  }
  const map: Record<string, string | null> = {}
  for (const row of res.rows) {
    map[row.role] = row.provider_id
  }
  return map
}

export interface LLMBridgeConfig {
  baseURL: string
  apiKey: string
  model: string
}

/** Get LLMConfig for a role — bridges legacy callLLM agents to the new provider system */
export async function getLLMConfigForRole(
  role: AgentRole,
  userId?: string | null
): Promise<LLMBridgeConfig | null> {
  const provider = await getProviderForRole(role, userId)
  if (!provider) return null
  return {
    baseURL: provider.base_url ?? '',
    apiKey:  provider.api_key_encrypted ?? '',
    model:   provider.model ?? '',
  }
}

export interface RoleProviderInfo {
  role: string
  provider_id: string | null
  provider_name: string | null
  provider_type: string | null
  provider_catalog_id: string | null
  compatibility: string | null
  auth_type: string | null
  model: string | null
  status: string | null
  last_error: string | null
  last_tested_at: string | null
  account_email: string | null
}

/** Returns all role assignments with provider details. */
export async function getAllRoleProviders(userId?: string | null): Promise<RoleProviderInfo[]> {
  if (userId) {
    const res = await db.query(`
      SELECT r.role, r.provider_id,
             p.name AS provider_name, p.type AS provider_type,
             p.provider_catalog_id, p.compatibility, p.auth_type, p.auth_method, p.display_name,
             p.model, p.status, p.last_error, p.last_tested_at, p.account_email
      FROM ai_role_assignments r
      LEFT JOIN provider_connections p ON p.id = r.provider_id
      WHERE r.user_id = $1
      ORDER BY r.role
    `, [userId])
    return res.rows
  }
  const res = await db.query(`
    SELECT r.role, r.provider_id,
           p.name AS provider_name, p.type AS provider_type,
           p.provider_catalog_id, p.compatibility, p.auth_type, p.auth_method, p.display_name,
           p.model, p.status, p.last_error, p.last_tested_at, p.account_email
    FROM ai_role_assignments r
    LEFT JOIN provider_connections p ON p.id = r.provider_id
    WHERE r.user_id IS NULL
    ORDER BY r.role
  `)
  return res.rows
}

// ── Core call ─────────────────────────────────────────────────────────────────

export interface CallAIOptions {
  role: AgentRole
  messages: ChatMessage[]
  maxTokens?: number
  temperature?: number
  jsonMode?: boolean
  userId?: string | null
}

export async function callAI(opts: CallAIOptions): Promise<string> {
  const provider = await getProviderForRole(opts.role, opts.userId)
  if (!provider) throw new Error('No AI provider connected. Go to Connect AI to add one.')

  if (provider.status === 'needs_reauth') {
    throw new NeedsReauthError(
      provider.id,
      `Your ${provider.name} connection needs re-authentication. Go to Connect AI.`
    )
  }

  return dispatchCall(provider, opts.messages, {
    maxTokens:   opts.maxTokens,
    temperature: opts.temperature,
    jsonMode:    opts.jsonMode,
  })
}

export interface StreamAIOptions {
  role: AgentRole
  messages: ChatMessage[]
  maxTokens?: number
  temperature?: number
  onChunk: (text: string) => void
  userId?: string | null
}

export async function streamAI(opts: StreamAIOptions): Promise<void> {
  const provider = await getProviderForRole(opts.role, opts.userId)
  if (!provider) throw new Error('No AI provider connected. Go to Connect AI to add one.')

  if (provider.status === 'needs_reauth') {
    throw new NeedsReauthError(
      provider.id,
      `Your ${provider.name} connection needs re-authentication. Go to Connect AI.`
    )
  }

  await dispatchStream(provider, opts.messages, {
    maxTokens:   opts.maxTokens,
    temperature: opts.temperature,
    onChunk:     opts.onChunk,
  })
}

// ── Dispatch helpers ───────────────────────────────────────────────────────────

function getCompatibility(p: ProviderRow): string {
  if (p.compatibility) return p.compatibility
  if (['openai_api', 'ollama', 'openai_compatible', 'custom', 'chatgpt_direct'].includes(p.type)) return 'openai_compatible'
  if (['anthropic_api', 'anthropic_compatible', 'claude_direct'].includes(p.type)) return 'anthropic_messages'
  if (['claude-code-local'].includes(p.type)) return 'claude_code_cli'
  return p.type
}

async function dispatchCall(
  p: ProviderRow,
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number; jsonMode?: boolean }
): Promise<string> {
  const key = await resolveProviderKey(p)
  const model  = p.model ?? ''
  const baseURL = p.base_url ?? ''
  const compat = getCompatibility(p)

  if (compat === 'claude_code_cli') {
    return callClaudeCodeCli(messages)
  }

  if (compat === 'anthropic_messages') {
    return callAnthropic(key, model, messages, {
      maxTokens:   opts.maxTokens,
      temperature: opts.temperature,
      baseURL:     baseURL || undefined,
    })
  }

  if (compat === 'openai_compatible' || compat === 'ollama_native') {
    return callOpenAICompat(baseURL, key, model, messages, {
      maxTokens:   opts.maxTokens,
      temperature: opts.temperature,
      jsonMode:    opts.jsonMode,
    })
  }

  throw new Error(`Unknown provider compatibility: ${compat} (type: ${p.type})`)
}

async function dispatchStream(
  p: ProviderRow,
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number; onChunk: (text: string) => void }
): Promise<void> {
  const key = await resolveProviderKey(p)
  const model   = p.model ?? ''
  const baseURL = p.base_url ?? ''
  const compat  = getCompatibility(p)

  if (compat === 'claude_code_cli') {
    const text = await callClaudeCodeCli(messages)
    opts.onChunk(text)
    return
  }

  if (compat === 'anthropic_messages') {
    return streamAnthropic(key, model, messages, {
      maxTokens:   opts.maxTokens,
      temperature: opts.temperature,
      baseURL:     baseURL || undefined,
      onChunk:     opts.onChunk,
    })
  }

  if (compat === 'openai_compatible' || compat === 'ollama_native') {
    return streamOpenAICompat(baseURL, key, model, messages, {
      stream:      true,
      maxTokens:   opts.maxTokens,
      temperature: opts.temperature,
      onChunk:     opts.onChunk,
    })
  }

  throw new Error(`Unknown provider compatibility: ${compat} (type: ${p.type})`)
}

// ── Test connection ─────────────────────────────────────────────────────────────

export async function testProvider(id: string): Promise<{ ok: boolean; error?: string }> {
  const res = await db.query(
    `SELECT * FROM provider_connections WHERE id = $1`, [id]
  )
  const p: ProviderRow & { api_key_encrypted: string } = res.rows[0]
  if (!p) return { ok: false, error: 'Provider not found' }

  // OAuth providers — can't test without a real user auth flow. Mark connected if token present.
  if ((p.auth_method ?? p.auth_type) === 'oauth') {
    if (p.oauth_access_token_encrypted ?? p.oauth_access_token) {
      await db.query(
        `UPDATE provider_connections
         SET status='connected', last_tested_at=NOW(), last_error=NULL, updated_at=NOW()
         WHERE id=$1`,
        [id]
      )
      return { ok: true }
    }
    return { ok: false, error: 'No OAuth access token. Please reconnect via OAuth.' }
  }

  try {
    const key    = p.api_key_encrypted ?? ''
    const model  = p.model ?? ''
    const baseURL = p.base_url ?? ''
    const compat = getCompatibility(p)

    if (compat === 'claude_code_cli') {
      await testClaudeCodeCli()
    } else if (compat === 'anthropic_messages') {
      await testAnthropic(key, model, baseURL || undefined)
    } else if (compat === 'openai_compatible' || compat === 'ollama_native') {
      await testOpenAICompat(baseURL, key, model)
    } else {
      return { ok: false, error: `Unknown provider compatibility: ${compat} (type: ${p.type})` }
    }

    await db.query(
      `UPDATE provider_connections
       SET status='connected', last_tested_at=NOW(), last_error=NULL, updated_at=NOW()
       WHERE id=$1`,
      [id]
    )
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await db.query(
      `UPDATE provider_connections
       SET status='error', last_tested_at=NOW(), last_error=$1, updated_at=NOW()
       WHERE id=$2`,
      [msg, id]
    )
    return { ok: false, error: msg }
  }
}
