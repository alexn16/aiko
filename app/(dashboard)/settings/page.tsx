'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface SmtpConfig { host: string; port: string; secure: boolean; user: string; pass: string; from: string }
interface ModelRow { base_url: string; api_key: string; model: string }

const AGENT_SLOTS = [
  { slot: 'browserAgent',         label: 'Browser Agent',           purpose: 'Web navigation',       profile: 'medium · mixed' },
  { slot: 'researchAgent',        label: 'Research Agent',          purpose: 'Web research',          profile: 'low · local-ok' },
  { slot: 'copywritingAgent',     label: 'Copywriting Agent',       purpose: 'Outbound drafts',       profile: 'high · cloud' },
  { slot: 'leadGenAgent',         label: 'Lead Gen Agent',          purpose: 'Lead enrichment',       profile: 'low · local-ok' },
  { slot: 'outreachAgent',        label: 'Outreach Agent',          purpose: 'Reply monitoring',      profile: 'medium · mixed' },
  { slot: 'strategyAgent',        label: 'Strategy Agent',          purpose: 'ICP & planning',        profile: 'high · cloud' },
  { slot: 'reportingAgent',       label: 'Reporting Agent',         purpose: 'Performance summaries', profile: 'medium · mixed' },
  { slot: 'qualityAgent',         label: 'Quality Agent',           purpose: 'Tone & safety review',  profile: 'medium · mixed' },
  { slot: 'salesValidationAgent', label: 'Sales Validation Agent',  purpose: 'Reply qualification',   profile: 'medium · mixed' },
  { slot: 'ceoAgent',             label: 'CEO Agent',               purpose: 'Top-level reasoning',   profile: 'high · cloud' },
  { slot: 'projectManagerAgent',  label: 'Project Manager Agent',   purpose: 'Ops coordination',      profile: 'medium · mixed' },
  { slot: 'socialMediaAgent',     label: 'Social Media Agent',      purpose: 'Social drafts',         profile: 'medium · mixed' },
]

const INPUT: React.CSSProperties = {
  width: '100%', background: '#ffffff', border: '1px solid #e2e8f0',
  borderRadius: 8, padding: '7px 10px', fontSize: 13, color: '#0f172a',
  boxSizing: 'border-box',
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{title}</div>
        {description && <p style={{ fontSize: 12, color: '#94a3b8', margin: '3px 0 0' }}>{description}</p>}
      </div>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 500, color: '#64748b', display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

export default function SettingsPage() {
  const [configs, setConfigs] = useState<Record<string, ModelRow>>({})
  const [modelSaved, setModelSaved] = useState(false)
  const [smtpSaved, setSmtpSaved] = useState(false)
  const [projectSaved, setProjectSaved] = useState(false)
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
    await fetch('/api/model-configs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ configs }) })
    setModelSaved(true); setTimeout(() => setModelSaved(false), 2000)
  }

  async function saveSmtp() {
    await fetch('/api/settings/smtp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(smtp) })
    setSmtpSaved(true); setTimeout(() => setSmtpSaved(false), 2000)
  }

  async function saveProject() {
    const res = await fetch('/api/projects', {
      method: projectId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...project, id: projectId }),
    })
    const d = await res.json()
    if (d.project?.id) setProjectId(d.project.id)
    setProjectSaved(true); setTimeout(() => setProjectSaved(false), 2000)
  }

  return (
    <div style={{ padding: '40px 32px', maxWidth: 860 }} className="page-enter">
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>Settings</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Configure your project, models, and email delivery.</p>
      </div>

      {/* Project */}
      <Section title="Project" description="Define who you're targeting and what you offer.">
        <Card>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {([
              { field: 'name' as const,          label: 'Project name' },
              { field: 'target_market' as const,  label: 'Target market' },
              { field: 'value_prop' as const,     label: 'Value proposition' },
              { field: 'description' as const,    label: 'Description' },
            ]).map(({ field, label }) => (
              <Field key={field} label={label}>
                <input value={project[field]} onChange={e => setProject(p => ({ ...p, [field]: e.target.value }))} style={INPUT} />
              </Field>
            ))}
          </div>
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Button variant="primary" onClick={saveProject}>Save project</Button>
            {projectSaved && <span style={{ fontSize: 12, color: '#10b981' }}>Saved ✓</span>}
          </div>
        </Card>
      </Section>

      {/* SMTP */}
      <Section title="Email (SMTP)" description="Required for email outreach. Works with Gmail App Passwords, Mailgun, Postmark, or any SMTP relay.">
        <Card>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            {([
              { field: 'host' as const, label: 'SMTP host',           placeholder: 'smtp.gmail.com',        type: 'text' },
              { field: 'port' as const, label: 'Port',                placeholder: '587',                   type: 'text' },
              { field: 'user' as const, label: 'Username / email',    placeholder: 'you@example.com',       type: 'text' },
              { field: 'pass' as const, label: 'Password / App token',placeholder: '••••••••',               type: 'password' },
              { field: 'from' as const, label: 'From address',        placeholder: 'AÏKO <you@example.com>', type: 'text' },
            ]).map(({ field, label, placeholder, type }) => (
              <Field key={field} label={label}>
                <input
                  value={smtp[field] as string}
                  onChange={e => setSmtp(s => ({ ...s, [field]: e.target.value }))}
                  placeholder={placeholder} type={type} style={INPUT}
                />
              </Field>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
              <input id="tls" type="checkbox" checked={smtp.secure} onChange={e => setSmtp(s => ({ ...s, secure: e.target.checked }))} />
              <label htmlFor="tls" style={{ fontSize: 13, color: '#374151' }}>Use TLS (port 465)</label>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Button variant="primary" onClick={saveSmtp}>Save SMTP</Button>
            {smtpSaved && <span style={{ fontSize: 12, color: '#10b981' }}>Saved ✓</span>}
          </div>
        </Card>
      </Section>

      {/* Model configs */}
      <Section title="AI Models" description="One model per agent. Any OpenAI-compatible endpoint works — Ollama, LM Studio, Groq, Mistral, or the real OpenAI.">
        <Card padding={0}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  {['Agent', 'Purpose', 'Profile', 'Base URL', 'API Key', 'Model'].map(h => (
                    <th key={h} style={{
                      padding: '10px 14px', fontSize: 11, fontWeight: 500, color: '#94a3b8',
                      textAlign: 'left', borderBottom: '1px solid #f1f5f9',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {AGENT_SLOTS.map(({ slot, label, purpose, profile }) => (
                  <tr key={slot} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '9px 14px', fontSize: 13, fontWeight: 500, color: '#0f172a', whiteSpace: 'nowrap' }}>{label}</td>
                    <td style={{ padding: '9px 14px', fontSize: 12, color: '#64748b', minWidth: 160 }}>{purpose}</td>
                    <td style={{ padding: '9px 14px', fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#94a3b8', minWidth: 100 }}>{profile}</td>
                    <td style={{ padding: '5px 14px', minWidth: 200 }}>
                      <input value={configs[slot]?.base_url ?? ''} onChange={e => updateConfig(slot, 'base_url', e.target.value)}
                        placeholder="http://localhost:11434/v1" style={INPUT} />
                    </td>
                    <td style={{ padding: '5px 14px', minWidth: 120 }}>
                      <input value={configs[slot]?.api_key ?? ''} onChange={e => updateConfig(slot, 'api_key', e.target.value)}
                        type="password" placeholder="(blank for local)" style={INPUT} />
                    </td>
                    <td style={{ padding: '5px 14px', minWidth: 120 }}>
                      <input value={configs[slot]?.model ?? ''} onChange={e => updateConfig(slot, 'model', e.target.value)}
                        placeholder="llama3" style={INPUT} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid #f8fafc' }}>
            <Button variant="primary" onClick={saveConfigs}>Save model configs</Button>
            {modelSaved && <span style={{ fontSize: 12, color: '#10b981' }}>Saved ✓</span>}
            <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 4 }}>
              Tip: use <code style={{ fontFamily: 'DM Mono, monospace', background: '#f8fafc', padding: '1px 5px', borderRadius: 4 }}>http://localhost:11434/v1</code> for local Ollama
            </span>
          </div>
        </Card>
      </Section>
    </div>
  )
}
