'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

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
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>
            {item.title}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{
              ...badge,
              fontSize: 10, fontWeight: 600, borderRadius: 4, padding: '2px 7px',
            }}>
              {item.status.replace(/_/g, ' ')}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 500, borderRadius: 4, padding: '2px 7px',
              background: '#f0f9ff', color: '#0369a1',
            }}>
              {item.item_type.replace(/_/g, ' ')}
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
        <span style={{ fontSize: 10, color: '#94a3b8' }}>
          by {item.requested_by_role}
        </span>
      </div>

      {/* Content preview / expanded */}
      {!expanded ? (
        <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, marginBottom: 10 }}>
          {item.content.slice(0, 150)}{item.content.length > 150 ? '…' : ''}
        </div>
      ) : (
        <div style={{ marginBottom: 10 }}>
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
        </div>
      )}

      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          fontSize: 11, color: '#6366f1', background: 'none', border: 'none',
          cursor: 'pointer', padding: 0, marginBottom: 10,
        }}
      >
        {expanded ? 'Hide content' : 'View full content'}
      </button>

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
          <div style={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic' }}>
            Approving grants internal permission only — no external emails or messages are sent.
          </div>
          {showNoteInput && (
            <input
              autoFocus
              value={noteInput}
              onChange={e => setNoteInput(e.target.value)}
              placeholder="Describe the changes needed…"
              style={{
                fontSize: 12, padding: '7px 10px', borderRadius: 6,
                border: '1px solid #e2e8f0', outline: 'none', color: '#374151',
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ApprovalsPage() {
  const [items, setItems] = useState<ApprovalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
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
    <div style={{ padding: '40px 32px', maxWidth: 780 }} className="page-enter">

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
          Approval Center
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
          Review and approve agent outputs before external use.
        </p>
      </div>

      {/* Safety microcopy banner */}
      <div style={{
        background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
        padding: '10px 14px', marginBottom: 20, fontSize: 12, color: '#64748b',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 14 }}>&#128274;</span>
        <span>
          Approving an item gives AÏKO permission to use it in the next step.
          It does <strong>not</strong> send external emails or messages.
        </span>
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
      <div style={{
        display: 'flex', borderBottom: '1px solid #f1f5f9',
        marginBottom: 20, flexWrap: 'wrap',
      }}>
        {FILTER_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 4px', marginRight: 18, height: 38, fontSize: 12,
              fontWeight: activeTab === t.id ? 600 : 400,
              color: activeTab === t.id ? '#0f172a' : '#94a3b8',
              borderBottom: activeTab === t.id ? '2px solid #0f172a' : '2px solid transparent',
              transition: 'color 0.1s', whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Item list */}
      {loading ? (
        <div style={{ fontSize: 12, color: '#94a3b8', padding: '20px 0', textAlign: 'center' }}>
          Loading…
        </div>
      ) : items.length === 0 ? (
        <div style={{
          fontSize: 13, color: '#94a3b8', fontStyle: 'italic',
          padding: '32px 0', textAlign: 'center',
        }}>
          {activeTab === 'pending'
            ? 'No items pending review. Agents will add items here automatically when outputs require approval.'
            : 'No items found.'}
        </div>
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

      {/* Footer link back to old approval queue */}
      <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
        <Link
          href="/approval"
          style={{ fontSize: 12, color: '#6366f1', textDecoration: 'none' }}
        >
          Legacy outreach approval queue →
        </Link>
      </div>
    </div>
  )
}
