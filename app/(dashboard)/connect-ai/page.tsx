'use client'
import { useEffect, useState, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Provider {
  id: string
  name: string
  type: string
  status: 'connected' | 'disconnected' | 'error' | 'unavailable'
  base_url: string | null
  model: string | null
  last_tested_at: string | null
  last_error: string | null
}

interface ProviderCardDef {
  type: string
  label: string
  description: string
  icon: string
  available: boolean
  unavailableReason?: string
  defaultBaseUrl?: string
  needsKey: boolean
  modelSuggestions?: string[]
  powersLabel: string
  primaryGroup: boolean
}

const PROVIDER_DEFS: ProviderCardDef[] = [
  {
    type: 'chatgpt_direct',
    label: 'ChatGPT',
    description: 'Connect directly to your ChatGPT account.',
    icon: '🟢',
    available: false,
    unavailableReason: 'Direct ChatGPT connection not available in this build. Use OpenAI API instead.',
    needsKey: false,
    powersLabel: 'Direct ChatGPT account',
    primaryGroup: true,
  },
  {
    type: 'claude_direct',
    label: 'Claude',
    description: 'Connect directly to your Claude account.',
    icon: '🟠',
    available: false,
    unavailableReason: 'Direct Claude connection not available in this build. Use Anthropic API instead.',
    needsKey: false,
    powersLabel: 'Direct Claude account',
    primaryGroup: true,
  },
  {
    type: 'openai_api',
    label: 'OpenAI API',
    description: 'GPT-4o, GPT-4 Turbo via OpenAI API key.',
    icon: '⚡',
    available: true,
    defaultBaseUrl: 'https://api.openai.com/v1',
    needsKey: true,
    modelSuggestions: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    powersLabel: 'OpenAI API key',
    primaryGroup: false,
  },
  {
    type: 'anthropic_api',
    label: 'Anthropic API',
    description: 'Claude 3.5 Sonnet, Claude 3 Opus via Anthropic API key.',
    icon: '🔶',
    available: true,
    defaultBaseUrl: '',
    needsKey: true,
    modelSuggestions: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5', 'claude-3-5-sonnet-20241022'],
    powersLabel: 'Anthropic API key',
    primaryGroup: false,
  },
  {
    type: 'ollama',
    label: 'Local AI / Ollama',
    description: 'Run models locally. No API key needed.',
    icon: '🖥',
    available: true,
    defaultBaseUrl: 'http://localhost:11434/v1',
    needsKey: false,
    modelSuggestions: ['llama3.2', 'llama3.1', 'qwen2.5', 'mistral', 'gemma3'],
    powersLabel: 'Local model (your machine)',
    primaryGroup: false,
  },
  {
    type: 'openai_compatible',
    label: 'Custom Endpoint',
    description: 'Any OpenAI-compatible API. Works with OpenRouter, Together AI, etc.',
    icon: '🔧',
    available: true,
    defaultBaseUrl: '',
    needsKey: true,
    modelSuggestions: [],
    powersLabel: 'Custom / compatible endpoint',
    primaryGroup: false,
  },
]

const ROLES = [
  { id: 'ceo',           label: 'CEO Chat' },
  { id: 'research',      label: 'Research Agent' },
  { id: 'copywriting',   label: 'Copywriting Agent' },
  { id: 'review',        label: 'Review Agent' },
  { id: 'qa',            label: 'QA Agent' },
  { id: 'local_fallback',label: 'Local Fallback' },
]

const INPUT: React.CSSProperties = {
  width: '100%', background: '#ffffff', border: '1px solid #e2e8f0',
  borderRadius: 8, padding: '9px 11px', fontSize: 13, color: '#0f172a',
  boxSizing: 'border-box', outline: 'none', fontFamily: 'Inter, sans-serif',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConnectAIPage() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [roles, setRoles] = useState<Record<string, string | null>>({})
  const [configuring, setConfiguring] = useState<string | null>(null) // type being configured
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pRes, rRes] = await Promise.all([
        fetch('/api/providers').then(r => r.json()),
        fetch('/api/providers/roles').then(r => r.json()),
      ])
      setProviders(pRes.providers ?? [])
      setRoles(rRes.roles ?? {})
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const connectedCount = providers.filter(p => p.status === 'connected').length

  return (
    <div style={{ padding: '40px 40px', maxWidth: 860 }} className="page-enter">
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 6px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          AI Brain
        </p>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.03em', margin: '0 0 8px' }}>
          Choose AÏKO's brain
        </h1>
        <p style={{ fontSize: 14, color: '#64748b', margin: 0, lineHeight: 1.6 }}>
          AÏKO needs an AI brain before the company can operate.
          Connect ChatGPT, Claude, or another provider to start the CEO.
        </p>
      </div>

      {/* Status banner */}
      {!loading && (
        connectedCount === 0 ? (
          <div style={{
            marginBottom: 28, padding: '12px 16px',
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
            fontSize: 13, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>⚠</span>
            <span>AÏKO CEO is offline. Connect at least one AI provider below.</span>
          </div>
        ) : (
          <div style={{
            marginBottom: 28, padding: '12px 16px',
            background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10,
            fontSize: 13, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>✓</span>
            <span>{connectedCount} AI provider{connectedCount > 1 ? 's' : ''} connected — AÏKO is operational.</span>
          </div>
        )
      )}

      {/* Primary providers (ChatGPT / Claude direct) */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
          Direct connections
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          {PROVIDER_DEFS.filter(d => d.primaryGroup).map(def => (
            <UnavailableCard key={def.type} def={def} />
          ))}
        </div>
      </div>

      {/* Secondary providers (API / local) */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
          API &amp; local providers
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {PROVIDER_DEFS.filter(d => !d.primaryGroup).map(def => {
            const existing = providers.filter(p => p.type === def.type)
            return (
              <ProviderCard
                key={def.type}
                def={def}
                existing={existing}
                onConfigure={() => setConfiguring(def.type)}
                onRefresh={load}
              />
            )
          })}
        </div>
      </div>

      {/* Role assignments */}
      {providers.filter(p => p.status === 'connected').length > 0 && (
        <RoleAssignments
          providers={providers.filter(p => p.status === 'connected')}
          roles={roles}
          onSave={load}
        />
      )}

      {/* Setup drawer */}
      {configuring && (
        <SetupDrawer
          def={PROVIDER_DEFS.find(d => d.type === configuring)!}
          onClose={() => setConfiguring(null)}
          onSaved={() => { setConfiguring(null); load() }}
        />
      )}
    </div>
  )
}

// ── Unavailable card ───────────────────────────────────────────────────────────

function UnavailableCard({ def }: { def: ProviderCardDef }) {
  return (
    <div style={{
      background: '#fafafa', border: '1px solid #f1f5f9', borderRadius: 12,
      padding: '18px 20px', opacity: 0.7,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 20 }}>{def.icon}</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{def.label}</div>
          <div style={{
            display: 'inline-block', fontSize: 10, fontWeight: 500,
            color: '#94a3b8', background: '#f1f5f9',
            borderRadius: 4, padding: '1px 6px', marginTop: 2,
          }}>
            Not available in this build
          </div>
        </div>
      </div>
      <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
        {def.unavailableReason}
      </p>
    </div>
  )
}

// ── Provider card ──────────────────────────────────────────────────────────────

function ProviderCard({
  def, existing, onConfigure, onRefresh,
}: {
  def: ProviderCardDef
  existing: Provider[]
  onConfigure: () => void
  onRefresh: () => void
}) {
  const connected = existing.filter(p => p.status === 'connected')
  const hasAny = existing.length > 0

  const statusColor = connected.length > 0 ? '#16a34a' : hasAny ? '#f59e0b' : '#94a3b8'
  const statusLabel = connected.length > 0 ? 'Connected' : hasAny ? 'Error / not tested' : 'Not connected'

  return (
    <div style={{
      background: '#ffffff', border: `1px solid ${connected.length > 0 ? '#bbf7d0' : '#f1f5f9'}`,
      borderRadius: 12, padding: '18px 20px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>{def.icon}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{def.label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, display: 'inline-block' }} />
              <span style={{ fontSize: 11, color: statusColor, fontWeight: 500 }}>{statusLabel}</span>
            </div>
          </div>
        </div>
      </div>

      <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px', lineHeight: 1.5 }}>
        {def.description}
      </p>

      {/* Connected instances */}
      {existing.map(p => (
        <ConnectedInstance key={p.id} provider={p} onRefresh={onRefresh} />
      ))}

      <button
        onClick={onConfigure}
        style={{
          marginTop: existing.length > 0 ? 8 : 0,
          padding: '7px 14px', borderRadius: 7,
          background: connected.length > 0 ? '#f8fafc' : '#0f172a',
          color: connected.length > 0 ? '#374151' : '#ffffff',
          border: `1px solid ${connected.length > 0 ? '#e2e8f0' : '#0f172a'}`,
          fontSize: 12, fontWeight: 500, cursor: 'pointer',
        }}
      >
        {hasAny ? '+ Add another' : 'Set up'}
      </button>
    </div>
  )
}

// ── Connected instance row ────────────────────────────────────────────────────

function ConnectedInstance({ provider, onRefresh }: { provider: Provider; onRefresh: () => void }) {
  const [testing, setTesting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function test() {
    setTesting(true)
    try {
      await fetch(`/api/providers/${provider.id}/test`, { method: 'POST' })
      onRefresh()
    } finally {
      setTesting(false)
    }
  }

  async function del() {
    if (!confirm(`Remove "${provider.name}"?`)) return
    setDeleting(true)
    try {
      await fetch(`/api/providers/${provider.id}`, { method: 'DELETE' })
      onRefresh()
    } finally {
      setDeleting(false)
    }
  }

  const statusColor = provider.status === 'connected' ? '#16a34a' : provider.status === 'error' ? '#dc2626' : '#94a3b8'

  return (
    <div style={{
      padding: '8px 10px', background: '#f8fafc', borderRadius: 8,
      border: '1px solid #f1f5f9', marginBottom: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: 12, fontWeight: 500, color: '#0f172a' }}>{provider.name}</span>
          {provider.model && (
            <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 6, fontFamily: 'DM Mono, monospace' }}>
              {provider.model}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={test}
            disabled={testing}
            style={{
              padding: '3px 8px', borderRadius: 5, fontSize: 11, cursor: 'pointer',
              background: 'none', border: '1px solid #e2e8f0', color: '#64748b',
            }}
          >
            {testing ? '…' : 'Test'}
          </button>
          <button
            onClick={del}
            disabled={deleting}
            style={{
              padding: '3px 8px', borderRadius: 5, fontSize: 11, cursor: 'pointer',
              background: 'none', border: '1px solid #fecaca', color: '#dc2626',
            }}
          >
            {deleting ? '…' : '✕'}
          </button>
        </div>
      </div>
      {provider.status === 'error' && provider.last_error && (
        <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>
          {provider.last_error.slice(0, 120)}
        </div>
      )}
      <div style={{ fontSize: 10, color: statusColor, marginTop: 3, fontWeight: 500 }}>
        {provider.status === 'connected' ? '✓ Connected' :
         provider.status === 'error' ? '⚠ Error' : '○ Not tested'}
        {provider.last_tested_at && (
          <span style={{ color: '#cbd5e1', marginLeft: 6 }}>
            tested {new Date(provider.last_tested_at).toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Role assignments ──────────────────────────────────────────────────────────

function RoleAssignments({
  providers, roles, onSave,
}: {
  providers: Provider[]
  roles: Record<string, string | null>
  onSave: () => void
}) {
  const [local, setLocal] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const init: Record<string, string> = {}
    for (const r of ROLES) { init[r.id] = roles[r.id] ?? '' }
    setLocal(init)
  }, [roles])

  async function save() {
    setSaving(true)
    try {
      await Promise.all(ROLES.map(r =>
        fetch('/api/providers/roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: r.id, provider_id: local[r.id] || null }),
        })
      ))
      onSave()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      background: '#ffffff', border: '1px solid #f1f5f9', borderRadius: 12,
      padding: '20px 24px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>
        Role assignments
      </div>
      <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 16px', lineHeight: 1.5 }}>
        Choose which AI brain powers each agent role. Leave blank to use the first connected provider.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {ROLES.map(r => (
          <div key={r.id}>
            <label style={{ fontSize: 11, fontWeight: 500, color: '#64748b', display: 'block', marginBottom: 4 }}>
              {r.label}
            </label>
            <select
              value={local[r.id] ?? ''}
              onChange={e => setLocal(prev => ({ ...prev, [r.id]: e.target.value }))}
              style={{ ...INPUT, fontSize: 12 }}
            >
              <option value="">Auto (first connected)</option>
              {providers.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <button
        onClick={save}
        disabled={saving}
        style={{
          marginTop: 16, padding: '9px 20px', borderRadius: 8,
          background: saving ? '#e2e8f0' : '#0f172a',
          color: saving ? '#94a3b8' : '#ffffff',
          border: 'none', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer',
        }}
      >
        {saving ? 'Saving…' : 'Save assignments'}
      </button>
    </div>
  )
}

// ── Setup drawer ──────────────────────────────────────────────────────────────

function SetupDrawer({
  def, onClose, onSaved,
}: {
  def: ProviderCardDef
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(def.label)
  const [baseUrl, setBaseUrl] = useState(def.defaultBaseUrl ?? '')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(def.modelSuggestions?.[0] ?? '')
  const [customModel, setCustomModel] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const effectiveModel = customModel.trim() || model

  async function save() {
    if (!effectiveModel.trim()) { setError('Enter a model name.'); return }
    if (def.needsKey && !apiKey.trim()) { setError('API key is required for this provider.'); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          type: def.type,
          base_url: baseUrl || null,
          model: effectiveModel,
          api_key: apiKey || null,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      const { id } = await res.json()

      // Auto-test after save
      const testRes = await fetch(`/api/providers/${id}/test`, { method: 'POST' })
      const testData = await testRes.json()
      if (!testData.ok) {
        setError(`Saved but test failed: ${testData.error}`)
        setSaving(false)
        return
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  async function testExisting() {
    // For testing before saving — validate inline
    if (!effectiveModel.trim()) { setTestResult({ ok: false, msg: 'Enter a model name first.' }); return }
    setTesting(true); setTestResult(null)
    try {
      // Create temp, test, delete
      const res = await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `__test__${Date.now()}`,
          type: def.type,
          base_url: baseUrl || null,
          model: effectiveModel,
          api_key: apiKey || null,
        }),
      })
      const { id } = await res.json()
      const testRes = await fetch(`/api/providers/${id}/test`, { method: 'POST' })
      const testData = await testRes.json()
      await fetch(`/api/providers/${id}`, { method: 'DELETE' })
      setTestResult({ ok: testData.ok, msg: testData.ok ? 'Connection successful!' : testData.error ?? 'Test failed' })
    } catch {
      setTestResult({ ok: false, msg: 'Test request failed' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }}
      />
      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, zIndex: 201,
        background: '#ffffff', boxShadow: '-20px 0 60px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.2s ease-out',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                {def.icon} {def.label}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{def.powersLabel}</div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#94a3b8' }}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {/* Name */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 500, color: '#64748b', display: 'block', marginBottom: 5 }}>
              Connection name
            </label>
            <input value={name} onChange={e => setName(e.target.value)} style={INPUT}
              onFocus={e => { e.target.style.borderColor = '#6366f1' }}
              onBlur={e => { e.target.style.borderColor = '#e2e8f0' }}
            />
          </div>

          {/* Base URL */}
          {(def.type !== 'anthropic_api') && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 500, color: '#64748b', display: 'block', marginBottom: 5 }}>
                Base URL
              </label>
              <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
                placeholder="https://api.openai.com/v1" style={INPUT}
                onFocus={e => { e.target.style.borderColor = '#6366f1' }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0' }}
              />
            </div>
          )}

          {/* API Key */}
          {def.needsKey && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 500, color: '#64748b', display: 'block', marginBottom: 5 }}>
                API key
              </label>
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                placeholder="sk-…" style={INPUT}
                onFocus={e => { e.target.style.borderColor = '#6366f1' }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0' }}
              />
            </div>
          )}

          {/* Model chips */}
          {def.modelSuggestions && def.modelSuggestions.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 500, color: '#64748b', display: 'block', marginBottom: 6 }}>
                Model
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 7 }}>
                {def.modelSuggestions.map(m => (
                  <button key={m} onClick={() => { setModel(m); setCustomModel('') }} type="button"
                    style={{
                      padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                      fontSize: 12, fontFamily: 'DM Mono, monospace',
                      fontWeight: model === m && !customModel ? 600 : 400,
                      background: model === m && !customModel ? '#eef2ff' : '#f8fafc',
                      color: model === m && !customModel ? '#6366f1' : '#374151',
                      border: `1px solid ${model === m && !customModel ? '#c7d2fe' : '#e2e8f0'}`,
                    }}
                  >{m}</button>
                ))}
              </div>
              <input value={customModel} onChange={e => setCustomModel(e.target.value)}
                placeholder="Or type a custom model name…"
                style={{ ...INPUT, fontFamily: 'DM Mono, monospace', fontSize: 12 }}
                onFocus={e => { e.target.style.borderColor = '#6366f1' }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0' }}
              />
            </div>
          )}
          {(!def.modelSuggestions || def.modelSuggestions.length === 0) && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 500, color: '#64748b', display: 'block', marginBottom: 5 }}>
                Model
              </label>
              <input value={customModel} onChange={e => setCustomModel(e.target.value)}
                placeholder="e.g. gpt-4o, llama3.2, mistral…"
                style={{ ...INPUT, fontFamily: 'DM Mono, monospace', fontSize: 12 }}
                onFocus={e => { e.target.style.borderColor = '#6366f1' }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0' }}
              />
            </div>
          )}

          {/* Test result */}
          {testResult && (
            <div style={{
              padding: '9px 12px', borderRadius: 8, marginBottom: 12,
              background: testResult.ok ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${testResult.ok ? '#bbf7d0' : '#fecaca'}`,
              fontSize: 12, color: testResult.ok ? '#16a34a' : '#dc2626',
            }}>
              {testResult.ok ? '✓ ' : '⚠ '}{testResult.msg}
            </div>
          )}

          {error && (
            <div style={{
              padding: '9px 12px', borderRadius: 8, marginBottom: 12,
              background: '#fef2f2', border: '1px solid #fecaca',
              fontSize: 12, color: '#dc2626',
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 8 }}>
          <button onClick={testExisting} disabled={testing}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 8,
              background: '#f8fafc', color: '#374151',
              border: '1px solid #e2e8f0', fontSize: 13, fontWeight: 500,
              cursor: testing ? 'default' : 'pointer',
            }}
          >
            {testing ? 'Testing…' : 'Test connection'}
          </button>
          <button onClick={save} disabled={saving}
            style={{
              flex: 2, padding: '10px 0', borderRadius: 8,
              background: saving ? '#e2e8f0' : '#0f172a',
              color: saving ? '#94a3b8' : '#ffffff',
              border: 'none', fontSize: 13, fontWeight: 600,
              cursor: saving ? 'default' : 'pointer',
            }}
          >
            {saving ? 'Saving & testing…' : 'Save & connect'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(40px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  )
}
