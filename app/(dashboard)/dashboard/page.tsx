'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { AgentGrid } from '@/components/agents/AgentGrid'
import { ActivityFeed } from '@/components/agents/ActivityFeed'
import { Card } from '@/components/ui/Card'
import { Agent, AgentLog } from '@/lib/db/schema'

const PROJECT_ID = process.env.NEXT_PUBLIC_DEFAULT_PROJECT_ID ?? ''

interface Stats { leads: number; sent: number; replies: number; pending: number }

const METRICS = [
  { key: 'leads',   label: 'Leads found',      color: '#0f172a' },
  { key: 'sent',    label: 'Messages sent',     color: '#10b981' },
  { key: 'replies', label: 'Replies',           color: '#f59e0b' },
  { key: 'pending', label: 'Pending approval',  color: '#6366f1' },
]

export default function DashboardPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [logs, setLogs] = useState<AgentLog[]>([])
  const [stats, setStats] = useState<Stats>({ leads: 0, sent: 0, replies: 0, pending: 0 })
  const [projectId, setProjectId] = useState(PROJECT_ID)

  useEffect(() => {
    if (!projectId) {
      fetch('/api/projects').then(r => r.json()).then(d => {
        if (d.projects?.[0]?.id) setProjectId(d.projects[0].id)
      }).catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!projectId) return
    const src = new EventSource(`/api/agents/stream?projectId=${projectId}`)
    src.onmessage = e => {
      const d = JSON.parse(e.data)
      if (d.agents) setAgents(d.agents)
      if (d.logs) setLogs(d.logs)
    }
    return () => src.close()
  }, [projectId])

  useEffect(() => {
    if (!projectId) return
    fetch(`/api/stats?projectId=${projectId}`)
      .then(r => r.json()).then(setStats).catch(() => {})
  }, [projectId])

  return (
    <div style={{ padding: '40px 32px' }} className="page-enter">
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
          Dashboard
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
          Real-time performance across all agent activity.
        </p>
      </div>

      {/* Metrics row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        {METRICS.map(m => (
          <Card key={m.key} padding={18}>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, marginBottom: 6 }}>{m.label}</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: m.color, letterSpacing: '-0.03em', lineHeight: 1 }}>
              {stats[m.key as keyof Stats]}
            </div>
          </Card>
        ))}
      </div>

      {/* Agents + feed */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', marginBottom: 12 }}>Agents</div>
          <AgentGrid agents={agents} />
        </div>

        <Card>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', marginBottom: 14 }}>Activity</div>
          <ActivityFeed logs={logs} />
        </Card>
      </div>
    </div>
  )
}
