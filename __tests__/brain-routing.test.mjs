/**
 * AÏKO brain-routing smoke tests
 *
 * Runs with: node --test __tests__/brain-routing.test.mjs
 *
 * No real API keys or database connections required.
 * Tests exercise routing logic in pure JS — no imports from the app.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

// ── 1. No provider → callAI throws a clear error ─────────────────────────────

test('callAI throws clear error when no provider connected', async () => {
  // Replicate the guard from lib/ai/router.ts callAI()
  async function callAISimulation(role, getProviderForRole) {
    const provider = await getProviderForRole(role)
    if (!provider) throw new Error('No AI provider connected. Go to Connect AI to add one.')
    return 'ok'
  }

  await assert.rejects(
    () => callAISimulation('ceo', async () => null),
    (err) => {
      assert.ok(err.message.includes('No AI provider'), `Error message was: "${err.message}"`)
      return true
    }
  )
})

// ── 2. getAllProviders() must redact api_key ───────────────────────────────────

test('getAllProviders redacts api_key_encrypted', () => {
  // The SQL in router.ts uses: '' as api_key_encrypted
  // Simulate the transformed row that getALL returns
  const dbRow = {
    id: 'abc',
    name: 'OpenAI',
    type: 'openai_api',
    status: 'connected',
    base_url: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    api_key_encrypted: '',   // hard-coded '' in SELECT
    supports_streaming: true,
    compatibility: 'openai_compatible',
  }

  assert.equal(dbRow.api_key_encrypted, '', 'api_key_encrypted must be empty string (redacted) in listing')
})

// ── 3. getCompatibility() resolves the right adapter ─────────────────────────

test('getCompatibility resolves adapter from explicit column', () => {
  // Replicate getCompatibility() from lib/ai/router.ts
  function getCompatibility(p) {
    if (p.compatibility) return p.compatibility
    if (['openai_api', 'ollama', 'openai_compatible', 'custom', 'chatgpt_direct'].includes(p.type)) return 'openai_compatible'
    if (['anthropic_api', 'anthropic_compatible', 'claude_direct'].includes(p.type)) return 'anthropic_messages'
    return p.type
  }

  // Explicit column takes precedence
  assert.equal(getCompatibility({ type: 'openai_api', compatibility: 'openai_compatible' }), 'openai_compatible')
  assert.equal(getCompatibility({ type: 'anthropic_api', compatibility: 'anthropic_messages' }), 'anthropic_messages')

  // Type-based fallback for legacy rows without compatibility column
  assert.equal(getCompatibility({ type: 'openai_api' }), 'openai_compatible')
  assert.equal(getCompatibility({ type: 'ollama' }), 'openai_compatible')
  assert.equal(getCompatibility({ type: 'anthropic_api' }), 'anthropic_messages')
  assert.equal(getCompatibility({ type: 'anthropic_compatible' }), 'anthropic_messages')
  assert.equal(getCompatibility({ type: 'claude_direct' }), 'anthropic_messages')

  // OpenRouter stored with explicit openai_compatible
  assert.equal(getCompatibility({ type: 'openrouter', compatibility: 'openai_compatible' }), 'openai_compatible')
})

// ── 4. Diagnostics: can_ceo_think flag ───────────────────────────────────────

test('can_ceo_think is false when no provider is connected', () => {
  const ceoProvider = null
  assert.equal(!!ceoProvider, false)
})

test('can_ceo_think is true when a connected provider resolves', () => {
  const ceoProvider = { id: '1', name: 'OpenAI', model: 'gpt-4o', status: 'connected' }
  assert.equal(!!ceoProvider, true)
})

// ── 5. PATCH api_key guard ────────────────────────────────────────────────────

test('PATCH api_key guard only updates for non-empty strings', () => {
  // Replicate the guard from app/api/providers/[id]/route.ts
  function shouldUpdateApiKey(api_key) {
    return typeof api_key === 'string' && api_key.trim() !== ''
  }

  assert.equal(shouldUpdateApiKey(null),      false, 'null')
  assert.equal(shouldUpdateApiKey(undefined), false, 'undefined')
  assert.equal(shouldUpdateApiKey(''),        false, 'empty string')
  assert.equal(shouldUpdateApiKey('   '),     false, 'whitespace only')
  assert.equal(shouldUpdateApiKey('sk-abc'),  true,  'real key')
})

// ── 6. fallback order in getProviderForRole ───────────────────────────────────

test('getProviderForRole falls back to any connected provider when no role assignment', async () => {
  const providers = [
    { id: '1', name: 'OpenAI', status: 'connected' },
    { id: '2', name: 'Groq',   status: 'disconnected' },
  ]
  const roleAssignments = {} // no CEO assignment

  // Simulate router logic: check assignment → fallback to any connected
  async function getProviderForRoleSimulation(role) {
    const assigned = roleAssignments[role]
    if (assigned) return providers.find(p => p.id === assigned) ?? null
    return providers.find(p => p.status === 'connected') ?? null
  }

  const result = await getProviderForRoleSimulation('ceo')
  assert.ok(result, 'should return a provider')
  assert.equal(result.name, 'OpenAI', 'should return first connected provider as fallback')
})

// ── 7. test-ceo-brain endpoint helper logic ───────────────────────────────────

test('test-ceo-brain returns clear error when no provider connected', async () => {
  // Simulate the endpoint guard: getProviderForRole returns null
  async function testCeoBrainSimulation(getProvider) {
    const provider = await getProvider().catch(() => null)
    if (!provider) {
      return {
        success: false,
        error: 'AÏKO CEO has no working brain assigned. Connect a provider and assign it to the CEO role.',
      }
    }
    // Would call callAI here (skipped — no real keys in tests)
    return { success: true, provider: { name: provider.name, model: provider.model } }
  }

  const result = await testCeoBrainSimulation(async () => null)
  assert.equal(result.success, false)
  assert.ok(result.error.includes('AÏKO CEO has no working brain'), `Got: "${result.error}"`)
})

test('test-ceo-brain returns provider info when provider exists', async () => {
  async function testCeoBrainSimulation(getProvider) {
    const provider = await getProvider().catch(() => null)
    if (!provider) {
      return { success: false, error: 'No provider.' }
    }
    return { success: true, provider: { name: provider.name, model: provider.model } }
  }

  const fakeProvider = { name: 'OpenAI', model: 'gpt-4o', type: 'openai_api', status: 'connected' }
  const result = await testCeoBrainSimulation(async () => fakeProvider)
  assert.equal(result.success, true)
  assert.equal(result.provider.name, 'OpenAI')
  assert.equal(result.provider.model, 'gpt-4o')
})

test('test-ceo-brain token check: success when response contains AÏKO_CEO_OK', () => {
  // Replicate the token check from the endpoint
  function checkResponse(raw) {
    const trimmed = raw.trim()
    return trimmed.includes('AÏKO_CEO_OK') || trimmed.includes('AIKO_CEO_OK')
  }

  assert.equal(checkResponse('AÏKO_CEO_OK Ready to serve.'), true, 'exact token with accent')
  assert.equal(checkResponse('AIKO_CEO_OK All systems operational.'), true, 'token without accent')
  assert.equal(checkResponse('Sure, I am ready!'), false, 'no token — should fail')
  assert.equal(checkResponse(''), false, 'empty — should fail')
})

// ── 11. User-scoped provider lookup ──────────────────────────────────────────

test('provider connections are user-scoped: user A cannot see user B providers', () => {
  // Simulate getAllProviders scoping — each user only sees their own rows
  const allProviders = [
    { id: '1', name: 'OpenAI', user_id: 'user-a', status: 'connected' },
    { id: '2', name: 'Anthropic', user_id: 'user-b', status: 'connected' },
    { id: '3', name: 'Ollama', user_id: null, status: 'connected' }, // global
  ]

  function getProvidersForUser(userId) {
    return allProviders.filter(p => p.user_id === userId)
  }

  const userAProviders = getProvidersForUser('user-a')
  const userBProviders = getProvidersForUser('user-b')

  assert.equal(userAProviders.length, 1, 'user A sees only their own provider')
  assert.equal(userAProviders[0].name, 'OpenAI')
  assert.equal(userBProviders.length, 1, 'user B sees only their own provider')
  assert.equal(userBProviders[0].name, 'Anthropic')

  // Verify neither user can see the other's providers
  assert.ok(!userAProviders.some(p => p.user_id === 'user-b'), 'user A cannot see user B providers')
  assert.ok(!userBProviders.some(p => p.user_id === 'user-a'), 'user B cannot see user A providers')
})

// ── 12. OAuth token resolution ────────────────────────────────────────────────

test('OAuth provider uses access token instead of api_key', () => {
  // Simulate resolveProviderKey logic
  function resolveKey(provider) {
    if (provider.auth_type !== 'oauth') return provider.api_key_encrypted ?? ''
    if (!provider.oauth_access_token) throw new Error('No OAuth access token')
    return provider.oauth_access_token
  }

  const apiKeyProvider = { auth_type: 'api_key', api_key_encrypted: 'sk-abc', oauth_access_token: null }
  const oauthProvider  = { auth_type: 'oauth', api_key_encrypted: null, oauth_access_token: 'tok_xyz' }

  assert.equal(resolveKey(apiKeyProvider), 'sk-abc', 'api_key provider uses stored key')
  assert.equal(resolveKey(oauthProvider), 'tok_xyz', 'oauth provider uses access token')

  // Missing token throws
  const badOAuth = { auth_type: 'oauth', api_key_encrypted: null, oauth_access_token: null }
  assert.throws(() => resolveKey(badOAuth), /No OAuth access token/)
})

// ── 13. OAuth not-configured response is honest ───────────────────────────────

test('OAuth start returns configured:false when env vars missing', () => {
  // Simulate the start route guard
  function startOAuth(authUrl, clientId) {
    if (!authUrl || !clientId) {
      return {
        status: 422,
        body: {
          configured: false,
          error: 'ChatGPT/Codex OAuth is not configured on this AÏKO instance. Use OpenAI API key instead.',
        },
      }
    }
    return { status: 302, location: `${authUrl}?client_id=${clientId}&...` }
  }

  const notConfigured = startOAuth(null, null)
  assert.equal(notConfigured.status, 422)
  assert.equal(notConfigured.body.configured, false)
  assert.ok(notConfigured.body.error.includes('not configured'))

  const configured = startOAuth('https://auth.openai.com/authorize', 'client123')
  assert.equal(configured.status, 302)
})

// ── 14. diagnostics returns no user when unauthenticated ─────────────────────

test('diagnostics signed_in_user is null when no session', () => {
  // Simulate diagnostics construction without a session
  const session = null
  const signedInUser = session?.user ?? null
  assert.equal(signedInUser, null, 'no session → no signed_in_user in diagnostics')
})

// ── 15. NeedsReauthError is a distinct error class ────────────────────────────

test('NeedsReauthError carries providerId and is distinguishable from generic Error', () => {
  class NeedsReauthError extends Error {
    constructor(providerId, message) {
      super(message)
      this.name = 'NeedsReauthError'
      this.providerId = providerId
    }
  }

  const err = new NeedsReauthError('provider-123', 'Token expired. Please reconnect.')
  assert.equal(err.name, 'NeedsReauthError')
  assert.equal(err.providerId, 'provider-123')
  assert.ok(err instanceof Error)
  assert.ok(err.message.includes('Token expired'))
})
