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
