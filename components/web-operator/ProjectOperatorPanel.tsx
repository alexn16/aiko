'use client'
import { useEffect, useState, useCallback } from 'react'
import type { WebOperatorAction } from '@/lib/web-operator/web-operator'
import type { ApprovalItem } from '@/lib/approvals'

const ACTION_TYPES = [
  'search', 'open_url', 'read_page', 'click', 'type',
  'fill_form', 'create_email_draft', 'send_email', 'submit_form',
  'download_file', 'copy_data', 'login_required',
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
      padding: '2px 7px', borderRadius: 4,
      fontSize: 9, fontWeight: 600,
      background: color + '20', color,
      textTransform: 'uppercase', letterSpacing: '0.05em',
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

function truncate(str: string | null | undefined, n = 44): string {
  if (!str) return ''
  return str.length > n ? str.slice(0, n) + '…' : str
}

interface Props {
  projectId: string
}

export function ProjectOperatorPanel({ projectId }: Props) {
  const [browserAvailable, setBrowserAvailable] = useState(false)
  const [actions, setActions] = useState<WebOperatorAction[]>([])
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalItem[]>([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [actionType, setActionType] = useState('open_url')
  const [targetUrl, setTargetUrl] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actionResult, setActionResult] = useState<Record<string, unknown> | null>(null)

  // Lead extraction state
  const [extractingLeads, setExtractingLeads] = useState<Record<string, boolean>>({})
  const [extractResult, setExtractResult] = useState<Record<string, number | null>>({})

  const loadData = useCallback(async () => {
    try {
      const [statusRes, actionsRes, approvalsRes] = await Promise.all([
        fetch('/api/web-operator/status'),
        fetch(`/api/web-operator/actions?project_id=${projectId}&limit=20`),
        fetch('/api/approval-items?status=pending'),
      ])
      if (statusRes.ok) {
        const s = await statusRes.json()
        setBrowserAvailable(s.browser_available ?? false)
      }
      if (actionsRes.ok) {
        const a = await actionsRes.json()
        setActions(a.actions ?? [])
      }
      if (approvalsRes.ok) {
        const ap = await approvalsRes.json()
        const all: ApprovalItem[] = ap.items ?? []
        setPendingApprovals(all.filter((a: ApprovalItem) =>
          a.title?.startsWith('Web Operator:') &&
          (a.project_id === projectId || !a.project_id)
        ))
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    loadData()
    const id = setInterval(loadData, 15000)
    return () => clearInterval(id)
  }, [loadData])

  async function handleRunAction() {
    if (!description.trim()) return
    setSubmitting(true)
    setActionResult(null)
    try {
      const res = await fetch('/api/web-operator/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          action_type: actionType,
          target_url: targetUrl || null,
          description,
        }),
      })
      const data = await res.json()
      setActionResult(data)
      await loadData()
    } catch (err) {
      setActionResult({ error: String(err) })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleExtractLeads(actionId: string) {
    setExtractingLeads(prev => ({ ...prev, [actionId]: true }))
    try {
      const res = await fetch('/api/leads/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ web_operator_action_id: actionId, project_id: projectId }),
      })
      const data = await res.json()
      const count = data.count ?? 0
      setExtractResult(prev => ({ ...prev, [actionId]: count }))
      setTimeout(() => setExtractResult(prev => ({ ...prev, [actionId]: null })), 3000)
    } catch {
      // non-fatal
    } finally {
      setExtractingLeads(prev => ({ ...prev, [actionId]: false }))
    }
  }

  async function handleApproval(item: ApprovalItem, decision: 'approved' | 'rejected') {
    try {
      const actionForApproval = actions.find(a => a.approval_item_id === item.id)
      if (actionForApproval) {
        await fetch('/api/web-operator/approve-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action_id: actionForApproval.id, approval_id: item.id, decision }),
        })
      } else {
        await fetch(`/api/approval-items/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: decision }),
        })
      }
      await loadData()
    } catch {
      // non-fatal
    }
  }

  const CARD: React.CSSProperties = {
    background: '#ffffff',
    border: '1px solid #f1f5f9',
    borderRadius: 10,
    padding: '16px 18px',
    marginBottom: 16,
  }

  const INPUT: React.CSSProperties = {
    background: '#fafafa', border: '1px solid #e2e8f0', borderRadius: 6,
    padding: '7px 10px', fontSize: 12, color: '#0f172a',
    width: '100%', boxSizing: 'border-box',
  }

  const LABEL: React.CSSProperties = {
    fontSize: 10, fontWeight: 600, color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10,
  }

  return (
    <div>
      {/* Runtime notice */}
      {!browserAvailable && (
        <div style={{
          ...CARD,
          background: '#fffbeb', border: '1px solid #fde68a',
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#92400e', marginBottom: 3 }}>
            Browser runtime not connected
          </div>
          <div style={{ fontSize: 11, color: '#78350f', lineHeight: 1.6 }}>
            Actions will be logged and approval-gated correctly.
            Browser execution starts when Playwright runtime is connected.
          </div>
        </div>
      )}

      {/* New action form */}
      <div style={CARD}>
        <div style={LABEL}>Run an action for this project</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>Action type</div>
            <select value={actionType} onChange={e => setActionType(e.target.value)} style={INPUT}>
              {ACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>Target URL</div>
            <input
              value={targetUrl}
              onChange={e => setTargetUrl(e.target.value)}
              style={INPUT}
              placeholder="https://..."
            />
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>Description</div>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            style={{ ...INPUT, resize: 'vertical' }}
            placeholder="Describe the action..."
          />
        </div>
        <button
          onClick={handleRunAction}
          disabled={submitting || !description.trim()}
          style={{
            background: submitting || !description.trim() ? '#e2e8f0' : '#0f172a',
            color: submitting || !description.trim() ? '#94a3b8' : '#ffffff',
            border: 'none', borderRadius: 6, padding: '8px 16px',
            fontSize: 11, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer',
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
              marginTop: 10, padding: '10px 12px',
              background: hasError ? '#fef2f2' : '#f0fdf4',
              border: `1px solid ${hasError ? '#fecaca' : '#bbf7d0'}`,
              borderRadius: 7, fontSize: 11,
            }}>
              {isWaiting && (
                <div style={{ color: '#92400e', fontWeight: 600, marginBottom: 3 }}>
                  Waiting for approval
                </div>
              )}
              {hasError && (
                <div style={{ color: '#dc2626' }}>{String(actionResult.error)}</div>
              )}
              {isSuccess && (
                <div style={{ color: '#15803d', fontWeight: 600 }}>Action completed</div>
              )}
            </div>
          )
        })()}
      </div>

      {/* Pending approvals */}
      {pendingApprovals.length > 0 && (
        <div style={CARD}>
          <div style={LABEL}>Pending approvals ({pendingApprovals.length})</div>
          {pendingApprovals.map(item => (
            <div key={item.id} style={{
              padding: '10px 12px', background: '#fffbeb',
              border: '1px solid #fde68a', borderRadius: 7, marginBottom: 8,
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#92400e', marginBottom: 4 }}>
                {item.title}
              </div>
              <div style={{ fontSize: 11, color: '#78350f', marginBottom: 8, lineHeight: 1.5 }}>
                {item.content}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => handleApproval(item, 'approved')}
                  style={{
                    background: '#10b981', color: '#fff', border: 'none',
                    borderRadius: 5, padding: '5px 12px', fontSize: 11,
                    fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Approve
                </button>
                <button
                  onClick={() => handleApproval(item, 'rejected')}
                  style={{
                    background: '#ef4444', color: '#fff', border: 'none',
                    borderRadius: 5, padding: '5px 12px', fontSize: 11,
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

      {/* Recent actions */}
      <div style={CARD}>
        <div style={LABEL}>Recent actions for this project</div>
        {loading ? (
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Loading…</div>
        ) : actions.length === 0 ? (
          <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>No actions yet for this project.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {actions.map(action => (
              <div key={action.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px', borderRadius: 6, background: '#fafafa',
                border: '1px solid #f1f5f9',
              }}>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#cbd5e1', flexShrink: 0, minWidth: 32 }}>
                  {timeAgo(action.created_at)}
                </div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#6366f1', flexShrink: 0 }}>
                  {action.action_type}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: 11, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {action.description}
                  </div>
                  {(action as { page_title?: string | null }).page_title && (
                    <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {truncate((action as { page_title?: string | null }).page_title, 44)}
                    </div>
                  )}
                  {(action as { failure_reason?: string | null }).failure_reason && (
                    <div style={{ fontSize: 9, color: '#ef4444', marginTop: 1 }}>
                      {(action as { failure_reason?: string | null }).failure_reason}
                    </div>
                  )}
                </div>
                {action.target_url && (
                  <div style={{ fontSize: 9, color: '#94a3b8', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'DM Mono, monospace' }}>
                    {truncate(action.target_url, 24)}
                  </div>
                )}
                <StatusBadge status={action.status} />
                {action.screenshot_url && !(action as { is_sensitive?: boolean }).is_sensitive && (
                  <img
                    src={action.screenshot_url}
                    alt="Page screenshot"
                    style={{ width: 80, height: 50, objectFit: 'cover', borderRadius: 4, border: '1px solid #e2e8f0', flexShrink: 0 }}
                  />
                )}
                {action.status === 'completed' && ['search', 'read_page'].includes(action.action_type) && (
                  extractResult[action.id] !== null && extractResult[action.id] !== undefined ? (
                    <span style={{ fontSize: 9, color: '#15803d', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {extractResult[action.id]} leads
                    </span>
                  ) : (
                    <button
                      onClick={() => handleExtractLeads(action.id)}
                      disabled={!!extractingLeads[action.id]}
                      style={{
                        background: '#f8fafc', color: '#374151',
                        border: '1px solid #e2e8f0', borderRadius: 4,
                        padding: '3px 8px', fontSize: 9, fontWeight: 600,
                        cursor: extractingLeads[action.id] ? 'not-allowed' : 'pointer',
                        opacity: extractingLeads[action.id] ? 0.6 : 1,
                        whiteSpace: 'nowrap', flexShrink: 0,
                      }}
                    >
                      {extractingLeads[action.id] ? 'Extracting…' : 'Extract leads'}
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
