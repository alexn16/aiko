'use client'
import { useEffect, useState, useCallback } from 'react'

export const dynamic = 'force-dynamic'

interface ToolRun {
  id: string
  project_id: string | null
  project_name: string | null
  agent_role: string
  tool_type: string
  action: string
  status: string
  input: Record<string, unknown>
  output: Record<string, unknown>
  error: string | null
  permission_mode: string
  created_at: string
  completed_at: string | null
}

type FilterStatus = 'all' | 'completed' | 'failed' | 'blocked'

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)   return `${Math.round(diff)}s ago`
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  return `${Math.round(diff / 86400)}d ago`
}

function statusBadge(status: string) {
  const styles: Record<string, React.CSSProperties> = {
    completed: { background: '#d1fae5', color: '#065f46' },
    failed:    { background: '#fee2e2', color: '#991b1b' },
    running:   { background: '#dbeafe', color: '#1e40af' },
    pending:   { background: '#f1f5f9', color: '#64748b' },
    blocked:   { background: '#fef3c7', color: '#92400e' },
  }
  const s = styles[status] ?? styles.pending
  return (
    <span style={{
      ...s,
      fontSize: 10, fontWeight: 600,
      padding: '2px 7px', borderRadius: 4,
      textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      {status}
    </span>
  )
}

function toolBadge(tool_type: string) {
  const colors: Record<string, { bg: string; fg: string }> = {
    web_search:     { bg: '#ede9fe', fg: '#4c1d95' },
    website_reader: { bg: '#e0f2fe', fg: '#0c4a6e' },
    email:          { bg: '#fce7f3', fg: '#831843' },
  }
  const c = colors[tool_type] ?? { bg: '#f1f5f9', fg: '#374151' }
  return (
    <span style={{
      background: c.bg, color: c.fg,
      fontSize: 10, fontWeight: 600,
      padding: '2px 7px', borderRadius: 4,
    }}>
      {tool_type.replace(/_/g, ' ')}
    </span>
  )
}

function truncateJson(obj: Record<string, unknown>, max = 80): string {
  const s = JSON.stringify(obj)
  if (s.length <= max) return s
  return s.slice(0, max) + '…'
}

export default function ToolRunsPage() {
  const [runs, setRuns] = useState<ToolRun[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterStatus>('all')

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (filter !== 'all') params.set('status', filter)
      const res = await fetch(`/api/tool-runs?${params}`)
      const d = await res.json()
      setRuns(d.runs ?? [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 30s
  useEffect(() => {
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [load])

  const TABS: { id: FilterStatus; label: string }[] = [
    { id: 'all',       label: 'All' },
    { id: 'completed', label: 'Completed' },
    { id: 'failed',    label: 'Failed' },
    { id: 'blocked',   label: 'Blocked' },
  ]

  return (
    <div style={{ padding: '40px 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
          Tool Runs
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
          Log of all agent tool executions.
        </p>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9', marginBottom: 20, gap: 0 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 4px', marginRight: 16,
              fontSize: 13,
              fontWeight: filter === t.id ? 500 : 400,
              color: filter === t.id ? '#0f172a' : '#94a3b8',
              borderBottom: filter === t.id ? '2px solid #0f172a' : '2px solid transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div style={{ fontSize: 13, color: '#94a3b8' }}>Loading…</div>}

      {!loading && runs.length === 0 && (
        <div style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>
          No tool runs found. Tool executions will appear here.
        </div>
      )}

      {!loading && runs.length > 0 && (
        <div style={{
          background: '#ffffff', borderRadius: 10,
          border: '1px solid #f1f5f9',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafafa' }}>
                {['Time', 'Agent', 'Project', 'Tool', 'Action', 'Status', 'Input', 'Output', 'Mode', 'Error'].map(h => (
                  <th key={h} style={{
                    padding: '9px 12px',
                    fontSize: 10, fontWeight: 500, color: '#94a3b8',
                    textAlign: 'left', borderBottom: '1px solid #f1f5f9',
                    whiteSpace: 'nowrap',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map(run => (
                <tr key={run.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '9px 12px', fontSize: 11, color: '#94a3b8', fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap' }}>
                    {timeAgo(run.created_at)}
                  </td>
                  <td style={{ padding: '9px 12px', fontSize: 11, color: '#374151' }}>
                    {run.agent_role}
                  </td>
                  <td style={{ padding: '9px 12px', fontSize: 11, color: '#64748b', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {run.project_name ?? '—'}
                  </td>
                  <td style={{ padding: '9px 12px' }}>
                    {toolBadge(run.tool_type)}
                  </td>
                  <td style={{ padding: '9px 12px', fontSize: 11, color: '#374151' }}>
                    {run.action}
                  </td>
                  <td style={{ padding: '9px 12px' }}>
                    {statusBadge(run.status)}
                  </td>
                  <td style={{ padding: '9px 12px', fontSize: 10, color: '#94a3b8', fontFamily: 'DM Mono, monospace', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {truncateJson(run.input)}
                  </td>
                  <td style={{ padding: '9px 12px', fontSize: 10, color: '#94a3b8', fontFamily: 'DM Mono, monospace', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {truncateJson(run.output)}
                  </td>
                  <td style={{ padding: '9px 12px', fontSize: 10, color: '#64748b' }}>
                    <span style={{
                      background: '#f1f5f9', borderRadius: 4,
                      padding: '1px 6px', fontSize: 10,
                    }}>
                      {run.permission_mode}
                    </span>
                  </td>
                  <td style={{ padding: '9px 12px', fontSize: 11, color: '#ef4444', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {run.error ?? ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
