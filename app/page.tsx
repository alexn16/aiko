'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

const PROJECT_ID = process.env.NEXT_PUBLIC_DEFAULT_PROJECT_ID ?? ''

const quickLinks = [
  { href: '/dashboard', label: 'Open Dashboard', description: 'See operational metrics, active agents, and activity feed.' },
  { href: '/office', label: 'Open Live Office', description: 'Watch agents run and dispatch focused instructions.' },
  { href: '/leads', label: 'Review Leads', description: 'Inspect, enrich, and qualify the lead pipeline.' },
  { href: '/approval', label: 'Open Approval Center', description: 'Approve or reject outbound drafts before any send.' },
  { href: '/reports', label: 'View Reports', description: 'Track outcomes and strategic recommendations.' },
]

const flow = [
  { label: '1. Home', detail: 'Set context and open the right work surface.' },
  { label: '2. Live Office', detail: 'Agents run research, enrichment, and drafting tasks.' },
  { label: '3. Approval Center', detail: 'Humans review and approve before send.' },
  { label: '4. Dashboard / Reports', detail: 'Monitor performance and refine strategy.' },
]

interface Stats { leads: number; sent: number; replies: number; pending: number }
interface StreamAgent { status: string }
interface StreamLog { created_at: string; action: string; details?: unknown }

export default function Home() {
  const [projectId, setProjectId] = useState(PROJECT_ID)
  const [projectName, setProjectName] = useState('No active project')
  const [stats, setStats] = useState<Stats | null>(null)
  const [activeAgents, setActiveAgents] = useState(0)
  const [lastActivity, setLastActivity] = useState('No live events yet')
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) return
    const source = new EventSource(`/api/agents/stream?projectId=${projectId}`)

    source.onmessage = (e) => {
      const data = JSON.parse(e.data) as { agents?: StreamAgent[]; logs?: StreamLog[] }
      if (data.agents) {
        setActiveAgents(data.agents.filter((a) => a.status !== 'idle').length)
      }
      if (data.logs?.[0]) {
        const latest = data.logs[0]
        const detail = latest.details && typeof latest.details === 'object'
          ? String((latest.details as Record<string, unknown>).thought ?? latest.action)
          : latest.action
        setLastActivity(detail.slice(0, 88))
        setLastUpdatedAt(latest.created_at)
      } else {
        setLastUpdatedAt(new Date().toISOString())
      }
    }

    return () => source.close()
  }, [projectId])

  const livePulse = useMemo(() => (activeAgents > 0 ? 'Active' : 'Standby'), [activeAgents])

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((d) => {
        const project = projectId
          ? (d.projects?.find((p: { id: string; name: string }) => p.id === projectId) ?? d.projects?.[0])
          : d.projects?.[0]
        if (!project) return
        if (!projectId) setProjectId(project.id)
        setProjectName(project.name)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!projectId) return
    fetch(`/api/stats?projectId=${projectId}`)
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => {})
  }, [projectId])

  return (
    <div style={{ padding: 32, maxWidth: 980 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, letterSpacing: '0.12em', color: '#9ca3af', textTransform: 'uppercase' }}>
          AÏKO · AI Marketing Operating System
        </div>
        <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: 32, fontWeight: 500, lineHeight: 1.2, color: '#111827', margin: '10px 0 14px' }}>
          Build, validate, and scale outbound growth with specialized AI agents.
        </h1>
        <p style={{ margin: 0, color: '#6b7280', maxWidth: 760, lineHeight: 1.6, fontSize: 14 }}>
          AÏKO is not a general chatbot. It is an always-running, human-supervised marketing company layer for research, lead generation,
          copywriting, outreach monitoring, and sales validation.
        </p>
      </div>

      <section style={{ marginBottom: 24, border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, background: '#ffffff' }}>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
          System Status
        </div>
        <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 12 }}>
          Active project: <span style={{ color: '#111827', fontWeight: 500 }}>{projectName}</span>
          <span style={{ marginLeft: 12, color: livePulse === 'Active' ? '#16a34a' : '#9ca3af' }}>● {livePulse}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(90px, 1fr))', gap: 10 }}>
          {[
            { label: 'Leads', value: stats?.leads ?? '—' },
            { label: 'Sent', value: stats?.sent ?? '—' },
            { label: 'Replies', value: stats?.replies ?? '—' },
            { label: 'Pending', value: stats?.pending ?? '—' },
            { label: 'Active agents', value: activeAgents },
          ].map((item) => (
            <div key={item.label} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, background: '#f9fafb' }}>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9ca3af', marginBottom: 6 }}>{item.label}</div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 20, color: '#111827' }}>{item.value}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, color: '#9ca3af', fontSize: 12 }}>
          Latest activity: {lastActivity} {lastUpdatedAt ? `· ${new Date(lastUpdatedAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}
        </div>
      </section>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 28 }}>
        <Link href="/dashboard" style={{ textDecoration: 'none', background: '#111827', color: '#ffffff', padding: '9px 14px', borderRadius: 6, fontFamily: 'Inter, sans-serif', fontSize: 13 }}>
          Open Dashboard
        </Link>
        <Link href="/approval" style={{ textDecoration: 'none', background: '#ffffff', border: '1px solid #e5e7eb', color: '#374151', padding: '9px 14px', borderRadius: 6, fontFamily: 'Inter, sans-serif', fontSize: 13 }}>
          Review Pending Approvals
        </Link>
        <Link href="/settings" style={{ textDecoration: 'none', background: '#ffffff', border: '1px solid #e5e7eb', color: '#374151', padding: '9px 14px', borderRadius: 6, fontFamily: 'Inter, sans-serif', fontSize: 13 }}>
          Configure Models & SMTP
        </Link>
      </div>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>
          Campaign Flow
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
          {flow.map((step) => (
            <div key={step.label} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 14, background: '#ffffff' }}>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#111827', marginBottom: 6 }}>{step.label}</div>
              <div style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.5 }}>{step.detail}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>
          Start Here
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {quickLinks.map((item) => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none', color: 'inherit', border: '1px solid #e5e7eb', background: '#ffffff', borderRadius: 8, padding: 14 }}>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 500, color: '#111827', marginBottom: 6 }}>{item.label}</div>
              <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>{item.description}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
