'use client'
import { useCallback, useEffect, useState } from 'react'

interface PMReport {
  id: string
  pm_name: string | null
  project_name?: string
  status: 'healthy' | 'attention' | 'blocked' | 'stale'
  summary: string
  progress: number
  blockers: string[]
  completed_work: string[]
  current_focus: string
  recommended_next_actions: string[]
  needs_client_approval: boolean
  created_at: string
}

interface Props {
  projectId: string
}

const STATUS_STYLE: Record<string, { dot: string; label: string; bg: string; border: string; text: string }> = {
  healthy:   { dot: '#10b981', label: 'Healthy',   bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
  attention: { dot: '#f59e0b', label: 'Attention', bg: '#fffbeb', border: '#fde68a', text: '#d97706' },
  blocked:   { dot: '#ef4444', label: 'Blocked',   bg: '#fef2f2', border: '#fecaca', text: '#dc2626' },
  stale:     { dot: '#94a3b8', label: 'Stale',     bg: '#f8fafc', border: '#e2e8f0', text: '#64748b' },
}

function relativeDate(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const LABEL: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, color: '#94a3b8',
  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
}

export function PMReportPanel({ projectId }: Props) {
  const [reports, setReports] = useState<PMReport[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/pm-reports`)
    const data = await res.json()
    setReports(data.reports ?? [])
  }, [projectId])

  useEffect(() => { load() }, [load])

  async function runReport() {
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/projects/${projectId}/pm-reports`, { method: 'POST' })
    const data = await res.json()
    setLoading(false)
    if (data.error) { setError(data.error); return }
    await load()
    setExpanded(true)
  }

  const latest = reports[0] ?? null
  const ss = latest ? (STATUS_STYLE[latest.status] ?? STATUS_STYLE.attention) : null

  return (
    <div style={{
      background: '#ffffff', borderRadius: 10,
      border: `1px solid ${ss ? ss.border : '#f1f5f9'}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      overflow: 'hidden',
    }}>
      {/* Panel header */}
      <div style={{
        padding: '14px 18px',
        background: ss ? ss.bg : '#fafafa',
        borderBottom: `1px solid ${ss ? ss.border : '#f1f5f9'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>
            PM Report
          </div>
          {latest && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: ss!.dot, flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 500, color: ss!.text }}>{ss!.label}</span>
            </div>
          )}
          {latest && (
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#94a3b8' }}>
              {relativeDate(latest.created_at)}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {latest && (
            <button
              onClick={() => setExpanded(e => !e)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 11, color: '#94a3b8', padding: '2px 6px',
              }}
            >
              {expanded ? 'collapse' : 'expand'}
            </button>
          )}
          <button
            onClick={runReport}
            disabled={loading}
            style={{
              background: loading ? '#f1f5f9' : '#0f172a',
              color: loading ? '#94a3b8' : '#ffffff',
              border: 'none', borderRadius: 6,
              padding: '5px 12px', fontSize: 11, fontWeight: 500,
              cursor: loading ? 'default' : 'pointer',
              letterSpacing: '-0.01em',
            }}
          >
            {loading ? 'Running…' : latest ? 'Re-run' : 'Run PM report'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 18px', background: '#fef2f2', fontSize: 12, color: '#ef4444' }}>
          {error}
        </div>
      )}

      {/* Empty state */}
      {!latest && !loading && !error && (
        <div style={{ padding: '24px 18px', textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
            No report yet. Run the PM report to get a structured status update from the assigned Project Manager.
          </div>
        </div>
      )}

      {/* Latest report */}
      {latest && (
        <div style={{ padding: '14px 18px' }}>
          {/* Progress bar */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>Progress</span>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#0f172a' }}>
                {latest.progress}%
              </span>
            </div>
            <div style={{ height: 4, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${latest.progress}%`,
                background: ss!.dot,
                borderRadius: 2,
                transition: 'width 0.4s ease',
              }} />
            </div>
          </div>

          {/* Summary */}
          <div style={{ marginBottom: expanded ? 14 : 0 }}>
            <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.65 }}>
              {latest.summary}
            </div>
            {latest.pm_name && (
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
                — {latest.pm_name}
              </div>
            )}
          </div>

          {/* Expanded detail */}
          {expanded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14, paddingTop: 14, borderTop: '1px solid #f8fafc' }}>

              {/* Current focus */}
              {latest.current_focus && (
                <div>
                  <div style={LABEL}>Current focus</div>
                  <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.5, fontStyle: 'italic' }}>
                    {latest.current_focus}
                  </div>
                </div>
              )}

              {/* Blockers */}
              {latest.blockers.length > 0 && (
                <div>
                  <div style={{ ...LABEL, color: '#ef4444' }}>Blockers</div>
                  {latest.blockers.map((b, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                      <span style={{ color: '#ef4444', fontSize: 11, flexShrink: 0 }}>!</span>
                      <span style={{ fontSize: 11, color: '#374151', lineHeight: 1.5 }}>{b}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Completed work */}
              {latest.completed_work.length > 0 && (
                <div>
                  <div style={LABEL}>Completed</div>
                  {latest.completed_work.map((w, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                      <span style={{ color: '#10b981', fontSize: 11, flexShrink: 0 }}>✓</span>
                      <span style={{ fontSize: 11, color: '#374151', lineHeight: 1.5 }}>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Recommended next actions */}
              {latest.recommended_next_actions.length > 0 && (
                <div>
                  <div style={LABEL}>Next actions</div>
                  {latest.recommended_next_actions.map((a, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 5 }}>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#cbd5e1', flexShrink: 0, minWidth: 14 }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span style={{ fontSize: 11, color: '#0f172a', lineHeight: 1.5 }}>{a}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Client approval needed */}
              {latest.needs_client_approval && (
                <div style={{
                  padding: '8px 12px', borderRadius: 7,
                  background: '#fffbeb', border: '1px solid #fde68a',
                  display: 'flex', gap: 8, alignItems: 'center',
                }}>
                  <span style={{ fontSize: 13 }}>⚠</span>
                  <span style={{ fontSize: 11, color: '#d97706', fontWeight: 500 }}>
                    Client approval required before next step
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Report history */}
      {reports.length > 1 && (
        <div style={{
          borderTop: '1px solid #f8fafc',
          padding: '8px 18px 12px',
        }}>
          <div style={{ ...LABEL, marginBottom: 6 }}>History</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {reports.slice(1, 6).map(r => {
              const s = STATUS_STYLE[r.status] ?? STATUS_STYLE.attention
              return (
                <button
                  key={r.id}
                  title={r.summary}
                  onClick={() => {
                    setReports(prev => [r, ...prev.filter(x => x.id !== r.id)])
                    setExpanded(true)
                  }}
                  style={{
                    background: '#f8fafc', border: '1px solid #e2e8f0',
                    borderRadius: 5, padding: '3px 8px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#94a3b8' }}>
                    {relativeDate(r.created_at)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
