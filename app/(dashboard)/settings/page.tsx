'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface SmtpConfig { host: string; port: string; secure: boolean; user: string; pass: string; from: string }

const AGENT_SLOTS = [
  { slot: 'browserAgent',         label: 'Browser Agent', purpose: 'Web navigation actions', cost: 'medium', privacy: 'mixed' },
  { slot: 'researchAgent',        label: 'Research Agent', purpose: 'Web research and summaries', cost: 'low', privacy: 'local-friendly' },
  { slot: 'copywritingAgent',     label: 'Copywriting Agent', purpose: 'Outbound draft writing', cost: 'high', privacy: 'cloud/common' },
  { slot: 'leadGenAgent',         label: 'Lead Gen Agent', purpose: 'Lead enrichment', cost: 'low', privacy: 'local-friendly' },
  { slot: 'outreachAgent',        label: 'Outreach Agent', purpose: 'Inbox/reply monitoring', cost: 'medium', privacy: 'mixed' },
  { slot: 'strategyAgent',        label: 'Strategy Agent', purpose: 'ICP and strategy planning', cost: 'high', privacy: 'cloud/common' },
  { slot: 'reportingAgent',       label: 'Reporting Agent', purpose: 'Summaries and recommendations', cost: 'medium', privacy: 'mixed' },
  { slot: 'qualityAgent',         label: 'Quality Agent', purpose: 'Tone/safety review', cost: 'medium', privacy: 'mixed' },
  { slot: 'salesValidationAgent', label: 'Sales Validation Agent', purpose: 'Reply qualification', cost: 'medium', privacy: 'mixed' },
  { slot: 'ceoAgent',             label: 'CEO Agent', purpose: 'Top-level reasoning', cost: 'high', privacy: 'cloud/common' },
  { slot: 'projectManagerAgent',  label: 'Project Manager Agent', purpose: 'Ops coordination', cost: 'medium', privacy: 'mixed' },
  { slot: 'socialMediaAgent',     label: 'Social Media Agent', purpose: 'Social drafts', cost: 'medium', privacy: 'mixed' },
]

interface ModelRow { base_url: string; api_key: string; model: string }

const inputStyle: React.CSSProperties = {
  background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 4,
  padding: '6px 8px', color: '#374151', fontFamily: 'Inter, sans-serif',
  fontSize: 13, width: '100%', boxSizing: 'border-box',
}

export default function SettingsPage() {
  const [configs, setConfigs] = useState<Record<string, ModelRow>>({})
  const [saved, setSaved] = useState(false)
  const [smtpSaved, setSmtpSaved] = useState(false)
  const [project, setProject] = useState({ name: '', description: '', target_market: '', value_prop: '' })
  const [projectId, setProjectId] = useState('')
  const [smtp, setSmtp] = useState<SmtpConfig>({ host: '', port: '587', secure: false, user: '', pass: '', from: '' })

  useEffect(() => {
    fetch('/api/model-configs').then(r => r.json()).then(d => setConfigs(d.configs ?? {}))
    fetch('/api/projects').then(r => r.json()).then(d => {
      const p = d.projects?.[0]
      if (p) { setProject(p); setProjectId(p.id) }
    })
    fetch('/api/settings/smtp').then(r => r.json()).then(d => {
      if (d.smtp) setSmtp({ ...d.smtp, port: String(d.smtp.port) })
    }).catch(() => {})
  }, [])

  function updateConfig(slot: string, field: keyof ModelRow, value: string) {
    setConfigs(prev => ({ ...prev, [slot]: { ...(prev[slot] ?? { base_url: '', api_key: '', model: '' }), [field]: value } }))
  }

  async function saveConfigs() {
    await fetch('/api/model-configs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ configs }),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function saveSmtp() {
    await fetch('/api/settings/smtp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(smtp),
    })
    setSmtpSaved(true)
    setTimeout(() => setSmtpSaved(false), 2000)
  }

  async function saveProject() {
    const method = projectId ? 'PUT' : 'POST'
    const res = await fetch('/api/projects', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...project, id: projectId }),
    })
    const d = await res.json()
    if (d.project?.id) setProjectId(d.project.id)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ padding: 24, fontFamily: 'Inter, sans-serif', maxWidth: 900 }}>
      <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 18, color: '#111827', marginBottom: 24 }}>
        Settings
      </h2>

      {/* Project config */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#9ca3af', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>Project</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {([
            { field: 'name' as const, label: 'Project name' },
            { field: 'target_market' as const, label: 'Target market' },
            { field: 'value_prop' as const, label: 'Value proposition' },
            { field: 'description' as const, label: 'Description' },
          ]).map(({ field, label }) => (
            <div key={field}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>{label}</label>
              <input
                value={project[field]}
                onChange={e => setProject(p => ({ ...p, [field]: e.target.value }))}
                style={inputStyle}
              />
            </div>
          ))}
        </div>
        <Button variant="primary" style={{ marginTop: 16 }} onClick={saveProject}>Save project</Button>
      </Card>

      {/* SMTP config */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#9ca3af', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>Email / SMTP</div>
        <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>
          Required for the email outreach channel. Works with Gmail (App Password), Mailgun SMTP, Postmark, and any standard SMTP relay.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {([
            { field: 'host' as const,  label: 'SMTP host',           placeholder: 'smtp.gmail.com',   type: 'text' },
            { field: 'port' as const,  label: 'Port',                 placeholder: '587',              type: 'text' },
            { field: 'user' as const,  label: 'Username / email',     placeholder: 'you@example.com',  type: 'text' },
            { field: 'pass' as const,  label: 'Password / App token', placeholder: '••••••••',         type: 'password' },
            { field: 'from' as const,  label: 'From address',         placeholder: 'AÏKO <you@example.com>', type: 'text' },
          ]).map(({ field, label, placeholder, type }) => (
            <div key={field}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>{label}</label>
              <input
                value={smtp[field] as string}
                onChange={e => setSmtp(s => ({ ...s, [field]: e.target.value }))}
                placeholder={placeholder}
                type={type}
                style={inputStyle}
              />
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 16 }}>
            <input
              id="smtp-secure"
              type="checkbox"
              checked={smtp.secure}
              onChange={e => setSmtp(s => ({ ...s, secure: e.target.checked }))}
            />
            <label htmlFor="smtp-secure" style={{ fontSize: 13, color: '#6b7280' }}>TLS / port 465</label>
          </div>
        </div>
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button variant="primary" onClick={saveSmtp}>Save SMTP</Button>
          {smtpSaved && <span style={{ fontSize: 12, color: '#16a34a' }}>Saved ✓</span>}
        </div>
      </Card>

      {/* Model configs */}
      <Card>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#9ca3af', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>Model configuration</div>
        <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>
          Configure one model per agent slot. Works with OpenAI-compatible endpoints (OpenAI, Ollama, LM Studio, Groq, Mistral, and similar).
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                {['Agent', 'Purpose', 'Profile', 'Base URL', 'API Key', 'Model'].map(h => (
                  <th key={h} style={{ padding: '6px 8px', color: '#9ca3af', fontSize: 10, textAlign: 'left', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'DM Mono, monospace' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AGENT_SLOTS.map(({ slot, label, purpose, cost, privacy }) => (
                <tr key={slot} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '8px', fontSize: 13, color: '#111827', whiteSpace: 'nowrap' }}>{label}</td>
                  <td style={{ padding: '8px', fontSize: 12, color: '#6b7280', minWidth: 170 }}>
                    {purpose}
                  </td>
                  <td style={{ padding: '8px', fontSize: 12, color: '#9ca3af', minWidth: 120 }}>
                    {cost} · {privacy}
                  </td>
                  <td style={{ padding: '4px 8px', minWidth: 200 }}>
                    <input
                      value={configs[slot]?.base_url ?? ''}
                      onChange={e => updateConfig(slot, 'base_url', e.target.value)}
                      placeholder="http://localhost:11434/v1"
                      style={inputStyle}
                    />
                  </td>
                  <td style={{ padding: '4px 8px', minWidth: 120 }}>
                    <input
                      value={configs[slot]?.api_key ?? ''}
                      onChange={e => updateConfig(slot, 'api_key', e.target.value)}
                      type="password"
                      placeholder="(empty for local)"
                      style={inputStyle}
                    />
                  </td>
                  <td style={{ padding: '4px 8px', minWidth: 120 }}>
                    <input
                      value={configs[slot]?.model ?? ''}
                      onChange={e => updateConfig(slot, 'model', e.target.value)}
                      placeholder="llama3"
                      style={inputStyle}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, color: '#9ca3af' }}>
          Tip: use <code style={{ fontFamily: 'DM Mono, monospace', background: '#f3f4f6', padding: '1px 4px', borderRadius: 3 }}>http://localhost:11434/v1</code> with model names like <code style={{ fontFamily: 'DM Mono, monospace', background: '#f3f4f6', padding: '1px 4px', borderRadius: 3 }}>llama3</code> for local Ollama slots.
        </div>

        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button variant="primary" onClick={saveConfigs}>Save model configs</Button>
          {saved && <span style={{ fontSize: 12, color: '#16a34a' }}>Saved ✓</span>}
        </div>
      </Card>
    </div>
  )
}
