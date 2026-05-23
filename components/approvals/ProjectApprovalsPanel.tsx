'use client'
import { useCallback, useEffect, useState } from 'react'

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

type FilterTab = 'all' | 'pending' | 'approved' | 'changes_requested' | 'rejected'

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all',               label: 'All' },
  { id: 'pending',           label: 'Pending' },
  { id: 'approved',          label: 'Approved' },
  { id: 'changes_requested', label: 'Changes Req.' },
  { id: 'rejected',          label: 'Rejected' },
]

const STATUS_BADGE: Record<string, { background: string; color: string }> = {
  pending:           { background: '#fef3c7', color: '#d97706' },
  approved:          { background: '#dcfce7', color: '#16a34a' },
  changes_requested: { background: '#f3e8ff', color: '#7c3aed' },
  rejected:          { background: '#fee2e2', color: '#dc2626' },
  archived:          { background: '#f1f5f9', color: '#94a3b8' },
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)    return `${Math.round(diff)}s ago`
  if (diff < 3600)  return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  return `${Math.round(diff / 86400)}d ago`
}

function CompactApprovalCard({
  item,
  onStatusUpdate,
}: {
  item: ApprovalItem
  onStatusUpdate: (id: string, status: string, opts?: { review_note?: string }) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [noteInput, setNoteInput] = useState('')
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [confirmedStatus, setConfirmedStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const badge = STATUS_BADGE[item.status] ?? STATUS_BADGE.archived
  const isPending = item.status === 'pending'

  async function handleApprove() {
    setLoading(true)
    await onStatusUpdate(item.id, 'approved')
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
      background: '#ffffff', border: '1px solid #f1f5f9', borderRadius: 8,
      padding: '12px 14px', marginBottom: 8,
      borderLeft: `3px solid ${badge.background}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 3 }}>
            {item.title}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{
              ...badge, fontSize: 10, fontWeight: 600, borderRadius: 4, padding: '1px 6px',
            }}>
              {item.status.replace(/_/g, ' ')}
            </span>
            <span style={{ fontSize: 10, color: '#94a3b8' }}>
              {item.item_type.replace(/_/g, ' ')} · {item.requested_by_role}
            </span>
          </div>
        </div>
        <span style={{ fontSize: 10, color: '#cbd5e1', flexShrink: 0, marginLeft: 8 }}>
          {timeAgo(item.created_at)}
        </span>
      </div>

      {/* Content preview */}
      {!expanded ? (
        <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5, marginBottom: 6 }}>
          {item.content.slice(0, 120)}{item.content.length > 120 ? '…' : ''}
        </div>
      ) : (
        <div style={{
          fontSize: 11, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap',
          background: '#fafafa', padding: '8px 10px', borderRadius: 5,
          border: '1px solid #f1f5f9', marginBottom: 6,
        }}>
          {item.content}
        </div>
      )}

      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          fontSize: 11, color: '#6366f1', background: 'none', border: 'none',
          cursor: 'pointer', padding: 0, marginBottom: isPending ? 8 : 0,
        }}
      >
        {expanded ? 'Hide' : 'View content'}
      </button>

      {/* Inline confirmation */}
      {confirmedStatus && (
        <div style={{
          fontSize: 11, color: '#16a34a', padding: '5px 8px', background: '#f0fdf4',
          borderRadius: 5, marginTop: 6, border: '1px solid #bbf7d0',
        }}>
          {confirmedStatus === 'approved' && 'Approved. No external messages sent.'}
          {confirmedStatus === 'rejected' && 'Rejected.'}
          {confirmedStatus === 'changes_requested' && 'Changes requested.'}
        </div>
      )}

      {/* Action buttons */}
      {isPending && !confirmedStatus && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={handleApprove}
              disabled={loading}
              style={{
                fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 5,
                border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              Approve
            </button>
            <button
              onClick={handleChanges}
              disabled={loading}
              style={{
                fontSize: 11, fontWeight: 500, padding: '4px 10px', borderRadius: 5,
                border: '1px solid #e2e8f0', background: '#f3e8ff', color: '#7c3aed', cursor: 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {showNoteInput ? 'Send' : 'Request changes'}
            </button>
            <button
              onClick={handleReject}
              disabled={loading}
              style={{
                fontSize: 11, fontWeight: 500, padding: '4px 10px', borderRadius: 5,
                border: '1px solid #e2e8f0', background: '#fee2e2', color: '#dc2626', cursor: 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              Reject
            </button>
          </div>
          <div style={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic' }}>
            Approving does not send externally.
          </div>
          {showNoteInput && (
            <input
              autoFocus
              value={noteInput}
              onChange={e => setNoteInput(e.target.value)}
              placeholder="Describe the changes needed…"
              style={{
                fontSize: 11, padding: '5px 8px', borderRadius: 5,
                border: '1px solid #e2e8f0', outline: 'none', color: '#374151',
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}

export function ProjectApprovalsPanel({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<ApprovalItem[]>([])
  const [filter, setFilter] = useState<FilterTab>('all')
  const [loading, setLoading] = useState(true)

  const fetchItems = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.set('project_id', projectId)
      params.set('limit', '50')
      const res = await fetch(`/api/approval-items?${params}`)
      const data = await res.json()
      if (data.items) setItems(data.items)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    setLoading(true)
    fetchItems()
  }, [fetchItems])

  useEffect(() => {
    const id = setInterval(fetchItems, 30_000)
    return () => clearInterval(id)
  }, [fetchItems])

  async function handleStatusUpdate(
    id: string,
    status: string,
    opts?: { review_note?: string }
  ) {
    try {
      await fetch(`/api/approval-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...opts }),
      })
      setItems(prev => prev.map(item =>
        item.id === id
          ? { ...item, status, review_note: opts?.review_note ?? item.review_note, reviewed_at: new Date().toISOString() }
          : item
      ))
    } catch {
      // silently fail
    }
  }

  const filtered = (() => {
    if (filter === 'all') return items
    return items.filter(i => i.status === filter)
  })()

  const pendingCount = items.filter(i => i.status === 'pending').length

  return (
    <div>
      {/* Filter tabs */}
      <div style={{
        display: 'flex', borderBottom: '1px solid #f1f5f9', marginBottom: 14, flexWrap: 'wrap',
      }}>
        {FILTER_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '6px 4px', marginRight: 14, height: 34, fontSize: 11,
              fontWeight: filter === t.id ? 600 : 400,
              color: filter === t.id ? '#0f172a' : '#94a3b8',
              borderBottom: filter === t.id ? '2px solid #0f172a' : '2px solid transparent',
              transition: 'color 0.1s', whiteSpace: 'nowrap',
            }}
          >
            {t.label}
            {t.id === 'pending' && pendingCount > 0 && (
              <span style={{
                marginLeft: 4, fontSize: 9, fontWeight: 700,
                background: '#fef3c7', color: '#d97706',
                borderRadius: 8, padding: '1px 4px', verticalAlign: 'middle',
              }}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Safety banner */}
      <div style={{
        fontSize: 11, color: '#64748b', background: '#f8fafc',
        border: '1px solid #e2e8f0', borderRadius: 6, padding: '7px 10px', marginBottom: 12,
      }}>
        Approving an item is internal permission only — no external messages are sent.
      </div>

      {/* Item list */}
      {loading ? (
        <div style={{ fontSize: 12, color: '#94a3b8', padding: '16px 0', textAlign: 'center' }}>
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', padding: '10px 0' }}>
          {filter === 'pending'
            ? 'No items pending review.'
            : `No ${filter.replace(/_/g, ' ')} items.`}
        </div>
      ) : (
        <div>
          {filtered.map(item => (
            <CompactApprovalCard
              key={item.id}
              item={item}
              onStatusUpdate={handleStatusUpdate}
            />
          ))}
        </div>
      )}
    </div>
  )
}
