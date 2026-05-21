'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { AgentGrid } from '@/components/agents/AgentGrid'
import { ActivityFeed } from '@/components/agents/ActivityFeed'
import { Card } from '@/components/ui/Card'
import { Agent, AgentLog } from '@/lib/db/schema'

const PROJECT_ID = process.env.NEXT_PUBLIC_DEFAULT_PROJECT_ID ?? ''

interface Stats {
  leads: number
  sent: number
  replies: number
  pending: number
}

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
    const source = new EventSource(`/api/agents/stream?projectId=${projectId}`)
    source.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.agents) setAgents(data.agents)
      if (data.logs) setLogs(data.logs)
    }
    return () => source.close()
  }, [projectId])

  useEffect(() => {
    if (!projectId) return
    fetch(`/api/stats?projectId=${projectId}`)
      .then(r => r.json())
      .then(d => setStats(d))
      .catch(() => {})
  }, [projectId])

  const METRIC_COLORS: Record<string, string> = {
    'Leads found': '#111827',
    'Messages sent': '#16a34a',
    'Replies': '#d97706',
    'Pending approval': '#2563eb',
  }

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 20, color: '#111827', marginBottom: 24 }}>
        AÏKO
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Leads found',      value: stats.leads },
          { label: 'Messages sent',    value: stats.sent },
          { label: 'Replies',          value: stats.replies },
          { label: 'Pending approval', value: stats.pending },
        ].map(m => (
          <Card key={m.label}>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#9ca3af', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>{m.label}</div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 28, color: METRIC_COLORS[m.label], fontWeight: 300 }}>{m.value}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
        <div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#9ca3af', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>Active agents</div>
          <AgentGrid agents={agents} maxCount={4} />
        </div>

        <Card>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#9ca3af', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>Activity</div>
          <ActivityFeed logs={logs} />
        </Card>
      </div>
    </div>
  )
}
