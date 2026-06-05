'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AikoBrand } from '@/components/brand/AikoBrand'
import { CATALOG, type ProviderCatalogEntry } from '@/lib/ai/provider-catalog'

type SetupState = {
  setup_required: boolean
  reason: string | null
  auth_mode: 'optional' | 'required'
  can_ceo_think: boolean
  ceo_profile: { id: string; display_name: string | null; provider: string; model: string | null; status: string; auth_method: string | null } | null
  recommended_next_step: string
}

type AuthDiagnostics = {
  chatgpt_oauth: { configured: boolean; missing_env: string[] }
  claude_code: { available: boolean; cli_detected: boolean; token_env_detected: boolean; detail: string }
  claude_oauth: { configured: boolean; missing_env: string[] }
}

type WizardStep = 'choose' | 'testing' | 'assigning' | 'complete'

type MethodId = 'chatgpt_oauth' | 'claude' | 'openai_api' | 'anthropic_api' | 'ollama' | 'openrouter' | 'custom_openai' | 'custom_anthropic'

type MethodConfig = {
  id: MethodId
  title: string
  catalogId?: string
  description: string
  fallback: string
  kind: 'oauth' | 'claude' | 'form'
  defaultModel?: string
  defaultBaseUrl?: string
  needsKey?: boolean
  advanced?: boolean
}

const METHODS: MethodConfig[] = [
  { id: 'chatgpt_oauth', title: 'ChatGPT / Codex', catalogId: 'chatgpt_oauth', kind: 'oauth', description: 'Use ChatGPT/Codex OAuth when this AÏKO instance has OAuth env vars configured.', fallback: 'Use OpenAI API instead.' },
  { id: 'claude', title: 'Claude', catalogId: 'claude-code-local', kind: 'claude', description: 'Use Claude Code local/CLI or Claude OAuth only when detected/configured.', fallback: 'Use Anthropic API instead.', defaultModel: 'claude-code-local' },
  { id: 'openai_api', title: 'OpenAI API key', catalogId: 'openai_api', kind: 'form', description: 'Reliable GPT access with an OpenAI Platform API key.', fallback: 'Separate from ChatGPT/Codex OAuth.', defaultModel: 'gpt-4o', defaultBaseUrl: 'https://api.openai.com/v1', needsKey: true },
  { id: 'anthropic_api', title: 'Anthropic API key', catalogId: 'anthropic_api', kind: 'form', description: 'Reliable Claude access with an Anthropic API key.', fallback: 'Separate from Claude account/Claude Code auth.', defaultModel: 'claude-sonnet-4-5', needsKey: true },
  { id: 'ollama', title: 'Ollama local', catalogId: 'ollama', kind: 'form', description: 'Offline/local path. Requires Ollama running and the model pulled.', fallback: 'No API key required.', defaultModel: 'llama3.1:8b', defaultBaseUrl: 'http://localhost:11434', needsKey: false },
  { id: 'openrouter', title: 'OpenRouter', catalogId: 'openrouter', kind: 'form', description: 'Route to many models through one OpenRouter API key.', fallback: 'Useful hosted fallback.', defaultModel: 'openai/gpt-4o', defaultBaseUrl: 'https://openrouter.ai/api/v1', needsKey: true },
  { id: 'custom_openai', title: 'Custom OpenAI-compatible', catalogId: 'custom_openai', kind: 'form', description: 'Any endpoint that speaks OpenAI chat completions.', fallback: 'Advanced.', defaultModel: '', defaultBaseUrl: '', needsKey: false, advanced: true },
  { id: 'custom_anthropic', title: 'Custom Anthropic-compatible', catalogId: 'custom_anthropic', kind: 'form', description: 'Any endpoint that speaks Anthropic Messages.', fallback: 'Advanced.', defaultModel: '', defaultBaseUrl: '', needsKey: false, advanced: true },
]

const INPUT: React.CSSProperties = { width: '100%', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', fontSize: 13, boxSizing: 'border-box' }

export default function SetupPage() {
  const [setupState, setSetupState] = useState<SetupState | null>(null)
  const [diagnostics, setDiagnostics] = useState<AuthDiagnostics | null>(null)
  const [selected, setSelected] = useState<MethodId>('ollama')
  const [model, setModel] = useState('llama3.1:8b')
  const [baseUrl, setBaseUrl] = useState('http://localhost:11434')
  const [apiKey, setApiKey] = useState('')
  const [step, setStep] = useState<WizardStep>('choose')
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const load = useCallback(async () => {
    const [stateRes, diagRes] = await Promise.all([
      fetch('/api/setup/state').then(r => r.json()),
      fetch('/api/auth-profiles/diagnostics').then(r => r.json()).catch(() => null),
    ])
    setSetupState(stateRes)
    setDiagnostics(diagRes)
    if (!stateRes.setup_required) setStep('complete')
  }, [])

  useEffect(() => { load() }, [load])

  const selectedMethod = useMemo(() => METHODS.find(m => m.id === selected) ?? METHODS[0], [selected])

  function choose(method: MethodConfig) {
    setSelected(method.id)
    setModel(method.defaultModel ?? '')
    setBaseUrl(method.defaultBaseUrl ?? '')
    setApiKey('')
    setError(null)
    setStatus(null)
  }

  function getEntry(method: MethodConfig): ProviderCatalogEntry | undefined {
    return CATALOG.find(c => c.id === method.catalogId)
  }

  function methodAvailability(method: MethodConfig): { available: boolean; label: string; detail?: string } {
    if (method.id === 'chatgpt_oauth') {
      const configured = !!diagnostics?.chatgpt_oauth.configured
      return { available: configured, label: configured ? 'Available' : 'Not configured', detail: diagnostics?.chatgpt_oauth.missing_env?.join(', ') }
    }
    if (method.id === 'claude') {
      const claudeAvailable = !!diagnostics?.claude_code.available || !!diagnostics?.claude_oauth.configured
      const parts = [
        `Claude Code local ${diagnostics?.claude_code.available ? 'detected' : 'not detected'}`,
        `Claude OAuth ${diagnostics?.claude_oauth.configured ? 'configured' : 'not configured'}`,
        'Anthropic API fallback available below',
      ]
      return { available: claudeAvailable, label: claudeAvailable ? 'Available' : 'Not available', detail: parts.join(' · ') }
    }
    return { available: true, label: 'Available' }
  }

  async function testConnectAssign() {
    setStep('testing')
    setError(null)
    setStatus('Creating auth profile…')
    const method = selectedMethod
    try {
      if (method.id === 'chatgpt_oauth') {
        window.location.href = '/api/auth-profiles/openai-codex/start'
        return
      }
      if (method.id === 'claude' && !diagnostics?.claude_code.available) {
        if (diagnostics?.claude_oauth.configured) {
          window.location.href = '/api/providers/oauth/claude/start'
          return
        }
        throw new Error('Claude Code/OAuth is not available here. Use Anthropic API key instead.')
      }
      if (!model.trim()) throw new Error('Model is required.')
      if (method.needsKey && !apiKey.trim()) throw new Error('API key is required.')
      if ((method.id === 'custom_openai' || method.id === 'custom_anthropic') && !baseUrl.trim()) throw new Error('Base URL is required for custom endpoints.')

      const entry = getEntry(method)
      if (!entry) throw new Error('Provider catalog entry not found.')
      const res = await fetch('/api/providers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: method.title,
          display_name: method.title,
          type: entry.id,
          provider_catalog_id: entry.id,
          compatibility: entry.compatibility,
          auth_type: entry.auth_type,
          auth_method: entry.auth_type,
          base_url: baseUrl.trim() || null,
          model: model.trim(),
          api_key: apiKey.trim() || null,
        }),
      })
      const created = await res.json()
      if (!res.ok) throw new Error(created.error ?? 'Could not create auth profile.')
      const providerId = created.id

      setStatus('Testing provider connection…')
      const testRes = await fetch(`/api/providers/${providerId}/test`, { method: 'POST' })
      const testData = await testRes.json()
      if (!testData.ok) {
        await fetch(`/api/providers/${providerId}`, { method: 'DELETE' }).catch(() => {})
        throw new Error(testData.error ?? 'Provider test failed.')
      }

      setStep('assigning')
      setStatus('Assigning CEO brain…')
      const assignRes = await fetch('/api/providers/roles', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'ceo', provider_id: providerId }),
      })
      if (!assignRes.ok) throw new Error('Provider tested, but CEO assignment failed.')

      setStatus('Verifying CEO brain…')
      const brainRes = await fetch('/api/providers/test-ceo-brain', { method: 'POST' })
      const brain = await brainRes.json()
      if (!brain.success) throw new Error(brain.error ?? 'CEO brain verification failed.')

      const completeRes = await fetch('/api/setup/complete', { method: 'POST' })
      const complete = await completeRes.json()
      if (!complete.ok) throw new Error(complete.reason ?? 'Setup is not complete yet.')
      setStep('complete')
      setStatus('CEO brain connected.')
      await load()
    } catch (err) {
      setStep('choose')
      setError(err instanceof Error ? err.message : 'Setup failed.')
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#f8fafc,#eef2ff)', padding: '42px 20px', color: '#0f172a' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <header style={{ marginBottom: 28 }}>
          <div style={{ marginBottom: 18 }}>
            <AikoBrand size="md" />
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.14em', color: '#6366f1', textTransform: 'uppercase' }}>Setup</div>
          <h1 style={{ fontSize: 42, lineHeight: 1.05, letterSpacing: '-0.05em', margin: '8px 0' }}>Connect an AI brain to start.</h1>
          <p style={{ fontSize: 15, color: '#64748b', maxWidth: 760, lineHeight: 1.7 }}>
            Choose a provider, test the auth profile, assign it to the CEO brain, then enter AÏKO. Google login is optional identity in local mode; provider auth is separate.
          </p>
          {setupState?.reason && <div style={{ marginTop: 12, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 12, fontSize: 13 }}>{setupState.reason}</div>}
        </header>

        {step === 'complete' ? (
          <SuccessPanel setupState={setupState} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 0.75fr', gap: 18, alignItems: 'start' }}>
            <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 20 }}>
              <StepTitle n={1} title="Choose connection method" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
                {METHODS.filter(m => showAdvanced || !m.advanced).map(method => {
                  const availability = methodAvailability(method)
                  return (
                    <button key={method.id} type="button" onClick={() => choose(method)} style={{ textAlign: 'left', border: `1px solid ${selected === method.id ? '#6366f1' : '#e2e8f0'}`, background: selected === method.id ? '#eef2ff' : '#fff', borderRadius: 14, padding: 14, cursor: 'pointer' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <strong>{method.title}</strong>
                        <span style={{ fontSize: 11, color: availability.available ? '#16a34a' : '#dc2626', fontWeight: 800 }}>{availability.label}</span>
                      </div>
                      <p style={{ color: '#64748b', fontSize: 12, lineHeight: 1.5, minHeight: 38 }}>{method.description}</p>
                      {availability.detail && <div style={{ fontSize: 11, color: availability.available ? '#475569' : '#b45309', lineHeight: 1.4 }}>{availability.detail}</div>}
                      <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8' }}>{method.fallback}</div>
                    </button>
                  )
                })}
              </div>
              <button type="button" onClick={() => setShowAdvanced(v => !v)} style={{ marginTop: 12, border: 'none', background: 'transparent', color: '#6366f1', fontWeight: 700, cursor: 'pointer' }}>
                {showAdvanced ? 'Hide advanced' : 'Show advanced custom endpoints'}
              </button>
            </section>

            <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 20 }}>
              <StepTitle n={2} title="Test connection" />
              <ConnectionForm
                method={selectedMethod}
                availability={methodAvailability(selectedMethod)}
                model={model}
                setModel={setModel}
                baseUrl={baseUrl}
                setBaseUrl={setBaseUrl}
                apiKey={apiKey}
                setApiKey={setApiKey}
                onSubmit={testConnectAssign}
                busy={step === 'testing' || step === 'assigning'}
              />
              <StepTitle n={3} title="Assign CEO brain" muted />
              <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>After a provider test passes, setup assigns it to CEO and runs Brain Verification. Setup does not fake success.</p>
              {status && <div style={{ marginTop: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, fontSize: 12 }}>{status}</div>}
              {error && <div style={{ marginTop: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 10, color: '#991b1b', fontSize: 12 }}>{error}</div>}
            </section>
          </div>
        )}
      </div>
    </main>
  )
}

function StepTitle({ n, title, muted = false }: { n: number; title: string; muted?: boolean }) {
  return <div style={{ marginBottom: 12, color: muted ? '#94a3b8' : '#0f172a', fontWeight: 900 }}><span style={{ color: '#6366f1' }}>Step {n}:</span> {title}</div>
}

function ConnectionForm({ method, availability, model, setModel, baseUrl, setBaseUrl, apiKey, setApiKey, onSubmit, busy }: {
  method: MethodConfig
  availability: { available: boolean; label: string; detail?: string }
  model: string
  setModel: (v: string) => void
  baseUrl: string
  setBaseUrl: (v: string) => void
  apiKey: string
  setApiKey: (v: string) => void
  onSubmit: () => void
  busy: boolean
}) {
  const formDisabled = (method.kind === 'oauth' || method.kind === 'claude') && !availability.available
  return (
    <div>
      {(method.kind === 'form') && (
        <>
          {(method.defaultBaseUrl !== undefined || method.id.startsWith('custom')) && <Field label="Base URL"><input style={INPUT} value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="http://localhost:11434" /></Field>}
          <Field label="Model"><input style={INPUT} value={model} onChange={e => setModel(e.target.value)} placeholder="model" /></Field>
          {method.needsKey && <Field label="API key"><input style={INPUT} value={apiKey} onChange={e => setApiKey(e.target.value)} type="password" placeholder="Stored server-side; never returned to frontend" /></Field>}
        </>
      )}
      {method.kind !== 'form' && <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>{availability.detail ?? method.description}</p>}
      <button disabled={busy || formDisabled} onClick={onSubmit} style={{ width: '100%', marginTop: 10, padding: '12px 14px', borderRadius: 11, border: 'none', background: busy || formDisabled ? '#e2e8f0' : '#0f172a', color: busy || formDisabled ? '#94a3b8' : '#fff', fontWeight: 900, cursor: busy || formDisabled ? 'default' : 'pointer' }}>
        {busy ? 'Working…' : method.kind === 'oauth' ? 'Connect OAuth' : 'Test & Connect'}
      </button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'block', marginBottom: 12 }}><div style={{ fontSize: 11, color: '#64748b', fontWeight: 800, marginBottom: 5 }}>{label}</div>{children}</label>
}

function SuccessPanel({ setupState }: { setupState: SetupState | null }) {
  return (
    <section style={{ background: '#fff', border: '1px solid #bbf7d0', borderRadius: 18, padding: 28, maxWidth: 720 }}>
      <div style={{ fontSize: 13, fontWeight: 900, color: '#16a34a', marginBottom: 8 }}>Step 4: Start using AÏKO</div>
      <h2 style={{ margin: '0 0 8px', fontSize: 28 }}>CEO brain connected</h2>
      <p style={{ color: '#64748b', lineHeight: 1.7 }}>AÏKO can resolve a working CEO profile: <strong>{setupState?.ceo_profile?.display_name ?? setupState?.ceo_profile?.provider ?? 'connected profile'}</strong>{setupState?.ceo_profile?.model ? ` / ${setupState.ceo_profile.model}` : ''}.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 18 }}>
        <Link href="/ceo" style={linkButton('#0f172a', '#fff')}>Go to CEO Chat</Link>
        <Link href="/start-campaign" style={linkButton('#fff', '#0f172a')}>Start First Campaign</Link>
        <Link href="/connect-ai" style={linkButton('#fff', '#0f172a')}>Open Connect AI</Link>
      </div>
    </section>
  )
}

function linkButton(bg: string, color: string): React.CSSProperties {
  return { display: 'inline-flex', textDecoration: 'none', background: bg, color, border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontWeight: 900 }
}
