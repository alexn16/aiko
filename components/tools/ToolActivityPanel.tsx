'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

interface ToolRun {
  id: string
  tool_type: string
  status: string
  agent_role: string
  action: string
  created_at: string
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)   return `${Math.round(diff)}s`
  if (diff < 3600) return `${Math.round(diff / 60)}m`
  return `${Math.round(diff / 3600)}h`
}

function statusDot(status: string) {
  const c: Record<string, string> = {
    completed: '#10b981',
    failed:    '#ef4444',
    running:   '#3b82f6',
    pending:   '#94a3b8',
  }
  return <span style={{ width: 6, height: 6, borderRadius: '50%', background: c[status] ?? '#94a3b8', display: 'inline-block', flexShrink: 0 }} />
}

export function ToolActivityPanel() {
  const [runs, setRuns] = useState<ToolRun[]>([])
  const [counts, setCounts] = useState({ active: 0, completed: 0, failed: 0 })

  const load = useCallback(async () => {
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const res = await fetch('/api/tool-runs?limit=50')
      const d = await res.json()
      const all: ToolRun[] = d.runs ?? []

      // Filter last 24h
      const recent = all.filter(r => new Date(r.created_at) >= new Date(since))
      setCounts({
        active:    recent.filter(r => r.status === 'running').length,
        completed: recent.filter(r => r.status === 'completed').length,
        failed:    recent.filter(r => r.status === 'failed').length,
      })
      setRuns(all.slice(0, 5))
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [load])

  return (
    <div style={{
      background: '#ffffff', borderRadius: 10,
      border: '1px solid #f1f5f9',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      padding: '16px 18px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>Tool Activity</div>
        <Link href="/tool-runs" style={{ fontSize: 11, color: '#6366f1', textDecoration: 'none' }}>
          View all →
        </Link>
      </div>

      {/* Counts */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'Active',    count: counts.active,    color: '#3b82f6' },
          { label: 'Done',      count: counts.completed, color: '#10b981' },
          { label: 'Failed',    count: counts.failed,    color: '#ef4444' },
        ].map(item => (
          <div key={item.label} style={{
            flex: 1, textAlign: 'center',
            padding: '8px 6px', borderRadius: 7,
            background: '#fafafa', border: '1px solid #f1f5f9',
          }}>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 18, color: item.color, fontWeight: 400 }}>
              {item.count}
            </div>
            <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2, fontWeight: 500 }}>
              {item.label}
            </div>
          </div>
        ))}
      </div>

      {/* Recent runs */}
      {runs.length === 0 && (
        <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>No tool runs yet.</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {runs.map(run => (
          <div key={run.id} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11 }}>
            {statusDot(run.status)}
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#cbd5e1', flexShrink: 0, minWidth: 24 }}>
              {timeAgo(run.created_at)}
            </span>
            <span style={{ color: '#64748b', flexShrink: 0 }}>
              {run.tool_type.replace(/_/g, ' ')}
            </span>
            <span style={{ color: '#94a3b8', fontSize: 10, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              · {run.agent_role}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
