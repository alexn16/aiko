'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'

interface WebOperator {
  id: string
  name: string
  role: string
  status: string
  current_url: string | null
  current_task: string | null
  current_goal: string | null
  current_workflow: string | null
  requires_user_input: boolean
  waiting_reason: string | null
  pending_action_type: string | null
  pending_action_payload: Record<string, unknown> | null
  pending_action_created_at: string | null
  latest_screenshot?: string | null
  updated_at: string
}

interface Action {
  id: string
  action_type: string
  description: string
  status: string
  target_url: string | null
  page_title: string | null
  screenshot_url: string | null
  failure_reason: string | null
  is_sensitive: boolean
  requires_approval: boolean
  approval_item_id: string | null
  skill_id: string | null
  skill_name: string | null
  skill_decision: Record<string, unknown> | null
  created_at: string
}

const STATUS_COLOR: Record<string, string> = {
  idle: '#94a3b8',
  working: '#3b82f6',
  waiting_user: '#f59e0b',
  waiting_approval: '#f59e0b',
  user_controlling: '#8b5cf6',
  ready_to_resume: '#10b981',
  paused: '#f97316',
  error: '#ef4444',
}

const STATUS_LABEL: Record<string, string> = {
  idle: 'Idle',
  working: 'Working',
  waiting_user: 'Waiting for user',
  waiting_approval: 'Waiting approval',
  user_controlling: 'User controlling',
  ready_to_resume: 'Ready to resume',
  paused: 'Paused',
  error: 'Error',
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? '#94a3b8'
  const label = STATUS_LABEL[status] ?? status.replace(/_/g, ' ')
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: color + '18', border: `1px solid ${color}40`,
      borderRadius: 6, padding: '3px 9px',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 11, color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
    </span>
  )
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return `${Math.round(diff)}s ago`
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  return `${Math.round(diff / 86400)}d ago`
}

function truncate(str: string | null | undefined, n = 50): string {
  if (!str) return ''
  return str.length > n ? str.slice(0, n) + '…' : str
}

export default function OperatorDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const [operator, setOperator] = useState<WebOperator | null>(null)
  const [actions, setActions] = useState<Action[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null)
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [extractingLeads, setExtractingLeads] = useState<Record<string, boolean>>({})
  const [extractResult, setExtractResult] = useState<Record<string, number | null>>({})
  const [resumingAction, setResumingAction] = useState<Record<string, boolean>>({})
  const [resumeResult, setResumeResult] = useState<Record<string, { ok: boolean; message: string } | null>>({})

  const load = useCallback(async () => {
    try {
      const [opRes, actRes] = await Promise.all([
        fetch(`/api/web-operators/${id}`),
        fetch(`/api/web-operator/actions?operator_id=${id}&limit=20`),
      ])
      if (opRes.ok) {
        const d = await opRes.json()
        setOperator(d.operator ?? null)
      }
      if (actRes.ok) {
        const d = await actRes.json()
        setActions(d.actions ?? [])
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
    const interval = setInterval(load, 10000)
    return () => clearInterval(interval)
  }, [load])

  async function doAction(action: string, extra?: Record<string, unknown>) {
    setActionLoading(action)
    try {
      const res = await fetch(`/api/web-operators/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      const data = await res.json()
      const ok = data.success !== false && res.ok
      const message = data.message ?? (ok ? 'Done.' : 'Action failed.')
      setFeedback({ ok, message })
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
      feedbackTimer.current = setTimeout(() => setFeedback(null), 5000)
      await load()
    } catch (err) {
      setFeedback({ ok: false, message: String(err) })
    } finally {
      setActionLoading(null)
    }
  }

  const CARD: React.CSSProperties = {
    background: '#ffffff',
    border: '1px solid #f1f5f9',
    borderRadius: 10,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    padding: '16px 20px',
    marginBottom: 16,
  }

  const BTN: React.CSSProperties = {
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    padding: '7px 14px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    background: '#f8fafc',
    color: '#374151',
  }

  const BTN_LOADING: React.CSSProperties = {
    ...BTN,
    opacity: 0.6,
    cursor: 'not-allowed',
  }

  if (loading) {
    return (
      <div style={{ padding: '40px 32px', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
    )
  }

  if (!operator) {
    return (
      <div style={{ padding: '40px 32px' }}>
        <Link href="/operators" style={{ fontSize: 12, color: '#6366f1', textDecoration: 'none' }}>← All operators</Link>
        <div style={{ marginTop: 20, color: '#ef4444', fontSize: 13 }}>Operator not found.</div>
      </div>
    )
  }

  const showResume = operator.status === 'ready_to_resume' || !!operator.pending_action_type

  const handleResumeAction = async (actionId: string) => {
    setResumingAction(prev => ({ ...prev, [actionId]: true }))
    setResumeResult(prev => ({ ...prev, [actionId]: null }))
    try {
      const res = await fetch(`/api/web-operator/actions/${actionId}/resume`, { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        setResumeResult(prev => ({ ...prev, [actionId]: { ok: true, message: data.message ?? 'Action completed.' } }))
        await load()
      } else {
        setResumeResult(prev => ({ ...prev, [actionId]: { ok: false, message: data.error ?? 'Resume failed.' } }))
      }
    } catch (err) {
      setResumeResult(prev => ({ ...prev, [actionId]: { ok: false, message: String(err) } }))
    } finally {
      setResumingAction(prev => ({ ...prev, [actionId]: false }))
    }
  }

  const handleExtractLeads = async (actionId: string) => {
    setExtractingLeads(prev => ({ ...prev, [actionId]: true }))
    try {
      const res = await fetch('/api/leads/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          web_operator_action_id: actionId,
          project_id: (operator as WebOperator & { project_id?: string }).project_id ?? undefined,
        }),
      })
      const data = await res.json()
      const count = data.count ?? 0
      setExtractResult(prev => ({ ...prev, [actionId]: count }))
      setTimeout(() => setExtractResult(prev => ({ ...prev, [actionId]: null })), 3000)
    } finally {
      setExtractingLeads(prev => ({ ...prev, [actionId]: false }))
    }
  }

  return (
    <div style={{ padding: '40px 32px', maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Link href="/operators" style={{ fontSize: 12, color: '#6366f1', textDecoration: 'none', marginBottom: 12, display: 'inline-block' }}>
          ← All operators
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>
            {operator.name}
          </span>
          <StatusBadge status={operator.status} />
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
          Updated {timeAgo(operator.updated_at)}
        </div>
      </div>

      {/* Status cards row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        <div style={{ ...CARD, marginBottom: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            Current workflow
          </div>
          <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 500 }}>
            {operator.current_workflow ?? 'None'}
          </div>
        </div>
        <div style={{ ...CARD, marginBottom: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            Current goal
          </div>
          <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 500 }} title={operator.current_goal ?? undefined}>
            {truncate(operator.current_goal, 60) || 'Idle'}
          </div>
        </div>
        <div style={{ ...CARD, marginBottom: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            Current URL
          </div>
          {operator.current_url ? (
            <a
              href={operator.current_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 11, color: '#6366f1', textDecoration: 'none', fontFamily: 'DM Mono, monospace', wordBreak: 'break-all' }}
            >
              {truncate(operator.current_url, 50)}
            </a>
          ) : (
            <div style={{ fontSize: 13, color: '#94a3b8' }}>—</div>
          )}
        </div>
      </div>

      {/* Waiting state banner */}
      {operator.requires_user_input && (
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: 10,
          padding: '16px 20px',
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>
            Operator waiting for user input
          </div>
          {operator.waiting_reason && (
            <div style={{ fontSize: 13, color: '#78350f', marginBottom: 12 }}>
              Reason: {operator.waiting_reason}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => doAction('mark_login_completed')}
              disabled={actionLoading === 'mark_login_completed'}
              style={actionLoading === 'mark_login_completed' ? BTN_LOADING : {
                ...BTN,
                background: '#f59e0b',
                color: '#ffffff',
                border: '1px solid #f59e0b',
              }}
            >
              {actionLoading === 'mark_login_completed' ? 'Checking…' : 'Mark login completed'}
            </button>
            <button
              onClick={() => doAction('mark_user_controlling')}
              disabled={actionLoading === 'mark_user_controlling'}
              style={actionLoading === 'mark_user_controlling' ? BTN_LOADING : {
                ...BTN,
                background: '#8b5cf6',
                color: '#ffffff',
                border: '1px solid #8b5cf6',
              }}
            >
              {actionLoading === 'mark_user_controlling' ? 'Updating…' : 'Mark: I\'m in control'}
            </button>
          </div>
        </div>
      )}

      {/* Feedback message */}
      {feedback && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 8,
          marginBottom: 16,
          background: feedback.ok ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${feedback.ok ? '#bbf7d0' : '#fecaca'}`,
          color: feedback.ok ? '#166534' : '#dc2626',
          fontSize: 13,
          fontWeight: 500,
        }}>
          {feedback.ok ? '✓ ' : '✗ '}{feedback.message}
        </div>
      )}

      {/* Latest screenshot */}
      {operator.latest_screenshot && (
        <div style={{ ...CARD }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Latest screenshot
          </div>
          <img
            src={operator.latest_screenshot}
            alt="Latest operator screenshot"
            style={{ width: '100%', maxWidth: 600, borderRadius: 8, border: '1px solid #e2e8f0' }}
          />
        </div>
      )}

      {/* Pending action card */}
      {operator.pending_action_type && (
        <div style={{
          ...CARD,
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
            Pending action: <span style={{ color: '#6366f1', fontFamily: 'DM Mono, monospace' }}>{operator.pending_action_type}</span>
          </div>
          {operator.pending_action_created_at && (
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>
              Since: {timeAgo(operator.pending_action_created_at)}
            </div>
          )}
          {operator.pending_action_payload && (
            <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'DM Mono, monospace', marginBottom: 12, wordBreak: 'break-all' }}>
              {JSON.stringify(operator.pending_action_payload).slice(0, 100)}
            </div>
          )}
          {showResume && (
            <button
              onClick={() => doAction('resume_workflow')}
              disabled={actionLoading === 'resume_workflow'}
              style={actionLoading === 'resume_workflow' ? BTN_LOADING : {
                ...BTN,
                background: '#10b981',
                color: '#ffffff',
                border: '1px solid #10b981',
              }}
            >
              {actionLoading === 'resume_workflow' ? 'Resuming…' : 'Resume workflow'}
            </button>
          )}
        </div>
      )}

      {/* Action buttons row */}
      <div style={{ ...CARD }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 12 }}>
          Operator controls
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => doAction('pause')}
            disabled={!!actionLoading}
            style={actionLoading ? BTN_LOADING : BTN}
          >
            {actionLoading === 'pause' ? 'Pausing…' : 'Pause operator'}
          </button>
          <button
            onClick={() => doAction('clear_workflow')}
            disabled={!!actionLoading}
            style={actionLoading ? BTN_LOADING : BTN}
          >
            {actionLoading === 'clear_workflow' ? 'Clearing…' : 'Clear workflow'}
          </button>
          <button
            onClick={() => doAction('mark_user_controlling')}
            disabled={!!actionLoading}
            style={actionLoading ? BTN_LOADING : {
              ...BTN,
              background: '#ede9fe',
              color: '#6d28d9',
              border: '1px solid #c4b5fd',
            }}
          >
            {actionLoading === 'mark_user_controlling' ? 'Updating…' : 'Mark: I\'m in control'}
          </button>
          {showResume && (
            <button
              onClick={() => doAction('resume_workflow')}
              disabled={!!actionLoading}
              style={actionLoading ? BTN_LOADING : {
                ...BTN,
                background: '#0f172a',
                color: '#ffffff',
                border: '1px solid #0f172a',
              }}
            >
              {actionLoading === 'resume_workflow' ? 'Resuming…' : 'Resume workflow'}
            </button>
          )}
        </div>
      </div>

      {/* Recent actions table */}
      {actions.length > 0 && (
        <div style={CARD}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 12 }}>
            Recent actions
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  {['Time', 'Type', 'Skill', 'Status', 'URL / Title', 'Screenshot', 'Failure', 'Actions'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '4px 8px',
                      color: '#94a3b8', fontWeight: 600, fontSize: 9,
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      borderBottom: '1px solid #f1f5f9',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {actions.map(a => (
                  <tr key={a.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '6px 8px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                      {timeAgo(a.created_at)}
                    </td>
                    <td style={{ padding: '6px 8px', fontFamily: 'DM Mono, monospace', color: '#6366f1' }}>
                      {a.action_type}
                    </td>
                    <td style={{ padding: '6px 8px', color: '#475569' }}>
                      {a.skill_name ? (
                        <div>
                          <span style={{ fontSize: 9, fontWeight: 600, color: '#0f172a' }}>{a.skill_name}</span>
                          <div style={{ fontSize: 8, color: '#94a3b8', fontFamily: 'DM Mono, monospace' }}>{a.skill_id}</div>
                        </div>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <span style={{
                        fontSize: 9, fontWeight: 600, textTransform: 'uppercase',
                        color: a.status === 'completed' ? '#10b981' : a.status === 'failed' ? '#ef4444' : '#f59e0b',
                      }}>
                        {a.status}
                      </span>
                    </td>
                    <td style={{ padding: '6px 8px', color: '#475569', maxWidth: 200 }}>
                      {a.target_url && (
                        <div style={{ fontSize: 9, fontFamily: 'DM Mono, monospace', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {truncate(a.target_url, 40)}
                        </div>
                      )}
                      {a.page_title && (
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {truncate(a.page_title, 35)}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      {a.screenshot_url && !a.is_sensitive && (
                        <img
                          src={a.screenshot_url}
                          alt="screenshot"
                          style={{ width: 48, height: 32, objectFit: 'cover', borderRadius: 3, border: '1px solid #e2e8f0' }}
                        />
                      )}
                    </td>
                    <td style={{ padding: '6px 8px', color: '#ef4444', fontSize: 9 }}>
                      {a.failure_reason === 'skill_blocked' ? 'Skill blocked this action' : (a.failure_reason ?? '')}
                    </td>
                    <td style={{ padding: '6px 8px', minWidth: 120 }}>
                      {/* Approved-but-not-executed — show Resume button */}
                      {a.status === 'approved' && a.approval_item_id && (
                        <div>
                          {resumeResult[a.id] ? (
                            <span style={{
                              fontSize: 9, fontWeight: 600,
                              color: resumeResult[a.id]!.ok ? '#10b981' : '#ef4444',
                            }}>
                              {resumeResult[a.id]!.ok ? '✓ Done' : '✗ ' + resumeResult[a.id]!.message.slice(0, 40)}
                            </span>
                          ) : (
                            <button
                              onClick={() => handleResumeAction(a.id)}
                              disabled={!!resumingAction[a.id]}
                              style={{
                                background: '#16a34a', color: '#ffffff',
                                border: 'none', borderRadius: 4,
                                padding: '4px 9px', fontSize: 9, fontWeight: 600,
                                cursor: resumingAction[a.id] ? 'not-allowed' : 'pointer',
                                opacity: resumingAction[a.id] ? 0.6 : 1,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {resumingAction[a.id] ? 'Resuming…' : '▶ Resume'}
                            </button>
                          )}
                        </div>
                      )}
                      {/* Waiting approval — show link to Approval Center */}
                      {a.status === 'waiting_approval' && a.approval_item_id && (
                        <a
                          href="/approvals"
                          style={{
                            fontSize: 9, color: '#d97706', fontWeight: 600,
                            textDecoration: 'none', whiteSpace: 'nowrap',
                          }}
                        >
                          ⏳ Awaiting approval →
                        </a>
                      )}
                      {/* Extract leads for completed research actions */}
                      {a.status === 'completed' && ['search', 'read_page'].includes(a.action_type) && (
                        extractResult[a.id] !== null && extractResult[a.id] !== undefined ? (
                          <span style={{ fontSize: 9, color: '#15803d', fontWeight: 600 }}>
                            {extractResult[a.id]} leads found
                          </span>
                        ) : (
                          <button
                            onClick={() => handleExtractLeads(a.id)}
                            disabled={!!extractingLeads[a.id]}
                            style={{
                              background: '#f8fafc', color: '#374151',
                              border: '1px solid #e2e8f0', borderRadius: 4,
                              padding: '3px 8px', fontSize: 9, fontWeight: 600,
                              cursor: extractingLeads[a.id] ? 'not-allowed' : 'pointer',
                              opacity: extractingLeads[a.id] ? 0.6 : 1,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {extractingLeads[a.id] ? 'Extracting…' : 'Extract leads'}
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Microcopy footer */}
      <div style={{
        padding: '12px 16px',
        background: '#f8fafc',
        borderRadius: 8,
        fontSize: 12,
        color: '#64748b',
        lineHeight: 1.6,
        marginTop: 8,
      }}>
        The operator browser is isolated. For login, CAPTCHA, or verification — complete it in the operator browser window and click &lsquo;Mark login completed&rsquo;.
      </div>
    </div>
  )
}
