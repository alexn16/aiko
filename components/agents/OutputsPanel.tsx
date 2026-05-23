'use client'
import { useEffect, useState, useCallback } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface AgentTaskOutput {
  id: string
  task_id: string | null
  project_id: string | null
  agent_role: string
  output_type: string
  title: string
  content: string
  structured_data: Record<string, unknown>
  status: string
  requires_approval: boolean
  created_at: string
  updated_at: string
}

interface Props {
  projectId?: string
}

type FilterTab = 'all' | 'draft' | 'ready' | 'pending_approval' | 'approved' | 'rejected'

// ── Constants ──────────────────────────────────────────────────────────────────

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all',              label: 'All' },
  { id: 'draft',            label: 'Draft' },
  { id: 'ready',            label: 'Ready' },
  { id: 'pending_approval', label: 'Pending Approval' },
  { id: 'approved',         label: 'Approved' },
  { id: 'rejected',         label: 'Rejected' },
]

const STATUS_BADGE: Record<string, React.CSSProperties> = {
  draft:    { background: '#f1f5f9', color: '#475569' },
  ready:    { background: '#dbeafe', color: '#1d4ed8' },
  reviewed: { background: '#ede9fe', color: '#6d28d9' },
  approved: { background: '#dcfce7', color: '#16a34a' },
  rejected: { background: '#fee2e2', color: '#dc2626' },
  archived: { background: '#f8fafc', color: '#94a3b8' },
}

const OUTPUT_TYPE_BADGE: Record<string, React.CSSProperties> = {
  research_brief:      { background: '#f0fdf4', color: '#15803d' },
  lead_list:           { background: '#eff6ff', color: '#1d4ed8' },
  outreach_draft:      { background: '#fef3c7', color: '#d97706' },
  qa_review:           { background: '#fdf4ff', color: '#9333ea' },
  report:              { background: '#f8fafc', color: '#475569' },
  campaign_proposal:   { background: '#fff1f2', color: '#e11d48' },
  project_map_update:  { background: '#f0f9ff', color: '#0369a1' },
  memory_update:       { background: '#fafaf9', color: '#57534e' },
  approval_item:       { background: '#fee2e2', color: '#dc2626' },
  note:                { background: '#f8fafc', color: '#64748b' },
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)    return `${Math.round(diff)}s ago`
  if (diff < 3600)  return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  return `${Math.round(diff / 86400)}d ago`
}

// ── OutputCard ────────────────────────────────────────────────────────────────

function OutputCard({
  output,
  showProject,
  onAction,
}: {
  output: AgentTaskOutput
  showProject: boolean
  onAction: (id: string, status: string) => void
}) {
  const typeBadgeStyle = OUTPUT_TYPE_BADGE[output.output_type] ?? OUTPUT_TYPE_BADGE.note
  const statusBadgeStyle = STATUS_BADGE[output.status] ?? STATUS_BADGE.draft

  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #f1f5f9',
      borderRadius: 8,
      padding: '14px 16px',
      marginBottom: 8,
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', lineHeight: 1.3, marginBottom: 4 }}>
            {output.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{
              ...typeBadgeStyle,
              fontSize: 10, fontWeight: 600, borderRadius: 4,
              padding: '2px 7px',
            }}>
              {output.output_type.replace(/_/g, ' ')}
            </span>
            <span style={{
              ...statusBadgeStyle,
              fontSize: 10, fontWeight: 600, borderRadius: 4,
              padding: '2px 7px', textTransform: 'capitalize',
            }}>
              {output.status}
            </span>
            {output.requires_approval && (
              <span style={{
                fontSize: 10, fontWeight: 600, borderRadius: 4,
                padding: '2px 7px',
                background: '#fee2e2', color: '#dc2626',
              }}>
                needs approval
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Meta */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: '#94a3b8' }}>
          {output.agent_role}
        </span>
        {showProject && output.project_id && (
          <span style={{ fontSize: 10, color: '#94a3b8' }}>
            project:{output.project_id.slice(0, 8)}
          </span>
        )}
        <span style={{ fontSize: 10, color: '#cbd5e1', marginLeft: 'auto' }}>
          {timeAgo(output.created_at)}
        </span>
      </div>

      {/* Content preview */}
      {output.content && (
        <div style={{
          fontSize: 12, color: '#64748b', lineHeight: 1.5,
          overflow: 'hidden', maxHeight: 40,
          marginBottom: 10,
        }}>
          {output.content.slice(0, 150)}{output.content.length > 150 ? '…' : ''}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {output.status === 'draft' && (
          <button
            onClick={() => onAction(output.id, 'ready')}
            style={{
              fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 5,
              border: '1px solid #e2e8f0', background: '#f0fdf4', color: '#16a34a', cursor: 'pointer',
            }}
          >
            Mark ready
          </button>
        )}
        {output.status === 'ready' && output.requires_approval && (
          <button
            onClick={() => onAction(output.id, 'approved')}
            style={{
              fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 5,
              border: '1px solid #e2e8f0', background: '#f0fdf4', color: '#16a34a', cursor: 'pointer',
            }}
          >
            Approve
          </button>
        )}
        {(output.status === 'draft' || output.status === 'ready') && (
          <button
            onClick={() => onAction(output.id, 'rejected')}
            style={{
              fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 5,
              border: '1px solid #e2e8f0', background: '#fef2f2', color: '#dc2626', cursor: 'pointer',
            }}
          >
            Reject
          </button>
        )}
        {(output.status === 'approved' || output.status === 'rejected') && (
          <button
            onClick={() => onAction(output.id, 'archived')}
            style={{
              fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 5,
              border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', cursor: 'pointer',
            }}
          >
            Archive
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function OutputsPanel({ projectId }: Props) {
  const [outputs, setOutputs] = useState<AgentTaskOutput[]>([])
  const [filter, setFilter] = useState<FilterTab>('all')
  const [loading, setLoading] = useState(true)

  const fetchOutputs = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (projectId) params.set('project_id', projectId)
      params.set('limit', '100')
      const res = await fetch(`/api/task-outputs?${params}`)
      const data = await res.json()
      if (data.outputs) setOutputs(data.outputs)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    setLoading(true)
    fetchOutputs()
  }, [fetchOutputs])

  // 30s auto-refresh
  useEffect(() => {
    const id = setInterval(fetchOutputs, 30_000)
    return () => clearInterval(id)
  }, [fetchOutputs])

  async function handleAction(id: string, status: string) {
    try {
      await fetch(`/api/task-outputs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      setOutputs(prev => prev.map(o => o.id === id ? { ...o, status } : o))
    } catch {
      // silently fail
    }
  }

  const filtered = (() => {
    if (filter === 'all') return outputs
    if (filter === 'pending_approval') {
      return outputs.filter(o => (o.status === 'draft' || o.status === 'ready') && o.requires_approval)
    }
    return outputs.filter(o => o.status === filter)
  })()

  const showProject = !projectId

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Filter tabs */}
      <div style={{
        display: 'flex', alignItems: 'center',
        borderBottom: '1px solid #f1f5f9', marginBottom: 16,
        flexWrap: 'wrap',
      }}>
        {FILTER_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 4px', marginRight: 18, height: 38,
              fontSize: 12,
              fontWeight: filter === t.id ? 600 : 400,
              color: filter === t.id ? '#0f172a' : '#94a3b8',
              borderBottom: filter === t.id ? '2px solid #0f172a' : '2px solid transparent',
              transition: 'color 0.1s',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
            {t.id === 'pending_approval' && outputs.filter(o =>
              (o.status === 'draft' || o.status === 'ready') && o.requires_approval
            ).length > 0 && (
              <span style={{
                marginLeft: 5, fontSize: 9, fontWeight: 700,
                background: '#fee2e2', color: '#dc2626',
                borderRadius: 10, padding: '1px 5px',
                verticalAlign: 'middle',
              }}>
                {outputs.filter(o => (o.status === 'draft' || o.status === 'ready') && o.requires_approval).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Output list */}
      {loading ? (
        <div style={{ fontSize: 12, color: '#94a3b8', padding: '20px 0', textAlign: 'center' }}>
          Loading outputs…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', padding: '12px 0' }}>
          No outputs{filter !== 'all' ? ` in "${FILTER_TABS.find(t => t.id === filter)?.label ?? filter}"` : ''}.
        </div>
      ) : (
        <div>
          {filtered.map(output => (
            <OutputCard
              key={output.id}
              output={output}
              showProject={showProject}
              onAction={handleAction}
            />
          ))}
        </div>
      )}
    </div>
  )
}
