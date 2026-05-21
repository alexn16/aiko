'use client'
import { useEffect, useState } from 'react'
import { Agent } from '@/lib/db/schema'
import { StatusDot } from '@/components/ui/StatusDot'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

const BLANK = { name: '', role: '', system_prompt: '' }

const INPUT: React.CSSProperties = {
  width: '100%', background: '#ffffff', border: '1px solid #e2e8f0',
  borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#0f172a',
  boxSizing: 'border-box',
}

export default function TeamPage() {
  const [agents, setAgents] = useState<(Agent & { created_by?: string; system_prompt?: string })[]>([])
  const [projectId, setProjectId] = useState('')
  const [showHire, setShowHire] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [firing, setFiring] = useState<string | null>(null)

  async function load(pid: string) {
    const d = await fetch(`/api/agents?projectId=${pid}`).then(r => r.json())
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

  return (
    <div style={{ padding: '40px 32px', maxWidth: 900 }} className="page-enter">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
            Team
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            {agents.length} agents — {coreAgents.length} core, {customAgents.length} custom
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowHire(v => !v)}>
          {showHire ? 'Cancel' : '+ Hire agent'}
        </Button>
      </div>

      {/* Hire form */}
      {showHire && (
        <Card style={{ marginBottom: 24 }} padding={20}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 16 }}>New hire</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, color: '#64748b', display: 'block', marginBottom: 4 }}>Name</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Spanish Outreach Specialist" style={INPUT} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, color: '#64748b', display: 'block', marginBottom: 4 }}>Role / Specialty</label>
              <input value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} placeholder="Warm outreach in Spanish for SMBs" style={INPUT} />
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 500, color: '#64748b', display: 'block', marginBottom: 4 }}>
              System prompt <span style={{ fontWeight: 400, color: '#94a3b8' }}>(optional)</span>
            </label>
            <textarea
              value={form.system_prompt}
              onChange={e => setForm(p => ({ ...p, system_prompt: e.target.value }))}
              placeholder="You are a senior B2B copywriter specialising in warm, conversational outreach in Spanish…"
              rows={4}
              style={{ ...INPUT, resize: 'vertical', lineHeight: 1.6 }}
            />
          </div>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 14px' }}>
            The CEO agent can also hire agents automatically when it needs more capacity.
          </p>
          <Button variant="primary" onClick={hire} disabled={saving || !form.name.trim() || !form.role.trim()}>
            {saving ? 'Hiring…' : 'Hire agent'}
          </Button>
        </Card>
      )}

      {/* Custom agents */}
      {customAgents.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', marginBottom: 12 }}>Custom agents</div>
          <div style={{ background: '#ffffff', borderRadius: 10, border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
            {customAgents.map((a, i) => (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px',
                borderBottom: i < customAgents.length - 1 ? '1px solid #f8fafc' : 'none',
              }}>
                <StatusDot status={a.status} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a' }}>{a.name}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>{a.role}</div>
                </div>
                <Badge label={a.created_by === 'ceo' ? 'ceo' : 'user'} />
                <Badge label={a.status} />
                <Button size="sm" variant="danger" onClick={() => fire(a.id, a.name)} disabled={firing === a.id}>
                  {firing === a.id ? '…' : 'Fire'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Core agents */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', marginBottom: 12 }}>Core team</div>
        <div style={{ background: '#ffffff', borderRadius: 10, border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          {coreAgents.map((a, i) => (
            <div key={a.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px',
              borderBottom: i < coreAgents.length - 1 ? '1px solid #f8fafc' : 'none',
            }}>
              <StatusDot status={a.status} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a' }}>{a.name}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>{a.role}</div>
              </div>
              <Badge label={a.status} />
              <div style={{
                fontSize: 12, color: '#94a3b8', maxWidth: 240,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {a.latest_output ?? a.current_task ?? '—'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
