'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// ── Provider presets ──────────────────────────────────────────────────────────

interface Preset {
  id: string
  name: string
  type: string
  baseUrl: string
  models: string[]
  needsKey: boolean
  hint: string
}

const PRESETS: Preset[] = [
  {
    id: 'openai',
    name: 'OpenAI API',
    type: 'openai_api',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    needsKey: true,
    hint: 'API key from platform.openai.com',
  },
  {
    id: 'anthropic',
    name: 'Anthropic API',
    type: 'anthropic_api',
    baseUrl: '',
    models: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5'],
    needsKey: true,
    hint: 'API key from console.anthropic.com',
  },
  {
    id: 'groq',
    name: 'Groq',
    type: 'openai_compatible',
    baseUrl: 'https://api.groq.com/openai/v1',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemma2-9b-it'],
    needsKey: true,
    hint: 'API key from console.groq.com',
  },
  {
    id: 'ollama',
    name: 'Ollama (local)',
    type: 'ollama',
    baseUrl: 'http://localhost:11434/v1',
    models: ['llama3.2', 'qwen2.5', 'mistral', 'gemma3'],
    needsKey: false,
    hint: 'No API key needed — runs on your machine',
  },
  {
    id: 'custom',
    name: 'Custom',
    type: 'openai_compatible',
    baseUrl: '',
    models: [],
    needsKey: true,
    hint: 'Any OpenAI-compatible endpoint',
  },
]

const INPUT: React.CSSProperties = {
  width: '100%', background: '#ffffff', border: '1px solid #e2e8f0',
  borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#0f172a',
  boxSizing: 'border-box', outline: 'none', fontFamily: 'Inter, sans-serif',
}

// ── Gate wrapper ──────────────────────────────────────────────────────────────

export function SetupGate({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false)
  const [configured, setConfigured] = useState(true) // optimistic — hide flash
  const router = useRouter()

  // Bypass the gate on auth routes — the login page must render as-is
  const isAuthRoute = typeof window !== 'undefined' &&
    (window.location.pathname.startsWith('/login') ||
     window.location.pathname.startsWith('/api/auth'))

  useEffect(() => {
    if (isAuthRoute) { setConfigured(true); setChecked(true); return }
    fetch('/api/setup')
      .then(r => r.json())
      .then(d => { setConfigured(d.configured); setChecked(true) })
      .catch(() => { setConfigured(false); setChecked(true) })
  }, [isAuthRoute])

  function handleDone() {
    setConfigured(true)
    router.push('/ceo')
  }

  if (!checked) return null
  if (configured) return <>{children}</>

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#f8fafc',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <SetupForm onDone={handleDone} />
    </div>
  )
}

// ── Setup form ────────────────────────────────────────────────────────────────

function SetupForm({ onDone }: { onDone: () => void }) {
  const [preset, setPreset] = useState<Preset>(PRESETS[0])
  const [baseUrl, setBaseUrl] = useState(PRESETS[0].baseUrl)
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(PRESETS[0].models[0])
  const [customModel, setCustomModel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function selectPreset(p: Preset) {
    setPreset(p)
    setBaseUrl(p.baseUrl)
    setModel(p.models[0] ?? '')
    setCustomModel('')
    setError(null)
  }

  const effectiveModel = customModel.trim() || model

  async function save() {
    if (!effectiveModel.trim()) { setError('Enter a model name.'); return }
    if (preset.needsKey && !apiKey.trim()) { setError('API key is required.'); return }
    setSaving(true)
    setError(null)

    try {
      // Create provider connection
      const createRes = await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: preset.name,
          type: preset.type,
          base_url: baseUrl.trim() || null,
          model: effectiveModel.trim(),
          api_key: apiKey.trim() || null,
        }),
      })
      if (!createRes.ok) throw new Error('Save failed')
      const { id } = await createRes.json()

      // Test the connection
      const testRes = await fetch(`/api/providers/${id}/test`, { method: 'POST' })
      const testData = await testRes.json()
      if (!testData.ok) {
        // Delete the bad entry and surface the error
        await fetch(`/api/providers/${id}`, { method: 'DELETE' })
        throw new Error(`Connection test failed: ${testData.error ?? 'Unknown error'}`)
      }

      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect. Check your key and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      background: '#ffffff', borderRadius: 16,
      boxShadow: '0 24px 64px rgba(0,0,0,0.10), 0 4px 16px rgba(0,0,0,0.06)',
      width: '100%', maxWidth: 520, padding: '36px 36px 32px',
    }}>
      {/* Logo + headline */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.03em', marginBottom: 4 }}>
          AÏKO
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginBottom: 6 }}>
          Choose AÏKO's brain
        </div>
        <p style={{ fontSize: 13, color: '#64748b', margin: 0, lineHeight: 1.6 }}>
          AÏKO needs an AI brain before the company can operate.
          Connect ChatGPT, Claude, or another provider to start the CEO.
        </p>
      </div>

      {/* Provider pills */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: '#64748b', marginBottom: 8 }}>Provider</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => selectPreset(p)}
              type="button"
              style={{
                padding: '6px 14px', borderRadius: 7, cursor: 'pointer',
                fontSize: 13, fontWeight: preset.id === p.id ? 600 : 400,
                background: preset.id === p.id ? '#0f172a' : '#f8fafc',
                color: preset.id === p.id ? '#ffffff' : '#374151',
                border: `1px solid ${preset.id === p.id ? '#0f172a' : '#e2e8f0'}`,
                transition: 'all 0.1s',
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: '#94a3b8' }}>{preset.hint}</div>
      </div>

      {/* Base URL — hidden for Anthropic (uses SDK default) */}
      {preset.type !== 'anthropic_api' && (
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 500, color: '#64748b', display: 'block', marginBottom: 5 }}>
            Base URL
          </label>
          <input
            value={baseUrl}
            onChange={e => setBaseUrl(e.target.value)}
            placeholder="https://api.openai.com/v1"
            style={INPUT}
            onFocus={e => { e.target.style.borderColor = '#6366f1' }}
            onBlur={e => { e.target.style.borderColor = '#e2e8f0' }}
          />
        </div>
      )}

      {/* API key */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 11, fontWeight: 500, color: '#64748b', display: 'block', marginBottom: 5 }}>
          API key{!preset.needsKey && <span style={{ color: '#94a3b8', fontWeight: 400 }}> (not needed for local)</span>}
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder={preset.needsKey ? 'sk-…' : 'Leave blank'}
          style={INPUT}
          onFocus={e => { e.target.style.borderColor = '#6366f1' }}
          onBlur={e => { e.target.style.borderColor = '#e2e8f0' }}
        />
      </div>

      {/* Model */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 11, fontWeight: 500, color: '#64748b', display: 'block', marginBottom: 5 }}>
          Model
        </label>
        {preset.models.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
            {preset.models.map(m => (
              <button
                key={m}
                onClick={() => { setModel(m); setCustomModel('') }}
                type="button"
                style={{
                  padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                  fontSize: 12, fontWeight: model === m && !customModel ? 600 : 400,
                  background: model === m && !customModel ? '#eef2ff' : '#f8fafc',
                  color: model === m && !customModel ? '#6366f1' : '#374151',
                  border: `1px solid ${model === m && !customModel ? '#c7d2fe' : '#e2e8f0'}`,
                  fontFamily: 'DM Mono, monospace',
                }}
              >
                {m}
              </button>
            ))}
          </div>
        )}
        <input
          value={customModel}
          onChange={e => setCustomModel(e.target.value)}
          placeholder={preset.models.length > 0 ? 'Or type a custom model name…' : 'Model name, e.g. llama3.2'}
          style={{ ...INPUT, fontFamily: 'DM Mono, monospace' }}
          onFocus={e => { e.target.style.borderColor = '#6366f1' }}
          onBlur={e => { e.target.style.borderColor = '#e2e8f0' }}
        />
      </div>

      {error && (
        <div style={{
          marginBottom: 16, padding: '9px 12px',
          background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: 7, fontSize: 12, color: '#dc2626',
        }}>
          {error}
        </div>
      )}

      <button
        onClick={save}
        disabled={saving}
        style={{
          width: '100%', padding: '12px 0',
          background: saving ? '#e2e8f0' : '#0f172a',
          color: saving ? '#94a3b8' : '#ffffff',
          border: 'none', borderRadius: 10,
          fontSize: 14, fontWeight: 600, cursor: saving ? 'default' : 'pointer',
          letterSpacing: '-0.01em', transition: 'background 0.15s',
        }}
      >
        {saving ? 'Connecting…' : 'Connect and enter AÏKO'}
      </button>

      <p style={{ fontSize: 11, color: '#94a3b8', margin: '12px 0 0', textAlign: 'center', lineHeight: 1.5 }}>
        You can add more providers or change assignments any time in Connect AI.
      </p>
    </div>
  )
}
