'use client'

import React, { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { AdvancedDisclosure } from '@/components/ui/AdvancedDisclosure'
import { MinimalCard } from '@/components/ui/MinimalCard'
import { PageShell } from '@/components/ui/PageShell'
import { PrimaryAction } from '@/components/ui/PrimaryAction'
import { StatusPill } from '@/components/ui/StatusPill'
import { CATALOG, type ProviderCatalogEntry } from '@/lib/ai/provider-catalog'

type ProfileStatus = 'connected' | 'not_configured' | 'not_connected' | 'needs_reauth' | 'error' | string

type AuthProfile = {
  id: string
  name?: string
  display_name?: string | null
  provider_catalog_id?: string | null
  type: string
  status: ProfileStatus
  base_url: string | null
  model: string | null
  auth_method?: string | null
  auth_type?: string | null
  compatibility?: string | null
  account_email?: string | null
  last_tested_at: string | null
  last_error: string | null
}

type Diagnostics = {
  can_ceo_think: boolean
  resolved_ceo_profile: AuthProfile | null
  chatgpt_oauth: { configured: boolean; missing_env: string[]; client_secret_set: boolean }
  chatgpt_codex_local: {
    provider: 'openai-codex-local'
    codex_cli_detected: boolean
    auth_file_detected: boolean
    auth_profile_exists: boolean
    connected: boolean
    needs_login: boolean
    account_email: string | null
    status: string
    can_import: boolean
    can_test: boolean
    instructions: string
    last_error: string | null
  }
  claude_code: { cli_detected: boolean; token_env_detected: boolean; local_auth_detected: boolean; available: boolean; detail: string }
  claude_oauth: { configured: boolean; missing_env: string[]; client_secret_set: boolean }
  api_fallbacks: Record<string, boolean>
  any_api_fallback_connected: boolean
}

type RoleInfo = Record<string, string | null>

const MANAGED_CATALOG_IDS = [
  'openai-codex-local',
  'chatgpt_oauth',
  'openai_api',
  'anthropic_api',
  'claude-code-local',
  'ollama',
  'openrouter',
  'custom_openai',
  'custom_anthropic',
]

const INPUT: React.CSSProperties = {
  width: '100%',
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  padding: '9px 11px',
  fontSize: 13,
  color: '#0f172a',
  boxSizing: 'border-box',
}

const LABEL: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 10,
}

function catalogEntry(profile: AuthProfile): ProviderCatalogEntry | undefined {
  return CATALOG.find(c => c.id === profile.provider_catalog_id || c.id === profile.type)
}

function statusStyle(status: ProfileStatus): React.CSSProperties {
  const color =
    status === 'connected' ? ['#dcfce7', '#166534', '#86efac'] :
    status === 'needs_reauth' ? ['#fef3c7', '#92400e', '#fde68a'] :
    status === 'error' ? ['#fee2e2', '#991b1b', '#fecaca'] :
    status === 'not_configured' ? ['#f1f5f9', '#64748b', '#e2e8f0'] :
    ['#f8fafc', '#475569', '#e2e8f0']
  return {
    display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '3px 8px',
    background: color[0], color: color[1], border: `1px solid ${color[2]}`, fontSize: 11, fontWeight: 700,
  }
}

function methodLabel(profile: AuthProfile): string {
  return profile.auth_method ?? profile.auth_type ?? 'none'
}

function profileName(profile: AuthProfile): string {
  return profile.display_name ?? profile.name ?? catalogEntry(profile)?.display_name ?? profile.type
}

export default function ConnectAIPage() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const [profiles, setProfiles] = useState<AuthProfile[]>([])
  const [roles, setRoles] = useState<RoleInfo>({})
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null)
  const [brainHealth, setBrainHealth] = useState<{ usable: boolean; runtime_available: boolean; status: string; owner_message: string; fix_action: string } | null>(null)
  const [browserSetup, setBrowserSetup] = useState<{ mode: string; chrome_found: boolean; ready: boolean; owner_message: string; setup_instructions: string } | null>(null)
  const [configuring, setConfiguring] = useState<ProviderCatalogEntry | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [providersRes, rolesRes, diagRes, provDiagRes, browserRes] = await Promise.all([
      fetch('/api/providers').then(r => r.json()),
      fetch('/api/providers/roles').then(r => r.json()),
      fetch('/api/auth-profiles/diagnostics').then(r => r.json()).catch(() => null),
      fetch('/api/providers/diagnostics').then(r => r.json()).catch(() => null),
      fetch('/api/browser/setup').then(r => r.json()).catch(() => null),
    ])
    setProfiles(providersRes.providers ?? [])
    setRoles(rolesRes.roles ?? {})
    setDiagnostics(diagRes ?? null)
    if (provDiagRes?.brain_health) setBrainHealth(provDiagRes.brain_health)
    if (browserRes) setBrowserSetup(browserRes)
  }, [])

  useEffect(() => { load() }, [load])

  const ceoProfile = useMemo(() => {
    const ceoId = roles.ceo
    return profiles.find(p => p.id === ceoId) ?? diagnostics?.resolved_ceo_profile ?? null
  }, [diagnostics?.resolved_ceo_profile, profiles, roles.ceo])

  async function testProfile(profile: AuthProfile) {
    setBusy(`test:${profile.id}`)
    setMessage(null)
    try {
      const res = await fetch(`/api/providers/${profile.id}/test`, { method: 'POST' })
      const data = await res.json()
      setMessage(data.ok ? `Test passed for ${profileName(profile)}.` : `Test failed: ${data.error}`)
      await load()
    } finally {
      setBusy(null)
    }
  }

  async function assignToCEO(profile: AuthProfile) {
    setBusy(`assign:${profile.id}`)
    setMessage(null)
    try {
      const res = await fetch('/api/providers/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'ceo', provider_id: profile.id }),
      })
      if (!res.ok) throw new Error('Could not assign profile')
      setMessage(`${profileName(profile)} assigned to CEO.`)
      await load()
    } finally {
      setBusy(null)
    }
  }

  async function codexLocalAction(action: 'detect' | 'import' | 'test' | 'assign') {
    setBusy(`codex:${action}`)
    setMessage(null)
    try {
      if (action === 'detect') {
        await load()
        setMessage('Codex local auth status refreshed.')
        return
      }
      const route =
        action === 'import' ? '/api/auth-profiles/openai-codex/local/import' :
        action === 'test' ? '/api/auth-profiles/openai-codex/local/test' :
        '/api/auth-profiles/openai-codex/local/assign-ceo'
      const res = await fetch(route, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Codex local action failed.')
      setMessage(
        action === 'import' ? 'Codex local auth imported. Run Test before assigning it to CEO.' :
        action === 'test' ? 'Codex local auth test passed.' :
        'ChatGPT / Codex Local assigned to CEO.',
      )
      await load()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Codex local action failed.')
      await load()
    } finally {
      setBusy(null)
    }
  }

  async function deleteProfile(profile: AuthProfile) {
    if (!confirm(`Delete ${profileName(profile)}?`)) return
    setBusy(`delete:${profile.id}`)
    setMessage(null)
    try {
      const res = await fetch(`/api/providers/${profile.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Could not delete profile')
      setMessage(`${profileName(profile)} deleted.`)
      await load()
    } finally {
      setBusy(null)
    }
  }

  const addCards = MANAGED_CATALOG_IDS.map(id => CATALOG.find(c => c.id === id)).filter(Boolean) as ProviderCatalogEntry[]
  const oauthSuccess = searchParams.get('oauth_success')
  const oauthError = searchParams.get('oauth_error')

  return (
    <PageShell
      title="Connect AI"
      subtitle="Choose the real brain AÏKO should use. Provider states stay honest."
      maxWidth={1040}
    >
      <AccountBanner sessionUser={session?.user} />

      {oauthSuccess && <Notice ok text={`${oauthSuccess === 'chatgpt' ? 'ChatGPT / Codex' : 'Claude'} OAuth connected and saved as an auth profile.`} />}
      {oauthError && <Notice text={`OAuth failed: ${decodeURIComponent(oauthError)}`} />}
      {message && <Notice ok={['passed', 'assigned', 'deleted', 'imported', 'refreshed'].some(token => message.includes(token))} text={message} />}

      <CurrentBrain profile={ceoProfile} diagnostics={diagnostics} brainHealth={brainHealth} onTest={testProfile} />

      <BrowserModeCard setup={browserSetup} />

      <section style={{ marginTop: 22 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
          <SimpleConnectionCard
            title="ChatGPT / Codex Local"
            status={diagnostics?.chatgpt_codex_local.connected ? 'Connected' : diagnostics?.chatgpt_codex_local.auth_file_detected ? 'Detected' : 'Not detected'}
            tone={diagnostics?.chatgpt_codex_local.connected ? 'green' : diagnostics?.chatgpt_codex_local.auth_file_detected ? 'amber' : 'gray'}
            description="Use your local Codex login."
            action={
              diagnostics?.chatgpt_codex_local.connected
                ? <PrimaryAction onClick={() => codexLocalAction('assign')} disabled={busy === 'codex:assign'}>Assign CEO</PrimaryAction>
                : <PrimaryAction onClick={() => codexLocalAction(diagnostics?.chatgpt_codex_local.auth_file_detected ? 'import' : 'detect')} disabled={busy?.startsWith('codex:')}>Detect</PrimaryAction>
            }
          />
          <SimpleConnectionCard
            title="Ollama Local"
            status={profiles.some(p => p.provider_catalog_id === 'ollama' && p.status === 'connected') ? 'Connected' : 'Local fallback'}
            tone={profiles.some(p => p.provider_catalog_id === 'ollama' && p.status === 'connected') ? 'green' : 'gray'}
            description="Run models on this machine."
            action={<PrimaryAction onClick={() => setConfiguring(CATALOG.find(c => c.id === 'ollama') ?? null)} variant="secondary">Set up</PrimaryAction>}
          />
          <SimpleConnectionCard
            title="API Key"
            status={profiles.some(p => ['openai_api', 'anthropic_api'].includes(p.provider_catalog_id ?? '') && p.status === 'connected') ? 'Connected' : 'Optional'}
            tone={profiles.some(p => ['openai_api', 'anthropic_api'].includes(p.provider_catalog_id ?? '') && p.status === 'connected') ? 'green' : 'gray'}
            description="OpenAI or Anthropic Platform keys."
            action={<PrimaryAction onClick={() => setConfiguring(CATALOG.find(c => c.id === 'openai_api') ?? null)} variant="secondary">Add key</PrimaryAction>}
          />
        </div>
      </section>

      <AdvancedDisclosure title="Advanced provider setup">
        <section style={{ marginTop: 28 }}>
          <div style={LABEL}>Auth profiles</div>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' }}>
          {profiles.length === 0 ? (
            <div style={{ padding: 22, color: '#64748b', fontSize: 13 }}>
              No saved auth profiles yet. Add Ollama, OpenAI API, Anthropic API, OpenRouter, or configure ChatGPT/Codex OAuth below.
            </div>
          ) : profiles.map(profile => (
            <ProfileRow
              key={profile.id}
              profile={profile}
              assignedRoles={Object.entries(roles).filter(([, id]) => id === profile.id).map(([role]) => role)}
              isCEO={roles.ceo === profile.id}
              busy={busy}
              onTest={testProfile}
              onAssign={assignToCEO}
              onDelete={deleteProfile}
            />
          ))}
          </div>
        </section>

        <section style={{ marginTop: 32 }}>
          <div style={LABEL}>Add auth profile</div>
          <p style={{ margin: '0 0 14px', color: '#6b7280', fontSize: 13 }}>
            Advanced OAuth app setup is not configured unless the required environment variables are present.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {addCards.map(entry => (
            <AddCard
              key={entry.id}
              entry={entry}
              diagnostics={diagnostics}
              onConfigure={() => setConfiguring(entry)}
              busy={busy}
              onCodexLocalAction={codexLocalAction}
            />
          ))}
          </div>
        </section>

        <DiagnosticsPanel diagnostics={diagnostics} profiles={profiles} />
      </AdvancedDisclosure>

      {configuring && (
        <SetupDrawer
          entry={configuring}
          diagnostics={diagnostics}
          onClose={() => setConfiguring(null)}
          onSaved={async () => { setConfiguring(null); await load() }}
        />
      )}
    </PageShell>
  )
}

function SimpleConnectionCard({ title, status, tone, description, action }: {
  title: string
  status: string
  tone: 'green' | 'amber' | 'red' | 'gray' | 'blue'
  description: string
  action: ReactNode
}) {
  return (
    <MinimalCard title={title} action={<StatusPill tone={tone}>{status}</StatusPill>}>
      <p style={{ margin: 0, color: '#6b7280', fontSize: 13, lineHeight: 1.5, minHeight: 40 }}>{description}</p>
      <div style={{ marginTop: 18 }}>{action}</div>
    </MinimalCard>
  )
}

function AccountBanner({ sessionUser }: { sessionUser?: { name?: string | null; email?: string | null } }) {
  if (sessionUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 16px', marginBottom: 26, background: '#f8fafc' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{sessionUser.name ?? sessionUser.email}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Google login identifies your AÏKO user only; it is not provider auth.</div>
        </div>
        <button onClick={() => signOut({ callbackUrl: '/login' })} style={{ border: '1px solid #e2e8f0', background: '#fff', borderRadius: 8, padding: '7px 12px', fontSize: 12 }}>Sign out</button>
      </div>
    )
  }
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 16px', marginBottom: 26, background: '#f8fafc', color: '#64748b', fontSize: 13 }}>
      Local single-user mode. Profiles are stored globally. Google login is optional AÏKO identity only.
    </div>
  )
}

function Notice({ text, ok = false }: { text: string; ok?: boolean }) {
  return <div style={{ marginBottom: 16, padding: '10px 13px', borderRadius: 9, border: `1px solid ${ok ? '#bbf7d0' : '#fecaca'}`, background: ok ? '#f0fdf4' : '#fef2f2', color: ok ? '#166534' : '#991b1b', fontSize: 13 }}>{text}</div>
}

function CurrentBrain({ profile, diagnostics, brainHealth, onTest }: {
  profile: AuthProfile | null
  diagnostics: Diagnostics | null
  brainHealth: { usable: boolean; runtime_available: boolean; status: string; owner_message: string; fix_action: string } | null
  onTest: (p: AuthProfile) => void
}) {
  const runtimeBadge = brainHealth
    ? brainHealth.usable
      ? { label: 'Usable', bg: '#dcfce7', color: '#166534', border: '#86efac' }
      : brainHealth.status === 'runtime_unavailable'
        ? { label: 'Runtime unavailable', bg: '#fee2e2', color: '#991b1b', border: '#fecaca' }
        : brainHealth.status === 'needs_reauth'
          ? { label: 'Needs re-auth', bg: '#fef3c7', color: '#92400e', border: '#fde68a' }
          : brainHealth.status === 'not_configured'
            ? { label: 'Not configured', bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' }
            : { label: 'Unavailable', bg: '#fee2e2', color: '#991b1b', border: '#fecaca' }
    : null

  return (
    <section>
      <div style={LABEL}>Section 1 · Current CEO brain</div>
      <div style={{ background: '#0f172a', color: '#fff', borderRadius: 18, padding: 22, display: 'grid', gridTemplateColumns: '1fr auto', gap: 18, alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
              {profile ? profileName(profile) : 'No CEO auth profile assigned'}
            </span>
            {runtimeBadge && (
              <span data-testid="brain-runtime-badge" style={{ fontSize: 11, fontWeight: 800, borderRadius: 999, padding: '3px 9px', background: runtimeBadge.bg, color: runtimeBadge.color, border: `1px solid ${runtimeBadge.border}` }}>
                {runtimeBadge.label}
              </span>
            )}
          </div>
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8, color: '#cbd5e1', fontSize: 12 }}>
            <span>Provider: {profile?.provider_catalog_id ?? profile?.type ?? '—'}</span>
            <span>Auth: {profile ? methodLabel(profile) : '—'}</span>
            <span>Model: {profile?.model ?? '—'}</span>
            <span>Status: {profile?.status ?? (diagnostics?.can_ceo_think ? 'connected' : 'not_connected')}</span>
          </div>
          {brainHealth && !brainHealth.usable && (
            <div data-testid="brain-fix-action" style={{ marginTop: 10, color: '#fca5a5', fontSize: 12 }}>
              {brainHealth.owner_message}{brainHealth.fix_action ? ` ${brainHealth.fix_action}` : ''}
            </div>
          )}
          {profile?.last_error && !brainHealth && <div style={{ marginTop: 10, color: '#fecaca', fontSize: 12 }}>{profile.last_error}</div>}
        </div>
        {profile && <button onClick={() => onTest(profile)} style={{ padding: '10px 14px', borderRadius: 9, border: '1px solid #334155', background: '#fff', color: '#0f172a', fontWeight: 700 }}>Test CEO profile</button>}
      </div>
    </section>
  )
}

function ProfileRow({ profile, assignedRoles, isCEO, busy, onTest, onAssign, onDelete }: {
  profile: AuthProfile
  assignedRoles: string[]
  isCEO: boolean
  busy: string | null
  onTest: (p: AuthProfile) => void
  onAssign: (p: AuthProfile) => void
  onDelete: (p: AuthProfile) => void
}) {
  const entry = catalogEntry(profile)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1.4fr) repeat(5, minmax(110px, 1fr)) 260px', gap: 12, alignItems: 'center', padding: '15px 16px', borderTop: '1px solid #f1f5f9' }}>
      <div>
        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 14 }}>{entry?.icon} {profileName(profile)}</div>
        <div style={{ color: '#94a3b8', fontSize: 11 }}>{profile.provider_catalog_id ?? profile.type}</div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 800, color: '#334155', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 999, padding: '3px 8px', width: 'fit-content' }}>{methodLabel(profile)}</span>
      <span style={statusStyle(profile.status)}>{profile.status}</span>
      <div style={{ fontSize: 12, color: '#334155', fontFamily: 'DM Mono, monospace' }}>{profile.model ?? '—'}</div>
      <div style={{ fontSize: 12, color: '#64748b' }}>{profile.account_email ?? '—'}</div>
      <div style={{ fontSize: 12, color: '#64748b' }}>{profile.last_tested_at ? new Date(profile.last_tested_at).toLocaleString() : 'Never tested'}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {assignedRoles.length > 0 && <span style={{ fontSize: 11, color: '#64748b' }}>Roles: {assignedRoles.join(', ')}</span>}
        <button onClick={() => onTest(profile)} disabled={busy === `test:${profile.id}`} style={smallButton('#0f172a', '#fff')}>{busy === `test:${profile.id}` ? 'Testing…' : 'Test'}</button>
        <button onClick={() => onAssign(profile)} disabled={isCEO || busy === `assign:${profile.id}`} style={smallButton('#fff', '#0f172a')}>{isCEO ? 'CEO' : 'Assign CEO'}</button>
        <button onClick={() => onDelete(profile)} disabled={busy === `delete:${profile.id}`} style={smallButton('#fff', '#dc2626')}>Delete</button>
      </div>
      {profile.last_error && <div style={{ gridColumn: '1 / -1', color: '#b91c1c', background: '#fef2f2', borderRadius: 8, padding: 8, fontSize: 12 }}>{profile.last_error}</div>}
    </div>
  )
}

function smallButton(bg: string, color: string): React.CSSProperties {
  return { background: bg, color, border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }
}

function AddCard({ entry, diagnostics, onConfigure, busy, onCodexLocalAction }: {
  entry: ProviderCatalogEntry
  diagnostics: Diagnostics | null
  onConfigure: () => void
  busy: string | null
  onCodexLocalAction: (action: 'detect' | 'import' | 'test' | 'assign') => void
}) {
  const isCodexLocal = entry.id === 'openai-codex-local'
  const isChatGPT = entry.id === 'chatgpt_oauth'
  const isClaudeCode = entry.id === 'claude-code-local'
  const codex = diagnostics?.chatgpt_codex_local
  const configured = isCodexLocal ? !!codex?.connected : isChatGPT ? !!diagnostics?.chatgpt_oauth.configured : isClaudeCode ? !!diagnostics?.claude_code.available : true
  const missing = isChatGPT ? diagnostics?.chatgpt_oauth.missing_env ?? [] : []
  const requires = isCodexLocal ? 'Codex CLI/app login on this machine; no OPENAI_OAUTH_* env vars required' :
    isChatGPT ? 'OPENAI_OAUTH_CLIENT_ID, OPENAI_OAUTH_AUTH_URL, OPENAI_OAUTH_TOKEN_URL, OPENAI_OAUTH_REDIRECT_URI' :
    isClaudeCode ? 'claude CLI or CLAUDE_CODE_OAUTH_TOKEN on the AÏKO server' :
    entry.requires_api_key ? 'API key and a model name' :
    entry.requires_base_url ? 'Base URL and model name' : 'Model name'
  const fallback = isCodexLocal ? 'If unavailable, use OpenAI API key or Ollama.' :
    isChatGPT ? 'Advanced OAuth-app path; use Codex Local or OpenAI API key if env vars are missing.' :
    isClaudeCode ? 'Use Anthropic API key instead.' : 'Can be assigned to CEO after a successful test.'
  const codexLabel = codex?.connected ? 'Connected' :
    codex?.auth_file_detected ? 'Codex auth detected' :
    codex?.codex_cli_detected ? 'CLI detected, not logged in' :
    'Not detected'

  if (isCodexLocal) {
    return (
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 15, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{entry.icon} {entry.display_name}</div>
          <span style={statusStyle(codex?.connected ? 'connected' : codex?.auth_file_detected ? 'needs_reauth' : 'not_configured')}>{codexLabel}</span>
        </div>
        <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6, minHeight: 58 }}>
          Use your ChatGPT account through local Codex auth, similar to OpenClaw. First sign in with Codex locally, then import and test here.
        </p>
        <InfoLine label="Uses" value="local · openai_codex" />
        <InfoLine label="Requires" value={requires} />
        <InfoLine label="Status" value={`CLI: ${codex?.codex_cli_detected ? 'yes' : 'no'} · Auth file: ${codex?.auth_file_detected ? 'yes' : 'no'} · Profile: ${codex?.auth_profile_exists ? 'yes' : 'no'}`} />
        {codex?.account_email && <InfoLine label="Account" value={codex.account_email} />}
        {codex?.last_error && <div style={{ marginTop: 10, fontSize: 11, color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 8 }}>{codex.last_error}</div>}
        {!codex?.auth_file_detected && <div style={{ marginTop: 10, fontSize: 11, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 8 }}>{codex?.instructions ?? 'Install/sign in to Codex first, then click Detect again.'}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
          <button onClick={() => onCodexLocalAction('detect')} disabled={busy === 'codex:detect'} style={smallButton('#fff', '#0f172a')}>Detect Codex auth</button>
          <button onClick={() => onCodexLocalAction('import')} disabled={!codex?.can_import || busy === 'codex:import'} style={smallButton(codex?.can_import ? '#0f172a' : '#e2e8f0', codex?.can_import ? '#fff' : '#94a3b8')}>Import local auth</button>
          <button onClick={() => onCodexLocalAction('test')} disabled={!codex?.can_test || busy === 'codex:test'} style={smallButton(codex?.can_test ? '#0f172a' : '#e2e8f0', codex?.can_test ? '#fff' : '#94a3b8')}>Test</button>
          <button onClick={() => onCodexLocalAction('assign')} disabled={!codex?.connected || busy === 'codex:assign'} style={smallButton(codex?.connected ? '#0f172a' : '#e2e8f0', codex?.connected ? '#fff' : '#94a3b8')}>Assign to CEO</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 15, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{entry.icon} {entry.display_name}</div>
        <span style={statusStyle(configured ? 'connected' : 'not_configured')}>{configured ? (isClaudeCode ? 'detected' : isChatGPT ? 'configured' : 'configured') : 'not configured'}</span>
      </div>
      <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6, minHeight: 58 }}>{entry.short_description}</p>
      <InfoLine label="Uses" value={`${entry.auth_type} · ${entry.compatibility}`} />
      <InfoLine label="Requires" value={requires} />
      <InfoLine label="Fallback" value={fallback} />
      {missing.length > 0 && <div style={{ marginTop: 10, fontSize: 11, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 8 }}>Missing: {missing.join(', ')}</div>}
      <button
        onClick={isChatGPT ? () => { window.location.href = '/api/auth-profiles/openai-codex/start' } : onConfigure}
        disabled={(isChatGPT || isClaudeCode) && !configured}
        style={{ marginTop: 12, width: '100%', padding: '9px 12px', borderRadius: 9, border: 'none', background: ((isChatGPT || isClaudeCode) && !configured) ? '#e2e8f0' : '#0f172a', color: ((isChatGPT || isClaudeCode) && !configured) ? '#94a3b8' : '#fff', fontWeight: 800, cursor: ((isChatGPT || isClaudeCode) && !configured) ? 'default' : 'pointer' }}
      >
        {isChatGPT ? 'Connect OAuth App' : isClaudeCode ? 'Create local profile' : 'Add profile'}
      </button>
    </div>
  )
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return <div style={{ marginTop: 6, fontSize: 12, color: '#475569' }}><strong style={{ color: '#0f172a' }}>{label}:</strong> {value}</div>
}

function DiagnosticsPanel({ diagnostics, profiles }: { diagnostics: Diagnostics | null; profiles: AuthProfile[] }) {
  return (
    <section style={{ marginTop: 32, marginBottom: 40 }}>
      <div style={LABEL}>Section 4 · Diagnostics</div>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 15, padding: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>
        <Diag label="ChatGPT / Codex OAuth App configured" value={diagnostics?.chatgpt_oauth.configured} detail={diagnostics?.chatgpt_oauth.missing_env.join(', ') || 'No missing required vars'} />
        <Diag label="ChatGPT / Codex Local detected" value={diagnostics?.chatgpt_codex_local.auth_file_detected} detail={`CLI: ${diagnostics?.chatgpt_codex_local.codex_cli_detected ? 'yes' : 'no'} · profile: ${diagnostics?.chatgpt_codex_local.auth_profile_exists ? 'yes' : 'no'} · connected: ${diagnostics?.chatgpt_codex_local.connected ? 'yes' : 'no'}`} />
        <Diag label="Claude Code CLI detected" value={diagnostics?.claude_code.available} detail={diagnostics?.claude_code.detail ?? 'Checking local server'} />
        <Diag label="Claude OAuth configured" value={diagnostics?.claude_oauth.configured} detail={diagnostics?.claude_oauth.missing_env.join(', ') || 'No missing required vars'} />
        <Diag label="API fallbacks connected" value={diagnostics?.any_api_fallback_connected} detail={Object.entries(diagnostics?.api_fallbacks ?? {}).map(([k, v]) => `${k}: ${v ? 'yes' : 'no'}`).join(' · ')} />
        <Diag label="CEO can think" value={diagnostics?.can_ceo_think} detail={`${profiles.filter(p => p.status === 'connected').length} connected profile(s)`} />
      </div>
    </section>
  )
}

function Diag({ label, value, detail }: { label: string; value?: boolean; detail?: string }) {
  return <div style={{ border: '1px solid #f1f5f9', borderRadius: 10, padding: 12 }}><div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>{label}</div><div style={{ marginTop: 5, color: value ? '#16a34a' : '#dc2626', fontSize: 13, fontWeight: 800 }}>{value ? 'Yes' : 'No'}</div><div style={{ marginTop: 5, color: '#64748b', fontSize: 11, lineHeight: 1.5 }}>{detail}</div></div>
}

function SetupDrawer({ entry, diagnostics, onClose, onSaved }: { entry: ProviderCatalogEntry; diagnostics: Diagnostics | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(entry.display_name)
  const [baseUrl, setBaseUrl] = useState(entry.default_base_url ?? '')
  const [model, setModel] = useState(entry.model_suggestions?.[0] ?? '')
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true); setError(null)
    try {
      if (entry.id === 'claude-code-local' && !diagnostics?.claude_code.available) throw new Error('Claude Code local auth not detected. Use Anthropic API key instead.')
      if (!model.trim()) throw new Error('Model is required.')
      if (entry.requires_api_key && !apiKey.trim()) throw new Error('API key is required.')
      if (entry.requires_base_url && !baseUrl.trim()) throw new Error('Base URL is required.')
      const res = await fetch('/api/providers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, display_name: name, type: entry.id, provider_catalog_id: entry.id,
          compatibility: entry.compatibility, auth_type: entry.auth_type, auth_method: entry.id === 'ollama' ? 'local' : entry.auth_type,
          base_url: baseUrl || null, model, api_key: apiKey || null,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      const { id } = await res.json()
      const test = await fetch(`/api/providers/${id}/test`, { method: 'POST' })
      const data = await test.json()
      if (!data.ok) throw new Error(`Saved but test failed: ${data.error}`)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.28)', display: 'flex', justifyContent: 'flex-end', zIndex: 50 }} onClick={onClose}>
      <div style={{ width: 430, background: '#fff', height: '100%', padding: 24, overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ margin: 0, color: '#0f172a' }}>Add {entry.display_name}</h2>
          <button onClick={onClose} style={smallButton('#fff', '#0f172a')}>Close</button>
        </div>
        <label style={LABEL}>Profile name</label><input style={INPUT} value={name} onChange={e => setName(e.target.value)} />
        <div style={{ height: 14 }} />
        {(entry.requires_base_url || entry.default_base_url) && <><label style={LABEL}>Base URL</label><input style={INPUT} value={baseUrl} onChange={e => setBaseUrl(e.target.value)} /><div style={{ height: 14 }} /></>}
        <label style={LABEL}>Model</label><input style={INPUT} value={model} onChange={e => setModel(e.target.value)} placeholder="model-name" />
        <div style={{ height: 14 }} />
        {entry.requires_api_key && <><label style={LABEL}>API key</label><input style={INPUT} value={apiKey} type="password" onChange={e => setApiKey(e.target.value)} placeholder="Stored server-side; never returned to frontend" /><div style={{ height: 14 }} /></>}
        {error && <Notice text={error} />}
        <button onClick={save} disabled={saving} style={{ width: '100%', border: 'none', borderRadius: 10, padding: '11px 14px', background: saving ? '#e2e8f0' : '#0f172a', color: saving ? '#94a3b8' : '#fff', fontWeight: 800 }}>{saving ? 'Saving and testing…' : 'Save and test profile'}</button>
      </div>
    </div>
  )
}

function BrowserModeCard({ setup }: { setup: { mode: string; chrome_found: boolean; chrome_profile_directory?: string; ready: boolean; owner_message: string; setup_instructions: string } | null }) {
  const [showSetup, setShowSetup] = React.useState(false)
  const mode = setup?.mode ?? 'loading'
  const modeLabel =
    mode === 'system_chrome' ? 'Normal Chrome' :
    mode === 'persistent' ? 'AÏKO profile' :
    mode === 'isolated' ? 'Isolated' : 'Loading...'

  const isSystemChrome = mode === 'system_chrome'
  const chromeFound = setup?.chrome_found ?? false
  const profileSet = setup?.chrome_profile_directory && setup.chrome_profile_directory !== 'Default'
  const ready = setup?.ready ?? false

  const tone: 'green' | 'amber' | 'gray' =
    mode === 'system_chrome' && chromeFound ? 'green' :
    mode === 'persistent' ? 'green' :
    mode === 'system_chrome' && !chromeFound ? 'amber' :
    'gray'

  const statusRows: Array<{ label: string; value: string; ok: boolean }> = isSystemChrome ? [
    { label: 'Chrome', value: chromeFound ? 'Found' : 'Not found', ok: chromeFound },
    { label: 'Profile', value: profileSet ? `${setup?.chrome_profile_directory}` : 'Using Default (recommended: create an AÏKO profile)', ok: true },
    { label: 'Ready', value: ready ? 'Yes' : 'Needs setup', ok: ready },
  ] : []

  return (
    <section data-testid="browser-mode-card" style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 20, marginTop: 18, background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>Browser for Kevin</div>
        <span style={{
          fontSize: 11, fontWeight: 800, borderRadius: 999, padding: '3px 9px',
          background: tone === 'green' ? '#dcfce7' : tone === 'amber' ? '#fef3c7' : '#f1f5f9',
          color: tone === 'green' ? '#166534' : tone === 'amber' ? '#92400e' : '#475569',
          border: `1px solid ${tone === 'green' ? '#86efac' : tone === 'amber' ? '#fde68a' : '#e2e8f0'}`,
        }}>{modeLabel}</span>
      </div>

      <p style={{ margin: '0 0 12px', color: '#374151', fontSize: 13, lineHeight: 1.55 }}>
        {setup?.owner_message ?? 'Loading browser status...'}
      </p>

      {statusRows.length > 0 && (
        <div style={{ display: 'grid', gap: 4, marginBottom: 14 }}>
          {statusRows.map(row => (
            <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ color: row.ok ? '#059669' : '#d97706', fontWeight: 900, minWidth: 12 }}>{row.ok ? '✓' : '!'}</span>
              <span style={{ color: '#64748b', minWidth: 60 }}>{row.label}:</span>
              <span style={{ color: '#374151' }}>{row.value}</span>
            </div>
          ))}
        </div>
      )}

      {isSystemChrome && !profileSet && (
        <div style={{ marginBottom: 14 }}>
          <button
            onClick={() => setShowSetup(s => !s)}
            style={{ fontSize: 12, color: '#1d4ed8', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 700 }}
          >
            {showSetup ? 'Hide setup steps' : 'Show setup steps'}
          </button>
          {showSetup && (
            <ol data-testid="chrome-setup-steps" style={{ margin: '10px 0 0', paddingLeft: 18, color: '#374151', fontSize: 12, lineHeight: 1.7 }}>
              <li>Open Google Chrome and create a new profile named <strong>AÏKO</strong>.</li>
              <li>In that profile, log into Canva, Gmail, LinkedIn, or any site Kevin should use.</li>
              <li>Add to <code style={{ background: '#f1f5f9', padding: '1px 4px', borderRadius: 3 }}>.env.local</code>:<br />
                <code style={{ background: '#f1f5f9', padding: '4px 6px', borderRadius: 3, display: 'inline-block', marginTop: 4 }}>WEB_OPERATOR_BROWSER_MODE=system_chrome</code><br />
                <code style={{ background: '#f1f5f9', padding: '4px 6px', borderRadius: 3, display: 'inline-block', marginTop: 2 }}>WEB_OPERATOR_CHROME_PROFILE_DIRECTORY=AÏKO</code>
              </li>
              <li>Restart AÏKO (<code style={{ background: '#f1f5f9', padding: '1px 4px', borderRadius: 3 }}>npm run dev</code>).</li>
            </ol>
          )}
        </div>
      )}

      {isSystemChrome && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
          <strong style={{ color: '#374151' }}>If Chrome is already open:</strong> Close that Chrome window or create a separate AÏKO Chrome profile to avoid profile lock conflicts.
        </div>
      )}

      {!isSystemChrome && setup?.setup_instructions && (
        <p style={{ margin: 0, color: '#64748b', fontSize: 12, lineHeight: 1.5 }}>
          {setup.setup_instructions}
        </p>
      )}
    </section>
  )
}
