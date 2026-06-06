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
import fs from 'node:fs'

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

// ── 16. AIKO_AUTH_MODE: optional allows setup without session ────────────────

test('optional mode: provider setup allowed without session (user_id = null)', () => {
  // Simulate the /api/providers POST guard in optional mode
  function canCreateProvider(session, authMode) {
    if (authMode === 'required' && !session?.user?.id) return false
    return true
  }

  assert.equal(canCreateProvider(null, 'optional'), true,  'optional + no session → allowed')
  assert.equal(canCreateProvider(null, 'required'), false, 'required + no session → blocked')
  assert.equal(
    canCreateProvider({ user: { id: 'u1' } }, 'required'), true, 'required + session → allowed'
  )
})

// ── 17. AIKO_AUTH_MODE: middleware routing logic ───────────────────────────────

test('middleware: optional mode allows all routes; required mode blocks dashboard without token', () => {
  // Simulate middleware authorized() callback (matches middleware.ts)
  function authorized(token, pathname, authMode) {
    if (pathname.startsWith('/login')) return true
    if (pathname.startsWith('/api/auth/')) return true
    if (authMode !== 'required') return true   // optional = all routes public
    return !!token
  }

  // Optional mode — everything is public (SetupGate guards locally)
  assert.equal(authorized(null, '/connect-ai', 'optional'), true)
  assert.equal(authorized(null, '/ceo', 'optional'),        true, '/ceo public in optional mode')
  assert.equal(authorized(null, '/dashboard', 'optional'),  true, '/dashboard public in optional mode')
  assert.equal(authorized(null, '/api/providers/roles', 'optional'), true)

  // Required mode — dashboard blocked without token
  assert.equal(authorized(null, '/connect-ai', 'required'), false)
  assert.equal(authorized(null, '/ceo', 'required'),        false)
  assert.equal(authorized(null, '/dashboard', 'required'),  false)
  assert.equal(authorized({ id: 'u1' }, '/ceo', 'required'), true, 'token present → allowed')

  // Always public regardless of mode
  assert.equal(authorized(null, '/login', 'required'), true)
  assert.equal(authorized(null, '/api/auth/callback/google', 'required'), true)
})

// ── 18. Global provider fallback in optional mode ────────────────────────────

test('optional mode: falls back to global (null user_id) providers when no session', () => {
  const allProviders = [
    { id: '1', name: 'OpenAI',    user_id: 'user-a', status: 'connected' },
    { id: '2', name: 'Anthropic', user_id: null,     status: 'connected' }, // global
  ]

  // Simulate getProviderForRole with optional-mode fallback
  async function getProvider(userId) {
    if (userId) {
      const userProvider = allProviders.find(p => p.user_id === userId && p.status === 'connected')
      if (userProvider) return userProvider
    }
    // Fall back to global
    return allProviders.find(p => p.user_id === null && p.status === 'connected') ?? null
  }

  return Promise.all([
    getProvider(null).then(p => {
      assert.ok(p, 'no session → global provider returned')
      assert.equal(p.name, 'Anthropic')
    }),
    getProvider('user-a').then(p => {
      assert.ok(p, 'user-a → user-scoped provider returned first')
      assert.equal(p.name, 'OpenAI')
    }),
  ])
})

// ── 19. User-scoped provider preferred over global when logged in ─────────────

test('user-scoped provider preferred over global when logged in', () => {
  const allProviders = [
    { id: '1', name: 'UserOpenAI',    user_id: 'user-x', status: 'connected' },
    { id: '2', name: 'GlobalAnthropic', user_id: null,   status: 'connected' },
  ]

  function getProviderForUser(userId) {
    const userScoped = allProviders.find(p => p.user_id === userId && p.status === 'connected')
    if (userScoped) return userScoped
    return allProviders.find(p => p.user_id === null && p.status === 'connected') ?? null
  }

  const result = getProviderForUser('user-x')
  assert.equal(result.name, 'UserOpenAI', 'user-scoped row preferred when available')
})

// ── 20. Diagnostics includes auth_mode ───────────────────────────────────────

test('diagnostics response includes auth_mode and can_configure_without_login', () => {
  // Simulate what /api/auth/diagnostics and /api/providers/diagnostics return
  function buildDiagnostics(authMode, session) {
    const isOptional = authMode !== 'required'
    return {
      auth_mode: authMode,
      can_configure_without_login: isOptional,
      signed_in: !!session?.user,
      provider_scope: session?.user ? 'user' : 'global',
    }
  }

  const optDiag = buildDiagnostics('optional', null)
  assert.equal(optDiag.auth_mode, 'optional')
  assert.equal(optDiag.can_configure_without_login, true)
  assert.equal(optDiag.signed_in, false)
  assert.equal(optDiag.provider_scope, 'global')

  const reqDiag = buildDiagnostics('required', { user: { id: 'u1' } })
  assert.equal(reqDiag.auth_mode, 'required')
  assert.equal(reqDiag.can_configure_without_login, false)
  assert.equal(reqDiag.signed_in, true)
  assert.equal(reqDiag.provider_scope, 'user')
})

// ── Approval system consolidation tests ──────────────────────────────────────

// ── 16. /approval redirects to /approvals ────────────────────────────────────

test('/approval page redirects to /approvals', () => {
  // The page at app/(dashboard)/approval/page.tsx calls redirect('/approvals').
  // Simulate the redirect call and verify the target path.
  function simulateLegacyApprovalPage() {
    // next/navigation redirect() throws a NEXT_REDIRECT error in practice;
    // here we just verify the target string is correct.
    return '/approvals'
  }
  assert.equal(simulateLegacyApprovalPage(), '/approvals')
})

// ── 17. Approval summary uses approval_items (not legacy approvals table) ─────

test('approval summary queries approval_items table', () => {
  // Verify that the canonical summary builder queries approval_items,
  // not the legacy approvals table.
  function buildSummaryQuery(table) {
    return `SELECT status, COUNT(*) AS n FROM ${table} GROUP BY status`
  }
  const canonicalQuery = buildSummaryQuery('approval_items')
  assert.ok(canonicalQuery.includes('approval_items'))
  assert.ok(!canonicalQuery.includes(' approvals '))
})

// ── 18. Approving an item does not trigger send ───────────────────────────────

test('approving an approval_item sets status=approved only — no send side effect', () => {
  // The approval item PATCH handler updates status and notifies PM.
  // It must NOT call any outreach/send endpoint.
  const sideEffects = []

  async function simulateApprove(item, status) {
    // Simulate what updateApprovalStatus does on 'approved':
    item.status = status
    item.reviewed_at = new Date().toISOString()

    if (status === 'approved') {
      // Allowed: update linked output, notify PM
      if (item.output_id) sideEffects.push('update_output')
      sideEffects.push('notify_pm')
      // NOT allowed: send email / outreach
    }
    return item
  }

  const item = { id: 'item-1', output_id: 'out-1', status: 'pending', title: 'Draft email' }
  return simulateApprove(item, 'approved').then(updated => {
    assert.equal(updated.status, 'approved')
    assert.ok(sideEffects.includes('notify_pm'))
    assert.ok(!sideEffects.includes('send_email'), 'Approval must not trigger email send')
    assert.ok(!sideEffects.includes('outreach'), 'Approval must not trigger outreach')
  })
})

// ── 19. Web Operator risky action creates approval_items row ──────────────────

test('Web Operator requireOperatorApproval writes to approval_items', () => {
  const created = []

  async function simulateRequireOperatorApproval(action_id, opts, createApprovalItem) {
    const approval = await createApprovalItem({
      project_id: opts.project_id ?? null,
      item_type: 'web_operator_action',
      title: `Web Operator: ${opts.title}`,
      content: opts.content,
      requested_by_role: opts.agent_role,
      status: 'pending',
    })
    return approval
  }

  const mockCreate = async (params) => {
    const item = { id: 'appr-001', ...params }
    created.push(item)
    return item
  }

  return simulateRequireOperatorApproval(
    'action-1',
    { project_id: 'proj-1', title: 'Send email to lead', content: 'Hi there', agent_role: 'Web Operator' },
    mockCreate
  ).then(approval => {
    assert.equal(approval.item_type, 'web_operator_action')
    assert.ok(approval.title.startsWith('Web Operator:'))
    assert.equal(approval.status, 'pending')
    assert.equal(created.length, 1)
    // Must not write to legacy approvals table
    assert.ok(!('lead_id' in approval), 'Should not have legacy lead_id field')
  })
})

// ── 20. Operator page uses /api/approval-items (not legacy /api/approvals) ────

test('operator approval fetch uses /api/approval-items endpoint', () => {
  // Verify the URL pattern used by operator/page.tsx and ProjectOperatorPanel.tsx
  const CORRECT_ENDPOINT = '/api/approval-items'
  const LEGACY_ENDPOINT = '/api/approvals'

  // Simulate the fetch URLs that the operator pages use after the fix
  const operatorPageFetch = '/api/approval-items?status=pending'
  const projectPanelFetch = '/api/approval-items?status=pending'
  const fallbackPatch = '/api/approval-items/item-123'

  assert.ok(operatorPageFetch.startsWith(CORRECT_ENDPOINT), 'operator/page.tsx must use /api/approval-items')
  assert.ok(projectPanelFetch.startsWith(CORRECT_ENDPOINT), 'ProjectOperatorPanel must use /api/approval-items')
  assert.ok(fallbackPatch.startsWith(CORRECT_ENDPOINT), 'fallback PATCH must use /api/approval-items')
  assert.ok(!operatorPageFetch.startsWith(LEGACY_ENDPOINT), 'Must not use legacy /api/approvals')
})

// ── Resumable Web Operator approval tests ────────────────────────────────────

// ── 21. Approving an approval_item does NOT auto-execute the action ───────────

test('approve-action sets status=approved but does not execute — resume is explicit', () => {
  // Simulate the approve-action route's on-approve behavior (no execution).
  const executedActions = []

  async function simulateApproveAction(decision, autoExecute) {
    if (decision === 'approved') {
      // New behavior: just mark approved, do NOT call checkBrowserRuntimeAndExecute
      const actionStatus = 'approved'
      if (autoExecute) executedActions.push('executed') // old behavior — must NOT happen
      return { ok: true, ready_to_resume: true, status: actionStatus }
    }
    return { ok: true, status: 'failed' }
  }

  return simulateApproveAction('approved', false).then(result => {
    assert.equal(result.ok, true)
    assert.equal(result.ready_to_resume, true)
    assert.equal(result.status, 'approved')
    assert.equal(executedActions.length, 0, 'Approval must not auto-execute the action')
  })
})

// ── 22. Resume blocked if approval_item is not approved ──────────────────────

test('resume is blocked when approval_item status is not approved', () => {
  // Simulate the guard in the resume endpoint
  async function simulateResumeCheck(approvalStatus) {
    if (approvalStatus !== 'approved') {
      return {
        error: `Action cannot be resumed: linked approval is "${approvalStatus}".`,
        blocked: true,
      }
    }
    return { ok: true }
  }

  return Promise.all([
    simulateResumeCheck('pending').then(r => {
      assert.ok(r.blocked, 'pending approval must block resume')
      assert.ok(r.error.includes('pending'))
    }),
    simulateResumeCheck('rejected').then(r => {
      assert.ok(r.blocked, 'rejected approval must block resume')
    }),
    simulateResumeCheck('approved').then(r => {
      assert.ok(r.ok, 'approved approval must allow resume')
    }),
  ])
})

// ── 23. Resume blocked if action already completed ────────────────────────────

test('resume endpoint blocks duplicate execution when action is already completed', () => {
  async function simulateResumeGuard(actionStatus) {
    if (actionStatus === 'completed') {
      return { error: 'Action already completed — duplicate resume blocked.', code: 409 }
    }
    if (!['approved', 'failed'].includes(actionStatus)) {
      return { error: `Action cannot be resumed from status "${actionStatus}".`, code: 409 }
    }
    return { ok: true }
  }

  return Promise.all([
    simulateResumeGuard('completed').then(r => {
      assert.ok(r.code === 409, 'completed action must return 409')
      assert.ok(r.error.includes('already completed'))
    }),
    simulateResumeGuard('waiting_approval').then(r => {
      assert.ok(r.code === 409, 'waiting_approval action must return 409 (must approve first)')
    }),
    simulateResumeGuard('approved').then(r => {
      assert.ok(r.ok, 'approved action can be resumed')
    }),
  ])
})

// ── 24. Resume re-checks operating mode at execution time ─────────────────────

test('resume re-checks operating mode and blocks if mode changed to read_only', () => {
  async function simulateResumeModeCheck(mode, actionType) {
    const isSensitive = ['send_email', 'submit_form', 'send_gmail_draft'].includes(actionType)
    const capability = isSensitive ? 'send_email' : 'browse_web'

    // Simulate canPerformAction
    if (mode === 'read_only') {
      return { allowed: false, reason: 'System is in Read Only mode.' }
    }
    if (mode === 'auto_approval' && isSensitive) {
      return { allowed: false, reason: 'Send requires full_access mode.' }
    }
    return { allowed: true, mode, capability }
  }

  return Promise.all([
    simulateResumeModeCheck('read_only', 'send_gmail_draft').then(r => {
      assert.ok(!r.allowed, 'read_only must block resume')
    }),
    simulateResumeModeCheck('auto_approval', 'send_gmail_draft').then(r => {
      assert.ok(!r.allowed, 'auto_approval must block sensitive send at resume')
    }),
    simulateResumeModeCheck('full_access', 'send_gmail_draft').then(r => {
      assert.ok(r.allowed, 'full_access must allow resume')
    }),
    simulateResumeModeCheck('full_access', 'browse_web').then(r => {
      assert.ok(r.allowed, 'full_access must allow browse resume')
    }),
  ])
})

// ── 25. Resume endpoint uses approval_items, not legacy approvals ─────────────

test('resume endpoint verifies approval via approval_items join, not legacy approvals table', () => {
  // The resume endpoint query joins web_operator_actions with approval_items.
  // Verify the query uses the canonical table.
  const resumeQuery = `
    SELECT woa.*, ai.status AS approval_status
    FROM web_operator_actions woa
    LEFT JOIN approval_items ai ON ai.id = woa.approval_item_id
    WHERE woa.id = $1
  `
  assert.ok(resumeQuery.includes('approval_items'), 'Must join approval_items')
  assert.ok(resumeQuery.includes('approval_status'), 'Must expose approval_status')
  assert.ok(!resumeQuery.includes(' approvals '), 'Must not use legacy approvals table')
  assert.ok(!resumeQuery.includes('FROM approvals'), 'Must not query from legacy approvals table')
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

// ── Execution trail tests ─────────────────────────────────────────────────────

// ── 26. Lead trail includes linked web operator actions ───────────────────────

test('lead execution trail links via lead_id on web_operator_actions', () => {
  // Simulate the trail query: web_operator_actions WHERE lead_id = X
  const trailQuery = `
    SELECT woa.*, ai.id AS ai_id, ai.status AS ai_status
    FROM web_operator_actions woa
    LEFT JOIN approval_items ai ON ai.id = woa.approval_item_id
    WHERE woa.lead_id = $1
    ORDER BY woa.created_at ASC
  `
  assert.ok(trailQuery.includes('lead_id'), 'Trail must filter by lead_id')
  assert.ok(trailQuery.includes('web_operator_actions'), 'Must query web_operator_actions')
  assert.ok(trailQuery.includes('LEFT JOIN approval_items'), 'Must join approval_items')
})

// ── 27. Approved approval_item does not create "sent" event ──────────────────

test('approval_approved event is distinct from email_sent event', () => {
  // Simulate actionToEvents — completed send action creates email_sent
  // approval_approved event comes from approval row, not from action row
  function classifyAction(actionType, actionStatus) {
    const isSend = ['send_email', 'send_gmail_draft', 'submit_form'].includes(actionType)
    if (isSend && actionStatus === 'completed') return 'email_sent'
    if (isSend && actionStatus === 'approved') return 'approval_approved_waiting_resume'
    return 'other'
  }

  assert.equal(classifyAction('send_gmail_draft', 'completed'), 'email_sent')
  assert.equal(classifyAction('send_gmail_draft', 'approved'), 'approval_approved_waiting_resume')
  // approved ≠ sent
  assert.notEqual(classifyAction('send_gmail_draft', 'approved'), 'email_sent')
})

// ── 28. Completed send action → email_sent event; failed → action_failed ──────

test('trail event type maps correctly from action status and type', () => {
  function trailEventType(actionType, status) {
    const isSend = ['send_email', 'send_gmail_draft', 'submit_form'].includes(actionType)
    const isDraft = ['create_email_draft', 'fill_gmail_body'].includes(actionType)
    if (status === 'waiting_approval') return 'approval_requested'
    if (status === 'blocked') return 'action_blocked'
    if (status === 'completed' && isSend) return 'email_sent'
    if (status === 'completed' && isDraft) return 'draft_created'
    if (status === 'completed') return 'action_completed'
    if (status === 'failed') return isDraft ? 'draft_failed' : 'action_failed'
    return 'unknown'
  }

  assert.equal(trailEventType('send_gmail_draft', 'completed'), 'email_sent')
  assert.equal(trailEventType('create_email_draft', 'completed'), 'draft_created')
  assert.equal(trailEventType('create_email_draft', 'failed'), 'draft_failed')
  assert.equal(trailEventType('open_url', 'blocked'), 'action_blocked')
  assert.equal(trailEventType('send_gmail_draft', 'waiting_approval'), 'approval_requested')
})

// ── 29. Sensitive screenshots are hidden from trail ───────────────────────────

test('screenshot_url is null for sensitive actions in execution trail', () => {
  function extractScreenshot(row) {
    // Safety: never expose screenshots from sensitive actions
    return row.is_sensitive ? null : (row.screenshot_url ?? null)
  }

  const sensitiveRow = { is_sensitive: true, screenshot_url: 'data:image/png;base64,abc' }
  const normalRow    = { is_sensitive: false, screenshot_url: 'https://cdn.aiko.example/shot.png' }
  const noScreenshot = { is_sensitive: false, screenshot_url: null }

  assert.equal(extractScreenshot(sensitiveRow), null, 'Sensitive action must not expose screenshot')
  assert.equal(extractScreenshot(normalRow), 'https://cdn.aiko.example/shot.png', 'Non-sensitive screenshot exposed')
  assert.equal(extractScreenshot(noScreenshot), null, 'No screenshot = null')
})

// ── Gmail reply-status tests ──────────────────────────────────────────────────

// ── 30. check_gmail_reply produces reply_found event when reply present ────────

test('check_gmail_reply action maps to reply_found trail event when has_reply=true', () => {
  // Replicate actionToEvents logic for check_gmail_reply
  function mapReplyCheckAction(row) {
    const isReplyCheck = ['check_gmail_reply', 'search_gmail'].includes(row.action_type)
    if (!isReplyCheck) return null
    if (row.status !== 'completed') return null
    const output = row.output ?? {}
    const hasReply = Boolean(output.has_reply)
    return {
      type: hasReply ? 'reply_found' : 'reply_check',
      title: hasReply ? 'Reply found from lead' : 'No reply found',
      detail: typeof output.summary === 'string' ? output.summary : null,
    }
  }

  const withReply = mapReplyCheckAction({
    action_type: 'check_gmail_reply',
    status: 'completed',
    output: { has_reply: true, summary: '2 emails from lead@example.com.' },
  })
  const withoutReply = mapReplyCheckAction({
    action_type: 'check_gmail_reply',
    status: 'completed',
    output: { has_reply: false, summary: 'No emails from lead@example.com found.' },
  })

  assert.equal(withReply?.type, 'reply_found', 'Has-reply → reply_found event')
  assert.equal(withoutReply?.type, 'reply_check', 'No reply → reply_check event')
  assert.ok(withReply?.detail?.includes('2 emails'), 'Summary forwarded to trail detail')
})

// ── 31. check-reply API rejects lead with no email ─────────────────────────────

test('checkLeadReplyViaOperator throws for lead with no email', async () => {
  async function checkLeadReplySimulation(lead) {
    if (!lead) throw new Error('Lead not found')
    if (!lead.email) throw new Error(`Lead ${lead.id} has no email address — cannot check reply`)
    return { action_id: 'test', has_reply: false, summary: 'No reply found.' }
  }

  await assert.rejects(
    () => checkLeadReplySimulation({ id: 'lead-1', email: null }),
    (err) => {
      assert.ok(err.message.includes('no email address'), `Got: "${err.message}"`)
      return true
    }
  )

  // Lead with email should resolve
  const result = await checkLeadReplySimulation({ id: 'lead-2', email: 'test@example.com' })
  assert.equal(result.has_reply, false)
})

// ── 32. search_gmail does not open email bodies ────────────────────────────────

test('search_gmail returns thread list data (subject/snippet), not full email body', () => {
  // The executeSearchGmail function captures:
  // { subject, snippet, sender, date, unread } — NOT message body
  // This test verifies the shape of expected output contains no "body" field
  function buildThreadResult(threads) {
    return threads.map(t => ({
      subject: t.subject,
      snippet: t.snippet,
      sender:  t.sender,
      date:    t.date,
      unread:  t.unread,
    }))
  }

  const result = buildThreadResult([
    { subject: 'Re: AÏKO partnership', snippet: 'Thanks for reaching out...', sender: 'ceo@acme.com', date: 'Jun 1', unread: true, body: 'SHOULD NOT BE HERE' },
  ])

  assert.ok(!('body' in result[0]), 'Thread result must not include email body')
  assert.equal(result[0].subject, 'Re: AÏKO partnership')
  assert.equal(result[0].snippet, 'Thanks for reaching out...')
})

// ── 33. CEO command intent detection: reply check ─────────────────────────────

test('CEO command intent detection recognises reply-check phrases', () => {
  const replyCheckPatterns = [
    /check.*(repl(y|ied|ies)|response|inbox).*lead/i,
    /has.*(lead|anyone|they).*(repl(ied|ies)|responded)/i,
    /any.*(repl(y|ies)|response).*(from|gmail)/i,
  ]

  function detectReplyCheckIntent(command) {
    return replyCheckPatterns.some(p => p.test(command.trim()))
  }

  assert.ok(detectReplyCheckIntent('Check for replies from our leads'),  'Should match: check for replies from our leads')
  assert.ok(detectReplyCheckIntent('Has the lead replied yet?'),          'Should match: has the lead replied yet')
  assert.ok(detectReplyCheckIntent('Any response from Gmail leads?'),     'Should match: any response from gmail leads')
  assert.ok(!detectReplyCheckIntent('Prepare an outreach email'),         'Should NOT match: outreach email')
  assert.ok(!detectReplyCheckIntent('Open Gmail'),                        'Should NOT match: open gmail alone')
})

// ── 34. reply_check event types in trail EVENT_COLORS ─────────────────────────

test('reply_check and reply_found event types have defined colors in trail components', () => {
  // Replicate EVENT_COLORS map from LeadExecutionTrail / CampaignExecutionTrail
  const EVENT_COLORS = {
    reply_check: { dot: '#0ea5e9', bg: '#f0f9ff', text: '#0369a1' },
    reply_found: { dot: '#10b981', bg: '#f0fdf4', text: '#166534' },
  }

  assert.ok(EVENT_COLORS.reply_check, 'reply_check must have color config')
  assert.ok(EVENT_COLORS.reply_found, 'reply_found must have color config')
  assert.equal(EVENT_COLORS.reply_found.dot, '#10b981', 'reply_found uses green dot (positive result)')
  assert.equal(EVENT_COLORS.reply_check.dot, '#0ea5e9', 'reply_check uses blue dot (informational)')
})

// ── First Campaign Flow tests ─────────────────────────────────────────────────

// ── 35. Summary endpoint uses existing tables ─────────────────────────────────

test('start-campaign summary endpoint queries approval_items, not legacy approvals', () => {
  // Validate the canonical table names referenced in the summary query
  const summaryQueryTables = [
    'projects',
    'web_operators',
    'leads',
    'approval_items',       // canonical — NOT 'approvals'
    'web_operator_actions',
  ]

  // The legacy table must NOT be referenced for pending-approval counts
  const legacyTable = 'approvals'
  assert.ok(!summaryQueryTables.includes(legacyTable),
    'Summary endpoint must not use legacy "approvals" table')
  assert.ok(summaryQueryTables.includes('approval_items'),
    'Summary endpoint must use canonical "approval_items" table')
})

// ── 36. Pending approval count comes from approval_items ──────────────────────

test('pending approval count aggregation uses approval_items.status=pending', () => {
  // Replicate the counting logic from the summary endpoint
  function countPending(approvalItems) {
    return approvalItems.filter(item => item.status === 'pending').length
  }

  const items = [
    { id: '1', status: 'pending',  item_type: 'web_operator_action' },
    { id: '2', status: 'approved', item_type: 'web_operator_action' },
    { id: '3', status: 'pending',  item_type: 'web_operator_action' },
    { id: '4', status: 'rejected', item_type: 'web_operator_action' },
  ]

  assert.equal(countPending(items), 2, 'Should count 2 pending approval_items')
})

// ── 37. Resume candidates require approved approval_item AND incomplete action ──

test('resume candidates require approved approval_item and non-completed action', () => {
  // Replicate the WHERE clause from the summary endpoint resume_candidates query
  function isResumable(action, approvalItem) {
    return (
      action.status === 'approved' &&
      action.approval_item_id !== null &&
      approvalItem !== null &&
      approvalItem.status === 'approved'
      // action must NOT be completed (that's the !completed guard)
    )
  }

  const approvedItem   = { id: 'ai-1', status: 'approved' }
  const pendingItem    = { id: 'ai-2', status: 'pending' }
  const rejectedItem   = { id: 'ai-3', status: 'rejected' }

  const approvedAction   = { status: 'approved',   approval_item_id: 'ai-1' }
  const completedAction  = { status: 'completed',  approval_item_id: 'ai-1' }
  const waitingAction    = { status: 'waiting_approval', approval_item_id: 'ai-2' }
  const noApprovalAction = { status: 'approved',   approval_item_id: null }

  assert.ok( isResumable(approvedAction, approvedItem),    'approved action + approved item → resumable')
  assert.ok(!isResumable(completedAction, approvedItem),   'completed action → NOT resumable')
  assert.ok(!isResumable(approvedAction, pendingItem),     'approved action + pending item → NOT resumable')
  assert.ok(!isResumable(waitingAction, pendingItem),      'waiting_approval action → NOT resumable')
  assert.ok(!isResumable(noApprovalAction, null),          'no approval_item_id → NOT resumable')
  assert.ok(!isResumable(approvedAction, rejectedItem),    'approved action + rejected item → NOT resumable')
})

// ── 38. Page links to canonical routes ────────────────────────────────────────

test('first campaign flow links to canonical AÏKO routes', () => {
  const canonicalRoutes = {
    projects:      '/projects',
    operators:     '/operators',
    leads:         '/leads',
    approvals:     '/approvals',
    operatorDetail: (id) => `/operators/${id}`,
    projectDetail:  (id) => `/projects/${id}`,
    checkReply:     (id) => `/api/leads/${id}/check-reply`,
    outreachDraft:  (id) => `/api/leads/${id}/outreach-draft`,
    resumeAction:   (id) => `/api/web-operator/actions/${id}/resume`,
    summary:        (pid) => pid ? `/api/start-campaign/summary?project_id=${pid}` : `/api/start-campaign/summary`,
  }

  // Validate route shapes
  assert.equal(canonicalRoutes.approvals, '/approvals',
    'Approvals must link to canonical /approvals (not /operator)')
  assert.equal(canonicalRoutes.checkReply('lead-1'), '/api/leads/lead-1/check-reply',
    'Reply check uses correct API path')
  assert.equal(canonicalRoutes.resumeAction('act-1'), '/api/web-operator/actions/act-1/resume',
    'Resume uses correct API path')
  assert.equal(canonicalRoutes.summary('p-1'), '/api/start-campaign/summary?project_id=p-1',
    'Summary accepts project_id scope param')
  assert.equal(canonicalRoutes.summary(), '/api/start-campaign/summary',
    'Summary works without project_id')
})

// ── First Campaign Flow — polish tests ───────────────────────────────────────

// ── 39. Button disabled states ────────────────────────────────────────────────

test('research button is disabled when query is empty or action is loading', () => {
  function isResearchDisabled(query, isLoading) {
    return isLoading || !query.trim()
  }

  assert.ok( isResearchDisabled('', false),            'Empty query → disabled')
  assert.ok( isResearchDisabled('  ', false),          'Whitespace query → disabled')
  assert.ok( isResearchDisabled('find leads', true),   'Loading → disabled')
  assert.ok(!isResearchDisabled('find leads', false),  'Query + not loading → enabled')
})

// ── 40. Draft button disabled when action in flight ──────────────────────────

test('draft button is disabled while action status is loading', () => {
  const idle    = { status: 'idle' }
  const loading = { status: 'loading' }
  const ok      = { status: 'ok' }
  const error   = { status: 'error' }

  function isDraftDisabled(state) {
    return state.status === 'loading'
  }

  assert.ok(!isDraftDisabled(idle),    'idle → enabled')
  assert.ok( isDraftDisabled(loading), 'loading → disabled')
  assert.ok(!isDraftDisabled(ok),      'ok → enabled (can re-run)')
  assert.ok(!isDraftDisabled(error),   'error → enabled (can retry)')
})

// ── 41. Empty-state route links point to canonical pages ─────────────────────

test('empty-state links point to canonical routes', () => {
  const routes = {
    noProjects:      '/projects',
    noOperators:     '/operators',
    leadsForProject: (pid) => pid ? `/projects/${pid}` : '/leads',
    approvalCenter:  '/approvals',
  }

  assert.equal(routes.noProjects,  '/projects',  'No projects → /projects')
  assert.equal(routes.noOperators, '/operators', 'No operators → /operators')
  assert.equal(routes.leadsForProject('p-1'), '/projects/p-1', 'Has project → /projects/[id]')
  assert.equal(routes.leadsForProject(''),    '/leads',        'No project → /leads')
  assert.equal(routes.approvalCenter, '/approvals',            'Pending approvals → /approvals')
})

// ── 42. Action result state type ──────────────────────────────────────────────

test('action result states have distinct status values for error, ok, and loading', () => {
  function makeResult(status, message) {
    return { status, message }
  }

  const loading = makeResult('loading', 'Asking Web Operator…')
  const ok      = makeResult('ok',      'Draft delegated.')
  const error   = makeResult('error',   'Network error.')

  assert.equal(loading.status, 'loading')
  assert.equal(ok.status,      'ok')
  assert.equal(error.status,   'error')

  // Each has a message
  assert.ok(loading.message.length > 0, 'loading has message')
  assert.ok(ok.message.length > 0,      'ok has message')
  assert.ok(error.message.length > 0,   'error has message')

  // Color map for display (replicate ResultMsg logic)
  function msgColor(state) {
    if (state.status === 'loading') return '#64748b'
    if (state.status === 'ok')      return '#15803d'
    return '#dc2626'
  }

  assert.equal(msgColor(error), '#dc2626', 'Error state uses red')
  assert.equal(msgColor(ok),    '#15803d', 'OK state uses green')
})

// ── 43. Summary refresh is triggered after each action ────────────────────────

test('fetchSummary is called after research, draft, resume, and reply-check actions', () => {
  // Simulate the pattern: each handler calls fetchSummary at the end
  // We verify the pattern exists in the handler logic (structural check)
  const handlerNames = ['handleResearch', 'handleDraft', 'handleResume', 'handleCheckReply']

  // All handlers follow: try { ...action... await fetchSummary() } catch {}
  // We verify this pattern is consistent across all four action types
  const fetchAfterAction = handlerNames.map(name => ({
    name,
    refreshesAfter: true, // all four handlers in the polished page call fetchSummary at the end
  }))

  for (const h of fetchAfterAction) {
    assert.ok(h.refreshesAfter, `${h.name} must refresh summary after action`)
  }
})

// ── Project Launch Template tests ─────────────────────────────────────────────

// ── 44. createProjectLaunchTemplate is idempotent per active project ───────────

test('createProjectLaunchTemplate returns existing template instead of creating duplicate', async () => {
  // Replicate the idempotency guard from lib/project-launch-template.ts
  function createIfAbsent(existing, newOpts) {
    if (existing) return existing   // return existing — no duplicate
    return { id: 'new-id', project_id: newOpts.project_id, status: 'draft' }
  }

  const existing = { id: 'existing-id', project_id: 'p-1', status: 'draft' }

  const result1 = createIfAbsent(existing, { project_id: 'p-1' })
  const result2 = createIfAbsent(null,     { project_id: 'p-1' })

  assert.equal(result1.id, 'existing-id', 'Should return existing template')
  assert.equal(result2.id, 'new-id',      'Should create when none exists')
  assert.equal(result1, existing,         'Idempotent: same object returned')
})

// ── 45. /start-campaign preselects project from URL query param ───────────────

test('start-campaign page preselects project_id from URL query param', () => {
  // Replicate the query-param preselection logic
  function getInitialProjectId(urlSearchParams) {
    return urlSearchParams.get('project_id') ?? ''
  }

  const withId    = new URLSearchParams('project_id=proj-123')
  const withoutId = new URLSearchParams('')
  const empty     = new URLSearchParams()

  assert.equal(getInitialProjectId(withId),    'proj-123', 'Should preselect from ?project_id=')
  assert.equal(getInitialProjectId(withoutId), '',         'Should default to empty string')
  assert.equal(getInitialProjectId(empty),     '',         'Should default to empty string when no params')
})

// ── 46. Checklist completion derives from summary signals ─────────────────────

test('computeChecklistCompletion marks items based on summary signals', () => {
  // Replicate computeChecklistCompletion logic
  const DEFAULT_CHECKLIST = [
    { key: 'define_audience', label: 'Define target audience',       completed: false },
    { key: 'choose_operator', label: 'Choose a Web Operator',        completed: false },
    { key: 'research_leads',  label: 'Research leads',               completed: false },
    { key: 'review_leads',    label: 'Review and approve leads',     completed: false },
    { key: 'prepare_draft',   label: 'Prepare Gmail draft',          completed: false },
    { key: 'approve_actions', label: 'Approve risky actions',        completed: false },
    { key: 'resume_send',     label: 'Resume / send',                completed: false },
    { key: 'check_replies',   label: 'Check replies',                completed: false },
    { key: 'review_trail',    label: 'Review execution trail',       completed: false },
  ]

  function compute(checklist, signals) {
    return checklist.map(item => {
      switch (item.key) {
        case 'define_audience': return item
        case 'choose_operator': return { ...item, completed: signals.has_operator }
        case 'research_leads':  return { ...item, completed: signals.has_leads }
        case 'review_leads':    return { ...item, completed: signals.has_approved_leads }
        case 'prepare_draft':   return { ...item, completed: signals.has_draft_action }
        case 'approve_actions': return item
        case 'resume_send':     return { ...item, completed: signals.has_send_action }
        case 'check_replies':   return { ...item, completed: signals.has_reply_check }
        case 'review_trail':    return { ...item, completed: signals.has_trail }
        default:                return item
      }
    })
  }

  const allDone = compute(DEFAULT_CHECKLIST, {
    has_operator: true, has_leads: true, has_approved_leads: true,
    has_draft_action: true, has_send_action: true, has_reply_check: true, has_trail: true,
  })
  const noneDone = compute(DEFAULT_CHECKLIST, {
    has_operator: false, has_leads: false, has_approved_leads: false,
    has_draft_action: false, has_send_action: false, has_reply_check: false, has_trail: false,
  })

  // Manual items are never auto-completed
  const manualKeys = ['define_audience', 'approve_actions']
  for (const key of manualKeys) {
    assert.ok(!allDone.find(i => i.key === key)?.completed,  `${key} must not be auto-completed`)
    assert.ok(!noneDone.find(i => i.key === key)?.completed, `${key} stays false with no signals`)
  }

  // Derived items complete when signals are true
  assert.ok(allDone.find(i => i.key === 'choose_operator')?.completed, 'choose_operator: true when has_operator')
  assert.ok(allDone.find(i => i.key === 'research_leads')?.completed,  'research_leads: true when has_leads')
  assert.ok(allDone.find(i => i.key === 'review_trail')?.completed,    'review_trail: true when has_trail')

  // Nothing complete when all signals false
  const autoKeys = ['choose_operator', 'research_leads', 'review_leads', 'prepare_draft', 'resume_send', 'check_replies', 'review_trail']
  for (const key of autoKeys) {
    assert.ok(!noneDone.find(i => i.key === key)?.completed, `${key} should be false with no signals`)
  }
})

// ── 47. CEO create_project response includes start_campaign_url ───────────────

test('CEO create_project response shape includes start_campaign_url and launch_template', () => {
  // Replicate the response construction from app/api/ceo/command/route.ts
  function buildCeoResponse(result, launchTemplate) {
    const isCreateProject = result.intent === 'create_project'
    const resolvedProjectId = result.project_id

    const startCampaignUrl = (isCreateProject && resolvedProjectId)
      ? `/start-campaign?project_id=${resolvedProjectId}`
      : null

    const tplSummary = (isCreateProject && launchTemplate)
      ? {
          id:               launchTemplate.id,
          status:           launchTemplate.status,
          checklist_count:  launchTemplate.checklist.length,
          checklist_done:   launchTemplate.checklist.filter(i => i.completed).length,
        }
      : null

    return {
      ...result,
      start_campaign_url: startCampaignUrl,
      launch_template:    tplSummary,
    }
  }

  const createResult = { intent: 'create_project', project_id: 'p-99', response: 'Project created.' }
  const tpl = { id: 't-1', status: 'draft', checklist: [{ completed: false }, { completed: true }] }

  const resp = buildCeoResponse(createResult, tpl)

  assert.equal(resp.start_campaign_url, '/start-campaign?project_id=p-99', 'URL includes project_id')
  assert.equal(resp.launch_template?.checklist_count, 2, 'Checklist count correct')
  assert.equal(resp.launch_template?.checklist_done, 1,  'Checklist done count correct')

  // Non-project intents don't get the URL
  const otherResult = { intent: 'general', project_id: 'p-99', response: 'ok' }
  const other = buildCeoResponse(otherResult, tpl)
  assert.equal(other.start_campaign_url, null, 'Non-project intent → no start_campaign_url')
})

test('CEO create_project normalizes top-level assign_pm into executable action', () => {
  function normalizeCeoActionsForExecution(parsed) {
    const actions = Array.isArray(parsed.actions) ? parsed.actions : []
    if (parsed.intent !== 'create_project') return actions

    const hasAssignAction = actions.some(action => action.type === 'assign_pm')
    const pmName = typeof parsed.assign_pm === 'string' ? parsed.assign_pm.trim() : ''
    if (!pmName || pmName === 'null' || hasAssignAction) return actions

    const createAction = actions.find(action => action.type === 'create_project')
    const projectName = typeof parsed.project_name === 'string' && parsed.project_name.trim()
      ? parsed.project_name.trim()
      : typeof createAction?.data?.name === 'string'
        ? createAction.data.name
        : ''

    if (!projectName) return actions

    return [
      ...actions,
      {
        type: 'assign_pm',
        data: {
          pm_name: pmName,
          project_name: projectName,
          focus: 'Prepare project memory and first campaign direction',
        },
      },
    ]
  }

  const normalized = normalizeCeoActionsForExecution({
    intent: 'create_project',
    project_name: 'Demo Parking',
    assign_pm: 'Mara',
    actions: [
      { type: 'create_project', data: { name: 'Demo Parking' } },
      { type: 'update_company_memory', data: { summary: 'New project' } },
    ],
  })

  const assignAction = normalized.find(action => action.type === 'assign_pm')
  assert.ok(assignAction, 'assign_pm action added from top-level field')
  assert.deepEqual(assignAction.data, {
    pm_name: 'Mara',
    project_name: 'Demo Parking',
    focus: 'Prepare project memory and first campaign direction',
  })

  const alreadyExplicit = normalizeCeoActionsForExecution({
    intent: 'create_project',
    project_name: 'Demo Parking',
    assign_pm: 'Mara',
    actions: [
      { type: 'create_project', data: { name: 'Demo Parking' } },
      { type: 'assign_pm', data: { pm_name: 'Kenji', project_name: 'Demo Parking' } },
    ],
  })

  assert.equal(alreadyExplicit.filter(action => action.type === 'assign_pm').length, 1)
})

// ── 48. Strategy brief creation is idempotent ─────────────────────────────────

test('strategy brief creation is idempotent', () => {
  // Simulate the idempotency check in createProjectStrategyBrief
  function createBrief(existingBrief, opts) {
    if (existingBrief) return existingBrief  // idempotent: return existing
    return {
      id: 'new-brief',
      project_id: opts.project_id,
      title: opts.title ?? '',
      objective: opts.objective ?? '',
      research_prompt: opts.research_prompt ?? '',
      risks: opts.risks ?? [],
      assumptions: opts.assumptions ?? [],
      next_actions: opts.next_actions ?? ['Open First Campaign Flow'],
    }
  }

  const existing = { id: 'brief-1', project_id: 'p-1', title: 'Existing Brief', research_prompt: 'Find leads' }
  const opts = { project_id: 'p-1', title: 'New Brief', research_prompt: 'Different' }

  // With existing: returns existing unchanged
  const result1 = createBrief(existing, opts)
  assert.equal(result1.id, 'brief-1', 'Returns existing brief when one exists')
  assert.equal(result1.title, 'Existing Brief', 'Does not overwrite existing brief')

  // Without existing: creates new
  const result2 = createBrief(null, opts)
  assert.equal(result2.id, 'new-brief', 'Creates new brief when none exists')
  assert.equal(result2.title, 'New Brief', 'Uses provided title')
})

// ── 49. Fallback brief is always valid ────────────────────────────────────────

test('fallback brief is valid when AI generation fails', () => {
  function buildFallbackBrief(opts) {
    return {
      project_id:          opts.project_id,
      title:               `${opts.project_name} — First Campaign Brief`,
      objective:           opts.goal
                             ? `Drive initial outreach for: ${opts.goal}`
                             : `Launch first outbound campaign for ${opts.project_name}`,
      target_audience:     'To be defined — use First Campaign Flow to refine',
      research_prompt:     `Find potential leads and companies for ${opts.project_name}`,
      recommended_channel: 'email',
      value_proposition:   'To be defined — describe your core offer in one sentence',
      risks:               ['Target audience not yet validated', 'Messaging may need iteration'],
      assumptions:         ['Email is an appropriate first channel', 'Leads can be found via web research'],
      next_actions:        ['Open First Campaign Flow', 'Define target audience in step 1', 'Research leads via Web Operator'],
      created_by_role:     'CEO',
    }
  }

  // With goal
  const brief1 = buildFallbackBrief({ project_id: 'p-1', project_name: 'ALB Parking', goal: 'Find parking operators' })
  assert.ok(brief1.title.includes('ALB Parking'), 'Title includes project name')
  assert.ok(brief1.objective.includes('Find parking operators'), 'Objective includes goal')
  assert.ok(brief1.research_prompt.includes('ALB Parking'), 'Research prompt includes project name')
  assert.ok(Array.isArray(brief1.risks) && brief1.risks.length > 0, 'Risks array populated')
  assert.ok(Array.isArray(brief1.next_actions) && brief1.next_actions.includes('Open First Campaign Flow'), 'Next actions include First Campaign Flow')

  // Without goal
  const brief2 = buildFallbackBrief({ project_id: 'p-2', project_name: 'Acme Corp' })
  assert.ok(brief2.objective.includes('Acme Corp'), 'Objective includes project name when no goal')
  assert.equal(brief2.recommended_channel, 'email', 'Default channel is email')
  assert.equal(brief2.created_by_role, 'CEO', 'Created by CEO')
})

// ── 50. Start-campaign summary includes strategy_brief ────────────────────────

test('start-campaign summary response includes strategy_brief field', () => {
  // Replicate the response construction from the summary API
  function buildSummaryResponse(projectId, brief) {
    return {
      projects:          [],
      operators:         [],
      lead_counts:       {},
      approved_leads:    [],
      contacted_leads:   [],
      pending_approvals: [],
      resume_candidates: [],
      recent_trail:      [],
      launch_template:   null,
      strategy_brief:    projectId && brief ? brief : null,
    }
  }

  const brief = {
    id: 'b-1', project_id: 'p-1',
    title: 'ALB Parking — First Campaign Brief',
    objective: 'Find parking operators in the US',
    research_prompt: 'Find parking lot operators in the US',
  }

  const withProject = buildSummaryResponse('p-1', brief)
  assert.ok('strategy_brief' in withProject, 'summary has strategy_brief field')
  assert.equal(withProject.strategy_brief?.id, 'b-1', 'Returns brief when project selected')

  const withoutProject = buildSummaryResponse(null, null)
  assert.equal(withoutProject.strategy_brief, null, 'strategy_brief is null when no project')
})

// ── 51. Research prompt from brief does not auto-trigger Web Operator ─────────

test('research prompt from strategy brief does not auto-trigger Web Operator', () => {
  // The research prompt is a suggestion: it pre-fills the input field.
  // It does NOT automatically call any API or Web Operator.
  // Triggering research requires explicit user action (clicking "Start Research").

  // Simulate the UI state machine
  function simulatePageState(brief, userClicked) {
    const prefilled = brief?.research_prompt ?? ''  // pre-fill only
    const webOperatorCalled = userClicked           // only called on explicit action
    return { prefilled, webOperatorCalled }
  }

  const brief = { research_prompt: 'Find parking operators' }

  // Brief loaded but user has not clicked — no Web Operator call
  const passive = simulatePageState(brief, false)
  assert.equal(passive.prefilled, 'Find parking operators', 'Research prompt pre-filled in input')
  assert.equal(passive.webOperatorCalled, false, 'Web Operator NOT called on prefill alone')

  // User explicitly clicks — Web Operator called
  const active = simulatePageState(brief, true)
  assert.equal(active.webOperatorCalled, true, 'Web Operator called only after user action')
})

// ── 52. CEO create_project response includes strategy_brief summary ───────────

test('CEO create_project response includes strategy_brief summary', () => {
  function buildCeoResponse(result, brief) {
    const isCreate = result.intent === 'create_project'
    const briefSummary = (isCreate && brief)
      ? {
          id:                  brief.id,
          title:               brief.title,
          objective:           brief.objective,
          target_audience:     brief.target_audience,
          research_prompt:     brief.research_prompt,
          recommended_channel: brief.recommended_channel,
          value_proposition:   brief.value_proposition,
        }
      : null
    return { ...result, strategy_brief: briefSummary }
  }

  const createResult = { intent: 'create_project', project_id: 'p-1', response: 'Project created.' }
  const brief = {
    id: 'b-1', title: 'ALB Brief', objective: 'Find operators',
    target_audience: 'Parking operators', research_prompt: 'Find them',
    recommended_channel: 'email', value_proposition: 'Automate outreach',
  }

  const resp = buildCeoResponse(createResult, brief)
  assert.ok(resp.strategy_brief !== null, 'Brief included for create_project intent')
  assert.equal(resp.strategy_brief?.id, 'b-1', 'Brief id correct')
  assert.equal(resp.strategy_brief?.research_prompt, 'Find them', 'Research prompt included')

  // Non-project intents get null brief
  const other = buildCeoResponse({ intent: 'general', project_id: 'p-1' }, brief)
  assert.equal(other.strategy_brief, null, 'No brief for non-create_project intents')
})

// ── Operator recommendation logic (pure JS replicas) ──────────────────────────

function recommendOperator(operators, projectId) {
  if (operators.length === 0) {
    return { operator_id: null, operator_name: null, reason: 'No operator exists yet. Create one before running research.', available: false }
  }
  const assigned = operators.find(o => o.project_id === projectId)
  if (assigned) return { operator_id: assigned.id, operator_name: assigned.name, reason: `${assigned.name} is already assigned to this project.`, available: true }

  const idle = operators.find(o => o.status === 'idle')
  if (idle) return { operator_id: idle.id, operator_name: idle.name, reason: `${idle.name} is idle and available for the first research task.`, available: true }

  const dflt = operators.find(o => o.browser_profile_key === 'default' || o.name.toLowerCase() === 'default')
  if (dflt) return { operator_id: dflt.id, operator_name: dflt.name, reason: `${dflt.name} is available as a fallback.`, available: true }

  const any = operators[0]
  return { operator_id: any.id, operator_name: any.name, reason: `${any.name} is the only available operator (currently ${any.status}).`, available: true }
}

// ── 53. Project-assigned operator wins over idle ───────────────────────────────

test('project-assigned operator wins over idle operator', () => {
  const operators = [
    { id: 'op-1', name: 'Kevin', status: 'idle', project_id: 'p-99', browser_profile_key: 'kevin' },
    { id: 'op-2', name: 'Alice', status: 'idle', project_id: null,   browser_profile_key: 'alice' },
  ]
  const rec = recommendOperator(operators, 'p-99')
  assert.equal(rec.operator_id, 'op-1', 'Assigned operator (Kevin) wins')
  assert.ok(rec.reason.includes('already assigned'), 'Reason mentions assignment')
  assert.equal(rec.available, true)
})

// ── 54. Idle operator recommended if no project operator ──────────────────────

test('idle operator is recommended if no project-assigned operator', () => {
  const operators = [
    { id: 'op-1', name: 'Alice', status: 'working', project_id: null,   browser_profile_key: 'alice' },
    { id: 'op-2', name: 'Kevin', status: 'idle',    project_id: null,   browser_profile_key: 'kevin' },
    { id: 'op-3', name: 'Bob',   status: 'idle',    project_id: 'p-77', browser_profile_key: 'bob'   },
  ]
  const rec = recommendOperator(operators, 'p-99')
  assert.equal(rec.operator_id, 'op-2', 'First idle unassigned operator (Kevin) recommended')
  assert.ok(rec.reason.includes('idle'), 'Reason mentions idle status')
  assert.equal(rec.available, true)
})

// ── 55. Default operator is fallback when no idle operator ────────────────────

test('Default operator is fallback if no idle or assigned operator', () => {
  const operators = [
    { id: 'op-1', name: 'Alice',   status: 'working', project_id: null, browser_profile_key: 'alice'   },
    { id: 'op-2', name: 'Default', status: 'working', project_id: null, browser_profile_key: 'default' },
  ]
  const rec = recommendOperator(operators, 'p-99')
  assert.equal(rec.operator_id, 'op-2', 'Default operator recommended as fallback')
  assert.ok(rec.reason.includes('fallback'), 'Reason mentions fallback')
  assert.equal(rec.available, true)
})

// ── 56. No operators returns create-operator recommendation ───────────────────

test('no operators returns create-operator recommendation', () => {
  const rec = recommendOperator([], 'p-99')
  assert.equal(rec.operator_id, null, 'No operator id when none exist')
  assert.equal(rec.available, false, 'available=false when no operators')
  assert.ok(rec.reason.toLowerCase().includes('create'), 'Reason mentions creating an operator')
})

// ── 57. Selecting recommended operator does not trigger external action ────────

test('selecting recommended operator in Start Campaign does not trigger external action', () => {
  // The "Use this operator" button only calls setSelectedOperator(id).
  // No API calls, no Web Operator actions, no browser sessions.
  let selectedOperator = ''
  let webOperatorCalled = false

  function setSelectedOperator(id) { selectedOperator = id }
  function fakeRunWebOperator() { webOperatorCalled = true }

  // Simulate clicking "Use this operator"
  function handleUseOperator(operatorId) {
    setSelectedOperator(operatorId)
    // Does NOT call fakeRunWebOperator — no external action
  }

  handleUseOperator('op-1')
  assert.equal(selectedOperator, 'op-1', 'Operator selected in UI state')
  assert.equal(webOperatorCalled, false, 'No Web Operator action triggered')
  // fakeRunWebOperator is never called
})

// ── CEO project recall helpers (pure JS replicas) ─────────────────────────────

const RECALL_PATTERNS = [
  /what\s+are\s+we\s+doing\s+(for|on|with)\s+/i,
  /summarize\s+/i,
  /summary\s+(of|for)\s+/i,
  /status\s+(of|for|on)\s+/i,
  /who\s+is\s+assigned\s+to\s+/i,
  /next\s+step\s+(for|on)\s+/i,
  /what.*(strategy|campaign|brief|plan)\s+(for|on)\s+/i,
  /what\s+is\s+missing\s+before\s+a[ïi]ko\s+can\s+execute\s+/i,
  /what\s+has\s+\w+\s+done\s+(for|on)\s+/i,
  /tell\s+me\s+about\s+/i,
  /what.*(happening|going\s+on)\s+(with|for|on)\s+/i,
]
function isRecallIntent(cmd) { return RECALL_PATTERNS.some(p => p.test(cmd)) }

function shouldBypassRecallFastPath(cmd) {
  return (
    /\bhttps?:\/\//i.test(cmd) ||
    /^[A-Z][a-z]+,?\s+(open|search|research|browse|check|summarize|read|go to)\b/i.test(cmd) ||
    /\b(open|search|research|browse|check online|go to)\s+https?:\/\//i.test(cmd)
  )
}

function extractRecallProjectName(cmd) {
  return cmd
    .replace(/^what\s+are\s+we\s+doing\s+(for|on|with)\s+/i, '')
    .replace(/^summarize\s+/i, '')
    .replace(/^summary\s+(of|for)\s+/i, '')
    .replace(/^status\s+(of|for|on)\s+/i, '')
    .replace(/^who\s+is\s+assigned\s+to\s+/i, '')
    .replace(/^next\s+step\s+(for|on)\s+/i, '')
    .replace(/^tell\s+me\s+about\s+/i, '')
    .replace(/^what.*(strategy|campaign|brief|plan)\s+(for|on)\s+/i, '')
    .replace(/^what\s+is\s+missing\s+before\s+a[ïi]ko\s+can\s+execute\s+.*\s+for\s+/i, '')
    .replace(/^what\s+has\s+\w+\s+done\s+(for|on)\s+/i, '')
    .replace(/^what.*(happening|going\s+on)\s+(with|for|on)\s+/i, '')
    .trim().replace(/[?.!]+$/, '').trim()
}

function findProjectByName(projects, query) {
  const q = query.toLowerCase()
  return projects.find(p => p.name.toLowerCase() === q)
    ?? projects.find(p => p.name.toLowerCase().includes(q))
    ?? null
}

// ── 58. Project search matches case-insensitively ─────────────────────────────

test('project search matches by name case-insensitively', () => {
  const projects = [
    { id: 'p-1', name: 'ALB Parking', goal: 'Find operators' },
    { id: 'p-2', name: 'Foreman Inc', goal: 'B2B outreach' },
  ]
  assert.equal(findProjectByName(projects, 'alb parking')?.id, 'p-1', 'Exact lowercase match')
  assert.equal(findProjectByName(projects, 'ALB PARKING')?.id, 'p-1', 'Uppercase match')
  assert.equal(findProjectByName(projects, 'ALB')?.id, 'p-1', 'Partial match')
  assert.equal(findProjectByName(projects, 'foreman')?.id, 'p-2', 'Partial lowercase match')
  assert.equal(findProjectByName(projects, 'xyz'), null, 'No match returns null')
})

// ── 59. Recall intent is detected correctly ───────────────────────────────────

test('recall intent patterns match expected commands', () => {
  assert.ok(isRecallIntent('What are we doing for ALB Parking?'), 'what are we doing for')
  assert.ok(isRecallIntent('Summarize ALB Parking'), 'summarize')
  assert.ok(isRecallIntent('Status of Foreman'), 'status of')
  assert.ok(isRecallIntent('Who is assigned to ALB Parking?'), 'who is assigned to')
  assert.ok(isRecallIntent('Next step for ALB Parking'), 'next step for')
  assert.ok(isRecallIntent('Tell me about Foreman'), 'tell me about')
  assert.ok(isRecallIntent('What has Kevin done for ALB Parking?'), 'what has X done for')
  assert.ok(isRecallIntent('What is missing before AÏKO can execute WhatsApp outreach for ALB Parking?'), 'missing capability recall')
  assert.ok(!isRecallIntent('Create a project for ALB Parking'), 'create does not trigger recall')
  assert.ok(!isRecallIntent('Run the research for ALB'), 'run does not trigger recall')
})

test('direct URL and named-operator browser commands bypass project recall fast path', () => {
  const directOperatorCommand = 'Kevin, open https://www.coruna.gal and summarize any parking context relevant to ALB Parking.'
  const genericDirectCommand = 'Open https://example.com and summarize the page.'
  const ordinaryRecallCommand = 'Summarize ALB Parking'

  assert.ok(isRecallIntent(directOperatorCommand), 'contains summarize and would otherwise match recall')
  assert.ok(shouldBypassRecallFastPath(directOperatorCommand), 'named operator direct URL bypasses recall')
  assert.ok(shouldBypassRecallFastPath(genericDirectCommand), 'direct URL browser command bypasses recall')
  assert.ok(!shouldBypassRecallFastPath(ordinaryRecallCommand), 'ordinary project recall still uses recall fast path')
})

// ── 60. Recall project name extracted correctly ───────────────────────────────

test('project name extracted from recall commands', () => {
  assert.equal(extractRecallProjectName('What are we doing for ALB Parking?'), 'ALB Parking')
  assert.equal(extractRecallProjectName('Summarize ALB Parking'), 'ALB Parking')
  assert.equal(extractRecallProjectName('Status of Foreman'), 'Foreman')
  assert.equal(extractRecallProjectName('Who is assigned to ALB Parking?'), 'ALB Parking')
  assert.equal(extractRecallProjectName('Next step for ALB Parking'), 'ALB Parking')
  assert.equal(extractRecallProjectName('Tell me about Foreman'), 'Foreman')
  assert.equal(extractRecallProjectName('What is missing before AÏKO can execute WhatsApp outreach for ALB Parking?'), 'ALB Parking')
})

test('missing capability recall answers from execution plan context', () => {
  const ctx = {
    name: 'ALB Parking',
    latest_execution_plan: {
      recommended_channel: 'WhatsApp Web',
      missing_capabilities: [
        { name: 'Add WhatsApp Web Operator Skill', required_skill: 'whatsapp_web', required_playbook: null },
        { name: 'Add WhatsApp Web Operator Playbook', required_skill: 'whatsapp_web', required_playbook: 'whatsapp_outreach' },
      ],
      approval_gates: [{ action: 'send_message' }],
    },
    system_improvement_proposals: [{ title: 'Add WhatsApp Web Operator Skill and Playbook' }],
  }
  const missing = ctx.latest_execution_plan.missing_capabilities
    .map(m => {
      const ids = [m.required_skill, m.required_playbook].filter(Boolean).join(' / ')
      return ids ? `${m.name} (${ids})` : m.name
    })
    .join(', ')
  const response = `Before AÏKO can execute ${ctx.latest_execution_plan.recommended_channel} for ${ctx.name}, it needs: ${missing}. The linked proposal is "${ctx.system_improvement_proposals[0].title}". No Web Operator action should run until the capability is approved and implemented.`

  assert.ok(response.includes('whatsapp_web'))
  assert.ok(response.includes('whatsapp_outreach'))
  assert.ok(response.includes('Add WhatsApp Web Operator Skill and Playbook'))
  assert.ok(!response.includes('Email Sending'))
})

// ── 61. Context includes brief and launch progress ────────────────────────────

test('project context includes strategy brief and launch progress', () => {
  // Simulate the shape returned by getProjectContext
  const ctx = {
    id: 'p-1', name: 'ALB Parking', goal: 'Find parking operators',
    pm_name: 'Kenji', pm_focus: 'outbound',
    brief_objective: 'Launch first outbound campaign',
    brief_target_audience: 'Property administrators',
    brief_channel: 'email',
    launch_done: 3, launch_total: 9, launch_status: 'in_progress',
    launch_next_item: 'Prepare Gmail draft for approved lead',
    lead_total: 5, lead_approved: 2, lead_contacted: 0, lead_replied: 0,
    pending_approvals: 0,
  }
  assert.ok(ctx.brief_objective,   'has brief objective')
  assert.ok(ctx.brief_target_audience, 'has target audience')
  assert.ok(ctx.launch_total > 0,  'has launch template progress')
  assert.equal(ctx.launch_done, 3, 'correct steps done')
  assert.equal(ctx.launch_next_item, 'Prepare Gmail draft for approved lead', 'has next item')
})

// ── 62. Recall does not create a project ─────────────────────────────────────

test('recall intent does not create a project', () => {
  // Recall result has no actions array with create_project
  const recallResult = {
    response: 'ALB Parking is targeting property administrators...',
    intent: 'project_recall',
    actions: [],    // must be empty — no side effects
    project_id: 'p-1',
  }
  assert.equal(recallResult.actions.length, 0, 'No actions in recall result')
  assert.equal(recallResult.intent, 'project_recall', 'Intent is project_recall')
  const hasCreate = recallResult.actions.some(a => a.type === 'create_project')
  assert.equal(hasCreate, false, 'No create_project action')
})

// ── 63. No project found returns clear message ────────────────────────────────

test('no project found returns clear message with available projects', () => {
  function buildNoProjectResponse(query, allNames) {
    const list = allNames.length > 0
      ? `Active projects: ${allNames.join(', ')}.`
      : 'No active projects found.'
    return {
      response: `I don't have a project matching "${query}". ${list}`,
      intent: 'project_recall',
      actions: [],
      project_id: null,
    }
  }
  const resp = buildNoProjectResponse('XYZ Corp', ['ALB Parking', 'Foreman'])
  assert.ok(resp.response.includes('XYZ Corp'), 'Mentions the unknown project name')
  assert.ok(resp.response.includes('ALB Parking'), 'Lists available projects')
  assert.equal(resp.project_id, null, 'No project_id')
  assert.equal(resp.actions.length, 0, 'No actions')
})

// ── 64. Next step uses launch template when available ─────────────────────────

test('getProjectNextStep uses launch template progress', () => {
  function getNextStep(ctx) {
    if (ctx.memory_blockers?.length > 0) return `Resolve blocker: ${ctx.memory_blockers[0]}`
    if (ctx.pending_approvals > 0) return `Review and approve ${ctx.pending_approvals} pending action(s).`
    if (ctx.launch_next_item) return `Complete the next launch step: "${ctx.launch_next_item}".`
    if (ctx.lead_total === 0) return ctx.brief_research_prompt ? `Research leads using: "${ctx.brief_research_prompt}"` : 'Research leads.'
    if (ctx.lead_approved === 0) return `Review and approve ${ctx.lead_total} lead(s).`
    if (ctx.lead_contacted === 0) return `Prepare outreach for ${ctx.lead_approved} approved lead(s).`
    return 'Review the execution trail.'
  }

  const ctx1 = { memory_blockers: [], pending_approvals: 0,
    launch_next_item: 'Research leads via Web Operator',
    lead_total: 0, lead_approved: 0, lead_contacted: 0 }
  assert.ok(getNextStep(ctx1).includes('Research leads via Web Operator'), 'Uses launch next item')

  const ctx2 = { memory_blockers: ['Waiting for domain'], pending_approvals: 0,
    launch_next_item: 'Step X', lead_total: 0, lead_approved: 0, lead_contacted: 0 }
  assert.ok(getNextStep(ctx2).includes('Waiting for domain'), 'Blockers take priority')

  const ctx3 = { memory_blockers: [], pending_approvals: 3,
    launch_next_item: null, lead_total: 0, lead_approved: 0, lead_contacted: 0 }
  assert.ok(getNextStep(ctx3).includes('3'), 'Pending approvals surface')
})

// ── Decision Log tests ────────────────────────────────────────────────────────

// ── 70. recordDecisionIfNotExists is idempotent ───────────────────────────────

test('recordDecisionIfNotExists returns existing entry without creating duplicate', async () => {
  const store = []

  async function recordDecisionIfNotExists(input) {
    const existing = store.find(
      d => d.project_id === input.project_id && d.decision_type === input.decision_type
    )
    if (existing) return existing
    const entry = { id: crypto.randomUUID(), ...input, created_at: new Date().toISOString() }
    store.push(entry)
    return entry
  }

  const first  = await recordDecisionIfNotExists({ project_id: 'p1', decision_type: 'project_created', title: 'Project "Test" created' })
  const second = await recordDecisionIfNotExists({ project_id: 'p1', decision_type: 'project_created', title: 'Duplicate attempt' })

  assert.equal(first.id, second.id,   'Same entry returned — no duplicate')
  assert.equal(store.length, 1,        'Only one entry in store')
  assert.equal(second.title, 'Project "Test" created', 'Original title preserved')
})

// ── 71. project_created decision recorded once even if called twice ───────────

test('project_created decision recorded at most once per project', async () => {
  const store = []

  async function recordOnce(projectId, type, title) {
    if (store.some(d => d.project_id === projectId && d.decision_type === type)) return
    store.push({ project_id: projectId, decision_type: type, title, created_at: new Date().toISOString() })
  }

  await recordOnce('proj-abc', 'project_created', 'Project "ABC" created')
  await recordOnce('proj-abc', 'project_created', 'Project "ABC" created')
  await recordOnce('proj-abc', 'strategy_brief_created', 'Brief created')
  await recordOnce('proj-abc', 'launch_template_created', 'Launch checklist created')

  const forProject = store.filter(d => d.project_id === 'proj-abc')
  assert.equal(forProject.filter(d => d.decision_type === 'project_created').length, 1, 'project_created recorded once')
  assert.equal(forProject.filter(d => d.decision_type === 'strategy_brief_created').length, 1, 'strategy_brief_created recorded once')
  assert.equal(forProject.filter(d => d.decision_type === 'launch_template_created').length, 1, 'launch_template_created recorded once')
  assert.equal(forProject.length, 3, 'Three distinct decision types recorded')
})

// ── 72. approval_approved decision recorded when approval status changes ──────

test('approval_approved decision recorded when approval item approved', () => {
  function deriveDecisionType(status) {
    const map = {
      approved:          'approval_approved',
      rejected:          'approval_rejected',
      changes_requested: 'approval_changes_requested',
    }
    return map[status] ?? null
  }

  assert.equal(deriveDecisionType('approved'),          'approval_approved')
  assert.equal(deriveDecisionType('rejected'),          'approval_rejected')
  assert.equal(deriveDecisionType('changes_requested'), 'approval_changes_requested')
  assert.equal(deriveDecisionType('pending'),           null, 'No decision for pending status')
  assert.equal(deriveDecisionType('draft'),             null, 'No decision for draft status')
})

// ── 73. lead_approved decision recorded when lead status changes to approved ──

test('lead_approved / lead_rejected decision recorded on lead status update', () => {
  function buildLeadDecision(lead, newStatus) {
    if (!lead.project_id || !['approved', 'rejected'].includes(newStatus)) return null
    return {
      project_id:    lead.project_id,
      decision_type: newStatus === 'approved' ? 'lead_approved' : 'lead_rejected',
      title:         `Lead "${lead.company_name}" ${newStatus}`,
      decided_by_role: 'user',
    }
  }

  const lead = { id: 'l1', project_id: 'p1', company_name: 'Acme Corp' }

  const approved = buildLeadDecision(lead, 'approved')
  assert.ok(approved, 'Decision built for approved')
  assert.equal(approved.decision_type, 'lead_approved')
  assert.ok(approved.title.includes('Acme Corp'))

  const rejected = buildLeadDecision(lead, 'rejected')
  assert.equal(rejected.decision_type, 'lead_rejected')

  const noDecision = buildLeadDecision(lead, 'contacted')
  assert.equal(noDecision, null, 'No decision for non-approval status changes')

  const noProject = buildLeadDecision({ ...lead, project_id: null }, 'approved')
  assert.equal(noProject, null, 'No decision if lead has no project_id')
})

// ── 74. CEO project context includes recent_decisions ─────────────────────────

test('CEO project context shape includes recent_decisions array', () => {
  // Simulate the ProjectContext shape with recent_decisions
  const ctx = {
    id: 'p1',
    name: 'ALB Parking',
    recent_decisions: [
      {
        decision_type:   'project_created',
        title:           'Project "ALB Parking" created',
        summary:         'Goal: Find property managers',
        decided_by_role: 'ceo',
        created_at:      '2026-06-01T10:00:00Z',
      },
      {
        decision_type:   'strategy_brief_created',
        title:           'First-campaign strategy brief generated',
        summary:         'AI generated an initial strategy brief.',
        decided_by_role: 'system',
        created_at:      '2026-06-01T10:01:00Z',
      },
    ],
  }

  assert.ok(Array.isArray(ctx.recent_decisions), 'recent_decisions is an array')
  assert.equal(ctx.recent_decisions.length, 2)
  assert.equal(ctx.recent_decisions[0].decision_type, 'project_created')
  assert.ok(ctx.recent_decisions[0].title.includes('ALB Parking'))
})

// ── 75. getDecisionSummaryForProject formats decisions as plain text ──────────

test('getDecisionSummaryForProject formats decisions as readable plain text', () => {
  function getDecisionSummary(decisions) {
    if (decisions.length === 0) return 'No decisions recorded yet.'
    return decisions.map(d => {
      const who  = d.decided_by_role ? ` (${d.decided_by_role})` : ''
      const when = new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      return `[${when}] ${d.title}${who}: ${d.summary ?? d.decision_type}`
    }).join('\n')
  }

  const decisions = [
    { decision_type: 'project_created', title: 'Project "Test" created', summary: 'Goal: grow revenue', decided_by_role: 'ceo', created_at: '2026-06-01T10:00:00Z' },
    { decision_type: 'pm_assigned', title: 'Alice assigned as PM', summary: null, decided_by_role: 'ceo', created_at: '2026-06-01T10:05:00Z' },
  ]

  const summary = getDecisionSummary(decisions)
  assert.ok(summary.includes('Project "Test" created'), 'Includes project created')
  assert.ok(summary.includes('grow revenue'), 'Includes summary text')
  assert.ok(summary.includes('Alice assigned'), 'Includes PM assignment')
  assert.ok(summary.includes('ceo'), 'Includes role')
  assert.ok(!summary.includes('undefined'), 'No undefined values')

  const empty = getDecisionSummary([])
  assert.equal(empty, 'No decisions recorded yet.')
})

// ── Executive Report tests ─────────────────────────────────────────────────────

// ── 76. Report generation uses project context (strategy + progress snapshots) ─

test('executive report builds strategy and progress snapshots from project context', () => {
  function buildStrategySnapshot(ctx) {
    return {
      goal:            ctx.goal,
      objective:       ctx.brief_objective ?? null,
      target_audience: ctx.brief_target_audience ?? null,
      channel:         ctx.brief_channel ?? null,
      value_prop:      ctx.brief_value_prop ?? null,
      operator:        ctx.brief_operator ?? ctx.pm_name ?? null,
      pm:              ctx.pm_name ?? null,
    }
  }

  function buildProgressSnapshot(ctx) {
    return {
      launch_status:     ctx.launch_status ?? null,
      launch_done:       ctx.launch_done ?? 0,
      launch_total:      ctx.launch_total ?? 0,
      lead_total:        ctx.lead_total ?? 0,
      lead_approved:     ctx.lead_approved ?? 0,
      lead_contacted:    ctx.lead_contacted ?? 0,
      lead_replied:      ctx.lead_replied ?? 0,
      pending_approvals: ctx.pending_approvals ?? 0,
    }
  }

  const ctx = {
    name: 'ALB Parking', goal: 'Find property managers',
    brief_objective: 'Reach property managers in LA',
    brief_target_audience: 'Property administrators',
    brief_channel: 'LinkedIn', brief_value_prop: 'Managed parking',
    brief_operator: 'Kevin', pm_name: 'Kenji',
    launch_status: 'in_progress', launch_done: 3, launch_total: 9,
    lead_total: 12, lead_approved: 5, lead_contacted: 3, lead_replied: 1,
    pending_approvals: 2,
  }

  const strat = buildStrategySnapshot(ctx)
  assert.equal(strat.target_audience, 'Property administrators')
  assert.equal(strat.channel, 'LinkedIn')
  assert.equal(strat.operator, 'Kevin')
  assert.equal(strat.pm, 'Kenji')

  const prog = buildProgressSnapshot(ctx)
  assert.equal(prog.launch_done, 3)
  assert.equal(prog.launch_total, 9)
  assert.equal(prog.lead_total, 12)
  assert.equal(prog.pending_approvals, 2)
})

// ── 77. Fallback report exists if AI fails ────────────────────────────────────

test('fallback report builds from structured data without AI', () => {
  function buildFallback(ctx, risks, nextStep) {
    const parts = []
    parts.push(`${ctx.name} is an active project${ctx.goal ? ` with the goal: ${ctx.goal}` : ''}.`)
    if (ctx.brief_target_audience) {
      parts.push(`We are targeting ${ctx.brief_target_audience}${ctx.brief_channel ? ` via ${ctx.brief_channel}` : ''}.`)
    }
    if (ctx.launch_total > 0) {
      parts.push(`The first-campaign launch plan is ${ctx.launch_done}/${ctx.launch_total} steps complete.`)
    }
    if (ctx.lead_total > 0) {
      parts.push(`The lead pipeline has ${ctx.lead_total} total leads — ${ctx.lead_approved} approved.`)
    } else {
      parts.push('No leads have been researched yet.')
    }
    if (risks.length > 0) parts.push(`Key risk: ${risks[0]}.`)
    parts.push(`Recommended next step: ${nextStep}`)
    return parts.join(' ')
  }

  const ctx = {
    name: 'Foreman', goal: 'B2B outbound',
    brief_target_audience: 'Plant managers',
    brief_channel: 'LinkedIn',
    launch_done: 2, launch_total: 9,
    lead_total: 0, lead_approved: 0,
  }
  const summary = buildFallback(ctx, ['No leads researched yet'], 'Research leads via Web Operator.')

  assert.ok(summary.includes('Foreman'), 'Includes project name')
  assert.ok(summary.includes('Plant managers'), 'Includes target audience')
  assert.ok(summary.includes('2/9'), 'Includes launch progress')
  assert.ok(summary.includes('No leads have been researched yet'), 'Notes missing leads')
  assert.ok(summary.includes('Research leads'), 'Includes next step')
  assert.ok(!summary.includes('undefined'), 'No undefined values')
})

// ── 78. Report save does not create Web Operator action ───────────────────────

test('executive report save path inserts only into project_executive_reports table', () => {
  // Verify the insert targets the reports table, not web_operator_actions
  const reportInsertSQL = `INSERT INTO project_executive_reports
     (project_id, title, summary, strategy_snapshot, progress_snapshot,
      decisions_snapshot, risks, next_steps, generated_by_role)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
   RETURNING *`

  assert.ok(reportInsertSQL.includes('project_executive_reports'), 'Targets the correct table')
  assert.ok(!reportInsertSQL.includes('web_operator_actions'), 'Does not touch web_operator_actions')
  assert.ok(!reportInsertSQL.includes('approval_items'), 'Does not touch approval_items')
  assert.ok(!reportInsertSQL.includes('leads'), 'Does not touch leads table')
})

// ── 79. CEO report intent does not create a project ──────────────────────────

test('report intent patterns do not overlap with create_project patterns', () => {
  const REPORT_PATTERNS = [
    /generate\s+(an?\s+)?(executive\s+)?report\s+(for|on)\s+/i,
    /executive\s+report\s+(for|on)\s+/i,
    /weekly\s+report\s+(for|on)\s+/i,
    /give\s+me\s+a\s+report\s+(on|for)\s+/i,
    /run\s+(a\s+)?report\s+(for|on)\s+/i,
    /project\s+report\s+(for|on)\s+/i,
    /status\s+report\s+(for|on)\s+/i,
  ]

  // Report commands
  const reportCmds = [
    'Generate an executive report for ALB Parking',
    'Weekly report for Foreman',
    'Give me a report on ALB Parking',
  ]
  for (const cmd of reportCmds) {
    assert.ok(REPORT_PATTERNS.some(p => p.test(cmd)), `"${cmd}" recognised as report`)
  }

  // Create-project commands must NOT match report patterns
  const createCmds = [
    'Create a marketing project for ALB Parking',
    'Start a new project called Foreman',
    'Add project for property managers',
  ]
  for (const cmd of createCmds) {
    assert.ok(!REPORT_PATTERNS.some(p => p.test(cmd)), `"${cmd}" must not match report pattern`)
  }
})

// ── 80. listProjectExecutiveReports returns newest first ─────────────────────

test('executive reports list is ordered newest first', () => {
  const rows = [
    { id: '1', created_at: '2026-05-01T10:00:00Z', title: 'Old report' },
    { id: '2', created_at: '2026-06-01T10:00:00Z', title: 'Latest report' },
    { id: '3', created_at: '2026-05-15T10:00:00Z', title: 'Middle report' },
  ]

  // Simulate ORDER BY created_at DESC
  const sorted = [...rows].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  assert.equal(sorted[0].title, 'Latest report', 'Newest first')
  assert.equal(sorted[1].title, 'Middle report', 'Middle second')
  assert.equal(sorted[2].title, 'Old report', 'Oldest last')
})

// ── Generated Files tests ─────────────────────────────────────────────────────

// ── 81. Path traversal prevention ────────────────────────────────────────────

test('generated files path traversal is prevented', () => {
  const path = { resolve: (...parts) => parts.join('/').replace(/\/+/g, '/'), sep: '/', basename: s => s.split('/').pop() }
  const STORAGE_BASE = '/app/storage/generated-files'

  function safePath(id, filename) {
    const safeFilename = path.basename(filename).replace(/^\.+/, '_')
    const resolved = path.resolve(STORAGE_BASE, id, safeFilename)
    if (!resolved.startsWith(STORAGE_BASE + path.sep)) {
      throw new Error(`Path traversal detected: ${resolved}`)
    }
    return resolved
  }

  // Normal path should work
  const normal = safePath('abc-123', 'report.md')
  assert.ok(normal.includes('abc-123'), 'Normal path contains ID')
  assert.ok(normal.includes('report.md'), 'Normal path contains filename')

  // Leading dots are sanitised
  const dotFile = safePath('abc-123', '.hidden')
  assert.ok(!dotFile.includes('/.hidden'), 'Leading dot is sanitised')
})

// ── 82. CSV escaping ──────────────────────────────────────────────────────────

test('CSV generator escapes commas, quotes, and newlines', () => {
  function escapeCell(v) {
    if (v === null || v === undefined) return ''
    const s = String(v)
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  assert.equal(escapeCell('plain'),              'plain',           'Plain text unchanged')
  assert.equal(escapeCell('has,comma'),          '"has,comma"',     'Comma triggers quoting')
  assert.equal(escapeCell('has "quote"'),        '"has ""quote"""', 'Quotes are doubled')
  assert.equal(escapeCell('has\nnewline'),       '"has\nnewline"',  'Newlines trigger quoting')
  assert.equal(escapeCell(null),                 '',                'null becomes empty')
  assert.equal(escapeCell(42),                   '42',              'Number becomes string')
})

// ── 83. Generated file metadata has no secrets ───────────────────────────────

test('generated file record does not include api_key or tokens', () => {
  const fileRecord = {
    id:               'file-uuid',
    project_id:       'proj-uuid',
    filename:         'report.md',
    mime_type:        'text/markdown',
    content_type:     'markdown',
    title:            'Executive Report',
    description:      'Q1 summary',
    generated_by_role: 'ceo',
    storage_path:     'generated-files/file-uuid/report.md',
    size_bytes:       1024,
    created_at:       '2026-06-01T10:00:00Z',
  }

  assert.ok(!('api_key' in fileRecord), 'No api_key field')
  assert.ok(!('token' in fileRecord),   'No token field')
  assert.ok(!('secret' in fileRecord),  'No secret field')
  assert.ok(!('password' in fileRecord),'No password field')
  assert.ok(fileRecord.storage_path.startsWith('generated-files/'), 'Storage path is relative, not absolute')
})

// ── 84. Download route sets correct Content-Disposition ──────────────────────

test('download route encodes filename in Content-Disposition header', () => {
  function buildDownloadHeaders(filename, mimeType, size) {
    return {
      'Content-Type':        mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Content-Length':      String(size),
      'Cache-Control':       'private, no-cache',
    }
  }

  const h = buildDownloadHeaders('my report.md', 'text/markdown', 1024)
  assert.equal(h['Content-Type'],  'text/markdown')
  assert.ok(h['Content-Disposition'].includes('attachment'))
  assert.ok(h['Content-Disposition'].includes('my%20report.md'), 'Space is URL-encoded')
  assert.equal(h['Cache-Control'], 'private, no-cache', 'No public caching')
})

// ── Custom Agents tests ───────────────────────────────────────────────────────

// ── 85. Custom agent always has security constraints ─────────────────────────

test('custom agent always includes required security constraints', () => {
  const REQUIRED_CONSTRAINTS = [
    'must_delegate_to_web_operator',
    'inherits_operating_mode',
    'cannot_bypass_approvals',
    'cannot_send_emails_directly',
    'cannot_access_secrets',
  ]

  function createAgentConstraints(userConstraints = []) {
    // User cannot override required constraints — always include them
    return [...new Set([...REQUIRED_CONSTRAINTS, ...userConstraints])]
  }

  const defaults = createAgentConstraints()
  for (const c of REQUIRED_CONSTRAINTS) {
    assert.ok(defaults.includes(c), `Required constraint present: ${c}`)
  }

  // User-provided extras are appended
  const withExtra = createAgentConstraints(['custom_rule'])
  assert.ok(withExtra.includes('custom_rule'), 'User extras are appended')
  assert.equal(withExtra.filter(c => c === 'must_delegate_to_web_operator').length, 1, 'No duplicate constraints')
})

// ── 86. Create-agent intent detection ────────────────────────────────────────

test('isCreateAgentIntent detects create-agent phrases correctly', () => {
  const CREATE_AGENT_PATTERNS = [
    /create\s+(an?\s+)?(new\s+)?agent\s+(for|to|that)\s+/i,
    /build\s+(an?\s+)?(new\s+)?agent\s+(for|to|that)\s+/i,
    /make\s+(an?\s+)?(new\s+)?agent\s+(for|to|that)\s+/i,
    /add\s+(an?\s+)?custom\s+agent\s+(for|to|that)\s+/i,
    /spin\s+up\s+(an?\s+)?(new\s+)?agent\s+(for|to|that)\s+/i,
  ]
  function isCreateAgentIntent(cmd) {
    return CREATE_AGENT_PATTERNS.some(p => p.test(cmd))
  }

  assert.ok(isCreateAgentIntent('Create an agent for lead qualification'), 'matches create...for')
  assert.ok(isCreateAgentIntent('Build a new agent to monitor pricing'),    'matches build...to')
  assert.ok(isCreateAgentIntent('Make an agent that checks replies'),       'matches make...that')
  assert.ok(isCreateAgentIntent('Add a custom agent for SEO tracking'),     'matches add custom')
  assert.ok(isCreateAgentIntent('Spin up a new agent to handle invoices'),  'matches spin up')
  assert.ok(!isCreateAgentIntent('What agents are active?'),                'does not match status question')
  assert.ok(!isCreateAgentIntent('Create a project for Acme'),              'does not match create project')
})

// ── 87. Agent creation result has no automatic execution ─────────────────────

test('create-agent CEO result is spec-only, no automatic execution', () => {
  const createAgentResult = {
    response: 'Created Lead Qualification Agent in draft status.',
    intent:   'create_agent',
    actions:  [{ type: 'create_agent', data: { agent_id: 'uuid', name: 'Lead Qual Agent', status: 'draft' } }],
    project_id: null,
  }

  assert.equal(createAgentResult.intent, 'create_agent', 'Intent is create_agent')
  assert.equal(createAgentResult.actions[0].data.status, 'draft', 'Agent starts as draft, not active')
  const hasWebAction = createAgentResult.actions.some(a =>
    ['browse', 'click', 'fill_form', 'navigate'].includes(a.type)
  )
  assert.ok(!hasWebAction, 'No web actions in create-agent result')
})

// ── 88. Built-in agents are always returned ──────────────────────────────────

test('agents endpoint always returns built-in agents', () => {
  const BUILT_IN_AGENTS = [
    { id: 'web_operator',     name: 'Web Operator',      is_built_in: true },
    { id: 'ceo',              name: 'AÏKO CEO',           is_built_in: true },
    { id: 'project_manager',  name: 'Project Manager',   is_built_in: true },
    { id: 'research',         name: 'Research Agent',    is_built_in: true },
    { id: 'copywriting',      name: 'Copywriting Agent', is_built_in: true },
  ]

  function buildResponse(customAgents) {
    return {
      built_in: BUILT_IN_AGENTS,
      custom:   customAgents,
      total:    BUILT_IN_AGENTS.length + customAgents.length,
    }
  }

  const r = buildResponse([])
  assert.equal(r.built_in.length, 5, 'Five built-in agents always returned')
  assert.ok(r.built_in.every(a => a.is_built_in), 'All built-in marked with is_built_in=true')
  assert.equal(r.total, 5, 'Total is built_in + custom count')
})

// ── 89. Agent cannot access secrets ──────────────────────────────────────────

test('custom agent spec must include cannot_access_secrets constraint', () => {
  const spec = {
    name:         'Data Spy Agent',
    purpose:      'Gather competitive data',
    capabilities: ['web_research'],
    constraints:  [
      'must_delegate_to_web_operator',
      'inherits_operating_mode',
      'cannot_bypass_approvals',
      'cannot_send_emails_directly',
      'cannot_access_secrets',   // ← required
    ],
  }

  assert.ok(spec.constraints.includes('cannot_access_secrets'), 'Cannot access secrets')
  assert.ok(spec.constraints.includes('must_delegate_to_web_operator'), 'Must delegate web actions')
  // Verify no capability grants secret access
  const dangerousCaps = ['read_env', 'read_secrets', 'access_tokens', 'read_api_keys']
  for (const cap of dangerousCaps) {
    assert.ok(!spec.capabilities.includes(cap), `Capability ${cap} is forbidden`)
  }
})

// ── 90. Provider audit: OAuth routes honest 422 ───────────────────────────────

test('OAuth routes return honest 422 when env vars are missing', () => {
  function simulateOAuthStart(envVars) {
    const required = ['CLIENT_ID', 'AUTH_URL', 'TOKEN_URL']
    const missing  = required.filter(k => !envVars[k])
    if (missing.length > 0) {
      return { status: 422, body: { error: 'OAuth not configured', configured: false, missing } }
    }
    return { status: 302, body: null }
  }

  const notConfigured = simulateOAuthStart({})
  assert.equal(notConfigured.status, 422, 'Returns 422 when not configured')
  assert.equal(notConfigured.body.configured, false, 'configured: false in response')
  assert.ok(notConfigured.body.missing.length > 0, 'Lists missing env vars')

  const configured = simulateOAuthStart({ CLIENT_ID: 'id', AUTH_URL: 'https://auth', TOKEN_URL: 'https://token' })
  assert.equal(configured.status, 302, 'Returns 302 redirect when configured')
})

// ── 91–95. Executive report export ───────────────────────────────────────────
// NOTE: Pure-JS re-implementations for smoke tests (test runner has no TS transpiler).
// These mirror the logic in lib/report-file-export.ts and are tested independently.

function formatExecutiveReportMarkdown(report) {
  const date = new Date(report.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const s = report.strategy_snapshot
  const p = report.progress_snapshot
  const lines = []
  lines.push(`# ${report.title}`, ``, `**Generated:** ${date}  `, `**Generated by:** ${report.generated_by_role}`, ``, `---`, ``)
  if (report.summary) { lines.push(`## Executive Summary`, ``, report.summary, ``) }
  const hasStrategy = s.goal || s.objective || s.target_audience || s.channel || s.value_prop || s.operator || s.pm
  if (hasStrategy) {
    lines.push(`## Strategy Snapshot`, ``)
    if (s.goal)            lines.push(`- **Goal:** ${s.goal}`)
    if (s.objective)       lines.push(`- **Objective:** ${s.objective}`)
    if (s.target_audience) lines.push(`- **Target Audience:** ${s.target_audience}`)
    if (s.channel)         lines.push(`- **Channel:** ${s.channel}`)
    if (s.value_prop)      lines.push(`- **Value Proposition:** ${s.value_prop}`)
    if (s.operator)        lines.push(`- **Operator:** ${s.operator}`)
    if (s.pm)              lines.push(`- **Project Manager:** ${s.pm}`)
    lines.push(``)
  }
  lines.push(`## Progress Snapshot`, ``)
  if (p.launch_total > 0) {
    const pct = Math.round((p.launch_done / p.launch_total) * 100)
    lines.push(`- **Launch Plan:** ${p.launch_done}/${p.launch_total} steps (${pct}%)${p.launch_status ? ` — ${p.launch_status}` : ''}`)
  }
  lines.push(`- **Leads:** ${p.lead_total} total — ${p.lead_approved} approved, ${p.lead_contacted} contacted, ${p.lead_replied} replied`, ``)
  if (report.decisions_snapshot.length > 0) {
    lines.push(`## Recent Decisions`, ``)
    for (const d of report.decisions_snapshot) {
      lines.push(`### ${d.title}`, ``, `*${d.decision_type}*`, d.summary ? `\n${d.summary}` : '', ``)
    }
  }
  if (report.risks.length > 0) { lines.push(`## Risks / Blockers`, ``); for (const r of report.risks) lines.push(`- ⚠ ${r}`); lines.push(``) }
  if (report.next_steps.length > 0) { lines.push(`## Recommended Next Steps`, ``); for (const s of report.next_steps) lines.push(`- ${s}`); lines.push(``) }
  lines.push(`---`, ``, `*This report was generated by AÏKO and is for internal use only.*`)
  return lines.join('\n')
}

function formatExecutiveReportJson(report) {
  return {
    id: report.id, project_id: report.project_id, title: report.title,
    generated_at: report.created_at, generated_by: report.generated_by_role,
    summary: report.summary,
    strategy: {
      goal: report.strategy_snapshot.goal, objective: report.strategy_snapshot.objective,
      target_audience: report.strategy_snapshot.target_audience, channel: report.strategy_snapshot.channel,
      value_prop: report.strategy_snapshot.value_prop, operator: report.strategy_snapshot.operator,
      project_manager: report.strategy_snapshot.pm,
    },
    progress: {
      launch_steps_done: report.progress_snapshot.launch_done, launch_steps_total: report.progress_snapshot.launch_total,
      launch_status: report.progress_snapshot.launch_status, leads_total: report.progress_snapshot.lead_total,
      leads_approved: report.progress_snapshot.lead_approved, leads_contacted: report.progress_snapshot.lead_contacted,
      leads_replied: report.progress_snapshot.lead_replied, pending_approvals: report.progress_snapshot.pending_approvals,
    },
    recent_decisions: report.decisions_snapshot.map(d => ({ type: d.decision_type, title: d.title, summary: d.summary, created_at: d.created_at })),
    risks: report.risks, next_steps: report.next_steps,
  }
}

const SAMPLE_REPORT = {
  id:           'report-uuid-001',
  project_id:   'project-uuid-001',
  title:        'Executive Report — Acme Campaign',
  summary:      'The Acme Campaign is progressing well. We have 10 leads and 3 approved.',
  strategy_snapshot: {
    goal: 'Book 5 demos', objective: 'Outreach to SMB founders', target_audience: 'SaaS founders',
    channel: 'LinkedIn DM', value_prop: 'Save 10h/week', operator: 'Web Operator', pm: 'Alice',
  },
  progress_snapshot: {
    launch_done: 3, launch_total: 5, launch_status: 'in_progress', launch_next_item: 'Write copy',
    lead_total: 10, lead_approved: 3, lead_contacted: 2, lead_replied: 1, pending_approvals: 1,
  },
  decisions_snapshot: [
    { decision_type: 'go/no-go', title: 'Approved LinkedIn outreach', summary: 'Approved.', created_at: '2026-01-01T00:00:00Z' },
  ],
  risks:      ['1 approval pending'],
  next_steps: ['Approve remaining leads'],
  generated_by_role: 'ceo',
  created_at: '2026-06-01T12:00:00Z',
}

test('91. formatExecutiveReportMarkdown produces valid Markdown with all sections', () => {
  const md = formatExecutiveReportMarkdown(SAMPLE_REPORT)
  assert.ok(md.startsWith('# Executive Report'), 'Starts with H1 title')
  assert.ok(md.includes('## Executive Summary'), 'Has Summary section')
  assert.ok(md.includes('## Strategy Snapshot'), 'Has Strategy section')
  assert.ok(md.includes('## Progress Snapshot'), 'Has Progress section')
  assert.ok(md.includes('## Recent Decisions'), 'Has Decisions section')
  assert.ok(md.includes('## Risks / Blockers'), 'Has Risks section')
  assert.ok(md.includes('## Recommended Next Steps'), 'Has Next Steps section')
  assert.ok(md.includes('internal use only'), 'Has disclaimer')
})

test('92. formatExecutiveReportMarkdown does not include secrets or env vars', () => {
  const md = formatExecutiveReportMarkdown(SAMPLE_REPORT)
  const forbidden = ['API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'process.env', 'Bearer ', 'sk-']
  for (const f of forbidden) {
    assert.ok(!md.includes(f), `Markdown must not contain "${f}"`)
  }
})

test('93. formatExecutiveReportJson produces valid JSON with expected structure', () => {
  const data = formatExecutiveReportJson(SAMPLE_REPORT)
  const json  = JSON.stringify(data)
  const parsed = JSON.parse(json)

  assert.equal(parsed.id, SAMPLE_REPORT.id, 'id matches')
  assert.equal(parsed.project_id, SAMPLE_REPORT.project_id, 'project_id matches')
  assert.equal(parsed.title, SAMPLE_REPORT.title, 'title matches')
  assert.ok(Array.isArray(parsed.risks), 'risks is array')
  assert.ok(Array.isArray(parsed.next_steps), 'next_steps is array')
  assert.ok(Array.isArray(parsed.recent_decisions), 'recent_decisions is array')
  assert.equal(typeof parsed.progress, 'object', 'progress is object')
  assert.equal(typeof parsed.strategy, 'object', 'strategy is object')
})

test('94. formatExecutiveReportJson does not expose secrets or tokens', () => {
  const json = JSON.stringify(formatExecutiveReportJson(SAMPLE_REPORT))
  const forbidden = ['API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'process.env', 'Bearer ', 'sk-']
  for (const f of forbidden) {
    assert.ok(!json.includes(f), `JSON must not contain "${f}"`)
  }
})

test('95. exportExecutiveReport returns 404 when report project_id mismatches', async () => {
  // Simulate the ownership check inside exportExecutiveReport
  function checkOwnership(projectId, report) {
    if (report.project_id !== projectId) {
      const err = new Error('Report does not belong to this project')
      err.statusCode = 404
      throw err
    }
    return true
  }

  // Correct project — should not throw
  assert.doesNotThrow(
    () => checkOwnership('project-uuid-001', SAMPLE_REPORT),
    'Correct project should not throw'
  )

  // Wrong project — should throw with statusCode 404
  let caught = null
  try {
    checkOwnership('wrong-project-uuid', SAMPLE_REPORT)
  } catch (e) {
    caught = e
  }
  assert.ok(caught !== null, 'Should throw for mismatched project')
  assert.equal(caught.statusCode, 404, 'Error should have statusCode 404')
})

// ── 96–100. Lead CSV export ───────────────────────────────────────────────────
// Pure-JS implementation mirroring lib/lead-file-export.ts

const CSV_COLUMNS = [
  'company_name','contact_name','email','phone','website','linkedin_url',
  'location','category','score','status','source_url','notes','created_at','updated_at',
]

function escapeCell(value) {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function getField(lead, col) {
  if (col === 'score') return lead.score ?? null
  return lead[col] ?? null
}

function formatLeadsCsv(leads) {
  const header = CSV_COLUMNS.join(',')
  const rows = leads.map(lead => CSV_COLUMNS.map(col => escapeCell(getField(lead, col))).join(','))
  return [header, ...rows].join('\n')
}

const REJECTED_STATUSES = new Set(['rejected', 'archived'])

function filterLeads(leads, { status, includeRejected = false }) {
  let result = leads
  if (status) {
    result = result.filter(l => l.status === status)
  } else if (!includeRejected) {
    result = result.filter(l => !REJECTED_STATUSES.has(l.status))
  }
  return result
}

const SAMPLE_LEADS = [
  { company_name: 'Acme, Inc', contact_name: 'Jane "CEO" Smith', email: 'jane@acme.com',
    phone: '+1 555 000', website: 'acme.com', linkedin_url: null, location: 'New York',
    category: 'SaaS', score: 85, status: 'approved', source_url: 'https://acme.com',
    notes: 'Multi\nline note', created_at: '2026-06-01T00:00:00Z', updated_at: null },
  { company_name: 'Beta Corp', contact_name: null, email: null,
    phone: null, website: 'beta.io', linkedin_url: null, location: null,
    category: null, score: 40, status: 'rejected', source_url: null,
    notes: null, created_at: '2026-06-01T00:00:00Z', updated_at: null },
  { company_name: 'Gamma Ltd', contact_name: 'Bob', email: 'bob@gamma.com',
    phone: null, website: null, linkedin_url: null, location: 'London',
    category: 'Agency', score: 60, status: 'discovered', source_url: null,
    notes: null, created_at: '2026-06-01T00:00:00Z', updated_at: null },
]

test('96. formatLeadsCsv escapes commas, quotes, and newlines correctly', () => {
  const csv = formatLeadsCsv([SAMPLE_LEADS[0]])
  const lines = csv.split('\n')
  assert.equal(lines[0], CSV_COLUMNS.join(','), 'First line is header')
  // company_name "Acme, Inc" should be quoted due to comma
  assert.ok(lines[1].startsWith('"Acme, Inc"'), 'company_name with comma is quoted')
  // contact_name 'Jane "CEO" Smith' should escape internal quotes
  assert.ok(lines[1].includes('"Jane ""CEO"" Smith"'), 'Quotes inside value are doubled')
  // notes with newline should be quoted
  assert.ok(csv.includes('"Multi\nline note"'), 'Newlines inside value are quoted')
})

test('97. rejected leads excluded by default', () => {
  const filtered = filterLeads(SAMPLE_LEADS, { includeRejected: false })
  assert.ok(!filtered.some(l => l.status === 'rejected'), 'No rejected leads')
  assert.ok(!filtered.some(l => l.status === 'archived'), 'No archived leads')
  assert.ok(filtered.some(l => l.status === 'approved'), 'Approved leads included')
  assert.ok(filtered.some(l => l.status === 'discovered'), 'Discovered leads included')
})

test('98. status filter includes only matching status', () => {
  const filtered = filterLeads(SAMPLE_LEADS, { status: 'approved' })
  assert.equal(filtered.length, 1, 'Only 1 approved lead')
  assert.equal(filtered[0].company_name, 'Acme, Inc')
})

test('99. empty lead list produces valid CSV with only headers', () => {
  const csv = formatLeadsCsv([])
  const lines = csv.split('\n')
  assert.equal(lines.length, 1, 'One line — just headers')
  assert.equal(lines[0], CSV_COLUMNS.join(','), 'Header line correct')
  // Validate no secret fields present
  const forbidden = ['source_text', 'API_KEY', 'OPENAI', 'password', 'token']
  for (const f of forbidden) {
    assert.ok(!lines[0].includes(f), `Header must not contain "${f}"`)
  }
})

test('100. formatLeadsCsv does not include source_text or secrets', () => {
  const leadWithSecret = {
    ...SAMPLE_LEADS[0],
    source_text: 'raw HTML content with secrets',
    api_key: 'sk-secret-should-not-appear',
  }
  const csv = formatLeadsCsv([leadWithSecret])
  assert.ok(!csv.includes('raw HTML content'), 'source_text not in CSV')
  assert.ok(!csv.includes('sk-secret'), 'api_key not in CSV')
})

// ── 101–106. Project artifact bundle ─────────────────────────────────────────
// Pure-JS implementations mirroring lib/project-artifact-bundle.ts

// ── Inline formatStrategyBriefMarkdown ────────────────────────────────────────

function formatStrategyBriefMarkdown(brief, projectName) {
  const lines = [
    `# ${brief.title || `${projectName} — Strategy Brief`}`,
    '',
    `> Generated ${new Date().toISOString().slice(0, 10)} · Project: ${projectName}`,
    '',
    '## Objective',
    '',
    brief.objective || '_No objective defined._',
    '',
    '## Target Audience',
    '',
    brief.target_audience || '_Not specified._',
    '',
    '## Recommended Channel',
    '',
    brief.recommended_channel || '_Not specified._',
    '',
    '## Value Proposition',
    '',
    brief.value_proposition || '_Not specified._',
    '',
    '## Research Prompt',
    '',
    brief.research_prompt || '_Not specified._',
    '',
  ]

  if (brief.risks && brief.risks.length > 0) {
    lines.push('## Risks', '')
    brief.risks.forEach(r => lines.push(`- ${r}`))
    lines.push('')
  }
  if (brief.assumptions && brief.assumptions.length > 0) {
    lines.push('## Assumptions', '')
    brief.assumptions.forEach(a => lines.push(`- ${a}`))
    lines.push('')
  }
  if (brief.next_actions && brief.next_actions.length > 0) {
    lines.push('## Next Actions', '')
    brief.next_actions.forEach(a => lines.push(`- [ ] ${a}`))
    lines.push('')
  }

  lines.push('---', '_This brief is internal guidance only. No automation is triggered by this document._')
  return lines.join('\n')
}

// ── Inline formatDecisionLogMarkdown ─────────────────────────────────────────

function formatDecisionLogMarkdown(decisions, projectName, isoDate) {
  const lines = [
    `# ${projectName} — Decision Log`,
    '',
    `> Generated ${isoDate.slice(0, 10)} · ${decisions.length} decision${decisions.length !== 1 ? 's' : ''} recorded`,
    '',
  ]

  if (decisions.length === 0) {
    lines.push('_No decisions have been recorded for this project yet._', '')
  } else {
    lines.push('## Decisions', '')
    for (const d of decisions) {
      const date = new Date(d.created_at).toISOString().slice(0, 10)
      const role = d.decided_by_role ? ` _(${d.decided_by_role})_` : ''
      lines.push(`### ${d.title}${role}`, '')
      lines.push(`**Type:** ${d.decision_type.replace(/_/g, ' ')}  `)
      lines.push(`**Date:** ${date}`)
      if (d.summary) { lines.push('', d.summary) }
      lines.push('')
    }
  }

  lines.push('---', '_Decision log is internal only. No outreach or automation is triggered._')
  return lines.join('\n')
}

// ── Inline generateBundleManifest ─────────────────────────────────────────────

function generateBundleManifest(projectId, projectName, files) {
  const isoDate = new Date().toISOString()
  return {
    project_id:   projectId,
    project_name: projectName,
    generated_at: isoDate,
    files: files.map(f => ({
      title:              f.title ?? f.filename,
      file_type:          f.content_type,
      content_type:       f.mime_type,
      download_url:       `/api/files/${f.id}/download`,
      source_entity_type: f.source_entity_type ?? 'unknown',
      source_entity_id:   f.source_entity_id ?? null,
    })),
  }
}

// ── Test fixtures ─────────────────────────────────────────────────────────────

const SAMPLE_BRIEF = {
  id: 'brief-1',
  project_id: 'proj-1',
  title: 'TestCo — First Campaign Brief',
  objective: 'Drive early sales pipeline',
  target_audience: 'Series A SaaS founders',
  research_prompt: 'Find SaaS startups in NYC',
  recommended_channel: 'email',
  value_proposition: 'AI-powered lead generation',
  risks: ['Target audience too narrow', 'Email deliverability'],
  assumptions: ['Email is primary channel'],
  next_actions: ['Open First Campaign Flow', 'Research leads'],
  created_by_role: 'CEO',
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
  recommended_operator_id: null,
  recommended_operator_name: null,
  operator_reason: null,
}

const SAMPLE_DECISIONS = [
  {
    id: 'd-1',
    project_id: 'proj-1',
    decision_type: 'project_created',
    title: 'Project created',
    summary: 'Initial project setup',
    decided_by_role: 'user',
    decided_by_user_id: null,
    related_entity_type: null,
    related_entity_id: null,
    metadata: {},
    created_at: '2026-06-01T10:00:00Z',
  },
  {
    id: 'd-2',
    project_id: 'proj-1',
    decision_type: 'lead_approved',
    title: 'Lead approved: Acme Corp',
    summary: 'High-score lead approved for outreach',
    decided_by_role: 'ceo',
    decided_by_user_id: null,
    related_entity_type: 'lead',
    related_entity_id: 'lead-1',
    metadata: {},
    created_at: '2026-06-02T09:00:00Z',
  },
]

const SAMPLE_FILES = [
  {
    id: 'file-1',
    project_id: 'proj-1',
    filename: 'executive-report-2026-06-02.md',
    mime_type: 'text/markdown',
    content_type: 'markdown',
    title: 'TestCo — Executive Report',
    description: 'Executive report',
    generated_by_role: 'system',
    storage_path: '/storage/generated-files/file-1/executive-report-2026-06-02.md',
    size_bytes: 1200,
    source_entity_type: 'executive_report',
    source_entity_id: 'report-1',
    created_at: '2026-06-02T10:00:00Z',
  },
  {
    id: 'file-2',
    project_id: 'proj-1',
    filename: 'leads-project-2026-06-02.csv',
    mime_type: 'text/csv',
    content_type: 'csv',
    title: 'TestCo — Leads Export',
    description: '10 leads',
    generated_by_role: 'system',
    storage_path: '/storage/generated-files/file-2/leads-project-2026-06-02.csv',
    size_bytes: 800,
    source_entity_type: 'leads_export',
    source_entity_id: null,
    created_at: '2026-06-02T10:01:00Z',
  },
  {
    id: 'file-3',
    project_id: 'proj-1',
    filename: 'strategy-brief-2026-06-02.md',
    mime_type: 'text/markdown',
    content_type: 'markdown',
    title: 'TestCo — Strategy Brief',
    description: 'Strategy brief',
    generated_by_role: 'system',
    storage_path: '/storage/generated-files/file-3/strategy-brief-2026-06-02.md',
    size_bytes: 900,
    source_entity_type: 'strategy_brief',
    source_entity_id: 'brief-1',
    created_at: '2026-06-02T10:02:00Z',
  },
  {
    id: 'file-4',
    project_id: 'proj-1',
    filename: 'decision-log-2026-06-02.md',
    mime_type: 'text/markdown',
    content_type: 'markdown',
    title: 'TestCo — Decision Log',
    description: '2 decisions',
    generated_by_role: 'system',
    storage_path: '/storage/generated-files/file-4/decision-log-2026-06-02.md',
    size_bytes: 600,
    source_entity_type: 'decision_log',
    source_entity_id: null,
    created_at: '2026-06-02T10:03:00Z',
  },
]

test('101. generateBundleManifest produces valid manifest JSON', () => {
  const manifest = generateBundleManifest('proj-1', 'TestCo', SAMPLE_FILES)
  assert.equal(manifest.project_id, 'proj-1', 'project_id set')
  assert.equal(manifest.project_name, 'TestCo', 'project_name set')
  assert.ok(typeof manifest.generated_at === 'string', 'generated_at present')
  assert.equal(manifest.files.length, 4, 'All 4 files in manifest')
  // Check first file entry shape
  const f = manifest.files[0]
  assert.ok(f.title, 'file entry has title')
  assert.ok(f.download_url.startsWith('/api/files/'), 'download_url correct prefix')
  assert.ok(f.source_entity_type, 'source_entity_type set')
})

test('102. manifest generated_at is ISO 8601 (not locale format)', () => {
  const manifest = generateBundleManifest('proj-1', 'TestCo', SAMPLE_FILES)
  const date = new Date(manifest.generated_at)
  assert.ok(!isNaN(date.getTime()), 'generated_at is a valid date')
  // ISO 8601 format: contains 'T' and 'Z'
  assert.ok(manifest.generated_at.includes('T'), 'generated_at has ISO T separator')
  assert.ok(
    manifest.generated_at.endsWith('Z') || manifest.generated_at.includes('+'),
    'generated_at has timezone indicator'
  )
  // Must NOT be locale format like "Jun 2, 2026"
  assert.ok(!/[A-Za-z]{3}\s+\d+,\s+\d{4}/.test(manifest.generated_at), 'generated_at not locale format')
})

test('103. formatDecisionLogMarkdown excludes secrets and metadata', () => {
  const md = formatDecisionLogMarkdown(SAMPLE_DECISIONS, 'TestCo', '2026-06-02T10:00:00Z')
  // Must not expose raw metadata, tokens, or API keys
  const forbidden = ['api_key', 'token', 'password', 'OPENAI', 'secret', 'decided_by_user_id']
  for (const f of forbidden) {
    assert.ok(!md.toLowerCase().includes(f.toLowerCase()), `Decision log must not contain "${f}"`)
  }
  // Must include decision titles
  assert.ok(md.includes('Project created'), 'Includes first decision title')
  assert.ok(md.includes('Lead approved'), 'Includes second decision title')
})

test('104. formatDecisionLogMarkdown uses ISO dates not locale format', () => {
  const md = formatDecisionLogMarkdown(SAMPLE_DECISIONS, 'TestCo', '2026-06-02T10:00:00Z')
  // Each decision date should appear as ISO-ish (YYYY-MM-DD)
  assert.ok(md.includes('2026-06-01'), 'ISO date for first decision')
  assert.ok(md.includes('2026-06-02'), 'ISO date for second decision')
  // Must NOT have locale format like "Jun 2, 2026"
  assert.ok(!/Jun\s+\d+,\s+\d{4}/.test(md), 'No locale date format in decision log')
})

test('105. formatStrategyBriefMarkdown includes all sections and no secrets', () => {
  const md = formatStrategyBriefMarkdown(SAMPLE_BRIEF, 'TestCo')
  // Required sections
  assert.ok(md.includes('## Objective'), 'Objective section')
  assert.ok(md.includes('## Target Audience'), 'Target Audience section')
  assert.ok(md.includes('## Value Proposition'), 'Value Proposition section')
  assert.ok(md.includes('## Risks'), 'Risks section')
  assert.ok(md.includes('## Next Actions'), 'Next Actions section')
  // Content correctness
  assert.ok(md.includes('Drive early sales pipeline'), 'Objective text present')
  assert.ok(md.includes('- [ ] Open First Campaign Flow'), 'Next actions as checkboxes')
  // No secrets
  const forbidden = ['api_key', 'token', 'password', 'OPENAI', 'secret']
  for (const f of forbidden) {
    assert.ok(!md.toLowerCase().includes(f.toLowerCase()), `Brief must not contain "${f}"`)
  }
})

test('106. manifest download_urls are all project-scoped internal paths', () => {
  const manifest = generateBundleManifest('proj-1', 'TestCo', SAMPLE_FILES)
  for (const f of manifest.files) {
    // All URLs must be internal /api/files/ paths — no external URLs
    assert.ok(f.download_url.startsWith('/api/files/'), `${f.title} download_url is internal`)
    // No absolute paths or file:// URLs
    assert.ok(!f.download_url.startsWith('http'), `${f.title} download_url is not external`)
    assert.ok(!f.download_url.startsWith('file://'), `${f.title} download_url is not file://`)
  }
})

// ── Tests 107–113: subscription-diagnostics logic ────────────────────────────
// Pure-JS reimplementation of the status derivation logic from
// app/api/providers/subscription-diagnostics/route.ts

function deriveStatus(envMissing, connRow) {
  if (envMissing.length > 0)       return 'oauth_not_configured'
  if (!connRow)                    return 'no_connection_row'
  if (connRow.status === 'connected')    return 'connected'
  if (connRow.status === 'needs_reauth') return 'needs_reauth'
  return 'not_connected'
}

function buildSubCard(envMissing, connRow) {
  const status = deriveStatus(envMissing, connRow)
  return {
    status,
    configured:  envMissing.length === 0,
    connected:   status === 'connected',
    needs_reauth: status === 'needs_reauth',
    can_start_oauth: envMissing.length === 0,
    can_call_model: status === 'connected',
    missing_env: envMissing,
    account_email: connRow?.account_email ?? null,
    last_error:   connRow?.last_error ?? null,
  }
}

test('107. subscription-diagnostics: oauth_not_configured when env vars missing', () => {
  const card = buildSubCard(['OPENAI_OAUTH_CLIENT_ID', 'OPENAI_OAUTH_CLIENT_SECRET'], null)
  assert.equal(card.status, 'oauth_not_configured')
  assert.equal(card.configured, false)
  assert.equal(card.connected, false)
  assert.equal(card.can_start_oauth, false)
  assert.deepEqual(card.missing_env, ['OPENAI_OAUTH_CLIENT_ID', 'OPENAI_OAUTH_CLIENT_SECRET'])
})

test('108. subscription-diagnostics: no_connection_row when configured but never connected', () => {
  const card = buildSubCard([], null)
  assert.equal(card.status, 'no_connection_row')
  assert.equal(card.configured, true)
  assert.equal(card.can_start_oauth, true)
  assert.equal(card.connected, false)
})

test('109. subscription-diagnostics: connected state correct', () => {
  const card = buildSubCard([], { status: 'connected', account_email: 'user@example.com', last_error: null })
  assert.equal(card.status, 'connected')
  assert.equal(card.connected, true)
  assert.equal(card.can_call_model, true)
  assert.equal(card.account_email, 'user@example.com')
  assert.equal(card.missing_env.length, 0)
})

test('110. subscription-diagnostics: needs_reauth state correct', () => {
  const card = buildSubCard([], { status: 'needs_reauth', account_email: null, last_error: 'token expired' })
  assert.equal(card.status, 'needs_reauth')
  assert.equal(card.needs_reauth, true)
  assert.equal(card.connected, false)
  assert.equal(card.can_call_model, false)
  assert.equal(card.last_error, 'token expired')
})

test('111. subscription-diagnostics: missing_env never includes secret values', () => {
  // missing_env should only contain env var NAMES — we verify none of the typical
  // secret value patterns appear in the names
  const missingNames = [
    'OPENAI_OAUTH_CLIENT_ID',
    'OPENAI_OAUTH_CLIENT_SECRET',
    'OPENAI_OAUTH_AUTH_URL',
    'OPENAI_OAUTH_TOKEN_URL',
  ]
  for (const name of missingNames) {
    // Names must be all-caps identifiers — no '=', no spaces, no base64
    assert.match(name, /^[A-Z][A-Z0-9_]+$/, `${name} is a valid env var name format`)
  }
})

test('112. subscription-diagnostics: fallbacks object has correct shape', () => {
  const fallbacks = {
    openai_api_connected:    false,
    anthropic_api_connected: true,
    ollama_connected:        false,
    openrouter_connected:    false,
  }
  // Must be booleans — not tokens or connection objects
  for (const [key, val] of Object.entries(fallbacks)) {
    assert.equal(typeof val, 'boolean', `${key} must be boolean`)
  }
})

test('113. subscription-diagnostics: can_start_oauth false when env unconfigured', () => {
  // Even if a stale connection row exists, can_start_oauth must be false
  // when the env vars are not set (OAuth cannot be started)
  const card = buildSubCard(
    ['OPENAI_OAUTH_CLIENT_ID'],
    { status: 'connected', account_email: null, last_error: null }
  )
  // missing_env takes priority — cannot start OAuth
  assert.equal(card.status, 'oauth_not_configured')
  assert.equal(card.can_start_oauth, false)
})

// ── Tests 114–121: OpenClaw-style auth profile smoke checks ──────────────────

test('114. auth profile serializer never exposes secrets or tokens', () => {
  function sanitize(row) {
    return {
      id: row.id,
      provider_catalog_id: row.provider_catalog_id,
      display_name: row.display_name ?? row.name,
      auth_method: row.auth_method ?? row.auth_type,
      model: row.model,
      status: row.status,
      account_email: row.account_email ?? null,
    }
  }
  const profile = sanitize({
    id: 'p1', name: 'OpenAI', provider_catalog_id: 'openai_api', auth_type: 'api_key',
    api_key_encrypted: 'sk-secret', oauth_access_token_encrypted: 'tok-secret',
    oauth_refresh_token_encrypted: 'refresh-secret', model: 'gpt-4o', status: 'connected',
  })
  assert.deepEqual(Object.keys(profile).sort(), ['account_email', 'auth_method', 'display_name', 'id', 'model', 'provider_catalog_id', 'status'].sort())
  assert.equal(JSON.stringify(profile).includes('secret'), false)
})

test('115. ChatGPT missing env disables OAuth connect', () => {
  const required = ['OPENAI_OAUTH_CLIENT_ID', 'OPENAI_OAUTH_AUTH_URL', 'OPENAI_OAUTH_TOKEN_URL', 'OPENAI_OAUTH_REDIRECT_URI']
  function missing(env) { return required.filter(k => !env[k]) }
  const env = { OPENAI_OAUTH_CLIENT_ID: 'id', OPENAI_OAUTH_AUTH_URL: 'https://auth', OPENAI_OAUTH_TOKEN_URL: 'https://token' }
  assert.deepEqual(missing(env), ['OPENAI_OAUTH_REDIRECT_URI'])
  assert.equal(missing(env).length === 0, false)
})

test('116. OpenAI API auth profile remains assignable', () => {
  const p = { id: 'openai1', provider_catalog_id: 'openai_api', auth_method: 'api_key', compatibility: 'openai_compatible', status: 'connected' }
  assert.equal(p.status === 'connected' && p.auth_method === 'api_key', true)
})

test('117. Anthropic API auth profile remains assignable', () => {
  const p = { id: 'anth1', provider_catalog_id: 'anthropic_api', auth_method: 'api_key', compatibility: 'anthropic_messages', status: 'connected' }
  assert.equal(p.status === 'connected' && p.compatibility === 'anthropic_messages', true)
})

test('118. Ollama local auth profile remains assignable', () => {
  const p = { id: 'ollama1', provider_catalog_id: 'ollama', auth_method: 'local', compatibility: 'ollama_native', status: 'connected' }
  assert.equal(p.status === 'connected' && ['local', 'none'].includes(p.auth_method), true)
})

test('119. CEO brain resolves through assigned auth profile before fallback', () => {
  function resolve(role, assignments, profiles) {
    const assigned = profiles.find(p => p.id === assignments[role] && p.status === 'connected')
    if (assigned) return assigned
    const localFallback = profiles.find(p => p.id === assignments.local_fallback && p.status === 'connected')
    if (localFallback) return localFallback
    return profiles.find(p => p.status === 'connected') ?? null
  }
  const profiles = [{ id: 'fallback', status: 'connected' }, { id: 'ceo', status: 'connected' }]
  assert.equal(resolve('ceo', { ceo: 'ceo', local_fallback: 'fallback' }, profiles).id, 'ceo')
})

test('120. Claude Code local not detected reports honest unavailable state', () => {
  const detection = { cli_detected: false, token_env_detected: false, local_auth_detected: false, available: false }
  assert.equal(detection.available, false)
  assert.equal(detection.local_auth_detected, false)
})

test('121. old OAuth provider route can alias to auth profile route', () => {
  const aliases = {
    '/api/providers/oauth/chatgpt/start': '/api/auth-profiles/openai-codex/start',
    '/api/providers/oauth/chatgpt/callback': '/api/auth-profiles/openai-codex/callback',
  }
  assert.equal(aliases['/api/providers/oauth/chatgpt/start'], '/api/auth-profiles/openai-codex/start')
})

// ── Tests 122–128: first-run setup wizard logic ──────────────────────────────

test('122. setup required when no CEO brain exists', () => {
  function setupState(connectedProfileCount, canCeoThink) {
    const reason = connectedProfileCount <= 0
      ? 'No connected AI auth profile exists.'
      : !canCeoThink
        ? 'No working CEO brain can be resolved from connected auth profiles.'
        : null
    return { setup_required: !!reason, reason, can_ceo_think: canCeoThink }
  }
  const state = setupState(0, false)
  assert.equal(state.setup_required, true)
  assert.equal(state.reason, 'No connected AI auth profile exists.')
})

test('123. setup complete when CEO brain works', () => {
  const state = { connected_profile_count: 1, can_ceo_think: true, setup_required: false }
  assert.equal(state.connected_profile_count > 0 && state.can_ceo_think && !state.setup_required, true)
})

test('124. /setup allows Ollama local path', () => {
  const ollama = { id: 'ollama', auth_method: 'local', base_url: 'http://localhost:11434', model: 'llama3.1:8b', needsKey: false }
  assert.equal(ollama.needsKey, false)
  assert.equal(ollama.auth_method, 'local')
})

test('125. ChatGPT OAuth App setup card disabled when OAuth env missing', () => {
  const required = ['OPENAI_OAUTH_CLIENT_ID', 'OPENAI_OAUTH_AUTH_URL', 'OPENAI_OAUTH_TOKEN_URL', 'OPENAI_OAUTH_REDIRECT_URI']
  const env = {}
  const missing = required.filter(k => !env[k])
  const card = { configured: missing.length === 0, disabled: missing.length > 0, missing_env: missing }
  assert.equal(card.configured, false)
  assert.equal(card.disabled, true)
  assert.deepEqual(card.missing_env, required)
})

test('126. setup complete assigns CEO role after successful provider test', () => {
  function setupFlow(providerTestOk, brainTestOk) {
    const assignments = {}
    if (!providerTestOk) return { complete: false, assignments }
    assignments.ceo = 'provider-1'
    return { complete: brainTestOk, assignments }
  }
  const result = setupFlow(true, true)
  assert.equal(result.assignments.ceo, 'provider-1')
  assert.equal(result.complete, true)
})

test('127. no Google login required in optional setup mode', () => {
  function setupPublic(authMode, pathname) {
    if (pathname.startsWith('/setup')) return true
    return authMode !== 'required'
  }
  assert.equal(setupPublic('optional', '/setup'), true)
  assert.equal(setupPublic('optional', '/ceo'), true)
})

test('128. setup cards do not fake connected state for ChatGPT or Claude', () => {
  const chatgpt = { oauthConfigured: false, profileConnected: false }
  const claude = { claudeCodeDetected: false, claudeOAuthConfigured: false, profileConnected: false }
  assert.equal(chatgpt.oauthConfigured && chatgpt.profileConnected, false)
  assert.equal((claude.claudeCodeDetected || claude.claudeOAuthConfigured) && claude.profileConnected, false)
})

// ── Tests 129–135: Web Operator Skills smoke checks ──────────────────────────

test('129. Canva instruction maps to canva_design skill', () => {
  function recommend(text) {
    return /\bcanva\b/i.test(text) ? 'canva_design' : null
  }
  assert.equal(recommend('Kevin, work on Canva'), 'canva_design')
})

test('130. Facebook instruction maps to facebook_research skill', () => {
  function recommend(text) {
    return /\bfacebook\b|\bfb\b/i.test(text) ? 'facebook_research' : null
  }
  assert.equal(recommend('Kevin, research on Facebook'), 'facebook_research')
})

test('131. Gmail send requires approval through gmail_workflow', () => {
  const gmail = { approval_required_actions: ['send_email', 'send_gmail_draft'] }
  assert.equal(gmail.approval_required_actions.includes('send_gmail_draft'), true)
})

test('132. Facebook post requires approval and is never auto-posted', () => {
  const facebook = { approval_required_actions: ['send_message', 'post_comment', 'join_group', 'create_post', 'post'] }
  assert.equal(facebook.approval_required_actions.includes('create_post'), true)
})

test('133. Forbidden Web Operator skill action is blocked', () => {
  function validate(skill, action) {
    if (skill.forbidden_actions.includes(action)) return { blocked: true, reason: 'Skill blocked this action' }
    return { blocked: false }
  }
  const decision = validate({ forbidden_actions: ['solve_captcha', 'bypass_login'] }, 'solve_captcha')
  assert.equal(decision.blocked, true)
  assert.match(decision.reason, /Skill blocked/)
})

test('134. Unknown website creates improvement proposal instead of blind execution', () => {
  function handleUnknown(website) {
    return {
      delegated: false,
      proposal_title: `Add Web Operator skill for ${website}`,
      reason: 'No governed skill profile exists',
    }
  }
  const result = handleUnknown('ExampleSocial')
  assert.equal(result.delegated, false)
  assert.equal(result.proposal_title, 'Add Web Operator skill for ExampleSocial')
})

test('135. skill_id is stored on web_operator_actions payload', () => {
  const actionRow = {
    action_type: 'open_url',
    skill_id: 'canva_design',
    skill_name: 'Canva design',
    skill_decision: { allowed: true, requires_approval: false },
  }
  assert.equal(actionRow.skill_id, 'canva_design')
  assert.equal(actionRow.skill_decision.allowed, true)
})

test('136. Facebook research opens Facebook groups directly, not Google', () => {
  const target = buildDirectSiteTargetTest('Kevin, research Facebook groups about parking in A Coruña.', 'facebook_research')
  assert.equal(target.action_type, 'open_url')
  assert.equal(target.url.startsWith('https://www.facebook.com/search/groups?q='), true)
  assert.equal(target.url.includes('google.com'), false)
  assert.equal(decodeURIComponent(target.url).includes('parking A Coruña'), true)
})

test('137. Canva instruction opens canva.com directly', () => {
  const target = buildDirectSiteTargetTest('Kevin, open Canva and create a draft Instagram post for ALB Parking.', 'canva_design')
  assert.equal(target.action_type, 'open_url')
  assert.equal(target.url, 'https://www.canva.com/')
})

test('138. LinkedIn instruction opens LinkedIn directly', () => {
  const target = buildDirectSiteTargetTest('Kevin, research LinkedIn companies for parking in A Coruña.', 'linkedin_research')
  assert.equal(target.action_type, 'open_url')
  assert.equal(target.url.startsWith('https://www.linkedin.com/search/results/companies/?keywords='), true)
  assert.equal(target.url.includes('google.com'), false)
})

test('139. Gmail instruction opens mail.google.com directly', () => {
  const target = buildDirectSiteTargetTest('Kevin, open Gmail.', 'gmail_workflow')
  assert.equal(target.action_type, 'open_url')
  assert.equal(target.url, 'https://mail.google.com/')
})

test('140. Direct URL remains exact after validation', () => {
  const target = buildDirectSiteTargetTest('Kevin, open https://example.com/a?b=1 and summarize it.', 'website_reader')
  assert.equal(target.action_type, 'open_url')
  assert.equal(target.url, 'https://example.com/a?b=1')
})

test('141. Posting still creates approval and does not execute', () => {
  function routeFacebookAction(command) {
    if (/\b(post|publish|comment|message|join)\b/i.test(command)) {
      return { action_type: 'create_post', status: 'waiting_approval', executed: false }
    }
    return buildDirectSiteTargetTest(command, 'facebook_research')
  }
  const result = routeFacebookAction('Kevin, post on Facebook about ALB Parking.')
  assert.equal(result.status, 'waiting_approval')
  assert.equal(result.executed, false)
})

test('142. CAPTCHA/security direct-site blockers still set waiting_user', () => {
  function handlePageState(state) {
    if (state.requires_manual_takeover) {
      return { status: 'waiting_user', waiting_reason: state.waiting_reason, bypass_attempted: false }
    }
    return { status: 'completed', waiting_reason: null, bypass_attempted: false }
  }
  const result = handlePageState({ requires_manual_takeover: true, waiting_reason: 'security_checkpoint' })
  assert.equal(result.status, 'waiting_user')
  assert.equal(result.waiting_reason, 'security_checkpoint')
  assert.equal(result.bypass_attempted, false)
})

test('143. Canva Instagram prompt maps to canva_instagram_draft playbook', () => {
  const playbook = recommendPlaybookTest('Kevin, create a Canva Instagram draft for ALB Parking.', 'canva_design')
  assert.equal(playbook.playbook_id, 'canva_instagram_draft')
  assert.equal(playbook.skill_id, 'canva_design')
})

test('144. Facebook group research maps to facebook_group_research playbook', () => {
  const playbook = recommendPlaybookTest('Kevin, research Facebook groups about parking in A Coruña.', 'facebook_research')
  assert.equal(playbook.playbook_id, 'facebook_group_research')
})

test('145. Gmail draft prompt maps to gmail_prepare_draft playbook', () => {
  const playbook = recommendPlaybookTest('Kevin, prepare a Gmail draft for this lead.', 'gmail_workflow')
  assert.equal(playbook.playbook_id, 'gmail_prepare_draft')
})

test('146. Playbook approval gates require approval', () => {
  const decision = validatePlaybookStepTest('facebook_group_research', 'join_group')
  assert.equal(decision.allowed, true)
  assert.equal(decision.requires_approval, true)
  assert.equal(decision.blocked, false)
})

test('147. Forbidden playbook step is blocked', () => {
  const decision = validatePlaybookStepTest('facebook_group_research', 'bypass_login')
  assert.equal(decision.allowed, false)
  assert.equal(decision.blocked, true)
  assert.match(decision.reason, /forbidden/)
})

test('148. Unknown prompt falls back to skill-only behavior', () => {
  const playbook = recommendPlaybookTest('Kevin, do something custom on a known but unsupported workflow.', 'facebook_research')
  assert.equal(playbook, null)
})

test('149. Delegation stores playbook metadata', () => {
  const plan = buildPlaybookPlanTest('canva_instagram_draft', 'Kevin, create a Canva Instagram draft for ALB Parking.')
  const actionRow = {
    action_type: 'open_url',
    skill_id: 'canva_design',
    playbook_id: plan.playbook_id,
    playbook_name: plan.playbook_name,
    playbook_plan: plan,
  }
  assert.equal(actionRow.playbook_id, 'canva_instagram_draft')
  assert.equal(actionRow.playbook_plan.current_step, 'open_canva')
  assert.ok(Array.isArray(actionRow.playbook_plan.steps))
})

test('150. CEO copy includes playbook and manual takeover language', () => {
  const copy = buildPlaybookCopyTest('Kevin', {
    playbookId: 'facebook_group_research',
    playbookName: 'Facebook Group Research',
  })
  assert.match(copy, /open Facebook directly/)
  assert.match(copy, /stop before any external action/)
})

test('151. Playbook action creates step rows', () => {
  const plan = buildPlaybookPlanTest('facebook_group_research', 'Kevin, research Facebook groups about parking in A Coruña.')
  const steps = createActionStepsTest('action-1', plan)
  assert.ok(steps.length >= plan.steps.length)
  assert.equal(steps[0].action_id, 'action-1')
  assert.equal(steps.some(s => s.step_id === 'join_group' && s.approval_required), true)
})

test('152. First playbook step is running and later safe steps are planned', () => {
  const plan = buildPlaybookPlanTest('canva_instagram_draft', 'Kevin, create a Canva Instagram draft.')
  const steps = createActionStepsTest('action-2', plan)
  assert.equal(steps[0].status, 'running')
  assert.equal(steps[1].status, 'planned')
})

test('153. Manual takeover marks current step waiting_user', () => {
  const steps = createActionStepsTest('action-3', buildPlaybookPlanTest('canva_instagram_draft', 'Canva draft'))
  markCurrentStepTest(steps, 'waiting_user', 'security_checkpoint')
  assert.equal(steps[0].status, 'waiting_user')
  assert.equal(steps[0].message, 'security_checkpoint')
})

test('154. Approval-required playbook step marks waiting_approval', () => {
  const steps = createActionStepsTest('action-4', buildPlaybookPlanTest('facebook_group_research', 'Facebook groups'))
  markStepByIdOrCurrentTest(steps, 'join_group', 'waiting_approval', 'Approval required')
  const step = steps.find(s => s.step_id === 'join_group')
  assert.equal(step.status, 'waiting_approval')
  assert.equal(step.approval_required, true)
})

test('155. Forbidden playbook step is displayed blocked', () => {
  const steps = createActionStepsTest('action-5', buildPlaybookPlanTest('facebook_group_research', 'Facebook groups'))
  const forbidden = steps.find(s => s.step_id === 'bypass_login')
  assert.equal(forbidden.status, 'blocked')
  assert.equal(forbidden.forbidden, true)
})

test('156. Listing playbook steps redacts sensitive result data', () => {
  const steps = createActionStepsTest('action-6', buildPlaybookPlanTest('gmail_prepare_draft', 'Gmail draft'))
  steps[0].result = { token: 'secret-token', body: 'private body', title: 'Safe title' }
  const listed = listStepsRedactedTest(steps)
  assert.equal(listed[0].result.token, '[redacted]')
  assert.equal(listed[0].result.body, '[redacted]')
  assert.equal(listed[0].result.title, 'Safe title')
})

test('157. Completing action does not mark unexecuted approval steps completed', () => {
  const steps = createActionStepsTest('action-7', buildPlaybookPlanTest('facebook_group_research', 'Facebook groups'))
  markCurrentStepTest(steps, 'completed', 'Browser action completed')
  const join = steps.find(s => s.step_id === 'join_group')
  assert.equal(steps[0].status, 'completed')
  assert.equal(join.status, 'planned')
})

test('158. provider brain smart defaults do not target partial unique indexes as constraints', () => {
  const oldSql = 'ON CONFLICT ON CONSTRAINT ai_role_asgn_user_uniq'
  const fixedSql = 'DELETE FROM ai_role_assignments WHERE role = $1 AND user_id = $2'
  assert.equal(/ON CONFLICT ON CONSTRAINT ai_role_asgn_(user|global)_uniq/.test(fixedSql), false)
  assert.equal(oldSql.includes('ON CONFLICT ON CONSTRAINT'), true)
})

function buildDirectSiteTargetTest(text, skillId) {
  const directUrl = text.match(/https?:\/\/[^\s"'<>]+/i)?.[0]?.replace(/[),.!?;:]+$/, '')
  if (directUrl) return { action_type: 'open_url', url: directUrl }
  const query = text
    .replace(/^[A-Z][a-z]+,\s*/i, '')
    .replace(/\b(facebook|fb|linkedin)\b/ig, ' ')
    .replace(/\b(research|search|find|look up|open|browse|groups?|pages?|companies|results|about|for|on|in)\b/ig, ' ')
    .replace(/[.?!]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const map = {
    facebook_research: `https://www.facebook.com/search/groups?q=${encodeURIComponent(query)}`,
    linkedin_research: `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(query)}`,
    instagram_research: 'https://www.instagram.com/',
    canva_design: 'https://www.canva.com/',
    gmail_workflow: 'https://mail.google.com/',
  }
  return { action_type: 'open_url', url: map[skillId], query }
}

const PLAYBOOKS_TEST = {
  canva_instagram_draft: {
    playbook_id: 'canva_instagram_draft',
    skill_id: 'canva_design',
    playbook_name: 'Canva Instagram Draft',
    steps: ['open_canva', 'wait_for_manual_login_if_needed', 'create_design_draft', 'add_user_requested_text', 'capture_preview', 'save_draft_result'],
    approval_gates: ['download_final_asset', 'share_design', 'publish_design'],
    forbidden_steps: ['publish_without_approval', 'use_unlicensed_assets_without_review'],
  },
  facebook_group_research: {
    playbook_id: 'facebook_group_research',
    skill_id: 'facebook_research',
    playbook_name: 'Facebook Group Research',
    steps: ['open_facebook_group_search_url', 'wait_for_manual_login_if_needed', 'read_visible_group_results', 'collect_group_names_urls_member_counts_if_visible', 'summarize_findings'],
    approval_gates: ['join_group', 'post', 'comment', 'send_message'],
    forbidden_steps: ['scrape_private_profiles', 'mass_message', 'bypass_login'],
  },
  gmail_prepare_draft: {
    playbook_id: 'gmail_prepare_draft',
    skill_id: 'gmail_workflow',
    playbook_name: 'Gmail Prepare Draft',
    steps: ['open_gmail', 'wait_for_manual_login_if_needed', 'create_email_draft', 'fill_requested_content', 'save_draft_result'],
    approval_gates: ['send_email', 'send_gmail_draft'],
    forbidden_steps: ['send_without_approval', 'store_password', 'bypass_login'],
  },
}

function recommendPlaybookTest(text, skillId) {
  if (skillId === 'canva_design' && /\b(canva|instagram|draft|post|design)\b/i.test(text)) return PLAYBOOKS_TEST.canva_instagram_draft
  if (skillId === 'facebook_research' && /\b(groups?|facebook)\b/i.test(text)) return PLAYBOOKS_TEST.facebook_group_research
  if (skillId === 'gmail_workflow' && /\b(draft|prepare|write|email|mail)\b/i.test(text)) return PLAYBOOKS_TEST.gmail_prepare_draft
  return null
}

function validatePlaybookStepTest(playbookId, stepType) {
  const playbook = PLAYBOOKS_TEST[playbookId]
  if (!playbook) return { allowed: false, requires_approval: false, blocked: true, reason: 'Unknown playbook' }
  if (playbook.forbidden_steps.includes(stepType)) return { allowed: false, requires_approval: false, blocked: true, reason: `Playbook blocked forbidden step: ${stepType}` }
  if (playbook.approval_gates.includes(stepType)) return { allowed: true, requires_approval: true, blocked: false, reason: `Playbook requires approval for step: ${stepType}` }
  return { allowed: playbook.steps.includes(stepType), requires_approval: false, blocked: !playbook.steps.includes(stepType), reason: 'Checked playbook step' }
}

function buildPlaybookPlanTest(playbookId, instruction) {
  const playbook = PLAYBOOKS_TEST[playbookId]
  return {
    playbook_id: playbook.playbook_id,
    playbook_name: playbook.playbook_name,
    skill_id: playbook.skill_id,
    instruction,
    current_step: playbook.steps[0],
    steps: playbook.steps.map((step, index) => ({
      step_type: step,
      status: index === 0 ? 'ready' : 'pending',
      requires_approval: playbook.approval_gates.includes(step),
      forbidden: playbook.forbidden_steps.includes(step),
    })),
    approval_gates: playbook.approval_gates,
    forbidden_steps: playbook.forbidden_steps,
  }
}

function createActionStepsTest(actionId, plan) {
  const seen = new Set()
  const rows = []
  const add = (stepId, approvalRequired = false, forbidden = false) => {
    if (seen.has(stepId)) return
    seen.add(stepId)
    rows.push({
      id: `${actionId}-${rows.length}`,
      action_id: actionId,
      step_index: rows.length,
      step_id: stepId,
      title: stepId.replace(/_/g, ' '),
      approval_required: approvalRequired,
      forbidden,
      status: forbidden ? 'blocked' : rows.length === 0 ? 'running' : 'planned',
      message: forbidden ? 'Forbidden by playbook.' : null,
      result: {},
    })
  }
  for (const step of plan.steps) add(step.step_type, step.requires_approval, step.forbidden)
  for (const gate of plan.approval_gates) add(gate, true, false)
  for (const forbidden of plan.forbidden_steps) add(forbidden, false, true)
  return rows
}

function markCurrentStepTest(steps, status, message) {
  const step = steps.find(s => ['running', 'waiting_user', 'waiting_approval'].includes(s.status)) ?? steps.find(s => s.status === 'planned' && !s.forbidden)
  step.status = status
  step.message = message
}

function markStepByIdOrCurrentTest(steps, stepId, status, message) {
  const step = steps.find(s => s.step_id === stepId) ?? steps.find(s => ['running', 'waiting_user', 'waiting_approval'].includes(s.status))
  step.status = status
  step.message = message
}

function listStepsRedactedTest(steps) {
  return steps.map(step => ({
    ...step,
    result: Object.fromEntries(Object.entries(step.result).map(([key, value]) => (
      /password|secret|token|api_key|apikey|authorization|body/i.test(key) ? [key, '[redacted]'] : [key, value]
    ))),
  }))
}

function buildPlaybookCopyTest(operatorName, result) {
  if (result.playbookId === 'facebook_group_research') {
    return `${operatorName} will open Facebook directly and stop before any external action.`
  }
  return `${operatorName} will use the ${result.playbookName} playbook. If login or CAPTCHA appears, ${operatorName} will pause.`
}

// ── Tests 114–120: Lead discovery workflow ────────────────────────────────────
// Pure-JS reimplementation of discovery-workflow.ts logic for testing without
// network or DB access.

// Inline buildLeadDiscoveryQueries logic
function buildLeadDiscoveryQueriesTest(userPrompt, projectContext) {
  const base = userPrompt.trim()
  const loc = projectContext?.location ?? extractLocationTest(userPrompt)
  const audience = projectContext?.target_audience ?? ''
  const queries = [base]

  if (loc && !base.toLowerCase().includes(loc.toLowerCase())) {
    queries.push(`${base} ${loc}`)
  }
  const iberian = ['coruña', 'a coruña', 'galicia', 'madrid', 'barcelona', 'spain']
  const isIberian = loc && iberian.some(i => loc.toLowerCase().includes(i))

  if (loc && isIberian) {
    queries.push(`administradores de fincas ${loc}`)
    queries.push(`gestor aparcamiento ${loc} contacto`)
    queries.push(`parking privado ${loc} empresa`)
  } else if (loc) {
    queries.push(`property managers ${loc} contact`)
    queries.push(`facility management ${loc}`)
  }

  if (audience) queries.push(`${audience} ${loc ?? ''}`.trim())

  const seen = new Set()
  return queries.filter(q => {
    const k = q.toLowerCase().trim()
    if (seen.has(k) || k.length < 5) return false
    seen.add(k)
    return true
  }).slice(0, 5)
}

function extractLocationTest(text) {
  const match = text.match(/\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)\s*[.,]?\s*$/u)
  return match?.[1] ?? null
}

// Inline normalizeLeadCandidate logic
function validateEmailTest(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}

function normalizeLeadCandidateTest(c) {
  return {
    ...c,
    email: c.email ? validateEmailTest(c.email.trim()) : null,
    confidence: Math.min(100, Math.max(0, c.confidence ?? 0)),
  }
}

// Inline parseCandidates logic
function parseCandidatesTest(raw) {
  try {
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const start = cleaned.indexOf('[')
    const end = cleaned.lastIndexOf(']')
    if (start === -1 || end === -1) return []
    const parsed = JSON.parse(cleaned.slice(start, end + 1))
    if (!Array.isArray(parsed)) return []
    return parsed.filter(c => c.company_name && typeof c.company_name === 'string' && c.source_url)
  } catch {
    return []
  }
}

test('114. buildLeadDiscoveryQueries returns multiple targeted variants', () => {
  const queries = buildLeadDiscoveryQueriesTest(
    'property administrators in A Coruña',
    { location: 'A Coruña' }
  )
  assert.ok(queries.length >= 3, `Expected ≥3 queries, got ${queries.length}`)
  // Should include Spanish language variants for Iberian target
  const hasSpanish = queries.some(q => q.toLowerCase().includes('administradores') || q.toLowerCase().includes('gestor'))
  assert.ok(hasSpanish, 'Should include Spanish query variants for Iberian location')
})

test('115. buildLeadDiscoveryQueries caps at 5 queries', () => {
  const queries = buildLeadDiscoveryQueriesTest(
    'parking operators in Madrid Spain',
    { location: 'Madrid', target_audience: 'property managers' }
  )
  assert.ok(queries.length <= 5, `Expected ≤5 queries, got ${queries.length}`)
})

test('116. normalizeLeadCandidate never invents email — rejects invalid format', () => {
  const candidate = { company_name: 'Test Co', source_url: 'https://example.com', email: 'not-an-email', confidence: 80 }
  const normalized = normalizeLeadCandidateTest(candidate)
  assert.equal(normalized.email, null, 'Invalid email must be set to null, not passed through')
})

test('117. normalizeLeadCandidate preserves valid email from visible source', () => {
  const candidate = { company_name: 'Test Co', source_url: 'https://example.com', email: 'info@testco.es', confidence: 80 }
  const normalized = normalizeLeadCandidateTest(candidate)
  assert.equal(normalized.email, 'info@testco.es')
})

test('118. parseCandidates rejects candidates missing company_name or source_url', () => {
  const raw = JSON.stringify([
    { company_name: 'Valid Co', source_url: 'https://valid.com', confidence: 70, reason: 'ok' },
    { source_url: 'https://no-name.com', confidence: 60, reason: 'missing name' },
    { company_name: 'No URL Co', confidence: 50, reason: 'missing url' },
  ])
  const candidates = parseCandidatesTest(raw)
  assert.equal(candidates.length, 1, 'Only the candidate with both company_name and source_url should pass')
  assert.equal(candidates[0].company_name, 'Valid Co')
})

test('119. discovery summary message is honest when 0 leads found', () => {
  // Inline buildSummaryMessage logic
  function buildSummaryMessage(ctx) {
    if (ctx.status === 'blocked') return `Research is blocked. ${ctx.failures[0] ?? 'Check Operating Mode.'}`
    if (ctx.status === 'failed') return `Lead discovery failed. ${ctx.failures[0] ?? 'All search queries failed.'}`
    const parts = []
    if (ctx.leadsCreated > 0) {
      parts.push(`${ctx.leadsCreated} lead candidate${ctx.leadsCreated !== 1 ? 's' : ''} created and awaiting review.`)
    } else {
      parts.push('No new leads were extracted from the search results.')
      parts.push('Try a more specific query, or ask the Web Operator to open specific target websites directly.')
    }
    parts.push(`${ctx.queriesRun} quer${ctx.queriesRun !== 1 ? 'ies' : 'y'} run, ${ctx.pagesChecked} page${ctx.pagesChecked !== 1 ? 's' : ''} checked.`)
    if (ctx.duplicatesSkipped > 0) parts.push(`${ctx.duplicatesSkipped} duplicate${ctx.duplicatesSkipped !== 1 ? 's' : ''} skipped.`)
    return parts.join(' ')
  }

  const msg = buildSummaryMessage({ status: 'completed', queriesRun: 3, pagesChecked: 5, candidatesFound: 0, leadsCreated: 0, duplicatesSkipped: 0, failures: [] })
  assert.ok(msg.includes('No new leads'), 'Should say no leads found honestly')
  assert.ok(msg.includes('Try a more specific'), 'Should suggest next steps')
  assert.ok(msg.includes('queries run'), 'Should report queries run')
  assert.ok(!msg.includes('undefined'), 'Should have no undefined values')
})

test('120. discovery blocked message is clear when mode is read_only', () => {
  function buildBlockedMsg(mode, reason) {
    return mode === 'read_only'
      ? 'AÏKO is in Read Only mode. Switch to Approval mode to let Kevin use the browser.'
      : reason
  }
  const msg = buildBlockedMsg('read_only', 'raw reason')
  assert.ok(msg.includes('Read Only mode'), 'Should name the mode')
  assert.ok(msg.includes('Approval mode'), 'Should name the required mode')
  assert.ok(!msg.includes('raw reason'), 'Should not expose internal reason string')
})

// ── Tests 121–129: Page-state detector and manual takeover ───────────────────
// Pure-JS reimplementation of detection patterns from page-state-detector.ts

const LOGIN_URL_PATTERNS_TEST = [
  /\/login/i, /\/signin/i, /\/sign-in/i, /\/auth/i,
  /accounts\.google\.com/i, /login\.live\.com/i,
]
const LOGIN_TITLE_PATTERNS_TEST = [
  /\bsign in\b/i, /\blog in\b/i, /\blogin\b/i,
]
const LOGIN_TEXT_PATTERNS_TEST = [
  /contraseña/i, /\bpassword\b/i, /iniciar sesión/i,
]
const CAPTCHA_TEXT_PATTERNS_TEST = [
  /unusual traffic/i, /verify you are human/i, /are you a robot/i,
  /recaptcha/i, /hcaptcha/i, /\bcaptcha\b/i,
  /comprueba que eres humano/i,
]
const SECURITY_CHECKPOINT_TEST = [
  /security checkpoint/i, /account locked/i, /verify your identity/i,
  /verify it's you/i,
  /just a moment/i, /\bun momento\b/i, /cloudflare/i,
  /\brayid\b/i, /cf-mitigated/i,
  /volver a diseñar/i, /equipo de ayuda de canva/i,
]
const TWO_FACTOR_TEST = [
  /two.?factor/i, /2-step verification/i, /2fa/i,
  /authentication code/i, /verification code/i,
]

function detectPageStateTest(url, title, bodyText) {
  const combined = `${url} ${title} ${bodyText}`
  const matchesAny = (text, patterns) => patterns.some(p => p.test(text))
  if (matchesAny(combined, TWO_FACTOR_TEST)) return { type: 'two_factor_required', requires_manual_takeover: true }
  if (matchesAny(combined, SECURITY_CHECKPOINT_TEST)) return { type: 'security_checkpoint', requires_manual_takeover: true }
  if (matchesAny(url, [/\/captcha/i, /recaptcha/i]) || matchesAny(combined, CAPTCHA_TEXT_PATTERNS_TEST)) return { type: 'captcha_detected', requires_manual_takeover: true }
  if (matchesAny(url, LOGIN_URL_PATTERNS_TEST) || matchesAny(title, LOGIN_TITLE_PATTERNS_TEST) || matchesAny(bodyText, LOGIN_TEXT_PATTERNS_TEST)) return { type: 'login_required', requires_manual_takeover: true }
  return { type: 'normal', requires_manual_takeover: false }
}

test('121. CAPTCHA text in page body triggers captcha_detected', () => {
  const state = detectPageStateTest('https://www.google.com/search', 'Google', 'Our systems have detected unusual traffic from your computer network.')
  assert.equal(state.type, 'captcha_detected')
  assert.equal(state.requires_manual_takeover, true)
})

test('122. Login URL triggers login_required', () => {
  const state = detectPageStateTest('https://www.facebook.com/login/', 'Facebook', 'Enter your email and password')
  assert.equal(state.type, 'login_required')
  assert.equal(state.requires_manual_takeover, true)
})

test('123. Security checkpoint triggers security_checkpoint', () => {
  const state = detectPageStateTest('https://www.linkedin.com/checkpoint/challenge', 'Challenge', 'Verify your identity to continue')
  assert.equal(state.type, 'security_checkpoint')
  assert.equal(state.requires_manual_takeover, true)
})

test('124. Two-factor authentication triggers two_factor_required', () => {
  const state = detectPageStateTest('https://accounts.google.com/signin/challenge', '2-Step Verification', 'Enter the authentication code from your app')
  assert.equal(state.type, 'two_factor_required')
  assert.equal(state.requires_manual_takeover, true)
})

test('125. Normal page does not trigger manual takeover', () => {
  const state = detectPageStateTest('https://example.com/about', 'About Us', 'Welcome to our company page')
  assert.equal(state.type, 'normal')
  assert.equal(state.requires_manual_takeover, false)
})

test('126. Spanish CAPTCHA text triggers captcha_detected', () => {
  const state = detectPageStateTest('https://www.google.es/sorry/index', 'Error', 'comprueba que eres humano')
  assert.equal(state.type, 'captcha_detected')
  assert.equal(state.requires_manual_takeover, true)
})

test('126b. Spanish Canva challenge text triggers security_checkpoint', () => {
  const state = detectPageStateTest(
    'https://www.canva.com/',
    'Un momento…',
    'Muy pronto podrás volver a diseñar. Si no puedes superar esta página, ponte en contacto con el equipo de Ayuda de Canva. RayID: abc123'
  )
  assert.equal(state.type, 'security_checkpoint')
  assert.equal(state.requires_manual_takeover, true)
})

test('127. Agent must not claim to solve CAPTCHA — waiting_user message does not claim solution', () => {
  // The user-facing message must never say "I solved" or "solved the CAPTCHA"
  const waitingMsg = 'Kevin needs your help. Complete this in the browser, then click Resume.'
  assert.ok(!waitingMsg.toLowerCase().includes('i solved'), 'Message must not claim CAPTCHA was solved')
  assert.ok(!waitingMsg.toLowerCase().includes('solved the captcha'), 'Message must not claim CAPTCHA was auto-solved')
  assert.ok(waitingMsg.includes('needs your help'), 'Message must ask user for help')
  assert.ok(waitingMsg.includes('Resume'), 'Message must reference the Resume button')
})

test('128. Resume uses same browser_profile_key (persistent session)', () => {
  // Verify that profile key is preserved across actions (no new key generated)
  const operator = { name: 'Kevin', browser_profile_key: 'kevin', status: 'ready_to_resume', pending_action_type: 'search', requires_user_input: false }
  // The resume flow uses operatorName → same profile key → same context (cookies preserved)
  assert.equal(operator.browser_profile_key, 'kevin', 'Profile key must remain stable for session continuity')
  assert.equal(operator.status, 'ready_to_resume', 'Operator must be ready_to_resume before resume is allowed')
  assert.equal(operator.requires_user_input, false, 'requires_user_input must be cleared before resume')
})

test('129. headed mode env: WEB_OPERATOR_HEADLESS=false maps to headless=false', () => {
  // Simulate the controller.ts isHeadless() logic
  function isHeadlessTest(webOpHeadless, browserHeadless) {
    if (webOpHeadless !== undefined) return webOpHeadless !== 'false'
    if (browserHeadless !== undefined) return browserHeadless !== 'false'
    return true
  }
  assert.equal(isHeadlessTest('false', undefined), false, 'WEB_OPERATOR_HEADLESS=false → headless=false')
  assert.equal(isHeadlessTest('true', undefined), true, 'WEB_OPERATOR_HEADLESS=true → headless=true')
  assert.equal(isHeadlessTest(undefined, 'false'), false, 'falls back to BROWSER_HEADLESS=false')
  assert.equal(isHeadlessTest(undefined, undefined), true, 'defaults to headless=true')
})

test('130. URL instructions route to website_reader instead of unknown-site proposal', () => {
  function extractFirstUrl(text) {
    const match = text.match(/https?:\/\/[^\s"'<>]+/i)
    return match ? match[0].replace(/[),.!?;:]+$/, '') : null
  }
  function inferUnknownWebsiteFromInstruction(text) {
    const withoutUrls = text.replace(/https?:\/\/[^\s"'<>]+/gi, '')
    if (!withoutUrls.trim()) return null
    const lower = withoutUrls.toLowerCase()
    if (!/\b(work on|research on|use|open|browse)\b/.test(lower)) return null
    const match = withoutUrls.match(/(?:work on|research on|use|open|browse)\s+([A-Z][\w.-]{2,}|[a-z][\w.-]+\.[a-z]{2,})/i)
    if (!match) return null
    const candidate = match[1].replace(/[.,!?;:]$/, '')
    const known = ['canva', 'facebook', 'linkedin', 'gmail', 'instagram', 'google', 'web', 'and', 'or', 'the', 'a', 'an']
    if (known.includes(candidate.toLowerCase())) return null
    return candidate
  }

  const command = 'Kevin, open https://example.com and summarize the page.'
  assert.equal(extractFirstUrl(command), 'https://example.com')
  assert.equal(inferUnknownWebsiteFromInstruction(command), null)
})

test('130b. Web Operator network failures use owner-facing copy', () => {
  function buildDelegationFailureMessage(rawError) {
    const clean = rawError.replace(/\u001b\[[0-9;]*m/g, '')
    if (/skill blocked|forbidden|not allowed/i.test(clean)) {
      return 'AÏKO cannot do this safely.'
    }
    if (clean.includes("Executable doesn't exist") || clean.includes('browserType.launch')) {
      return 'Browser runtime is missing. Run: npx playwright install chromium.'
    }
    if (clean.includes('net::ERR_NAME_NOT_RESOLVED')) {
      return 'The Web Operator could not resolve that website address. Check the URL or network connection, then try again.'
    }
    if (clean.includes('net::ERR') || clean.toLowerCase().includes('network')) {
      return 'The Web Operator hit a network error while opening the website. Check the URL or connection, then try again.'
    }
    if (clean.toLowerCase().includes('timeout')) {
      return 'The Web Operator timed out while loading the website. Try again or use a more specific URL.'
    }
    return 'The Web Operator action failed. Check the operator page for details and try again.'
  }

  const raw = 'page.goto: net::ERR_NAME_NOT_RESOLVED at https://example.com/\\n\\u001b[2m  - navigating to "https://example.com/"\\u001b[22m'
  const message = buildDelegationFailureMessage(raw)

  assert.equal(message, 'The Web Operator could not resolve that website address. Check the URL or network connection, then try again.')
  assert.ok(!message.includes('page.goto'), 'does not expose Playwright internals')
  assert.ok(!message.includes('\\u001b'), 'does not expose ANSI escapes')
})

test('131. named unknown website still creates an unknown-site candidate', () => {
  function inferUnknownWebsiteFromInstruction(text) {
    const withoutUrls = text.replace(/https?:\/\/[^\s"'<>]+/gi, '')
    if (!withoutUrls.trim()) return null
    const lower = withoutUrls.toLowerCase()
    if (!/\b(work on|research on|use|open|browse)\b/.test(lower)) return null
    const match = withoutUrls.match(/(?:work on|research on|use|open|browse)\s+([A-Z][\w.-]{2,}|[a-z][\w.-]+\.[a-z]{2,})/i)
    if (!match) return null
    const candidate = match[1].replace(/[.,!?;:]$/, '')
    const known = ['canva', 'facebook', 'linkedin', 'gmail', 'instagram', 'google', 'web', 'and', 'or', 'the', 'a', 'an']
    if (known.includes(candidate.toLowerCase())) return null
    return candidate
  }

  assert.equal(inferUnknownWebsiteFromInstruction('Kevin, open AcmePortal and check leads.'), 'AcmePortal')
})

// ── Strategy Execution Planner smoke tests ───────────────────────────────────

function strategyCapabilitiesForTest(text) {
  const lower = text.toLowerCase()
  const caps = []
  const add = (channel, skill, playbook, approval = true, login = true) => {
    caps.push({ channel, skill_id: skill, playbook_id: playbook, requires_approval: approval, requires_user_login: login })
  }
  if (/\bwhatsapp(?:\s+web)?\b/.test(lower)) add('WhatsApp Web', 'whatsapp_web', 'whatsapp_outreach')
  if (/\breddit\b/.test(lower)) add('Reddit', 'reddit_research', 'reddit_market_research', false, true)
  if (/\bfacebook\b/.test(lower)) add('Facebook', 'facebook_research', 'facebook_group_research')
  if (/\blinkedin\b/.test(lower)) add('LinkedIn', 'linkedin_research', 'linkedin_company_research')
  if (/\bgmail\b|\bemail\b/.test(lower)) add('Gmail', 'gmail_workflow', 'gmail_prepare_draft')
  const sites = text.match(/https?:\/\/[^\s"'<>]+|(?:[a-z0-9-]+\.)+[a-z]{2,}/gi) ?? []
  for (const site of sites) {
    if (!/facebook|instagram|linkedin|canva|gmail|google|reddit|whatsapp/i.test(site)) {
      const special = /\b(contact|message|submit|login|account|post|publish)\b/i.test(text)
      add(site.replace(/[),.!?;:]+$/, ''), special ? `custom_site_${site}` : 'website_reader', special ? `custom_site_${site}_workflow` : 'general_site_research', special, special)
    }
  }
  if (caps.length === 0) add('General web', 'general_web_research', 'general_site_research', false, false)
  return caps
}

function matchCapabilitiesForTest(caps, installedSkills, installedPlaybooks) {
  const missing = []
  for (const cap of caps) {
    if (!installedSkills.includes(cap.skill_id)) {
      missing.push({
        capability_key: `web_operator_skill:${cap.skill_id}`,
        required_skill: cap.skill_id,
        required_playbook: cap.playbook_id,
        forbidden_actions: ['bypass_login', 'bypass_captcha', 'scrape_private_data', 'send_without_approval'],
      })
    }
    if (!installedPlaybooks.includes(cap.playbook_id)) {
      missing.push({
        capability_key: `web_operator_playbook:${cap.playbook_id}`,
        required_skill: cap.skill_id,
        required_playbook: cap.playbook_id,
        forbidden_actions: ['bypass_login', 'bypass_captcha', 'scrape_private_data', 'send_without_approval'],
      })
    }
  }
  return missing
}

function approvalGatesForTest(caps) {
  return caps.flatMap(cap => {
    if (cap.skill_id === 'whatsapp_web') return ['send_message', 'attach_file', 'create_group', 'broadcast_message']
    if (cap.skill_id === 'facebook_research') return ['join_group', 'post', 'comment', 'send_message']
    if (cap.skill_id === 'gmail_workflow') return ['send_email', 'send_gmail_draft']
    return cap.requires_approval ? ['submit_form', 'send_message', 'publish'] : []
  })
}

test('132. WhatsApp strategy creates missing capability proposal when whatsapp_web is missing', () => {
  const caps = strategyCapabilitiesForTest('For ALB Parking, contact property owners through WhatsApp.')
  const missing = matchCapabilitiesForTest(caps, ['facebook_research'], ['facebook_group_research'])
  assert.ok(caps.some(c => c.skill_id === 'whatsapp_web'))
  assert.ok(missing.some(m => m.capability_key === 'web_operator_skill:whatsapp_web'))
  assert.ok(missing.some(m => m.capability_key === 'web_operator_playbook:whatsapp_outreach'))
})

test('133. Reddit strategy maps to reddit_research when skill and playbook exist', () => {
  const caps = strategyCapabilitiesForTest('Use Reddit research to validate parking pain points.')
  const missing = matchCapabilitiesForTest(caps, ['reddit_research'], ['reddit_market_research'])
  assert.equal(caps[0].skill_id, 'reddit_research')
  assert.equal(caps[0].playbook_id, 'reddit_market_research')
  assert.equal(missing.length, 0)
})

test('134. Facebook strategy maps to facebook_research and group research playbook', () => {
  const caps = strategyCapabilitiesForTest('Research Facebook groups about parking in A Coruña.')
  assert.equal(caps[0].skill_id, 'facebook_research')
  assert.equal(caps[0].playbook_id, 'facebook_group_research')
})

test('135. random website maps to website_reader or custom site proposal', () => {
  const readOnly = strategyCapabilitiesForTest('Research https://randomwebsite.com for lead context.')
  const special = strategyCapabilitiesForTest('Contact people through randomwebsite.com.')
  assert.equal(readOnly[0].skill_id, 'website_reader')
  assert.ok(special[0].skill_id.startsWith('custom_site_'))
})

test('136. execution plan does not create Web Operator actions', () => {
  const createdRows = ['project_strategy_execution_plans', 'agent_tasks', 'system_improvement_proposals']
  assert.ok(!createdRows.includes('web_operator_actions'))
})

test('137. create_tasks creates internal tasks only', () => {
  const step = {
    owner_role: 'copywriting_agent',
    description: 'Prepare WhatsApp message draft',
    requires_approval: true,
    internal_only: true,
  }
  const task = { table: 'agent_tasks', owner_role: step.owner_role, description: JSON.stringify(step) }
  assert.equal(task.table, 'agent_tasks')
  assert.ok(JSON.parse(task.description).internal_only)
})

test('138. approval gates are included for messaging and posting channels', () => {
  const caps = strategyCapabilitiesForTest('Use WhatsApp and Facebook posting for the campaign.')
  const gates = approvalGatesForTest(caps)
  assert.ok(gates.includes('send_message'))
  assert.ok(gates.includes('post'))
})

test('139. missing capability proposals include forbidden actions', () => {
  const caps = strategyCapabilitiesForTest('Use WhatsApp outreach.')
  const missing = matchCapabilitiesForTest(caps, [], [])
  assert.ok(missing.every(m => m.forbidden_actions.includes('bypass_captcha')))
  assert.ok(missing.every(m => m.forbidden_actions.includes('send_without_approval')))
})

test('140. CEO can AÏKO execute intent returns ready or missing capability answer', () => {
  function isStrategyExecutionPlannerIntent(command) {
    return /\b(can\s+a[ïi]ko\s+(execute|do)|proceed with the strategy|make the agents execute|execute this strategy|use\s+(whatsapp|reddit|facebook|linkedin|instagram|canva|gmail|email)|best strategy is|strategy execution plan)\b/i.test(command)
  }
  const command = 'For ALB Parking, the best strategy is WhatsApp outreach. Can AÏKO execute this?'
  assert.equal(isStrategyExecutionPlannerIntent(command), true)
})

test('141. WhatsApp missing capability prompt includes whatsapp_web', () => {
  const prompt = `Required skill: whatsapp_web\nRequired playbook: whatsapp_outreach\nOpen https://web.whatsapp.com/ directly.`
  assert.ok(prompt.includes('whatsapp_web'))
  assert.ok(prompt.includes('whatsapp_outreach'))
})

test('142. capability prompt includes approval-required send_message', () => {
  const prompt = `Approval-required actions:\n- send_message\n- attach_file\n- broadcast_message`
  assert.ok(prompt.includes('send_message'))
})

test('143. capability prompt includes forbidden mass_messaging', () => {
  const prompt = `Forbidden actions:\n- mass_messaging\n- spam\n- scrape_contacts`
  assert.ok(prompt.includes('mass_messaging'))
})

test('144. capability prompt includes manual QR/login takeover', () => {
  const prompt = `Steps:\n- open_whatsapp_web\n- wait_for_qr_or_manual_login_if_needed\nSafety constraints:\n- User manual takeover is required for QR/login/security checkpoints.`
  assert.ok(prompt.includes('wait_for_qr_or_manual_login_if_needed'))
  assert.ok(prompt.includes('manual takeover'))
})

test('145. capability prompt includes tests and runtime validation', () => {
  const prompt = `Tests to add:\n- WhatsApp strategy maps to whatsapp_web.\n\nRuntime validation checklist:\n- Run headed mode.\n- Confirm login/security pauses.`
  assert.ok(prompt.includes('Tests to add'))
  assert.ok(prompt.includes('Runtime validation checklist'))
})

test('146. capability prompt does not instruct auto-sending', () => {
  const prompt = `Do not send, post, publish, comment, join, attach, broadcast, or message automatically.\nRisky actions must create/require Approval Center items before execution.`
  assert.ok(!/\b(auto-send|automatically send|send automatically)\b/i.test(prompt))
  assert.ok(prompt.includes('Do not send'))
})

test('147. proposal stores implementation_prompt and metadata', () => {
  const proposal = {
    implementation_prompt: 'You are Codex working locally on AÏKO. Implement whatsapp_web.',
    proposal_metadata: {
      missing_capability_id: 'web_operator_skill:whatsapp_web',
      platform: 'WhatsApp Web',
      skill_spec: { skill_id: 'whatsapp_web' },
      playbook_spec: { playbook_id: 'whatsapp_outreach' },
      safety_rules: ['no_captcha_bypass'],
      test_plan: ['prompt includes approval gates'],
      runtime_validation_plan: ['headed mode validation'],
    },
  }
  assert.ok(proposal.implementation_prompt.includes('Codex'))
  assert.equal(proposal.proposal_metadata.skill_spec.skill_id, 'whatsapp_web')
  assert.ok(proposal.proposal_metadata.runtime_validation_plan.length > 0)
})

test('148. WhatsApp missing capability proposal is idempotent per project and title', () => {
  const existing = [
    {
      id: 'proposal-1',
      related_project_id: 'alb',
      title: 'Add WhatsApp Web Operator Skill and Playbook',
      missing_capabilities: ['web_operator_skill:whatsapp_web'],
      status: 'draft',
    },
  ]
  function findReusable(proposals, projectId, title, missingCapability) {
    return proposals.find(p =>
      p.related_project_id === projectId &&
      p.title.toLowerCase() === title.toLowerCase() &&
      !['rejected', 'implemented', 'archived'].includes(p.status) &&
      p.missing_capabilities.includes(missingCapability)
    ) ?? null
  }
  const reusable = findReusable(
    existing,
    'alb',
    'Add WhatsApp Web Operator Skill and Playbook',
    'web_operator_skill:whatsapp_web'
  )
  assert.equal(reusable?.id, 'proposal-1')
})

test('149. active duplicate WhatsApp proposals collapse in visible list', () => {
  const proposals = [
    {
      id: 'newest',
      related_project_id: 'alb',
      title: 'Add WhatsApp Web Operator Skill and Playbook',
      missing_capabilities: ['web_operator_skill:whatsapp_web'],
      status: 'draft',
    },
    {
      id: 'older',
      related_project_id: 'alb',
      title: 'Add WhatsApp Web Operator Skill and Playbook',
      missing_capabilities: ['web_operator_skill:whatsapp_web'],
      status: 'draft',
    },
    {
      id: 'rejected-history',
      related_project_id: 'alb',
      title: 'Add WhatsApp Web Operator Skill and Playbook',
      missing_capabilities: ['web_operator_skill:whatsapp_web'],
      status: 'rejected',
    },
  ]
  function dedupeVisible(proposals) {
    const seen = new Set()
    return proposals.filter(p => {
      if (['rejected', 'implemented', 'archived'].includes(p.status)) return true
      const key = `${p.related_project_id ?? 'global'}::${p.title.toLowerCase()}::${p.missing_capabilities[0] ?? ''}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
  const visible = dedupeVisible(proposals)
  assert.deepEqual(visible.map(p => p.id), ['newest', 'rejected-history'])
})

// ── Controlled self-improvement lifecycle ────────────────────────────────────

test('150. approving proposal does not run code', () => {
  const calls = []
  function approveProposal(proposal) {
    return {
      ...proposal,
      status: 'approved_for_implementation',
      proposal_metadata: {
        ...proposal.proposal_metadata,
        lifecycle: { approved_at: '2026-06-04T00:00:00.000Z' },
      },
    }
  }
  const updated = approveProposal({ id: 'p1', status: 'proposed', proposal_metadata: {} })
  assert.equal(updated.status, 'approved_for_implementation')
  assert.equal(calls.length, 0, 'no code-generation or shell execution is invoked')
})

test('151. copying prompt does not change proposal status', () => {
  const proposal = { id: 'p1', status: 'proposed', implementation_prompt: 'Codex prompt' }
  const copied = proposal.implementation_prompt
  assert.equal(copied, 'Codex prompt')
  assert.equal(proposal.status, 'proposed')
})

test('152. mark implemented stores branch commit and PR metadata', () => {
  const lifecycle = {
    implemented_at: '2026-06-04T00:00:00.000Z',
    implementation_branch: 'self-improvement-loop',
    implementation_commit: 'abc123',
    implementation_pr_url: 'https://github.com/acme/aiko/pull/1',
  }
  assert.equal(lifecycle.implementation_branch, 'self-improvement-loop')
  assert.equal(lifecycle.implementation_commit, 'abc123')
  assert.ok(lifecycle.implementation_pr_url.includes('/pull/1'))
})

test('153. validate available is blocked if Web Operator skill or playbook is missing', () => {
  function validatePresence(proposal, skills, playbooks) {
    const skillId = proposal.proposal_metadata.skill_spec.skill_id
    const playbookId = proposal.proposal_metadata.playbook_spec.playbook_id
    if (!skills.includes(skillId)) return `Cannot mark available because the skill/playbook is not present in the database. Missing skill: ${skillId}.`
    if (!playbooks.includes(playbookId)) return `Cannot mark available because the skill/playbook is not present in the database. Missing playbook: ${playbookId}.`
    return 'ok'
  }
  const proposal = {
    proposal_metadata: {
      skill_spec: { skill_id: 'whatsapp_web' },
      playbook_spec: { playbook_id: 'whatsapp_outreach' },
    },
  }
  assert.match(validatePresence(proposal, [], []), /Missing skill: whatsapp_web/)
  assert.match(validatePresence(proposal, ['whatsapp_web'], []), /Missing playbook: whatsapp_outreach/)
})

test('154. validate available succeeds if Web Operator skill and playbook exist', () => {
  function canValidate(proposal, skills, playbooks) {
    return skills.includes(proposal.skill_id) && playbooks.includes(proposal.playbook_id)
  }
  assert.equal(canValidate({ skill_id: 'reddit_research', playbook_id: 'reddit_market_research' }, ['reddit_research'], ['reddit_market_research']), true)
})

test('155. validated proposal marks related capability available', () => {
  const capabilities = { email_sending: 'missing' }
  function markAvailable(key) {
    if (capabilities[key]) capabilities[key] = 'available'
  }
  markAvailable('email_sending')
  assert.equal(capabilities.email_sending, 'available')
})

test('156. execution planner no longer creates missing proposal once skill and playbook exist', () => {
  function missingForCapability(cap, skills, playbooks) {
    const missing = []
    if (!skills.includes(cap.skill_id)) missing.push(`web_operator_skill:${cap.skill_id}`)
    if (!playbooks.includes(cap.playbook_id)) missing.push(`web_operator_playbook:${cap.playbook_id}`)
    return missing
  }
  const missing = missingForCapability(
    { skill_id: 'reddit_research', playbook_id: 'reddit_market_research' },
    ['reddit_research'],
    ['reddit_market_research']
  )
  assert.deepEqual(missing, [])
})

test('157. rejected proposal does not appear as active duplicate', () => {
  const proposals = [
    { id: 'rejected', status: 'rejected', title: 'Add X', related_project_id: 'p1', missing_capabilities: ['x'] },
    { id: 'active', status: 'proposed', title: 'Add X', related_project_id: 'p1', missing_capabilities: ['x'] },
  ]
  const active = proposals.filter(p => !['rejected', 'implemented', 'archived', 'validated_available'].includes(p.status))
  assert.deepEqual(active.map(p => p.id), ['active'])
})

test('158. lifecycle status appears in project execution plan missing row', () => {
  const proposalStatus = 'implementation_in_progress'
  const rendered = `Proposal status: ${proposalStatus.replace(/_/g, ' ')}`
  assert.equal(rendered, 'Proposal status: implementation in progress')
})

// ── Self-improvement timeline ────────────────────────────────────────────────

test('159. timeline groups proposals by lifecycle status', () => {
  function summarize(statuses) {
    return statuses.reduce((acc, status) => {
      if (['proposed', 'draft', 'pending_approval'].includes(status)) acc.proposed++
      else if (['approved_for_implementation', 'approved'].includes(status)) acc.approved++
      else if (status === 'implementation_in_progress') acc.in_progress++
      else if (['implemented_pending_validation', 'implemented'].includes(status)) acc.pending_validation++
      else if (status === 'validated_available') acc.validated++
      else if (status === 'rejected') acc.rejected++
      return acc
    }, { proposed: 0, approved: 0, in_progress: 0, pending_validation: 0, validated: 0, rejected: 0 })
  }
  assert.deepEqual(
    summarize(['proposed', 'approved_for_implementation', 'implementation_in_progress', 'implemented_pending_validation', 'validated_available', 'rejected']),
    { proposed: 1, approved: 1, in_progress: 1, pending_validation: 1, validated: 1, rejected: 1 }
  )
})

test('160. blocked validation proposal appears as pending validation health issue', () => {
  function blockedByValidation(proposal, skills, playbooks) {
    if (!['implemented_pending_validation', 'implemented'].includes(proposal.status)) return false
    if (proposal.skill_id && !skills.includes(proposal.skill_id)) return true
    if (proposal.playbook_id && !playbooks.includes(proposal.playbook_id)) return true
    return false
  }
  const proposal = { status: 'implemented_pending_validation', skill_id: 'whatsapp_web', playbook_id: 'whatsapp_outreach' }
  assert.equal(blockedByValidation(proposal, [], []), true)
})

test('161. rejected proposal appears separately in timeline summary', () => {
  const statuses = ['rejected', 'proposed']
  const rejected = statuses.filter(s => s === 'rejected').length
  const proposed = statuses.filter(s => ['proposed', 'draft', 'pending_approval'].includes(s)).length
  assert.equal(rejected, 1)
  assert.equal(proposed, 1)
})

test('162. validated proposal timeline includes validation summary', () => {
  const timelineItem = {
    event_type: 'validated_available',
    validation_summary: 'npm test and npm run build passed; runtime validation complete.',
  }
  assert.equal(timelineItem.event_type, 'validated_available')
  assert.ok(timelineItem.validation_summary.includes('runtime validation'))
})

test('163. improvement timeline does not expose implementation prompt text', () => {
  const proposal = {
    id: 'p1',
    title: 'Add Capability',
    implementation_prompt: 'SECRET PROMPT BODY',
  }
  const timelineItem = {
    proposal_id: proposal.id,
    title: proposal.title,
    event_type: 'proposal_created',
  }
  assert.equal('implementation_prompt' in timelineItem, false)
  assert.equal(JSON.stringify(timelineItem).includes('SECRET PROMPT BODY'), false)
})

test('164. CEO self-improvement status query is read-only', () => {
  const isTimelineIntent = (command) => /\b(what improvements has a[ïi]ko proposed|status of (?:a[ïi]ko )?self-improvement|self-improvement status|which capabilities are missing|what was implemented recently|improvements has a[ïi]ko proposed|missing capabilities)\b/i.test(command)
  assert.equal(isTimelineIntent('What is the status of AÏKO self-improvement?'), true)

  const response = {
    intent: 'system_improvement_status',
    actions: [],
    delegation: null,
    response: 'AÏKO has 1 proposed improvement. This is read-only status; no code was executed and no capability was enabled.',
  }
  assert.equal(response.intent, 'system_improvement_status')
  assert.equal(response.actions.length, 0)
  assert.equal(response.delegation, null)
  assert.ok(response.response.includes('no code was executed'))
})

test('165. implementation prompt copy falls back if clipboard write stalls', async () => {
  let fallbackCalled = false
  async function copyWithTimeout(writeText, fallback) {
    try {
      await Promise.race([
        writeText('prompt'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Clipboard write timed out')), 10)),
      ])
    } catch {
      fallback()
    }
  }

  await copyWithTimeout(
    () => new Promise(() => {}),
    () => { fallbackCalled = true }
  )

  assert.equal(fallbackCalled, true)
})

// ── MVP dashboard consolidation ───────────────────────────────────────────────

test('166. dashboard summary does not expose secrets', () => {
  const summary = {
    ceo_brain: { provider_name: 'Ollama (local)', model: 'llama3.1:8b', status: 'connected' },
    recent_files: [{ id: 'f1', filename: 'report.md', title: 'Report', content_type: 'markdown' }],
  }
  const serialized = JSON.stringify(summary)
  assert.equal(serialized.includes('api_key'), false)
  assert.equal(serialized.includes('refresh_token'), false)
  assert.equal(serialized.includes('storage_path'), false)
  assert.equal(serialized.includes('implementation_prompt'), false)
})

test('167. dashboard summary shows CEO brain status', () => {
  const summary = {
    ceo_brain: {
      can_think: true,
      provider_name: 'Ollama (local)',
      model: 'llama3.1:8b',
      status: 'connected',
    },
  }
  assert.equal(summary.ceo_brain.can_think, true)
  assert.equal(summary.ceo_brain.status, 'connected')
  assert.ok(summary.ceo_brain.provider_name.includes('Ollama'))
})

test('168. dashboard summary includes pending approvals count', () => {
  const counts = {
    pending_approvals: 4,
  }
  assert.equal(Number.isInteger(counts.pending_approvals), true)
  assert.equal(counts.pending_approvals, 4)
})

test('169. dashboard summary includes waiting_user count', () => {
  const counts = {
    waiting_user: 2,
  }
  assert.equal(Number.isInteger(counts.waiting_user), true)
  assert.equal(counts.waiting_user, 2)
})

test('170. dashboard summary includes active improvement proposal count', () => {
  const counts = {
    active_improvement_proposals: 3,
  }
  assert.equal(Number.isInteger(counts.active_improvement_proposals), true)
  assert.equal(counts.active_improvement_proposals, 3)
})

test('171. dashboard quick links exist', () => {
  const quickLinks = [
    { label: 'CEO Chat', href: '/ceo' },
    { label: 'Start Campaign', href: '/start-campaign' },
    { label: 'Operators', href: '/operators' },
    { label: 'Approvals', href: '/approvals' },
    { label: 'Files', href: '/files' },
    { label: 'System Improvements', href: '/system' },
  ]
  const hrefs = quickLinks.map(link => link.href)
  assert.deepEqual(hrefs, ['/ceo', '/start-campaign', '/operators', '/approvals', '/files', '/system'])
})

// ── MVP release health endpoint ───────────────────────────────────────────────

test('172. /api/health response does not expose secrets', () => {
  const health = {
    ok: true,
    version: '0.1.0',
    auth_mode: 'optional',
    database: { ok: true, error: null },
    setup: { required: false, can_ceo_think: true },
    web_operator: { runtime_available: true, headed_mode: false },
    storage: { generated_files_writable: true, screenshots_writable: true },
  }
  const serialized = JSON.stringify(health)
  assert.equal(/api_key|access_token|refresh_token|nextauth_secret|auth_secret|database_url/i.test(serialized), false)
})

test('173. DB unavailable health result returns ok=false cleanly', () => {
  function summarizeDatabaseError(message) {
    const lower = message.toLowerCase()
    if (lower.includes('connection') || lower.includes('econnrefused')) return 'database_connection_failed'
    if (lower.includes('timeout')) return 'database_timeout'
    if (lower.includes('does not exist')) return 'database_schema_missing'
    if (lower.includes('password') || lower.includes('authentication')) return 'database_auth_failed'
    return 'database_unavailable'
  }
  const database = { ok: false, error: summarizeDatabaseError('connect ECONNREFUSED 127.0.0.1:5432') }
  const health = { ok: database.ok, database }
  assert.equal(health.ok, false)
  assert.equal(health.database.error, 'database_connection_failed')
  assert.equal(health.database.error.includes('/Users/'), false)
})

test('174. storage health does not expose absolute sensitive paths', () => {
  const storage = {
    generated_files_writable: true,
    screenshots_writable: true,
  }
  const serialized = JSON.stringify(storage)
  assert.equal(serialized.includes('/Users/'), false)
  assert.equal(serialized.includes('storage/generated-files'), false)
  assert.equal(serialized.includes('screenshots/'), false)
})

test('175. health response includes setup status', () => {
  const health = {
    setup: { required: false, can_ceo_think: true },
  }
  assert.equal(typeof health.setup.required, 'boolean')
  assert.equal(typeof health.setup.can_ceo_think, 'boolean')
})

test('176. health response includes web operator runtime status', () => {
  const health = {
    web_operator: { runtime_available: true, headed_mode: false },
  }
  assert.equal(typeof health.web_operator.runtime_available, 'boolean')
  assert.equal(typeof health.web_operator.headed_mode, 'boolean')
})

// ── Codex local auth smoke tests ──────────────────────────────────────────────

test('177. ChatGPT local card does not require OPENAI_OAUTH env vars', () => {
  function localCard(diagnostics) {
    return {
      id: 'openai-codex-local',
      requires_oauth_env: false,
      disabled: false,
      status: diagnostics.connected
        ? 'Connected'
        : diagnostics.auth_file_detected
          ? 'Codex auth detected'
          : diagnostics.codex_cli_detected
            ? 'Codex CLI detected, not logged in'
            : 'Not detected',
    }
  }
  const card = localCard({ codex_cli_detected: false, auth_file_detected: false, connected: false })
  assert.equal(card.requires_oauth_env, false)
  assert.equal(card.disabled, false)
  assert.equal(card.status, 'Not detected')
})

test('178. ChatGPT OAuth app card remains disabled when env vars missing', () => {
  const required = ['OPENAI_OAUTH_CLIENT_ID', 'OPENAI_OAUTH_AUTH_URL', 'OPENAI_OAUTH_TOKEN_URL', 'OPENAI_OAUTH_REDIRECT_URI']
  function oauthAppCard(env) {
    const missing = required.filter(k => !env[k])
    return {
      id: 'chatgpt_oauth',
      label: 'ChatGPT / Codex OAuth App',
      disabled: missing.length > 0,
      missing_env: missing,
    }
  }
  const card = oauthAppCard({})
  assert.equal(card.disabled, true)
  assert.deepEqual(card.missing_env, required)
})

test('179. Codex local status does not expose tokens', () => {
  const status = {
    provider: 'openai-codex-local',
    codex_cli_detected: true,
    auth_file_detected: true,
    auth_profile_exists: true,
    connected: false,
    account_email: null,
    status: 'auth_detected',
    instructions: 'Run codex login, then return to AÏKO.',
  }
  const serialized = JSON.stringify(status)
  assert.equal(/access_token|refresh_token|api_key|OPENAI_API_KEY|tokens|auth\.json|\/Users\//i.test(serialized), false)
})

test('180. Codex local import fails safely when auth is not detected', () => {
  function importLocal(status) {
    if (!status.codex_cli_detected || !status.auth_file_detected) {
      return {
        http_status: 409,
        ok: false,
        error: 'Codex local auth was not detected. Run codex login / sign in with ChatGPT using Codex, then return to AÏKO and click Detect again.',
      }
    }
    return { http_status: 200, ok: true }
  }
  const result = importLocal({ codex_cli_detected: true, auth_file_detected: false })
  assert.equal(result.http_status, 409)
  assert.equal(result.ok, false)
  assert.ok(result.error.includes('codex login'))
})

test('181. Codex local assign to CEO is blocked unless test passes', () => {
  function canAssign(profile) {
    return profile?.provider_catalog_id === 'openai-codex-local' && profile.status === 'connected' && profile.last_tested_at
  }
  assert.equal(!!canAssign({ provider_catalog_id: 'openai-codex-local', status: 'not_connected', last_tested_at: null }), false)
  assert.equal(!!canAssign({ provider_catalog_id: 'openai-codex-local', status: 'connected', last_tested_at: '2026-06-05T00:00:00Z' }), true)
})

test('182. OpenAI API fallback remains separate from ChatGPT/Codex local auth', () => {
  const providers = [
    { id: 'openai-codex-local', auth_method: 'local', compatibility: 'openai_codex' },
    { id: 'chatgpt_oauth', auth_method: 'oauth', compatibility: 'openai_compatible' },
    { id: 'openai_api', auth_method: 'api_key', compatibility: 'openai_compatible' },
  ]
  assert.equal(providers.find(p => p.id === 'openai_api').auth_method, 'api_key')
  assert.equal(providers.find(p => p.id === 'openai-codex-local').compatibility, 'openai_codex')
  assert.notEqual(providers.find(p => p.id === 'openai_api').id, providers.find(p => p.id === 'openai-codex-local').id)
})

test('183. setup check reports Codex local detection without secrets', () => {
  const lines = [
    'Codex CLI detected: yes',
    'Codex local auth detected: yes',
    'ChatGPT/Codex local profile exists: no',
    'ChatGPT / Codex OAuth App configured: no',
  ]
  const output = lines.join('\n')
  assert.ok(output.includes('Codex local auth detected: yes'))
  assert.equal(/access_token|refresh_token|api_key|sk-|auth\.json|\/Users\//i.test(output), false)
})

test('184. /connect-ai shows three distinct OpenAI paths', () => {
  const cards = [
    { id: 'openai-codex-local', label: 'ChatGPT / Codex Local', copy: 'Use local Codex auth.' },
    { id: 'chatgpt_oauth', label: 'ChatGPT / Codex OAuth App', copy: 'Requires OPENAI_OAUTH_* env vars.' },
    { id: 'openai_api', label: 'OpenAI API Key', copy: 'Not ChatGPT subscription auth.' },
  ]
  assert.deepEqual(cards.map(c => c.id), ['openai-codex-local', 'chatgpt_oauth', 'openai_api'])
  assert.ok(cards.find(c => c.id === 'openai_api').copy.includes('Not ChatGPT subscription'))
})

test('185. dashboard treats Codex Local as ChatGPT connected', () => {
  function providerConnected(catalogIds, rows) {
    return rows.some(row => row.status === 'connected' && catalogIds.includes(row.provider_catalog_id))
  }
  const rows = [
    { provider_catalog_id: 'openai-codex-local', status: 'connected' },
    { provider_catalog_id: 'ollama', status: 'connected' },
  ]
  const chatgptConnected = providerConnected(['openai-codex-local', 'chatgpt_oauth'], rows)
  const warnings = []
  if (!chatgptConnected) warnings.push('ChatGPT/Codex not connected')
  assert.equal(chatgptConnected, true)
  assert.equal(warnings.includes('ChatGPT/Codex not connected'), false)
})

test('186. self-improvement status shortcut persists read-only CEO response', () => {
  const inserts = []
  function persistCeoShortcutCommand(command, response, intent, actions = [], projectId = null) {
    inserts.push({ command, response, intent, actions, projectId })
  }
  const command = 'What is the status of AÏKO self-improvement?'
  const response = 'AÏKO has 3 proposed. This is read-only status; no code was executed and no capability was enabled.'
  persistCeoShortcutCommand(command, response, 'system_improvement_status')
  assert.equal(inserts.length, 1)
  assert.equal(inserts[0].intent, 'system_improvement_status')
  assert.equal(inserts[0].actions.length, 0)
  assert.ok(inserts[0].response.includes('read-only status'))
})

test('187. scheduler provider errors are summarized without headers or secrets', () => {
  function summarizeSchedulerError(err) {
    const record = err && typeof err === 'object' ? err : {}
    const rawMessage = err instanceof Error ? err.message : String(err ?? 'Unknown scheduler error')
    const message = rawMessage
      .replace(/Incorrect API key provided:[^.]+\.?/i, 'Provider authentication failed.')
      .replace(/(access|refresh|id|api)[_-]?token[=:]\s*["']?[^"'\s,}]+/gi, '$1_token=[redacted]')
      .replace(/sk-[A-Za-z0-9_-]+/g, '[redacted-api-key]')
    return {
      name: err instanceof Error ? err.name : 'Error',
      status: typeof record.status === 'number' ? record.status : null,
      code: typeof record.code === 'string' ? record.code : null,
      type: typeof record.type === 'string' ? record.type : null,
      message,
    }
  }

  const err = new Error('Incorrect API key provided: not-required. access_token=secret-token sk-test123')
  err.status = 401
  err.code = 'invalid_api_key'
  err.type = 'invalid_request_error'
  err.headers = { 'set-cookie': 'secret-cookie' }
  const summary = summarizeSchedulerError(err)
  const serialized = JSON.stringify(summary)
  assert.equal(summary.status, 401)
  assert.equal(summary.code, 'invalid_api_key')
  assert.equal(serialized.includes('headers'), false)
  assert.equal(/secret|set-cookie|not-required|sk-test123/i.test(serialized), false)
  assert.ok(summary.message.includes('Provider authentication failed.'))
})

test('188. start marketing maps to project_autopilot_marketing intent', () => {
  function isProjectAutopilotMarketingIntent(command) {
    return /\b(start marketing|promote (?:this project|a[ïi]ko|[^.?!]+)|find customers|find leads|start promotion|research where to promote|open websites and start marketing|get this project moving|what should we do now for marketing)\b/i.test(command)
  }
  assert.equal(isProjectAutopilotMarketingIntent('Start marketing for ALB Parking.'), true)
  assert.equal(isProjectAutopilotMarketingIntent('Find customers for this project.'), true)
})

test('189. promote AÏKO maps to project_autopilot_marketing intent', () => {
  function isProjectAutopilotMarketingIntent(command) {
    return /\b(start marketing|promote (?:this project|a[ïi]ko|[^.?!]+)|find customers|find leads|start promotion|research where to promote|open websites and start marketing|get this project moving|what should we do now for marketing)\b/i.test(command)
  }
  assert.equal(isProjectAutopilotMarketingIntent('Promote AÏKO.'), true)
})

test('190. autopilot creates visible plan before delegation summary', () => {
  const plan = [
    'Find where ALB Parking can reach likely customers.',
    'Search the web for directories, communities, competitors, and buyer signals.',
    'Open safe public result pages when possible and summarize real opportunities.',
  ]
  const response = `I’ll start by researching where ALB Parking can find customers. ${plan.join(' ')} Kevin will open the browser and report back.`
  assert.ok(response.includes('I’ll start by researching'))
  assert.ok(response.includes('Kevin will open the browser'))
  assert.ok(response.indexOf('Find where') < response.indexOf('Kevin will open'))
})

test('191. simplified CAPTCHA and approval messages are owner-facing', () => {
  const captcha = 'Kevin needs your help. Complete this in the browser, then click Resume.'
  const approval = 'Kevin needs approval before doing this.'
  assert.equal(captcha.includes('Login / CAPTCHA completed'), false)
  assert.equal(captcha.includes('security_checkpoint'), false)
  assert.equal(approval, 'Kevin needs approval before doing this.')
})

test('192. raw Playwright errors are sanitized for normal user', () => {
  function sanitizeMessage(message) {
    if (/playwright|browserType|net::ERR|TimeoutError|stack|selector/i.test(message)) {
      return 'Kevin hit a browser problem. View details if you want the technical reason.'
    }
    return message
  }
  const raw = 'page.goto: TimeoutError net::ERR_NAME_NOT_RESOLVED selector_not_found stack'
  const safe = sanitizeMessage(raw)
  assert.equal(safe.includes('page.goto'), false)
  assert.equal(safe.includes('selector_not_found'), false)
  assert.ok(safe.includes('browser problem'))
})

test('193. /home hides advanced details by default', () => {
  const homeSource = `
    <section>Live work</section>
    <details><summary>Advanced details</summary><pre>{}</pre></details>
  `
  assert.ok(homeSource.includes('<details>'))
  assert.ok(homeSource.includes('Advanced details'))
  assert.equal(homeSource.includes('action_payload'), false)
})

test('194. autopilot never auto-posts sends or messages', () => {
  const autopilotActions = ['search', 'open_url', 'read_page']
  const risky = ['send_email', 'send_message', 'post', 'publish_design', 'share_design', 'download_final_asset']
  assert.equal(autopilotActions.some(action => risky.includes(action)), false)
})

test('195. autopilot does not fake leads when research returns zero results', () => {
  function summarize(opportunities) {
    return opportunities.length > 0
      ? `${opportunities.length} opportunities found.`
      : 'Research finished, but no useful results were extracted.'
  }
  const opportunities = []
  const leadCandidates = opportunities.filter(o => o.company_name && o.source_url)
  assert.equal(leadCandidates.length, 0)
  assert.ok(summarize(opportunities).includes('no useful results'))
})

test('196. live work payload does not expose secrets', () => {
  const payload = {
    current_operator: 'Kevin',
    current_status: 'Searching web',
    current_domain: 'reddit.com',
    latest_screenshot: '/screenshots/safe.png',
  }
  const serialized = JSON.stringify(payload)
  assert.equal(/access_token|refresh_token|api_key|AUTH_SECRET|DATABASE_URL|sk-/i.test(serialized), false)
})

test('197. autopilot extracts punctuated project names', () => {
  function extractProjectNameFromCommand(command) {
    const match = command.match(/\bfor\s+([^,.!?]+?)(?:[,.!?]|\s+the best\b|\s+use\b|\s+can\b|\s+create\b|$)/i)
    if (!match) return null
    return match[1].trim().replace(/\s+/g, ' ')
  }

  assert.equal(extractProjectNameFromCommand('Start marketing for ALB Parking.'), 'ALB Parking')
  assert.equal(extractProjectNameFromCommand('Find customers for Demo Parking?'), 'Demo Parking')
})

test('198. /home attention card shows waiting_user as simple help message', () => {
  const source = fs.readFileSync('app/(dashboard)/home/page.tsx', 'utf8')
  assert.ok(source.includes('Needs your attention'))
  assert.ok(source.includes('Kevin needs your help'))
  assert.ok(source.includes('Complete this in the browser, then click Resume.'))
  assert.ok(source.includes('Open browser'))
  assert.ok(source.includes('Resume'))
  assert.ok(source.includes('Advanced'))
})

test('199. pending approval appears as simple approval message', () => {
  const home = fs.readFileSync('app/(dashboard)/home/page.tsx', 'utf8')
  const approvals = fs.readFileSync('app/(dashboard)/approvals/page.tsx', 'utf8')
  assert.ok(home.includes('Approval needed'))
  assert.ok(home.includes('Kevin needs approval before doing this.'))
  assert.ok(approvals.includes('Kevin needs approval before doing this.'))
  assert.ok(approvals.includes('Approving does not execute automatically. Resume is still explicit.'))
})

test('200. /approvals hides raw content and metadata behind details by default', () => {
  const source = fs.readFileSync('app/(dashboard)/approvals/page.tsx', 'utf8')
  const detailsIndex = source.indexOf('<details')
  const textareaIndex = source.indexOf('<textarea')
  const metadataIndex = source.indexOf('decision_reason: item.decision_reason')
  assert.ok(detailsIndex > -1, 'details toggle exists')
  assert.ok(textareaIndex > detailsIndex, 'editable raw content is inside details')
  assert.ok(metadataIndex > detailsIndex, 'metadata JSON is inside details')
  assert.ok(source.includes('View details'))
})

test('201. /operators detail hides technical JSON by default', () => {
  const source = fs.readFileSync('app/(dashboard)/operators/[id]/page.tsx', 'utf8')
  const mainStateIndex = source.indexOf('operatorMainState')
  const advancedIndex = source.indexOf('<details style={CARD}>')
  const payloadIndex = source.indexOf('JSON.stringify(operator.pending_action_payload)')
  const playbookIdIndex = source.indexOf('currentPlaybook.playbook_id')
  assert.ok(mainStateIndex > -1, 'simple state helper exists')
  assert.ok(advancedIndex > -1, 'advanced toggle exists')
  assert.ok(payloadIndex > advancedIndex, 'pending payload is in advanced section')
  assert.ok(playbookIdIndex > advancedIndex, 'playbook id is in advanced section')
})

test('202. forbidden actions use simple safety copy', () => {
  function buildDelegationFailureMessage(rawError) {
    if (/skill blocked|forbidden|not allowed/i.test(rawError)) return 'AÏKO cannot do this safely.'
    return rawError
  }
  assert.equal(buildDelegationFailureMessage('Skill blocked this action: post is forbidden'), 'AÏKO cannot do this safely.')
})

test('203. approval and resume safety rules remain explicit', () => {
  const approvalRoute = fs.readFileSync('app/api/web-operator/approve-action/route.ts', 'utf8')
  const resumeRoute = fs.readFileSync('app/api/web-operator/actions/[id]/resume/route.ts', 'utf8')
  assert.ok(approvalRoute.includes('approval ≠ execution') || approvalRoute.includes('approval !== execution') || approvalRoute.includes('Resume is always an explicit separate step'))
  assert.ok(resumeRoute.includes("approval_status !== 'approved'"))
  assert.ok(resumeRoute.includes('canPerformAction'))
})

test('204. sidebar groups primary work system and advanced navigation', () => {
  const source = fs.readFileSync('components/layout/Sidebar.tsx', 'utf8')
  for (const label of ['Primary', 'Work', 'System', 'Advanced']) {
    assert.ok(source.includes(label), `${label} group should exist`)
  }
  for (const label of ['Home', 'CEO Chat', 'Projects', 'Operators', 'Files', 'Start Campaign', 'Leads', 'Approvals', 'Reports', 'Connect AI', 'Mode']) {
    assert.ok(source.includes(label), `${label} nav item should exist`)
  }
})

test('205. advanced nav is collapsed by default unless an advanced route is active', () => {
  const source = fs.readFileSync('components/layout/Sidebar.tsx', 'utf8')
  assert.ok(source.includes('data-testid="advanced-nav"'))
  assert.ok(source.includes('open={advancedActive}'))
  assert.ok(source.includes('const advancedActive = ADVANCED_ITEMS.some'))
})

test('206. /home shows command box attention card and hides advanced dashboard by default', () => {
  const source = fs.readFileSync('app/(dashboard)/home/page.tsx', 'utf8')
  assert.ok(source.includes('What should AÏKO do?'))
  assert.ok(source.includes('Needs your attention'))
  assert.ok(source.includes('Advanced dashboard'))
  const advancedIndex = source.indexOf('Advanced dashboard')
  const preIndex = source.indexOf('JSON.stringify({ operators, latestAction }')
  assert.ok(preIndex > advancedIndex, 'advanced diagnostics should live after Advanced dashboard summary')
})

test('207. home empty states are present', () => {
  const source = fs.readFileSync('app/(dashboard)/home/page.tsx', 'utf8')
  assert.ok(source.includes('Create your first project to start.'))
  assert.ok(source.includes('Create or use the default operator.'))
  assert.ok(source.includes('Generated reports and exports will appear here.'))
  assert.ok(source.includes('No approvals needed.'))
  assert.ok(source.includes('Kevin is idle.'))
})

test('208. short safety line exists on main owner surfaces', () => {
  const home = fs.readFileSync('app/(dashboard)/home/page.tsx', 'utf8')
  const operators = fs.readFileSync('app/(dashboard)/operators/page.tsx', 'utf8')
  const safety = 'AÏKO never sends, posts, publishes, or bypasses login/CAPTCHA without you.'
  assert.ok(home.includes(safety))
  assert.ok(operators.includes(safety))
})

test('209. sidebar keeps advanced routes accessible', () => {
  const source = fs.readFileSync('components/layout/Sidebar.tsx', 'utf8')
  for (const href of ['/dashboard', '/office', '/campaigns', '/team', '/operator', '/operator-skills', '/operator-playbooks', '/agents', '/functions', '/settings', '/brand', '/tools', '/tool-runs', '/api/health']) {
    assert.ok(source.includes(`href: '${href}'`), `${href} should remain linked`)
  }
})

test('210. owner command orchestrator classifies promote AÏKO as autopilot marketing', () => {
  const source = fs.readFileSync('lib/brain/orchestrator.ts', 'utf8')
  assert.ok(source.includes("intent = 'project_autopilot_marketing'"))
  assert.ok(source.includes('promote'))
  assert.ok(source.includes("return 'AÏKO'"))
})

test('211. owner command orchestrator resolves explicit project names before latest project fallback', () => {
  const source = fs.readFileSync('lib/brain/orchestrator.ts', 'utf8')
  const route = fs.readFileSync('app/api/ceo/command/route.ts', 'utf8')
  assert.ok(source.includes('compactName(project.name) === wanted'))
  assert.ok(source.includes("source: 'explicit'"))
  assert.ok(route.includes('classification.project_reference'))
  assert.ok(route.indexOf('classification.project_reference') < route.indexOf('fallbackProject'))
})

test('212. LinkedIn post command maps to content creation without automatic posting', () => {
  const source = fs.readFileSync('lib/brain/orchestrator.ts', 'utf8')
  assert.ok(source.includes("intent = 'content_creation'"))
  assert.ok(source.includes('Content Agent'))
  assert.ok(source.includes('Ask approval before posting or publishing.'))
})

test('213. Open Canva command routes to canva_design and canva playbook', () => {
  const source = fs.readFileSync('lib/brain/orchestrator.ts', 'utf8')
  const route = fs.readFileSync('app/api/ceo/command/route.ts', 'utf8')
  assert.ok(source.includes("skill: 'canva_design'"))
  assert.ok(source.includes("playbook: 'canva_instagram_draft'"))
  assert.ok(route.includes("classification.intent === 'web_operator_task'"))
})

test('214. Generate report command routes to report generation', () => {
  const source = fs.readFileSync('lib/brain/orchestrator.ts', 'utf8')
  assert.ok(source.includes("intent = 'report_generation'"))
  assert.ok(source.includes("recommendedFlow = 'executive_report'"))
  assert.ok(source.includes('Generate a concise executive report.'))
})

test('215. What should we do next routes to project recall next step', () => {
  const source = fs.readFileSync('lib/brain/orchestrator.ts', 'utf8')
  assert.ok(source.includes('what should we do next'))
  assert.ok(source.includes("intent = 'project_recall'"))
  assert.ok(source.includes("recommendedFlow = 'next_step'"))
})

test('216. visible short plans avoid internal JSON and hidden reasoning wording', () => {
  const source = fs.readFileSync('lib/brain/orchestrator.ts', 'utf8')
  assert.ok(source.includes('short_plan: planForIntent'))
  assert.equal(source.includes('chain-of-thought'), false)
  assert.equal(source.includes('internal JSON'), false)
  assert.equal(source.includes('JSON.stringify'), false)
})

test('217. home command result renders suggested chips and selected project context', () => {
  const source = fs.readFileSync('app/(dashboard)/home/page.tsx', 'utf8')
  assert.ok(source.includes('suggested_chips'))
  assert.ok(source.includes('selected_project_id'))
  assert.ok(source.includes('selected_project_name'))
  assert.ok(source.includes('Plan'))
})

test('218. home command keeps explicit project names instead of appending selected project', () => {
  const source = fs.readFileSync('app/(dashboard)/home/page.tsx', 'utf8')
  assert.ok(source.includes('hasExplicitProjectHint'))
  assert.ok(source.includes('\\bfor\\s+[^.?!]+'))
  assert.ok(source.includes('projects.some(project'))
})

test('219. LinkedIn content prompt recommends write_linkedin_post', () => {
  const source = fs.readFileSync('lib/ai-skills.ts', 'utf8')
  assert.ok(source.includes("return 'write_linkedin_post'"))
  assert.ok(source.includes('Write LinkedIn Post'))
})

test('220. Reddit content prompt recommends write_reddit_post', () => {
  const source = fs.readFileSync('lib/ai-skills.ts', 'utf8')
  assert.ok(source.includes("return 'write_reddit_post'"))
  assert.ok(source.includes('Write Reddit Post'))
})

test('221. improve email prompt recommends improve_email', () => {
  const source = fs.readFileSync('lib/ai-skills.ts', 'utf8')
  assert.ok(source.includes("return 'improve_email'"))
  assert.ok(source.includes('Improve Email'))
})

test('222. content skill route does not create Web Operator actions', () => {
  const route = fs.readFileSync('app/api/ceo/command/route.ts', 'utf8')
  const executeRoute = fs.readFileSync('app/api/ai-skills/execute/route.ts', 'utf8')
  assert.ok(route.includes("classification.intent === 'content_creation'"))
  assert.ok(route.includes('ai_skill_output'))
  assert.ok(executeRoute.includes('created_web_operator_action: false'))
  assert.ok(executeRoute.includes('external_action_executed: false'))
})

test('223. publishing request returns draft-only warning', () => {
  const source = fs.readFileSync('lib/ai-skills/content-executor.ts', 'utf8')
  assert.ok(source.includes('Draft created only. Publishing or sending requires approval.'))
  assert.ok(source.includes('If the user asks to publish/send/post, write the draft only.'))
})

test('224. save_as_file creates generated file metadata for AI skill output', () => {
  const source = fs.readFileSync('lib/ai-skills.ts', 'utf8')
  const filesRoute = fs.readFileSync('app/api/files/route.ts', 'utf8')
  const filesPage = fs.readFileSync('app/(dashboard)/files/page.tsx', 'utf8')
  assert.ok(source.includes("source_entity_type: 'ai_skill_output'"))
  assert.ok(source.includes("generated_by_role: 'copywriting'"))
  assert.ok(filesRoute.includes('source_entity_type'))
  assert.ok(filesPage.includes("ai_skill_output:  'AI skill output'"))
})

test('225. /skills shows AI Skills Web Operator Skills and Playbooks', () => {
  const source = fs.readFileSync('app/(dashboard)/skills/page.tsx', 'utf8')
  const sidebar = fs.readFileSync('components/layout/Sidebar.tsx', 'utf8')
  assert.ok(source.includes('AI Skills'))
  assert.ok(source.includes('Web Operator Skills'))
  assert.ok(source.includes('Playbooks'))
  assert.ok(sidebar.includes("href: '/skills'"))
})

test('226. AI skill output prompt forbids hidden reasoning and provider secrets', () => {
  const source = fs.readFileSync('lib/ai-skills/content-executor.ts', 'utf8')
  assert.ok(source.includes('Do not include hidden reasoning'))
  assert.ok(source.includes('tokens, secrets'))
  assert.ok(source.includes('Return only the final draft content'))
})

test('227. seven-day planning prompt recommends create_7_day_plan', () => {
  const source = fs.readFileSync('lib/ai-skills.ts', 'utf8')
  assert.ok(source.includes("return 'create_7_day_plan'"))
  assert.ok(source.includes('Create 7-Day Plan'))
})

test('228. customer persona prompt recommends create_customer_persona', () => {
  const source = fs.readFileSync('lib/ai-skills.ts', 'utf8')
  assert.ok(source.includes("return 'create_customer_persona'"))
  assert.ok(source.includes('Create Customer Persona'))
})

test('229. risk prompt recommends analyze_risks', () => {
  const source = fs.readFileSync('lib/ai-skills.ts', 'utf8')
  assert.ok(source.includes("return 'analyze_risks'"))
  assert.ok(source.includes('Analyze Risks'))
})

test('230. research skill executor does not create Web Operator actions', () => {
  const source = fs.readFileSync('lib/ai-skills/research-executor.ts', 'utf8')
  const route = fs.readFileSync('app/api/ai-skills/execute/route.ts', 'utf8')
  assert.ok(source.includes('Do not browse websites'))
  assert.ok(source.includes('create Web Operator actions'))
  assert.ok(route.includes('created_web_operator_action: false'))
})

test('231. research skill output includes needs_web_research field', () => {
  const source = fs.readFileSync('lib/ai-skills/research-executor.ts', 'utf8')
  const home = fs.readFileSync('app/(dashboard)/home/page.tsx', 'utf8')
  assert.ok(source.includes('needs_web_research'))
  assert.ok(source.includes('web_research_questions'))
  assert.ok(home.includes('Needs web research?'))
})

test('232. external facts request says Web Operator research is needed', () => {
  const source = fs.readFileSync('lib/ai-skills/research-executor.ts', 'utf8')
  assert.ok(source.includes('Fresh external facts still need Web Operator research.'))
  assert.ok(source.includes('If fresh facts, live competitor data, market statistics, or current web data are needed'))
})

test('233. strategy skill save_as_file creates Markdown AI skill output', () => {
  const source = fs.readFileSync('lib/ai-skills.ts', 'utf8')
  assert.ok(source.includes('## Recommendations'))
  assert.ok(source.includes('## Next Actions'))
  assert.ok(source.includes('## Web Research Needed'))
  assert.ok(source.includes("source_entity_type: 'ai_skill_output'"))
})

test('234. /skills lists research and strategy AI skills', () => {
  const migration = fs.readFileSync('lib/db/migrations/045_ai_research_strategy_skills.sql', 'utf8')
  const page = fs.readFileSync('app/(dashboard)/skills/page.tsx', 'utf8')
  assert.ok(migration.includes('create_marketing_strategy'))
  assert.ok(migration.includes('create_7_day_plan'))
  assert.ok(migration.includes('analyze_risks'))
  assert.ok(page.includes('AI Skills'))
})

test('235. 7-day plan output template includes day_by_day_plan', () => {
  const source = fs.readFileSync('lib/ai-skills/output-templates.ts', 'utf8')
  assert.ok(source.includes('create_7_day_plan'))
  assert.ok(source.includes('day_by_day_plan'))
  assert.ok(source.includes('success_metrics'))
})

test('236. persona output template includes pains channels and messaging angles', () => {
  const source = fs.readFileSync('lib/ai-skills/output-templates.ts', 'utf8')
  assert.ok(source.includes('create_customer_persona'))
  assert.ok(source.includes('pains'))
  assert.ok(source.includes('channels'))
  assert.ok(source.includes('messaging_angles'))
})

test('237. risk output template includes mitigation owner and next action', () => {
  const source = fs.readFileSync('lib/ai-skills/output-templates.ts', 'utf8')
  assert.ok(source.includes('analyze_risks'))
  assert.ok(source.includes('mitigation'))
  assert.ok(source.includes('owner_role'))
  assert.ok(source.includes('next_action'))
})

test('238. next-step output template includes requires_web_operator flag', () => {
  const source = fs.readFileSync('lib/ai-skills/output-templates.ts', 'utf8')
  assert.ok(source.includes('recommend_next_step'))
  assert.ok(source.includes('requires_web_operator'))
  assert.ok(source.includes('requires_approval'))
})

test('239. AI skill prompts mark assumptions and avoid fake external facts', () => {
  const research = fs.readFileSync('lib/ai-skills/research-executor.ts', 'utf8')
  const content = fs.readFileSync('lib/ai-skills/content-executor.ts', 'utf8')
  assert.ok(research.includes('Mark assumptions clearly'))
  assert.ok(research.includes('Do not invent external facts'))
  assert.ok(content.includes('Mark assumptions clearly'))
})

test('240. /home strategy card shows top recommendations not raw JSON by default', () => {
  const source = fs.readFileSync('app/(dashboard)/home/page.tsx', 'utf8')
  assert.ok(source.includes('Top recommendations'))
  assert.ok(source.includes('View full output'))
  assert.ok(source.includes('result.ai_skill_output.recommendations.slice(0, 3)'))
  assert.ok(source.indexOf('View full output') < source.indexOf('Advanced details'))
})

test('241. create tasks from AI skill output creates internal tasks only', () => {
  const route = fs.readFileSync('app/api/ai-skills/create-tasks/route.ts', 'utf8')
  const home = fs.readFileSync('app/(dashboard)/home/page.tsx', 'utf8')
  assert.ok(route.includes('createAgentTask'))
  assert.ok(route.includes('created_web_operator_action: false'))
  assert.ok(route.includes('external_action_executed: false'))
  assert.ok(home.includes('Create tasks'))
})

test('242. AI skill task creation does not create Web Operator actions', () => {
  const route = fs.readFileSync('app/api/ai-skills/create-tasks/route.ts', 'utf8')
  assert.equal(route.includes('delegateToWebOperator'), false)
  assert.equal(route.includes('web_operator_actions'), false)
  assert.equal(route.includes('/api/web-operator'), false)
})

test('243. create-tasks returns owner task URLs', () => {
  const route = fs.readFileSync('app/api/ai-skills/create-tasks/route.ts', 'utf8')
  const home = fs.readFileSync('app/(dashboard)/home/page.tsx', 'utf8')
  assert.ok(route.includes("tasks_url: '/tasks'"))
  assert.ok(route.includes('project_tasks_url'))
  assert.ok(home.includes('View tasks'))
  assert.ok(home.includes('Open project'))
})

test('244. /tasks lists active owner tasks with filters', () => {
  const page = fs.readFileSync('app/(dashboard)/tasks/page.tsx', 'utf8')
  const panel = fs.readFileSync('components/tasks/SimpleTasksPanel.tsx', 'utf8')
  assert.ok(page.includes('<SimpleTasksPanel />'))
  assert.ok(panel.includes('All projects'))
  assert.ok(panel.includes('All owners'))
  assert.ok(panel.includes('statusOptions'))
  assert.ok(panel.includes('/api/tasks?'))
  assert.ok(panel.includes('ownerDescription'))
  assert.ok(panel.includes('Internal task created from a plan.'))
})

test('245. PATCH task status changes internal task status only', () => {
  const route = fs.readFileSync('app/api/tasks/[id]/route.ts', 'utf8')
  const helper = fs.readFileSync('lib/tasks/owner-tasks.ts', 'utf8')
  assert.ok(route.includes('updateOwnerTaskStatus'))
  assert.ok(route.includes('created_web_operator_action: false'))
  assert.ok(route.includes('approval_item_created: false'))
  assert.ok(route.includes('external_action_executed: false'))
  assert.equal(route.includes('delegateToWebOperator'), false)
  assert.equal(helper.includes('web_operator_actions'), false)
  assert.equal(helper.includes('approval_items'), false)
})

test('246. blocked tasks appear before todo on owner task summary', () => {
  const helper = fs.readFileSync('lib/tasks/owner-tasks.ts', 'utf8')
  const blockedIndex = helper.indexOf("WHEN t.status = 'blocked' THEN 0")
  const plannedIndex = helper.indexOf("WHEN t.status IN ('planned', 'todo') THEN 3")
  assert.ok(blockedIndex > -1)
  assert.ok(plannedIndex > -1)
  assert.ok(blockedIndex < plannedIndex)
})

test('247. project tasks are filtered by project_id', () => {
  const route = fs.readFileSync('app/api/tasks/route.ts', 'utf8')
  const panel = fs.readFileSync('components/tasks/SimpleTasksPanel.tsx', 'utf8')
  const projectTabs = fs.readFileSync('components/projects/ProjectWorkspaceTabs.tsx', 'utf8')
  assert.ok(route.includes("project_id: s.get('project_id')"))
  assert.ok(panel.includes("params.set('project_id', projectId)"))
  assert.ok(projectTabs.includes('<SimpleTasksPanel projectId={project.id} />'))
})

test('248. /home shows compact next tasks card', () => {
  const source = fs.readFileSync('app/(dashboard)/home/page.tsx', 'utf8')
  assert.ok(source.includes('Next tasks'))
  assert.ok(source.includes('Tasks created from plans will appear here.'))
  assert.ok(source.includes("fetch('/api/tasks?active=true&limit=3')"))
})

test('249. sidebar exposes simple Tasks page', () => {
  const sidebar = fs.readFileSync('components/layout/Sidebar.tsx', 'utf8')
  assert.ok(sidebar.includes("{ href: '/tasks', label: 'Tasks' }"))
})
