'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

const PROJECT_ID = process.env.NEXT_PUBLIC_DEFAULT_PROJECT_ID ?? ''

interface Stats { leads: number; sent: number; replies: number; pending: number }
interface StreamAgent { status: string }
interface StreamLog { created_at: string; action: string; details?: unknown }

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function Home() {
  const [projectId, setProjectId] = useState(PROJECT_ID)
  const [projectName, setProjectName] = useState('')
  const [stats, setStats] = useState<Stats | null>(null)
  const [activeAgents, setActiveAgents] = useState(0)
  const [recentLogs, setRecentLogs] = useState<StreamLog[]>([])

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(d => {
        const p = projectId
          ? d.projects?.find((x: { id: string }) => x.id === projectId) ?? d.projects?.[0]
          : d.projects?.[0]
        if (!p) return
        if (!projectId) setProjectId(p.id)
        setProjectName(p.name)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!projectId) return
    fetch(`/api/stats?projectId=${projectId}`)
      .then(r => r.json()).then(setStats).catch(() => {})
  }, [projectId])

  useEffect(() => {
    if (!projectId) return
    const src = new EventSource(`/api/agents/stream?projectId=${projectId}`)
    src.onmessage = e => {
      const d = JSON.parse(e.data) as { agents?: StreamAgent[]; logs?: StreamLog[] }
      if (d.agents) setActiveAgents(d.agents.filter(a => a.status !== 'idle').length)
      if (d.logs) setRecentLogs(d.logs.slice(0, 4))
    }
    return () => src.close()
  }, [projectId])

  const isActive = activeAgents > 0

  return (
    <div style={{ padding: '48px 40px', maxWidth: 840 }} className="page-enter">
      {/* Greeting */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 6px', fontWeight: 400 }}>
          {getGreeting()}
        </p>
        <h1 style={{
          fontSize: 28, fontWeight: 700, color: '#0f172a',
          letterSpacing: '-0.03em', margin: 0, lineHeight: 1.15,
        }}>
          {projectName || 'Your marketing OS is ready.'}
        </h1>
      </div>

      {/* Status strip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '12px 16px', background: '#ffffff',
        borderRadius: 10, border: '1px solid #f1f5f9',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        marginBottom: 32, fontSize: 13,
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: isActive ? '#10b981' : '#cbd5e1',
            display: 'inline-block',
            animation: isActive ? 'pulse 2s ease-in-out infinite' : undefined,
          }} />
          <span style={{ color: isActive ? '#10b981' : '#94a3b8', fontWeight: 500 }}>
            {isActive ? 'Active' : 'Standby'}
          </span>
        </span>
        <span style={{ color: '#e2e8f0' }}>·</span>
        <span style={{ color: '#64748b' }}>
          <strong style={{ color: '#0f172a', fontWeight: 600 }}>{activeAgents}</strong> agents running
        </span>
        {projectName && (
          <>
            <span style={{ color: '#e2e8f0' }}>·</span>
            <span style={{ color: '#64748b' }}>{projectName}</span>
          </>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
        {[
          { label: 'Leads', value: stats?.leads },
          { label: 'Sent', value: stats?.sent },
          { label: 'Replies', value: stats?.replies },
          { label: 'Pending', value: stats?.pending },
        ].map(s => (
          <div key={s.label} style={{
            background: '#ffffff', borderRadius: 10,
            border: '1px solid #f1f5f9',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            padding: '16px 18px',
          }}>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.03em', lineHeight: 1 }}>
              {s.value ?? '—'}
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 40, flexWrap: 'wrap' }}>
        <Link href="/dashboard" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: '#0f172a', color: '#ffffff',
          padding: '9px 16px', borderRadius: 8, textDecoration: 'none',
          fontSize: 13, fontWeight: 500, letterSpacing: '-0.01em',
        }}>
          Open Dashboard →
        </Link>
        <Link href="/approval" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: '#ffffff', color: '#374151',
          border: '1px solid #e2e8f0',
          padding: '9px 16px', borderRadius: 8, textDecoration: 'none',
          fontSize: 13, fontWeight: 500,
        }}>
          Approval Center
          {(stats?.pending ?? 0) > 0 && (
            <span style={{
              background: '#f59e0b', color: '#ffffff',
              borderRadius: 10, fontSize: 10, fontWeight: 600,
              padding: '1px 6px', minWidth: 18, textAlign: 'center',
            }}>
              {stats!.pending}
            </span>
          )}
        </Link>
        <Link href="/settings" style={{
          display: 'inline-flex', alignItems: 'center',
          background: '#ffffff', color: '#64748b',
          border: '1px solid #e2e8f0',
          padding: '9px 16px', borderRadius: 8, textDecoration: 'none',
          fontSize: 13, fontWeight: 500,
        }}>
          Settings
        </Link>
      </div>

      {/* Recent activity */}
      {recentLogs.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', marginBottom: 12 }}>
            Recent activity
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {recentLogs.map((log, i) => {
              const text = log.details && typeof log.details === 'object'
                ? String((log.details as Record<string, unknown>).thought ?? log.action)
                : log.action
              return (
                <div key={i} style={{
                  display: 'flex', gap: 12, padding: '8px 0',
                  borderBottom: i < recentLogs.length - 1 ? '1px solid #f8fafc' : 'none',
                  alignItems: 'flex-start',
                }}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#cbd5e1', minWidth: 52, paddingTop: 1 }}>
                    {new Date(log.created_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span style={{ fontSize: 13, color: '#64748b', lineHeight: 1.4 }}>
                    {text.slice(0, 100)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
