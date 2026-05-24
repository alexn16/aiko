'use client'
import { useEffect, useState } from 'react'

interface LogEntry {
  id: string
  action: string
  mode: string
  project_id: string | null
  agent_role: string | null
  allowed: boolean
  reason: string | null
  created_at: string
}

type Filter = 'all' | 'allowed' | 'blocked'

const MODE_LABEL: Record<string, string> = {
  read_only: 'Read Only',
  auto_approval: 'Auto',
  full_access: 'Full Access',
}

export function ModeActionLog() {
  const [log, setLog] = useState<LogEntry[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)

  async function loadLog() {
    try {
      const param = filter === 'all' ? '' : `&allowed=${filter === 'allowed'}`
      const res = await fetch(`/api/mode/log?limit=100${param}`)
      const d = await res.json()
      setLog(d.log ?? [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLog()
    const interval = setInterval(loadLog, 30000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  const FILTERS: Array<{ key: Filter; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'allowed', label: 'Allowed' },
    { key: 'blocked', label: 'Blocked' },
  ]

  return (
    <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid #f1f5f9',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
          Action Log
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                background: filter === f.key ? '#0f172a' : 'transparent',
                color: filter === f.key ? '#fff' : '#64748b',
                border: '1px solid',
                borderColor: filter === f.key ? '#0f172a' : '#e2e8f0',
                borderRadius: 6, padding: '4px 10px',
                fontSize: 11, fontWeight: 500, cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '20px', fontSize: 12, color: '#94a3b8' }}>Loading…</div>
      ) : log.length === 0 ? (
        <div style={{ padding: '20px', fontSize: 12, color: '#94a3b8' }}>No log entries yet.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafafa' }}>
                {['', 'Action', 'Mode', 'Agent', 'Reason', 'Time'].map(h => (
                  <th key={h} style={{
                    padding: '8px 14px', fontSize: 10, fontWeight: 500,
                    color: '#94a3b8', textAlign: 'left',
                    borderBottom: '1px solid #f1f5f9',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {log.map(entry => (
                <tr key={entry.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '8px 14px', width: 20 }}>
                    <span style={{
                      display: 'inline-block', width: 16, height: 16,
                      borderRadius: '50%', lineHeight: '16px', textAlign: 'center',
                      background: entry.allowed ? '#d1fae5' : '#fee2e2',
                      fontSize: 10,
                    }}>
                      {entry.allowed ? '✓' : '✗'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 14px', fontSize: 12, color: '#0f172a', fontWeight: 500 }}>
                    {entry.action}
                  </td>
                  <td style={{ padding: '8px 14px', fontSize: 11, color: '#64748b' }}>
                    {MODE_LABEL[entry.mode] ?? entry.mode}
                  </td>
                  <td style={{ padding: '8px 14px', fontSize: 11, color: '#64748b' }}>
                    {entry.agent_role ?? '—'}
                  </td>
                  <td style={{ padding: '8px 14px', fontSize: 11, color: '#94a3b8', maxWidth: 260 }}>
                    <span title={entry.reason ?? ''} style={{
                      display: 'block', overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {entry.reason ?? '—'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 14px', fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                    {new Date(entry.created_at).toLocaleString()}
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
