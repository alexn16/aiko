'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

const AGENT_SLOTS = [
  { slot: 'browserAgent',        label: 'Browser Agent' },
  { slot: 'researchAgent',       label: 'Research Agent' },
  { slot: 'copywritingAgent',    label: 'Copywriting Agent' },
  { slot: 'leadGenAgent',        label: 'Lead Gen Agent' },
  { slot: 'outreachAgent',       label: 'Outreach Agent' },
  { slot: 'strategyAgent',       label: 'Strategy Agent' },
  { slot: 'reportingAgent',      label: 'Reporting Agent' },
  { slot: 'qualityAgent',        label: 'Quality Agent' },
  { slot: 'salesValidationAgent',label: 'Sales Validation Agent' },
  { slot: 'ceoAgent',            label: 'CEO Agent' },
  { slot: 'projectManagerAgent', label: 'Project Manager Agent' },
  { slot: 'socialMediaAgent',    label: 'Social Media Agent' },
]

interface ModelRow { base_url: string; api_key: string; model: string }

export default function SettingsPage() {
  const [configs, setConfigs] = useState<Record<string, ModelRow>>({})
  const [saved, setSaved] = useState(false)
  const [project, setProject] = useState({ name: '', description: '', target_market: '', value_prop: '' })
  const [projectId, setProjectId] = useState('')

  useEffect(() => {
    fetch('/api/model-configs').then(r => r.json()).then(d => setConfigs(d.configs ?? {}))
    fetch('/api/projects').then(r => r.json()).then(d => {
      const p = d.projects?.[0]
      if (p) { setProject(p); setProjectId(p.id) }
    })
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

  const inputStyle: React.CSSProperties = {
    background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 3,
    padding: '6px 8px', color: '#e8e6e0', fontFamily: 'DM Mono, monospace',
    fontSize: 10, width: '100%', boxSizing: 'border-box',
  }

  return (
    <div style={{ padding: 24, fontFamily: 'DM Mono, monospace', maxWidth: 900 }}>
      <h2 style={{ fontFamily: 'Noto Serif JP, serif', fontWeight: 300, fontSize: 18, color: '#e8e6e0', marginBottom: 24 }}>
        Settings
      </h2>

      {/* Project config */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 9, color: '#666', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>Project</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {([
            { field: 'name' as const, label: 'Project name' },
            { field: 'target_market' as const, label: 'Target market' },
            { field: 'value_prop' as const, label: 'Value proposition' },
            { field: 'description' as const, label: 'Description' },
          ]).map(({ field, label }) => (
            <div key={field}>
              <label style={{ fontSize: 9, color: '#444', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>{label.toUpperCase()}</label>
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

      {/* Model configs */}
      <Card>
        <div style={{ fontSize: 9, color: '#666', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>Model configuration</div>
        <div style={{ fontSize: 9, color: '#444', marginBottom: 16 }}>
          Configure one model per agent slot. Use any OpenAI-compatible endpoint (Ollama, OpenAI, Mistral, etc.)
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1a1a1a' }}>
                {['Agent', 'Base URL', 'API Key', 'Model'].map(h => (
                  <th key={h} style={{ padding: '6px 8px', color: '#444', fontSize: 9, textAlign: 'left', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AGENT_SLOTS.map(({ slot, label }) => (
                <tr key={slot} style={{ borderBottom: '1px solid #111' }}>
                  <td style={{ padding: '8px', fontSize: 10, color: '#c8b89a', whiteSpace: 'nowrap' }}>{label}</td>
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

        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button variant="primary" onClick={saveConfigs}>Save model configs</Button>
          {saved && <span style={{ fontSize: 10, color: '#7eb88a' }}>Saved ✓</span>}
        </div>
      </Card>
    </div>
  )
}
