'use client'
import { useEffect, useState } from 'react'
import { Agent } from '@/lib/db/schema'
import { StatusDot } from '@/components/ui/StatusDot'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

const BLANK = { name: '', role: '', system_prompt: '' }

export default function TeamPage() {
  const [agents, setAgents] = useState<(Agent & { created_by?: string; system_prompt?: string })[]>([])
  const [projectId, setProjectId] = useState('')
  const [showHire, setShowHire] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [firing, setFiring] = useState<string | null>(null)

  async function load(pid: string) {
    const res = await fetch(`/api/agents?projectId=${pid}`)
    const d = await res.json()
    setAgents(d.agents ?? [])
  }

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(d => {
      const pid = d.projects?.[0]?.id
      if (pid) { setProjectId(pid); load(pid) }
    }).catch(() => {})
  }, [])

  async function hire() {
    if (!form.name.trim() || !form.role.trim() || !projectId) return
    setSaving(true)
    const res = await fetch('/api/agents/hire', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, ...form }),
    })
    const d = await res.json()
    setSaving(false)
    if (d.error) { alert(d.error); return }
    setForm(BLANK)
    setShowHire(false)
    load(projectId)
  }

  async function fire(agentId: string, name: string) {
    if (!confirm(`Remove "${name}" from the team?`)) return
    setFiring(agentId)
    await fetch('/api/agents/fire', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId }),
    })
    setFiring(null)
    load(projectId)
  }

  const coreAgents = agents.filter(a => !a.created_by || a.created_by === 'system')
  const customAgents = agents.filter(a => a.created_by && a.created_by !== 'system')

  const inputStyle: React.CSSProperties = {
    background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 3,
    padding: '6px 10px', color: '#e8e6e0', fontFamily: 'DM Mono, monospace',
    fontSize: 10, width: '100%', boxSizing: 'border-box',
  }

  return (
    <div style={{ padding: 24, fontFamily: 'DM Mono, monospace', maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'Noto Serif JP, serif', fontWeight: 300, fontSize: 18, color: '#e8e6e0', margin: 0 }}>
          Team
          <span style={{ fontSize: 11, color: '#444', fontFamily: 'DM Mono, monospace', marginLeft: 12 }}>
            {agents.length} agents
          </span>
        </h2>
        <Button variant="primary" onClick={() => setShowHire(v => !v)}>
          {showHire ? 'Cancel' : '+ Hire agent'}
        </Button>
      </div>

      {showHire && (
        <Card style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 9, color: '#666', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 14 }}>
            Hire new agent
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 9, color: '#444', display: 'block', marginBottom: 4 }}>NAME</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Spanish Outreach Specialist" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 9, color: '#444', display: 'block', marginBottom: 4 }}>ROLE / SPECIALTY</label>
              <input value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} placeholder="Writes warm outreach in Spanish for SMBs" style={inputStyle} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 9, color: '#444', display: 'block', marginBottom: 4 }}>
              SYSTEM PROMPT (optional — defines how this agent thinks and writes)
            </label>
            <textarea
              value={form.system_prompt}
              onChange={e => setForm(p => ({ ...p, system_prompt: e.target.value }))}
              placeholder="You are a senior B2B copywriter specialising in warm, conversational outreach in Spanish. You never use templates..."
              rows={4}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
            />
          </div>
          <div style={{ fontSize: 9, color: '#444', marginBottom: 12 }}>
            The CEO agent can also hire agents automatically when it evaluates that more capacity is needed.
          </div>
          <Button variant="primary" onClick={hire} disabled={saving || !form.name.trim() || !form.role.trim()}>
            {saving ? 'Hiring…' : 'Hire'}
          </Button>
        </Card>
      )}

      {/* Custom agents */}
      {customAgents.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 9, color: '#555', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 10 }}>
            Custom agents ({customAgents.length})
          </div>
          <div style={{ border: '1px solid #222', borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#111', borderBottom: '1px solid #222' }}>
                  {['', 'Name', 'Role / Specialty', 'Hired by', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '7px 12px', color: '#444', fontSize: 9, textAlign: 'left', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customAgents.map(a => (
                  <tr key={a.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                    <td style={{ padding: '8px 12px' }}><StatusDot status={a.status} /></td>
                    <td style={{ padding: '8px 12px', fontSize: 11, color: '#c8b89a' }}>{a.name}</td>
                    <td style={{ padding: '8px 12px', fontSize: 10, color: '#888', maxWidth: 280 }}>{a.role}</td>
                    <td style={{ padding: '8px 12px', fontSize: 9 }}>
                      <Badge label={a.created_by === 'ceo' ? 'CEO' : 'user'} />
                    </td>
                    <td style={{ padding: '8px 12px' }}><Badge label={a.status} /></td>
                    <td style={{ padding: '8px 12px' }}>
                      <Button size="sm" variant="danger" onClick={() => fire(a.id, a.name)} disabled={firing === a.id}>
                        {firing === a.id ? '…' : 'Fire'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Core agents */}
      <div>
        <div style={{ fontSize: 9, color: '#555', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 10 }}>
          Core team ({coreAgents.length})
        </div>
        <div style={{ border: '1px solid #222', borderRadius: 4, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#111', borderBottom: '1px solid #222' }}>
                {['', 'Agent', 'Role', 'Status', 'Last task'].map(h => (
                  <th key={h} style={{ padding: '7px 12px', color: '#444', fontSize: 9, textAlign: 'left', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coreAgents.map(a => (
                <tr key={a.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                  <td style={{ padding: '8px 12px' }}><StatusDot status={a.status} /></td>
                  <td style={{ padding: '8px 12px', fontSize: 11, color: '#e8e6e0' }}>{a.name}</td>
                  <td style={{ padding: '8px 12px', fontSize: 10, color: '#666', maxWidth: 220 }}>{a.role}</td>
                  <td style={{ padding: '8px 12px' }}><Badge label={a.status} /></td>
                  <td style={{ padding: '8px 12px', fontSize: 10, color: '#555', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.latest_output ?? a.current_task ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
