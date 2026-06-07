/**
 * lib/ai/provider-health.ts
 *
 * Runtime health checks for assigned AI providers.
 * Checks whether a "connected" provider profile is actually usable at runtime,
 * not just stored in the DB.
 *
 * Rules:
 * - Never expose API keys, tokens, or secrets.
 * - Never silently switch providers.
 * - Return clear, owner-friendly messages and fix actions.
 */

import { getProviderForRole, getAllProviders } from './router'

export type BrainHealthStatus =
  | 'usable'
  | 'runtime_unavailable'
  | 'test_failed'
  | 'not_configured'
  | 'needs_reauth'

export interface BrainHealth {
  provider_name: string | null
  profile_id: string | null
  auth_method: string | null
  compatibility: string | null
  configured: boolean
  connected: boolean
  runtime_available: boolean
  test_passed: boolean | null
  usable: boolean
  status: BrainHealthStatus
  fallback_available: boolean
  fallback_provider: string | null
  owner_message: string
  fix_action: string
}

// ── Per-provider runtime checks ───────────────────────────────────────────────

async function checkCodexRuntime(): Promise<{ available: boolean; reason: string | null }> {
  try {
    const { detectCodexCli } = await import('./providers/codex-auth')
    const result = await detectCodexCli()
    return result.detected
      ? { available: true, reason: null }
      : { available: false, reason: 'codex_binary_missing' }
  } catch {
    return { available: false, reason: 'codex_check_failed' }
  }
}

async function checkOllamaRuntime(baseUrl: string): Promise<{ available: boolean; reason: string | null }> {
  try {
    const url = baseUrl.replace(/\/v1\/?$/, '')
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 4000)
    const res = await fetch(`${url}/api/tags`, { signal: ctrl.signal }).catch(() => null)
    clearTimeout(timer)
    return res?.ok
      ? { available: true, reason: null }
      : { available: false, reason: 'ollama_not_reachable' }
  } catch {
    return { available: false, reason: 'ollama_not_reachable' }
  }
}

async function checkApiKeyRuntime(baseUrl: string | null): Promise<{ available: boolean; reason: string | null }> {
  if (!baseUrl) return { available: true, reason: null }
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 4000)
    const res = await fetch(baseUrl, { signal: ctrl.signal }).catch(() => null)
    clearTimeout(timer)
    // Any HTTP response (even 401) means the endpoint is reachable
    return res
      ? { available: true, reason: null }
      : { available: false, reason: 'api_endpoint_not_reachable' }
  } catch {
    return { available: false, reason: 'api_endpoint_not_reachable' }
  }
}

// ── Main functions ────────────────────────────────────────────────────────────

/**
 * Check the runtime health of the provider assigned to the given role.
 * Returns a safe, secret-free health object.
 */
export async function checkAssignedBrainHealth(role = 'ceo', userId?: string | null): Promise<BrainHealth> {
  const provider = await getProviderForRole(role as Parameters<typeof getProviderForRole>[0], userId).catch(() => null)

  if (!provider) {
    return {
      provider_name: null,
      profile_id: null,
      auth_method: null,
      compatibility: null,
      configured: false,
      connected: false,
      runtime_available: false,
      test_passed: null,
      usable: false,
      status: 'not_configured',
      fallback_available: false,
      fallback_provider: null,
      owner_message: 'No AI provider is connected. AÏKO needs a brain to think.',
      fix_action: 'Open Connect AI to add a provider.',
    }
  }

  const p = provider as typeof provider & {
    auth_method?: string | null
    compatibility?: string | null
    base_url?: string | null
    type?: string
  }
  const providerType = String(p.type ?? '')
  const authMethod = String(p.auth_method ?? p.compatibility ?? '')
  const baseUrl = p.base_url ?? null

  if (provider.status === 'needs_reauth') {
    return makeHealth(provider, authMethod, {
      connected: false,
      runtime_available: false,
      test_passed: null,
      status: 'needs_reauth',
      owner_message: `${provider.name} needs re-authentication.`,
      fix_action: 'Open Connect AI and re-authenticate the provider.',
    }, await findFallback(provider.id, userId))
  }

  // Runtime check per provider type
  let runtime: { available: boolean; reason: string | null } = { available: true, reason: null }

  if (['openai-codex-local', 'chatgpt_codex_local'].includes(providerType)) {
    runtime = await checkCodexRuntime()
  } else if (providerType === 'ollama' || /ollama/i.test(authMethod)) {
    runtime = await checkOllamaRuntime(baseUrl ?? 'http://localhost:11434')
  }
  // For API-key providers (anthropic, openai, etc.) we trust the DB status
  // rather than hitting the endpoint on every health check.

  if (!runtime.available) {
    const msg = formatRuntimeUnavailableMessage(providerType, runtime.reason)
    const fix = formatRuntimeFixAction(providerType, runtime.reason)
    const fallback = await findFallback(provider.id, userId)
    return makeHealth(provider, authMethod, {
      connected: true,
      runtime_available: false,
      test_passed: null,
      status: 'runtime_unavailable',
      owner_message: msg,
      fix_action: fix,
    }, fallback)
  }

  return makeHealth(provider, authMethod, {
    connected: true,
    runtime_available: true,
    test_passed: null,
    status: 'usable',
    owner_message: `${provider.name} is connected and ready.`,
    fix_action: '',
  }, await findFallback(provider.id, userId))
}

function makeHealth(
  provider: { id: string; name: string },
  authMethod: string,
  partial: {
    connected: boolean
    runtime_available: boolean
    test_passed: boolean | null
    status: BrainHealthStatus
    owner_message: string
    fix_action: string
  },
  fallback: { available: boolean; name: string | null },
): BrainHealth {
  return {
    provider_name: provider.name,
    profile_id: provider.id,
    auth_method: authMethod,
    compatibility: null,
    configured: true,
    connected: partial.connected,
    runtime_available: partial.runtime_available,
    test_passed: partial.test_passed,
    usable: partial.status === 'usable',
    status: partial.status,
    fallback_available: fallback.available,
    fallback_provider: fallback.name,
    owner_message: partial.owner_message,
    fix_action: partial.fix_action,
  }
}

async function findFallback(excludeProviderId: string, userId?: string | null): Promise<{ available: boolean; name: string | null }> {
  try {
    const all = await getAllProviders(userId)
    const candidates = all.filter(p => p.id !== excludeProviderId && p.status === 'connected')
    // Prefer Ollama or API-key providers as fallback
    const preferred = candidates.find(p => {
      const t = String((p as { type?: string }).type ?? '')
      return t === 'ollama' || t === 'anthropic' || t === 'openai'
    }) ?? candidates[0] ?? null
    return preferred ? { available: true, name: preferred.name } : { available: false, name: null }
  } catch {
    return { available: false, name: null }
  }
}

function formatRuntimeUnavailableMessage(providerType: string, reason: string | null): string {
  if (['openai-codex-local', 'chatgpt_codex_local'].includes(providerType)) {
    return 'ChatGPT / Codex Local is assigned, but the Codex CLI is not available on this machine.'
  }
  if (providerType === 'ollama') {
    return 'Ollama is assigned but is not reachable. Make sure Ollama is running.'
  }
  if (reason === 'api_endpoint_not_reachable') {
    return 'The assigned AI provider endpoint is not reachable.'
  }
  return 'The assigned AI provider is not available at runtime.'
}

function formatRuntimeFixAction(providerType: string, reason: string | null): string {
  if (['openai-codex-local', 'chatgpt_codex_local'].includes(providerType)) {
    return 'Open Connect AI, reinstall/sign in to Codex, or switch CEO brain to Ollama/OpenAI/Anthropic.'
  }
  if (providerType === 'ollama') {
    return 'Start Ollama locally, then retry.'
  }
  return 'Open Connect AI and verify your provider settings.'
}

/**
 * Format health result for safe inclusion in API responses.
 * Never includes secrets, tokens, or raw error messages.
 */
export function formatProviderHealthForOwner(health: BrainHealth): {
  usable: boolean
  runtime_available: boolean
  provider_name: string | null
  status: BrainHealthStatus
  owner_message: string
  fix_action: string
  fallback_available: boolean
  fallback_provider: string | null
} {
  return {
    usable: health.usable,
    runtime_available: health.runtime_available,
    provider_name: health.provider_name,
    status: health.status,
    owner_message: health.owner_message,
    fix_action: health.fix_action,
    fallback_available: health.fallback_available,
    fallback_provider: health.fallback_provider,
  }
}
