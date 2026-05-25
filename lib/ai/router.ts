/**
 * AÏKO Provider Router
 *
 * Single entry point for all AI calls in the app.
 * Agents never talk to providers directly — they call callAI().
 *
 * Usage:
 *   const text = await callAI({ role: 'ceo', messages: [...] })
 *   await streamAI({ role: 'ceo', messages: [...], onChunk: (t) => ... })
 */

import { db } from '@/lib/db/client'
import type { ChatMessage } from './providers/openai-compat'
import { callOpenAICompat, streamOpenAICompat, testOpenAICompat } from './providers/openai-compat'
import { callAnthropic, streamAnthropic, testAnthropic } from './providers/anthropic'

export type AgentRole = 'ceo' | 'research' | 'copywriting' | 'review' | 'qa' | 'local_fallback' | 'project_manager'

export interface ProviderRow {
  id: string
  name: string
  type: string
  status: string
  base_url: string | null
  model: string | null
  api_key_encrypted: string | null
  supports_streaming: boolean
  compatibility?: string | null
}

// ── Provider lookup ────────────────────────────────────────────────────────────

export async function getProviderForRole(role: AgentRole): Promise<ProviderRow | null> {
  // 1. Check role assignment
  const assigned = await db.query(
    `SELECT p.* FROM provider_connections p
     JOIN ai_role_assignments r ON r.provider_id = p.id
     WHERE r.role = $1 AND p.status = 'connected'`,
    [role]
  )
  if (assigned.rows[0]) return assigned.rows[0]

  // 2. Fall back to any connected provider
  const fallback = await db.query(
    `SELECT * FROM provider_connections WHERE status = 'connected' LIMIT 1`
  )
  return fallback.rows[0] ?? null
}

/** Returns any connected provider (used for quick availability checks) */
export async function getAnyConnectedProvider(): Promise<ProviderRow | null> {
  const res = await db.query(
    `SELECT * FROM provider_connections WHERE status = 'connected' LIMIT 1`
  )
  return res.rows[0] ?? null
}

export async function getAllProviders(): Promise<ProviderRow[]> {
  const res = await db.query(
    `SELECT id, name, type, status, base_url, model,
            '' as api_key_encrypted,
            supports_chat, supports_tools, supports_streaming,
            compatibility, provider_catalog_id,
            last_tested_at, last_error, created_at, updated_at
     FROM provider_connections ORDER BY created_at`
  )
  return res.rows
}

export async function getRoleAssignments(): Promise<Record<string, string | null>> {
  const res = await db.query(`SELECT role, provider_id FROM ai_role_assignments`)
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
export async function getLLMConfigForRole(role: AgentRole): Promise<LLMBridgeConfig | null> {
  const provider = await getProviderForRole(role)
  if (!provider) return null
  return {
    baseURL: provider.base_url ?? '',
    apiKey: provider.api_key_encrypted ?? '',
    model: provider.model ?? '',
  }
}

export interface RoleProviderInfo {
  role: string
  provider_id: string | null
  provider_name: string | null
  provider_type: string | null
  provider_catalog_id: string | null
  compatibility: string | null
  model: string | null
  status: string | null
  last_error: string | null
  last_tested_at: string | null
}

/** Returns all role assignments with provider details */
export async function getAllRoleProviders(): Promise<RoleProviderInfo[]> {
  const res = await db.query(`
    SELECT r.role, r.provider_id,
           p.name AS provider_name, p.type AS provider_type,
           p.provider_catalog_id, p.compatibility,
           p.model, p.status, p.last_error, p.last_tested_at
    FROM ai_role_assignments r
    LEFT JOIN provider_connections p ON p.id = r.provider_id
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
}

export async function callAI(opts: CallAIOptions): Promise<string> {
  const provider = await getProviderForRole(opts.role)
  if (!provider) throw new Error('No AI provider connected. Go to Connect AI to add one.')

  return dispatchCall(provider, opts.messages, {
    maxTokens: opts.maxTokens,
    temperature: opts.temperature,
    jsonMode: opts.jsonMode,
  })
}

export interface StreamAIOptions {
  role: AgentRole
  messages: ChatMessage[]
  maxTokens?: number
  temperature?: number
  onChunk: (text: string) => void
}

export async function streamAI(opts: StreamAIOptions): Promise<void> {
  const provider = await getProviderForRole(opts.role)
  if (!provider) throw new Error('No AI provider connected. Go to Connect AI to add one.')

  await dispatchStream(provider, opts.messages, {
    maxTokens: opts.maxTokens,
    temperature: opts.temperature,
    onChunk: opts.onChunk,
  })
}

// ── Dispatch helpers ───────────────────────────────────────────────────────────

/**
 * Resolve compatibility for a provider row.
 * New rows have a `compatibility` column set by the catalog.
 * Old rows fall back to type-based mapping for backward compatibility.
 */
function getCompatibility(p: ProviderRow): string {
  if (p.compatibility) return p.compatibility
  if (['openai_api', 'ollama', 'openai_compatible', 'custom', 'chatgpt_direct'].includes(p.type)) return 'openai_compatible'
  if (['anthropic_api', 'anthropic_compatible', 'claude_direct'].includes(p.type)) return 'anthropic_messages'
  return p.type
}

async function dispatchCall(
  p: ProviderRow,
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number; jsonMode?: boolean }
): Promise<string> {
  const key = p.api_key_encrypted ?? ''
  const model = p.model ?? ''
  const baseURL = p.base_url ?? ''
  const compat = getCompatibility(p)

  if (compat === 'anthropic_messages') {
    return callAnthropic(key, model, messages, {
      maxTokens: opts.maxTokens,
      temperature: opts.temperature,
      baseURL: baseURL || undefined,
    })
  }

  if (compat === 'openai_compatible' || compat === 'ollama_native') {
    return callOpenAICompat(baseURL, key, model, messages, {
      maxTokens: opts.maxTokens,
      temperature: opts.temperature,
      jsonMode: opts.jsonMode,
    })
  }

  throw new Error(`Unknown provider compatibility: ${compat} (type: ${p.type})`)
}

async function dispatchStream(
  p: ProviderRow,
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number; onChunk: (text: string) => void }
): Promise<void> {
  const key = p.api_key_encrypted ?? ''
  const model = p.model ?? ''
  const baseURL = p.base_url ?? ''
  const compat = getCompatibility(p)

  if (compat === 'anthropic_messages') {
    return streamAnthropic(key, model, messages, {
      maxTokens: opts.maxTokens,
      temperature: opts.temperature,
      baseURL: baseURL || undefined,
      onChunk: opts.onChunk,
    })
  }

  if (compat === 'openai_compatible' || compat === 'ollama_native') {
    return streamOpenAICompat(baseURL, key, model, messages, {
      stream: true,
      maxTokens: opts.maxTokens,
      temperature: opts.temperature,
      onChunk: opts.onChunk,
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

  try {
    const key = p.api_key_encrypted ?? ''
    const model = p.model ?? ''
    const baseURL = p.base_url ?? ''
    const compat = getCompatibility(p)

    if (compat === 'anthropic_messages') {
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
