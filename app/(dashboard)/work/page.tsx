'use client'

import { useEffect, useState } from 'react'

type WorkItem = {
  id: string
  project_id: string | null
  assigned_agent_name: string
  assigned_role: string
  work_type: string
  priority: number
  status: string
  output_summary: string | null
  blocked_reason: string | null
  requires_approval: boolean
  requires_user_input: boolean
  created_at: string
}

type WorkStatus = {
  state: {
    enabled: boolean
    level: string
    max_actions_per_cycle: number
    cycles_today: number
    paused_reason: string | null
  }
  queue: WorkItem[]
  active: WorkItem[]
  recent: WorkItem[]
  counts: Record<string, number>
}

const card = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  padding: 18,
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
}

const button = {
  border: '1px solid #dbeafe',
  background: '#eff6ff',
  color: '#1d4ed8',
  borderRadius: 8,
  padding: '9px 11px',
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
}

export default function WorkPage() {
  const [status, setStatus] = useState<WorkStatus | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function load() {
    const res = await fetch('/api/intensive-work/status')
    if (res.ok) setStatus(await res.json())
  }

  useEffect(() => {
    load().catch(() => {})
  }, [])

  async function runCycle() {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/intensive-work/run-cycle', { method: 'POST' })
      const data = await res.json()
      setMessage(data.message ?? 'Cycle finished.')
      await load()
    } finally {
      setLoading(false)
    }
  }

  async function pause() {
    setLoading(true)
    try {
      await fetch('/api/intensive-work/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Paused from Work page.' }),
      })
      setMessage('Intensive Work paused.')
      await load()
    } finally {
      setLoading(false)
    }
  }

  const state = status?.state
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: 28 }}>
      <div style={{ maxWidth: 1040, margin: '0 auto' }}>
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ margin: '0 0 8px', color: '#0f172a', fontSize: 30, letterSpacing: 0 }}>Intensive Work</h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: 14, lineHeight: 1.5 }}>
            Bounded work queue. AÏKO stops when it needs approval, login help, or a missing capability.
          </p>
        </div>

        <section style={{ ...card, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 800 }}>Status</div>
              <div style={{ fontSize: 24, fontWeight: 950, color: state?.enabled ? '#047857' : '#0f172a', marginTop: 4 }}>
                {state?.enabled ? 'Active' : 'Off'}
              </div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                Level: {(state?.level ?? 'off').replace(/_/g, ' ')} · Max {state?.max_actions_per_cycle ?? 3} actions/cycle
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button style={button} onClick={runCycle} disabled={loading}>{loading ? 'Running...' : 'Run one cycle'}</button>
              <button style={{ ...button, background: '#f8fafc', color: '#475569', borderColor: '#e2e8f0' }} onClick={pause} disabled={loading}>Pause</button>
            </div>
          </div>
          {message && <p style={{ margin: '12px 0 0', color: '#475569', fontSize: 13 }}>{message}</p>}
        </section>

        <QueueSection title="Active / Waiting" items={status?.active ?? []} />
        <QueueSection title="Queued" items={status?.queue ?? []} />
        <QueueSection title="Completed recently" items={status?.recent ?? []} />
      </div>
    </div>
  )
}

function QueueSection({ title, items }: { title: string; items: WorkItem[] }) {
  return (
    <section style={{ ...card, marginBottom: 16 }}>
      <h2 style={{ margin: '0 0 12px', fontSize: 16, color: '#0f172a' }}>{title}</h2>
      {items.length === 0 ? (
        <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>No work items here.</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map(item => (
            <div key={item.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#0f172a' }}>{item.work_type.replace(/_/g, ' ')}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{item.assigned_agent_name} · {item.assigned_role.replace(/_/g, ' ')}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 900, color: '#334155', background: '#f1f5f9', borderRadius: 999, padding: '5px 8px', height: 24 }}>
                  {item.status.replace(/_/g, ' ')}
                </span>
              </div>
              {(item.output_summary || item.blocked_reason) && (
                <p style={{ margin: '8px 0 0', color: item.blocked_reason ? '#b91c1c' : '#475569', fontSize: 13, lineHeight: 1.5 }}>
                  {item.output_summary ?? item.blocked_reason}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
