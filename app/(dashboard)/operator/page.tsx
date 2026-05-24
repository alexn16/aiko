'use client'
import { useEffect, useState, useCallback } from 'react'
import { ModeGateBadge } from '@/components/mode/ModeGateBadge'
import type { WebOperatorAction, WebOperatorSession } from '@/lib/web-operator/web-operator'
import type { ApprovalItem } from '@/lib/approvals'

const ACTION_TYPES = [
  'search', 'open_url', 'read_page', 'click', 'type',
  'fill_form', 'create_email_draft', 'send_email', 'submit_form',
  'download_file', 'copy_data', 'login_required', 'approval_required', 'blocked',
]

const STATUS_BADGE_COLOR: Record<string, string> = {
  pending: '#94a3b8',
  running: '#3b82f6',
  completed: '#10b981',
  blocked: '#ef4444',
  failed: '#ef4444',
  waiting_approval: '#f59e0b',
  approved: '#6366f1',
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_BADGE_COLOR[status] ?? '#94a3b8'
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 10,
      fontWeight: 600,
      background: color + '20',
      color,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    }}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return `${Math.round(diff)}s ago`
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`
  return `${Math.round(diff / 3600)}h ago`
}

function truncate(str: string | null | undefined, n = 48): string {
  if (!str) return ''
  return str.length > n ? str.slice(0, n) + '…' : str
}

export default function OperatorPage() {
  const [browserAvailable, setBrowserAvailable] = useState(false)
  const [activeSession, setActiveSession] = useState<WebOperatorSession | null>(null)
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalItem[]>([])
  const [recentActions, setRecentActions] = useState<WebOperatorAction[]>([])
  const [loading, setLoading] = useState(true)

  // Action form state
  const [agentRole, setAgentRole] = useState('Web Operator')
  const [actionType, setActionType] = useState('open_url')
  const [targetUrl, setTargetUrl] = useState('')
  const [description, setDescription] = useState('')
  const [actionResult, setActionResult] = useState<Record<string, unknown> | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/web-operator/status')
      if (!res.ok) return
      const data = await res.json()
      setBrowserAvailable(data.browser_available ?? false)
      setActiveSession(data.active_session ?? null)
      setRecentActions(data.recent_actions ?? [])
    } catch {
      // non-fatal
    }
  }, [])

  const loadPendingApprovals = useCallback(async () => {
    try {
      const res = await fetch('/api/approvals?status=pending')
      if (!res.ok) return
      const data = await res.json()
      const all: ApprovalItem[] = data.items ?? []
      setPendingApprovals(all.filter(a => a.title?.startsWith('Web Operator:')))
    } catch {
      // non-fatal
    }
  }, [])

  const loadActions = useCallback(async () => {
    try {
      const res = await fetch('/api/web-operator/actions?limit=20')
      if (!res.ok) return
      const data = await res.json()
      setRecentActions(data.actions ?? [])
    } catch {
      // non-fatal
    }
  }, [])

  useEffect(() => {
    async function init() {
      setLoading(true)
      await Promise.all([loadStatus(), loadPendingApprovals(), loadActions()])
      setLoading(false)
    }
    init()
    const interval = setInterval(() => {
      loadStatus()
      loadPendingApprovals()
      loadActions()
    }, 15000)
    return () => clearInterval(interval)
  }, [loadStatus, loadPendingApprovals, loadActions])

  async function handleRunAction() {
    if (!description.trim()) return
    setSubmitting(true)
    setActionResult(null)
    try {
      const res = await fetch('/api/web-operator/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_role: agentRole,
          action_type: actionType,
          target_url: targetUrl || null,
          description,
          session_id: activeSession?.id ?? null,
        }),
      })
      const data = await res.json()
      setActionResult(data)
      await loadActions()
      await loadPendingApprovals()
    } catch (err) {
      setActionResult({ error: String(err) })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleStartSession() {
    try {
      const res = await fetch('/api/web-operator/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_role: agentRole }),
      })
      const data = await res.json()
      setActiveSession(data.session ?? null)
    } catch {
      // non-fatal
    }
  }

  async function handleStopSession() {
    if (!activeSession) return
    try {
      await fetch(`/api/web-operator/session/${activeSession.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'stopped' }),
      })
      setActiveSession(null)
    } catch {
      // non-fatal
    }
  }

  async function handleApproval(item: ApprovalItem, decision: 'approved' | 'rejected') {
    try {
      // Find the action linked to this approval
      const actionRes = await fetch(`/api/web-operator/actions?limit=50`)
      const actionData = await actionRes.json()
      const action = (actionData.actions as WebOperatorAction[]).find(a => a.approval_item_id === item.id)

      if (action) {
        await fetch('/api/web-operator/approve-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action_id: action.id, approval_id: item.id, decision }),
        })
      } else {
        // Just update the approval item directly
        await fetch(`/api/approvals/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: decision }),
        })
      }

      await loadPendingApprovals()
      await loadActions()
    } catch {
      // non-fatal
    }
  }

  async function handlePause() {
    try {
      await fetch('/api/mode', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paused: true }),
      })
    } catch {
      // non-fatal
    }
  }

  const CARD: React.CSSProperties = {
    background: '#ffffff',
    border: '1px solid #f1f5f9',
    borderRadius: 10,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    padding: '18px 20px',
    marginBottom: 20,
  }

  const LABEL: React.CSSProperties = {
    fontSize: 10, fontWeight: 600, color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12,
  }

  const INPUT: React.CSSProperties = {
    background: '#fafafa', border: '1px solid #e2e8f0', borderRadius: 6,
    padding: '8px 10px', fontSize: 12, color: '#0f172a', width: '100%',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ padding: '40px 32px', maxWidth: 860 }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', margin: '0 0 4px' }}>
          Web Operator
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
          The Web Operator is AÏKO&apos;s only external execution layer. All browser actions — search, email drafts, form filling, LinkedIn — run here.
        </p>
      </div>

      {/* Status bar */}
      <div style={{ ...CARD, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
        <ModeGateBadge />

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: browserAvailable ? '#10b981' : '#f59e0b',
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 12, color: '#374151' }}>
            {browserAvailable ? 'Playwright ready' : 'Runtime not configured'}
          </span>
        </div>

        {activeSession && (
          <div style={{ fontSize: 11, color: '#64748b' }}>
            Session{' '}
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10 }}>
              {activeSession.id.slice(0, 8)}
            </span>
            {' '}· started {timeAgo(activeSession.started_at)}
            {activeSession.current_url && (
              <> · <span style={{ color: '#6366f1' }}>{truncate(activeSession.current_url, 40)}</span></>
            )}
            {(activeSession as { recovery_count?: number }).recovery_count && (activeSession as { recovery_count?: number }).recovery_count! > 0 ? (
              <span style={{
                marginLeft: 8, fontSize: 9, fontWeight: 600,
                background: '#fef3c7', color: '#92400e',
                borderRadius: 4, padding: '1px 5px',
              }}>
                Recovered {(activeSession as { recovery_count?: number }).recovery_count}x
              </span>
            ) : null}
          </div>
        )}

        <button
          onClick={handlePause}
          style={{
            marginLeft: 'auto',
            background: '#ef4444', color: '#ffffff', border: 'none',
            borderRadius: 7, padding: '8px 16px', fontSize: 12,
            fontWeight: 600, cursor: 'pointer', letterSpacing: '-0.01em',
          }}
        >
          PAUSE
        </button>
      </div>

      {/* Current State card — shows when there's an active session with page state */}
      {activeSession && (activeSession.current_url || (activeSession as { page_title?: string | null }).page_title) && (() => {
        const lastScreenshot = recentActions.find(a => a.screenshot_url && !(a as { is_sensitive?: boolean }).is_sensitive)?.screenshot_url ?? null
        return (
          <div style={{ ...CARD, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            {lastScreenshot && (
              <img
                src={lastScreenshot}
                alt="Last page screenshot"
                style={{ width: 120, height: 75, objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e8f0', flexShrink: 0 }}
              />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                Current State
              </div>
              {activeSession.current_url && (
                <div style={{ fontSize: 12, color: '#6366f1', fontFamily: 'DM Mono, monospace', marginBottom: 2 }}>
                  {truncate(activeSession.current_url, 60)}
                </div>
              )}
              {(activeSession as { page_title?: string | null }).page_title && (
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                  {truncate((activeSession as { page_title?: string | null }).page_title, 70)}
                </div>
              )}
              {(activeSession as { recovery_count?: number }).recovery_count && (activeSession as { recovery_count?: number }).recovery_count! > 0 ? (
                <div style={{ fontSize: 10, color: '#92400e' }}>
                  Session recovered {(activeSession as { recovery_count?: number }).recovery_count} time(s)
                </div>
              ) : null}
            </div>
          </div>
        )
      })()}

      {/* Browser runtime notice */}
      {!browserAvailable && (
        <div style={{
          ...CARD,
          background: '#fffbeb',
          border: '1px solid #fde68a',
          color: '#92400e',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            Web Operator runtime is not configured yet.
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.7, color: '#78350f' }}>
            Connect a Playwright/browser runtime to allow AÏKO to operate websites.
            <br />
            Data model, API, and approval flow are active.
            All actions will be logged and gated correctly.
            <br />
            Browser execution starts when runtime is connected.
          </div>
        </div>
      )}

      {/* New Action form */}
      <div style={CARD}>
        <div style={LABEL}>New Action</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Agent role</div>
            <input
              value={agentRole}
              onChange={e => setAgentRole(e.target.value)}
              style={INPUT}
              placeholder="Web Operator"
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Action type</div>
            <select
              value={actionType}
              onChange={e => setActionType(e.target.value)}
              style={{ ...INPUT }}
            >
              {ACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Target URL</div>
          <input
            value={targetUrl}
            onChange={e => setTargetUrl(e.target.value)}
            style={INPUT}
            placeholder="https://..."
          />
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Description</div>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            style={{ ...INPUT, resize: 'vertical' }}
            placeholder="Describe what this action should do..."
          />
        </div>
        <button
          onClick={handleRunAction}
          disabled={submitting || !description.trim()}
          style={{
            background: submitting || !description.trim() ? '#e2e8f0' : '#0f172a',
            color: submitting || !description.trim() ? '#94a3b8' : '#ffffff',
            border: 'none', borderRadius: 7, padding: '9px 20px',
            fontSize: 12, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Running…' : 'Run action'}
        </button>

        {actionResult && (() => {
          const hasError = Boolean(actionResult.error)
          const isWaiting = Boolean(actionResult.waiting_approval)
          const isSuccess = Boolean(actionResult.success)
          return (
            <div style={{
              marginTop: 14, padding: '12px 14px',
              background: hasError ? '#fef2f2' : isWaiting ? '#fffbeb' : '#f0fdf4',
              border: `1px solid ${hasError ? '#fecaca' : isWaiting ? '#fde68a' : '#bbf7d0'}`,
              borderRadius: 8, fontSize: 12,
            }}>
              {isWaiting && (
                <div style={{ color: '#92400e', fontWeight: 600, marginBottom: 4 }}>
                  Waiting for approval — check Pending Approvals below
                </div>
              )}
              {hasError && (
                <div style={{ color: '#dc2626', fontWeight: 600, marginBottom: 4 }}>
                  {String(actionResult.error)}
                </div>
              )}
              {isSuccess && (
                <div style={{ color: '#15803d', fontWeight: 600, marginBottom: 4 }}>
                  Action completed successfully
                </div>
              )}
              <pre style={{ margin: 0, fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#475569', whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>
                {JSON.stringify(actionResult, null, 2).slice(0, 600)}
              </pre>
            </div>
          )
        })()}
      </div>

      {/* Pending Approvals */}
      <div style={CARD}>
        <div style={LABEL}>Pending Approvals ({pendingApprovals.length})</div>
        {pendingApprovals.length === 0 ? (
          <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>No pending approvals.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pendingApprovals.map(item => (
              <div key={item.id} style={{
                padding: '12px 14px', background: '#fffbeb',
                border: '1px solid #fde68a', borderRadius: 8,
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#92400e', marginBottom: 4 }}>
                  {item.title}
                </div>
                <div style={{ fontSize: 11, color: '#78350f', marginBottom: 10, lineHeight: 1.6 }}>
                  {item.content}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleApproval(item, 'approved')}
                    style={{
                      background: '#10b981', color: '#ffffff', border: 'none',
                      borderRadius: 6, padding: '6px 14px', fontSize: 11,
                      fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleApproval(item, 'rejected')}
                    style={{
                      background: '#ef4444', color: '#ffffff', border: 'none',
                      borderRadius: 6, padding: '6px 14px', fontSize: 11,
                      fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Actions */}
      <div style={CARD}>
        <div style={LABEL}>Recent Actions (auto-refreshes every 15s)</div>
        {recentActions.length === 0 ? (
          <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
            {loading ? 'Loading…' : 'No actions yet.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  {['Time', 'Type', 'Role', 'URL / Page', 'Status', 'Description', 'Preview'].map(h => (
                    <th key={h} style={{
                      padding: '7px 10px', textAlign: 'left', fontWeight: 600,
                      color: '#94a3b8', borderBottom: '1px solid #f1f5f9',
                      fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentActions.map(action => (
                  <tr key={action.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '8px 10px', color: '#94a3b8', fontFamily: 'DM Mono, monospace', fontSize: 10, whiteSpace: 'nowrap' }}>
                      {timeAgo(action.created_at)}
                    </td>
                    <td style={{ padding: '8px 10px', color: '#374151', fontFamily: 'DM Mono, monospace', fontSize: 10 }}>
                      {action.action_type}
                    </td>
                    <td style={{ padding: '8px 10px', color: '#64748b' }}>
                      {action.agent_role}
                    </td>
                    <td style={{ padding: '8px 10px', color: '#6366f1', maxWidth: 180 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                        {truncate(action.target_url, 32)}
                      </div>
                      {(action as { page_title?: string | null }).page_title && (
                        <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                          {truncate((action as { page_title?: string | null }).page_title, 36)}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <StatusBadge status={action.status} />
                      {(action as { failure_reason?: string | null }).failure_reason && (
                        <div style={{ fontSize: 9, color: '#ef4444', marginTop: 2 }}>
                          {(action as { failure_reason?: string | null }).failure_reason}
                        </div>
                      )}
                      {(action as { is_sensitive?: boolean }).is_sensitive && (
                        <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2, background: '#f1f5f9', borderRadius: 3, padding: '1px 4px', display: 'inline-block' }}>
                          Sensitive
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '8px 10px', color: '#374151', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {action.description}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      {action.screenshot_url && !(action as { is_sensitive?: boolean }).is_sensitive && (
                        <img
                          src={action.screenshot_url}
                          alt="Page screenshot"
                          style={{ width: 80, height: 50, objectFit: 'cover', borderRadius: 4, border: '1px solid #e2e8f0' }}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Session controls */}
      <div style={CARD}>
        <div style={LABEL}>Session controls</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={handleStartSession}
            style={{
              background: '#0f172a', color: '#ffffff', border: 'none',
              borderRadius: 7, padding: '9px 18px', fontSize: 12,
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            Start new session
          </button>
          {activeSession && (
            <button
              onClick={handleStopSession}
              style={{
                background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
                borderRadius: 7, padding: '9px 18px', fontSize: 12,
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              Stop session
            </button>
          )}
          {activeSession && (
            <span style={{ fontSize: 11, color: '#64748b' }}>
              Active: <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10 }}>{activeSession.id.slice(0, 12)}…</span>
            </span>
          )}
          {!activeSession && (
            <span style={{ fontSize: 11, color: '#94a3b8' }}>No active session</span>
          )}
        </div>
      </div>
    </div>
  )
}
