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
    // Get first project if no default set
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

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontFamily: 'Noto Serif JP, serif', fontWeight: 300, fontSize: 22, color: '#e8e6e0', marginBottom: 24 }}>
        AÏKO
      </h1>

      {/* Metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Leads found',       value: stats.leads,   color: '#e8e6e0' },
          { label: 'Messages sent',     value: stats.sent,    color: '#7eb88a' },
          { label: 'Replies',           value: stats.replies, color: '#c8a84a' },
          { label: 'Pending approval',  value: stats.pending, color: '#7098c8' },
        ].map(m => (
          <Card key={m.label}>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#666', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>{m.label}</div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 28, color: m.color, fontWeight: 300 }}>{m.value}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
        <div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#666', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>Active agents</div>
          <AgentGrid agents={agents} maxCount={4} />
        </div>

        <Card>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#666', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>Activity</div>
          <ActivityFeed logs={logs} />
        </Card>
      </div>
    </div>
  )
}
