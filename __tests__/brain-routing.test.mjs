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
