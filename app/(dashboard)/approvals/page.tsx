'use client'
import { useCallback, useEffect, useState } from 'react'
import { AdvancedDisclosure } from '@/components/ui/AdvancedDisclosure'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageShell } from '@/components/ui/PageShell'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ApprovalItem {
  id: string
  project_id: string | null
  output_id: string | null
  task_id: string | null
  item_type: string
  title: string
  content: string
  status: string
  requested_by_role: string
  reviewed_by_user_id: string | null
  review_note: string | null
  decision_reason: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
  project_name?: string
}

// Linked web_operator_action for resumable items
interface LinkedAction {
  id: string
  status: string
  action_type: string
  description: string
}

type FilterTab = 'all' | 'pending' | 'approved' | 'changes_requested' | 'rejected'

interface Project {
  id: string
  name: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all',               label: 'All' },
  { id: 'pending',           label: 'Pending' },
  { id: 'approved',          label: 'Approved' },
  { id: 'changes_requested', label: 'Changes Requested' },
  { id: 'rejected',          label: 'Rejected' },
]

const STATUS_BADGE: Record<string, { background: string; color: string }> = {
  pending:           { background: '#fef3c7', color: '#d97706' },
  approved:          { background: '#dcfce7', color: '#16a34a' },
  changes_requested: { background: '#f3e8ff', color: '#7c3aed' },
  rejected:          { background: '#fee2e2', color: '#dc2626' },
  archived:          { background: '#f1f5f9', color: '#94a3b8' },
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)    return `${Math.round(diff)}s ago`
  if (diff < 3600)  return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  return `${Math.round(diff / 86400)}d ago`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function plainApprovalReason(item: ApprovalItem): string {
  if (item.item_type === 'web_operator_action') return 'Kevin needs approval before doing this.'
  if (/post|send|message|publish|share|download/i.test(`${item.title} ${item.content}`)) {
    return 'Kevin needs approval before doing this.'
  }
  return 'Review this before AÏKO uses it.'
}

function plainApprovalTitle(item: ApprovalItem): string {
  const source = `${item.title} ${item.content}`
  if (/facebook/i.test(source) && /post|publish/i.test(source)) return 'Prepare Facebook post draft'
  if (/facebook/i.test(source) && /message/i.test(source)) return 'Prepare Facebook message draft'
  if (/gmail|email/i.test(source) && /send/i.test(source)) return 'Prepare email draft'
  if (/canva/i.test(source) && /download|share|publish/i.test(source)) return 'Use Canva draft externally'
  if (/post|publish/i.test(source)) return 'Prepare public post draft'
  if (/send|message/i.test(source)) return 'Prepare message draft'
  return item.title
}

// ── AddToCampaignButton ────────────────────────────────────────────────────────

function AddToCampaignButton({ item, projects }: { item: ApprovalItem; projects: Project[] }) {
  const [open, setOpen] = useState(false)
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [added, setAdded] = useState(false)

  async function loadCampaigns() {
    if (!item.project_id) return
    try {
      const res = await fetch(`/api/campaigns?project_id=${item.project_id}`)
      const data = await res.json()
      if (data.campaigns) {
        setCampaigns(data.campaigns)
        if (data.campaigns[0]?.id) setSelectedCampaign(data.campaigns[0].id)
      }
    } catch {
      // silently fail
    }
  }

  function handleOpen() {
    if (!open) loadCampaigns()
    setOpen(v => !v)
  }

  async function handleAdd() {
    if (!selectedCampaign) return
    setLoading(true)
    try {
      await fetch(`/api/campaigns/${selectedCampaign}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approval_item_id: item.id }),
      })
      setAdded(true)
      setOpen(false)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  if (item.status !== 'approved') return null

  return (
    <div style={{ display: 'inline-block' }}>
      {added ? (
        <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 500 }}>Added to campaign</span>
      ) : (
        <>
          <button
            onClick={handleOpen}
            style={{
              fontSize: 11, fontWeight: 500, padding: '4px 10px', borderRadius: 5,
              border: '1px solid #d1fae5', background: '#f0fdf4', color: '#15803d',
              cursor: 'pointer',
            }}
          >
            Add to campaign
          </button>
          {open && campaigns.length > 0 && (
            <div style={{
              position: 'absolute', zIndex: 50, background: '#ffffff',
              border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)', marginTop: 4, minWidth: 200,
            }}>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>Select campaign:</div>
              <select
                value={selectedCampaign}
                onChange={e => setSelectedCampaign(e.target.value)}
                style={{
                  width: '100%', fontSize: 12, padding: '5px 8px', borderRadius: 5,
                  border: '1px solid #e2e8f0', outline: 'none', marginBottom: 8,
                }}
              >
                {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={handleAdd}
                  disabled={loading}
                  style={{
                    fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 5,
                    border: 'none', background: '#16a34a', color: '#ffffff', cursor: 'pointer',
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {loading ? 'Adding…' : 'Add'}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  style={{
                    fontSize: 11, padding: '4px 8px', borderRadius: 5,
                    border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {open && campaigns.length === 0 && (
            <div style={{
              position: 'absolute', zIndex: 50, background: '#ffffff',
              border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)', marginTop: 4, minWidth: 200,
              fontSize: 11, color: '#94a3b8',
            }}>
              No campaigns for this project yet.
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── ResumeOperatorButton ───────────────────────────────────────────────────────

function ResumeOperatorButton({ item }: { item: ApprovalItem }) {
  const [linkedAction, setLinkedAction] = useState<LinkedAction | null | 'loading'>('loading')
  const [resuming, setResuming] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  // Only relevant for approved web_operator_action items
  const isRelevant = item.item_type === 'web_operator_action' && item.status === 'approved'

  useEffect(() => {
    if (!isRelevant) { setLinkedAction(null); return }
    let cancelled = false
    fetch(`/api/web-operator/actions?limit=100&status=approved`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        const actions: LinkedAction[] = d.actions ?? []
        const match = actions.find((a: LinkedAction & { approval_item_id?: string }) =>
          (a as unknown as { approval_item_id?: string }).approval_item_id === item.id
        )
        setLinkedAction(match ?? null)
      })
      .catch(() => setLinkedAction(null))
    return () => { cancelled = true }
  }, [item.id, item.status, isRelevant])

  if (!isRelevant) return null
  if (linkedAction === 'loading') return (
    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>Checking for pending action…</div>
  )
  if (!linkedAction) return (
    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
      ✓ Approved — no browser action pending
    </div>
  )
  if (linkedAction.status === 'completed') return (
    <div style={{ fontSize: 11, color: '#10b981', marginTop: 8 }}>
      ✓ Operator action completed
    </div>
  )

  async function handleResume() {
    if (!linkedAction || linkedAction === 'loading') return
    setResuming(true)
    setResult(null)
    try {
      const res = await fetch(`/api/web-operator/actions/${linkedAction.id}/resume`, { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        setResult({ ok: true, message: data.message ?? 'Action completed.' })
        setLinkedAction({ ...linkedAction, status: 'completed' })
      } else {
        setResult({ ok: false, message: data.error ?? 'Resume failed.' })
      }
    } catch (e) {
      setResult({ ok: false, message: String(e) })
    } finally {
      setResuming(false)
    }
  }

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{
        background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
        padding: '10px 14px', marginBottom: 8,
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#166534', marginBottom: 4 }}>
          ✓ Approved — browser action ready to resume
        </div>
        <div style={{ fontSize: 11, color: '#166534', marginBottom: 8 }}>
          <span style={{ fontFamily: 'DM Mono, monospace', background: '#dcfce7', borderRadius: 4, padding: '1px 5px' }}>
            {linkedAction.action_type}
          </span>
          {' '}— {linkedAction.description.slice(0, 80)}{linkedAction.description.length > 80 ? '…' : ''}
        </div>
        <button
          onClick={handleResume}
          disabled={resuming}
          style={{
            fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 6,
            border: 'none', background: '#16a34a', color: '#ffffff', cursor: 'pointer',
            opacity: resuming ? 0.6 : 1,
          }}
        >
          {resuming ? 'Resuming…' : '▶ Resume operator action'}
        </button>
      </div>
      {result && (
        <div style={{
          fontSize: 11, padding: '6px 10px', borderRadius: 6, marginTop: 4,
          background: result.ok ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${result.ok ? '#bbf7d0' : '#fecaca'}`,
          color: result.ok ? '#166534' : '#dc2626',
        }}>
          {result.message}
        </div>
      )}
    </div>
  )
}

// ── ApprovalCard ───────────────────────────────────────────────────────────────

function ApprovalCard({
  item,
  onStatusUpdate,
  projects,
}: {
  item: ApprovalItem
  onStatusUpdate: (id: string, status: string, opts?: { review_note?: string; content?: string }) => Promise<void>
  projects: Project[]
}) {
  const [expanded, setExpanded] = useState(false)
  const [editedContent, setEditedContent] = useState(item.content)
  const [noteInput, setNoteInput] = useState('')
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [confirmedStatus, setConfirmedStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const badge = STATUS_BADGE[item.status] ?? STATUS_BADGE.archived
  const isPending = item.status === 'pending'
  const plainReason = plainApprovalReason(item)
  const displayTitle = plainApprovalTitle(item)

  async function handleApprove() {
    setLoading(true)
    await onStatusUpdate(item.id, 'approved', { content: editedContent !== item.content ? editedContent : undefined })
    setConfirmedStatus('approved')
    setLoading(false)
  }

  async function handleReject() {
    setLoading(true)
    await onStatusUpdate(item.id, 'rejected')
    setConfirmedStatus('rejected')
    setLoading(false)
  }

  async function handleChanges() {
    if (!showNoteInput) { setShowNoteInput(true); return }
    setLoading(true)
    await onStatusUpdate(item.id, 'changes_requested', { review_note: noteInput })
    setConfirmedStatus('changes_requested')
    setShowNoteInput(false)
    setLoading(false)
  }

  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #f1f5f9',
      borderRadius: 10,
      padding: '16px 18px',
      marginBottom: 10,
      borderLeft: `3px solid ${badge.background}`,
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
            {displayTitle}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{
              ...badge,
              fontSize: 10, fontWeight: 600, borderRadius: 4, padding: '2px 7px',
            }}>
              {item.status.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
        <span style={{ fontSize: 10, color: '#cbd5e1', flexShrink: 0 }}>{timeAgo(item.created_at)}</span>
      </div>

      {/* Meta */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        {item.project_name && (
          <span style={{ fontSize: 10, color: '#94a3b8' }}>
            {item.project_name}
          </span>
        )}
      </div>

      <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.5, marginBottom: 8 }}>
        {plainReason}
      </div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>
        Approving does not execute automatically. Resume is still explicit.
      </div>

      {/* Approved/rejected info */}
      {(item.status === 'approved' || item.status === 'rejected' || item.status === 'changes_requested') && item.reviewed_at && (
        <div style={{
          fontSize: 11, color: '#94a3b8', marginBottom: 8, padding: '6px 10px',
          background: '#f8fafc', borderRadius: 6,
        }}>
          {item.status.replace(/_/g, ' ')} on {formatDate(item.reviewed_at)}
          {item.review_note && <span> — "{item.review_note}"</span>}
        </div>
      )}

      {/* Add to campaign — for approved items */}
      {item.status === 'approved' && (
        <div style={{ marginBottom: 8, position: 'relative' }}>
          <AddToCampaignButton item={item} projects={projects} />
        </div>
      )}

      {/* Resume operator action — for approved web_operator_action items */}
      <ResumeOperatorButton item={item} />

      {/* Inline confirmation */}
      {confirmedStatus && (
        <div style={{
          fontSize: 11, color: '#16a34a', padding: '6px 10px', background: '#f0fdf4',
          borderRadius: 6, marginBottom: 8, border: '1px solid #bbf7d0',
        }}>
          {confirmedStatus === 'approved' && 'Approved internally. This does not send anything externally.'}
          {confirmedStatus === 'rejected' && 'Item rejected.'}
          {confirmedStatus === 'changes_requested' && 'Changes requested. The agent has been notified.'}
        </div>
      )}

      {/* Action buttons — only for pending */}
      {isPending && !confirmedStatus && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={handleApprove}
              disabled={loading}
              style={{
                fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 6,
                border: 'none', background: '#16a34a', color: '#ffffff', cursor: 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              Approve
            </button>
            <button
              onClick={handleReject}
              disabled={loading}
              style={{
                fontSize: 12, fontWeight: 500, padding: '6px 14px', borderRadius: 6,
                border: '1px solid #e2e8f0', background: '#fee2e2', color: '#dc2626', cursor: 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              Reject
            </button>
          </div>
        </div>
      )}

      <details
        open={expanded}
        onToggle={event => setExpanded(event.currentTarget.open)}
        style={{ marginTop: 12 }}
      >
        <summary style={{ cursor: 'pointer', color: '#6366f1', fontSize: 11, fontWeight: 700 }}>
          View details
        </summary>
        <div style={{ marginTop: 10 }}>
          {isPending ? (
            <textarea
              value={editedContent}
              onChange={e => setEditedContent(e.target.value)}
              style={{
                width: '100%', minHeight: 120, fontSize: 12, color: '#374151',
                lineHeight: 1.6, padding: '10px 12px', borderRadius: 6,
                border: '1px solid #e2e8f0', background: '#fafafa',
                resize: 'vertical', outline: 'none', boxSizing: 'border-box',
              }}
            />
          ) : (
            <div style={{
              fontSize: 12, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap',
              background: '#fafafa', padding: '10px 12px', borderRadius: 6,
              border: '1px solid #f1f5f9',
            }}>
              {item.content}
            </div>
          )}
          <pre style={{
            overflow: 'auto',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: 10,
            fontSize: 10,
            color: '#475569',
            marginTop: 10,
          }}>
            {JSON.stringify({
              id: item.id,
              item_type: item.item_type,
              requested_by_role: item.requested_by_role,
              output_id: item.output_id,
              task_id: item.task_id,
              status: item.status,
              decision_reason: item.decision_reason,
            }, null, 2)}
          </pre>
          {isPending && (
            <div style={{ marginTop: 10 }}>
              {showNoteInput && (
                <input
                  autoFocus
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                  placeholder="Describe the changes needed…"
                  style={{
                    display: 'block',
                    width: '100%',
                    boxSizing: 'border-box',
                    fontSize: 12,
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: '1px solid #e2e8f0',
                    outline: 'none',
                    color: '#374151',
                    marginBottom: 8,
                  }}
                />
              )}
              <button
                onClick={handleChanges}
                disabled={loading}
                style={{
                  fontSize: 12, fontWeight: 500, padding: '6px 14px', borderRadius: 6,
                  border: '1px solid #e2e8f0', background: '#f3e8ff', color: '#7c3aed', cursor: 'pointer',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {showNoteInput ? 'Send changes request' : 'Request changes'}
              </button>
            </div>
          )}
        </div>
      </details>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ApprovalsPage() {
  const [items, setItems] = useState<ApprovalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<FilterTab>('pending')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [projects, setProjects] = useState<Project[]>([])

  const fetchItems = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (activeTab !== 'all') params.set('status', activeTab)
      if (projectFilter !== 'all') params.set('project_id', projectFilter)
      params.set('limit', '100')
      const res = await fetch(`/api/approval-items?${params}`)
      const data = await res.json()
      if (data.items) setItems(data.items)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [activeTab, projectFilter])

  useEffect(() => {
    setLoading(true)
    fetchItems()
  }, [fetchItems])

  // 30s auto-refresh
  useEffect(() => {
    const id = setInterval(fetchItems, 30_000)
    return () => clearInterval(id)
  }, [fetchItems])

  // Load projects for filter
  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(d => { if (d.projects) setProjects(d.projects) })
      .catch(() => {})
  }, [])

  async function handleStatusUpdate(
    id: string,
    status: string,
    opts?: { review_note?: string; content?: string }
  ) {
    try {
      await fetch(`/api/approval-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...opts }),
      })
      setItems(prev => prev.map(item =>
        item.id === id ? { ...item, status, review_note: opts?.review_note ?? item.review_note, reviewed_at: new Date().toISOString() } : item
      ))
    } catch {
      // silently fail
    }
  }

  const pendingCount = items.filter(i => i.status === 'pending').length

  return (
    <PageShell title="Approvals" subtitle="Review anything risky before Kevin continues." maxWidth={780} style={{ minHeight: '100vh' }}>

      {/* Safety microcopy banner */}
      <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 22 }}>
        Approving does not execute automatically. Resume is still explicit.
      </div>

      {/* Filters row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Project dropdown */}
        <select
          value={projectFilter}
          onChange={e => setProjectFilter(e.target.value)}
          style={{
            fontSize: 12, padding: '6px 10px', borderRadius: 6,
            border: '1px solid #e2e8f0', background: '#ffffff', color: '#374151',
            outline: 'none', cursor: 'pointer',
          }}
        >
          <option value="all">All projects</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {pendingCount > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 600, background: '#fef3c7', color: '#d97706',
            borderRadius: 10, padding: '2px 8px',
          }}>
            {pendingCount} pending
          </span>
        )}
      </div>

      {/* Filter tabs */}
      <AdvancedDisclosure title="View other approvals">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {FILTER_TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                border: '1px solid #e5e7eb',
                background: activeTab === t.id ? '#111827' : '#ffffff',
                color: activeTab === t.id ? '#ffffff' : '#6b7280',
                borderRadius: 999,
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </AdvancedDisclosure>

      {/* Item list */}
      {loading ? (
        <div style={{ fontSize: 12, color: '#94a3b8', padding: '20px 0', textAlign: 'center' }}>
          Loading…
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title={activeTab === 'pending' ? 'No approvals needed.' : 'No items found.'}
          description={activeTab === 'pending' ? 'Kevin will ask here before anything risky continues.' : undefined}
        />
      ) : (
        <div>
          {items.map(item => (
            <ApprovalCard
              key={item.id}
              item={item}
              onStatusUpdate={handleStatusUpdate}
              projects={projects}
            />
          ))}
        </div>
      )}
    </PageShell>
  )
}
