'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { AikoBrand } from '@/components/brand/AikoBrand'
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
  claude_code: { cli_detected: boolean; token_env_detected: boolean; local_auth_detected: boolean; available: boolean; detail: string }
  claude_oauth: { configured: boolean; missing_env: string[]; client_secret_set: boolean }
  api_fallbacks: Record<string, boolean>
  any_api_fallback_connected: boolean
}

type RoleInfo = Record<string, string | null>

const MANAGED_CATALOG_IDS = [
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
  const [configuring, setConfiguring] = useState<ProviderCatalogEntry | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [providersRes, rolesRes, diagRes] = await Promise.all([
      fetch('/api/providers').then(r => r.json()),
      fetch('/api/providers/roles').then(r => r.json()),
      fetch('/api/auth-profiles/diagnostics').then(r => r.json()).catch(() => null),
    ])
    setProfiles(providersRes.providers ?? [])
    setRoles(rolesRes.roles ?? {})
    setDiagnostics(diagRes ?? null)
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
    <div style={{ padding: '40px', maxWidth: 1180 }} className="page-enter">
      <AccountBanner sessionUser={session?.user} />

      <div style={{ marginBottom: 28 }}>
        <div style={{ marginBottom: 18 }}>
          <AikoBrand size="md" />
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          OpenClaw-style auth profiles
        </div>
        <h1 style={{ fontSize: 30, letterSpacing: '-0.03em', margin: '6px 0 8px', color: '#0f172a' }}>
          Connect AI brains
        </h1>
        <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.7, maxWidth: 850 }}>
          AÏKO now resolves AI access through provider catalog → auth profile → auth method → model → role assignment → test call.
          ChatGPT/Codex OAuth is separate from OpenAI API keys, Claude Code/local is separate from Anthropic API keys, and Google login only identifies the AÏKO user.
        </p>
      </div>

      {oauthSuccess && <Notice ok text={`${oauthSuccess === 'chatgpt' ? 'ChatGPT / Codex' : 'Claude'} OAuth connected and saved as an auth profile.`} />}
      {oauthError && <Notice text={`OAuth failed: ${decodeURIComponent(oauthError)}`} />}
      {message && <Notice ok={message.includes('passed') || message.includes('assigned') || message.includes('deleted')} text={message} />}

      <CurrentBrain profile={ceoProfile} diagnostics={diagnostics} onTest={testProfile} />

      <section style={{ marginTop: 28 }}>
        <div style={LABEL}>Section 2 · Auth profiles</div>
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
        <div style={LABEL}>Section 3 · Add auth profile</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {addCards.map(entry => (
            <AddCard
              key={entry.id}
              entry={entry}
              diagnostics={diagnostics}
              onConfigure={() => setConfiguring(entry)}
            />
          ))}
        </div>
      </section>

      <DiagnosticsPanel diagnostics={diagnostics} profiles={profiles} />

      {configuring && (
        <SetupDrawer
          entry={configuring}
          diagnostics={diagnostics}
          onClose={() => setConfiguring(null)}
          onSaved={async () => { setConfiguring(null); await load() }}
        />
      )}
    </div>
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

function CurrentBrain({ profile, diagnostics, onTest }: { profile: AuthProfile | null; diagnostics: Diagnostics | null; onTest: (p: AuthProfile) => void }) {
  return (
    <section>
      <div style={LABEL}>Section 1 · Current CEO brain</div>
      <div style={{ background: '#0f172a', color: '#fff', borderRadius: 18, padding: 22, display: 'grid', gridTemplateColumns: '1fr auto', gap: 18, alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
            {profile ? profileName(profile) : 'No CEO auth profile assigned'}
          </div>
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8, color: '#cbd5e1', fontSize: 12 }}>
            <span>Provider: {profile?.provider_catalog_id ?? profile?.type ?? '—'}</span>
            <span>Auth: {profile ? methodLabel(profile) : '—'}</span>
            <span>Model: {profile?.model ?? '—'}</span>
            <span>Status: {profile?.status ?? (diagnostics?.can_ceo_think ? 'connected' : 'not_connected')}</span>
          </div>
          {profile?.last_error && <div style={{ marginTop: 10, color: '#fecaca', fontSize: 12 }}>{profile.last_error}</div>}
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

function AddCard({ entry, diagnostics, onConfigure }: { entry: ProviderCatalogEntry; diagnostics: Diagnostics | null; onConfigure: () => void }) {
  const isChatGPT = entry.id === 'chatgpt_oauth'
  const isClaudeCode = entry.id === 'claude-code-local'
  const configured = isChatGPT ? !!diagnostics?.chatgpt_oauth.configured : isClaudeCode ? !!diagnostics?.claude_code.available : true
  const missing = isChatGPT ? diagnostics?.chatgpt_oauth.missing_env ?? [] : []
  const requires = isChatGPT ? 'OPENAI_OAUTH_CLIENT_ID, OPENAI_OAUTH_AUTH_URL, OPENAI_OAUTH_TOKEN_URL, OPENAI_OAUTH_REDIRECT_URI' :
    isClaudeCode ? 'claude CLI or CLAUDE_CODE_OAUTH_TOKEN on the AÏKO server' :
    entry.requires_api_key ? 'API key and a model name' :
    entry.requires_base_url ? 'Base URL and model name' : 'Model name'
  const fallback = isChatGPT ? 'Use OpenAI API key instead.' : isClaudeCode ? 'Use Anthropic API key instead.' : 'Can be assigned to CEO after a successful test.'

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 15, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{entry.icon} {entry.display_name}</div>
        <span style={statusStyle(configured ? 'connected' : 'not_configured')}>{configured ? (isClaudeCode ? 'detected' : 'configured') : 'not configured'}</span>
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
        {isChatGPT ? 'Connect ChatGPT' : isClaudeCode ? 'Create local profile' : 'Add profile'}
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
        <Diag label="ChatGPT OAuth configured" value={diagnostics?.chatgpt_oauth.configured} detail={diagnostics?.chatgpt_oauth.missing_env.join(', ') || 'No missing required vars'} />
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
