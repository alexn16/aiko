'use client'
import { useEffect, useState, useCallback } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface AgentTask {
  id: string
  project_id: string | null
  owner_role: string
  assigned_by_role: string
  title: string
  description: string
  status: string
  priority: string
  task_type: string
  created_at: string
  completed_at: string | null
}

interface TaskOutput {
  id: string
  task_id: string | null
  output_type: string
  title: string
  status: string
  content: string
  requires_approval: boolean
  created_at: string
}

interface Props {
  projectId?: string
}

type FilterTab = 'all' | 'in_progress' | 'blocked' | 'review' | 'completed'

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, React.CSSProperties> = {
  planned:     { background: '#f1f5f9', color: '#475569' },
  in_progress: { background: '#dbeafe', color: '#1d4ed8' },
  waiting:     { background: '#fef3c7', color: '#d97706' },
  review:      { background: '#ede9fe', color: '#6d28d9' },
  blocked:     { background: '#fee2e2', color: '#dc2626' },
  completed:   { background: '#dcfce7', color: '#16a34a' },
  cancelled:   { background: '#f1f5f9', color: '#94a3b8' },
}

const OUTPUT_STATUS_BADGE: Record<string, React.CSSProperties> = {
  draft:    { background: '#f1f5f9', color: '#475569' },
  ready:    { background: '#dbeafe', color: '#1d4ed8' },
  reviewed: { background: '#ede9fe', color: '#6d28d9' },
  approved: { background: '#dcfce7', color: '#16a34a' },
  rejected: { background: '#fee2e2', color: '#dc2626' },
  archived: { background: '#f8fafc', color: '#94a3b8' },
}

const PRIORITY_COLOR: Record<string, string> = {
  low:    '#94a3b8',
  normal: '#3b82f6',
  high:   '#f97316',
  urgent: '#ef4444',
}

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all',         label: 'All' },
  { id: 'in_progress', label: 'Active' },
  { id: 'blocked',     label: 'Blocked' },
  { id: 'review',      label: 'Review' },
  { id: 'completed',   label: 'Completed' },
]

const ROLE_OPTIONS = [
  'CEO', 'Project Manager', 'Research Agent', 'Lead Gen Agent',
  'Copywriting Agent', 'Quality Agent', 'Outreach Agent',
  'Strategy Agent', 'Reporting Agent', 'Social Media Agent',
]

const TASK_TYPE_OPTIONS = [
  'project_map', 'research', 'strategy', 'lead_generation',
  'copywriting', 'qa_review', 'outreach_preparation',
  'report', 'approval_preparation', 'memory_update', 'client_update',
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)   return `${Math.round(diff)}s ago`
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  return `${Math.round(diff / 86400)}d ago`
}

function getActions(status: string): { label: string; next: string }[] {
  switch (status) {
    case 'planned':
      return [{ label: 'Start', next: 'in_progress' }]
    case 'in_progress':
      return [
        { label: 'Waiting', next: 'waiting' },
        { label: 'Blocked', next: 'blocked' },
        { label: 'Review',  next: 'review' },
        { label: 'Complete', next: 'completed' },
      ]
    case 'waiting':
      return [
        { label: 'Resume',  next: 'in_progress' },
        { label: 'Blocked', next: 'blocked' },
        { label: 'Complete', next: 'completed' },
      ]
    case 'review':
      return [
        { label: 'Complete', next: 'completed' },
        { label: 'Blocked',  next: 'blocked' },
      ]
    case 'blocked':
      return [
        { label: 'Resume',   next: 'in_progress' },
        { label: 'Complete', next: 'completed' },
      ]
    default:
      return []
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_BADGE[status] ?? STATUS_BADGE.planned
  return (
    <span style={{
      ...style,
      fontSize: 10, fontWeight: 600, borderRadius: 4,
      padding: '2px 7px', textTransform: 'capitalize',
      letterSpacing: '0.02em',
    }}>
      {status.replace('_', ' ')}
    </span>
  )
}

function PriorityDot({ priority }: { priority: string }) {
  return (
    <span style={{
      display: 'inline-block',
      width: 7, height: 7, borderRadius: '50%',
      background: PRIORITY_COLOR[priority] ?? PRIORITY_COLOR.normal,
      flexShrink: 0,
    }} title={`Priority: ${priority}`} />
  )
}

// ── OutputExpandSection ────────────────────────────────────────────────────────

function OutputExpandSection({ taskId, onStatusChange }: {
  taskId: string
  onStatusChange?: () => void
}) {
  const [outputs, setOutputs] = useState<TaskOutput[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/task-outputs?task_id=${taskId}`)
      .then(r => r.json())
      .then(d => { if (d.outputs) setOutputs(d.outputs) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [taskId])

  async function handleOutputAction(outputId: string, status: string) {
    try {
      await fetch(`/api/task-outputs/${outputId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      setOutputs(prev => prev.map(o => o.id === outputId ? { ...o, status } : o))
      onStatusChange?.()
    } catch {
      // silently fail
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '10px 14px', fontSize: 11, color: '#94a3b8' }}>
        Loading outputs…
      </div>
    )
  }

  if (outputs.length === 0) {
    return (
      <div style={{ padding: '10px 14px', fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
        No outputs yet.
      </div>
    )
  }

  return (
    <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {outputs.map(output => (
        <div key={output.id} style={{
          background: '#fafafa',
          border: '1px solid #f1f5f9',
          borderRadius: 6,
          padding: '10px 12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', flex: 1 }}>
              {output.title}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 500, borderRadius: 4,
              padding: '1px 6px',
              ...(OUTPUT_STATUS_BADGE[output.status] ?? OUTPUT_STATUS_BADGE.draft),
            }}>
              {output.status}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 500, borderRadius: 4,
              padding: '1px 6px',
              background: '#f0f9ff', color: '#0369a1',
            }}>
              {output.output_type.replace(/_/g, ' ')}
            </span>
            {output.requires_approval && (
              <span style={{
                fontSize: 10, fontWeight: 600, borderRadius: 4,
                padding: '1px 6px',
                background: '#fee2e2', color: '#dc2626',
              }}>
                needs approval
              </span>
            )}
          </div>
          {output.content && (
            <div style={{
              fontSize: 11, color: '#64748b', lineHeight: 1.5,
              overflow: 'hidden', maxHeight: 48,
              marginBottom: 8,
            }}>
              {output.content.slice(0, 150)}{output.content.length > 150 ? '…' : ''}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {output.status === 'draft' && (
              <button
                onClick={() => handleOutputAction(output.id, 'ready')}
                style={{
                  fontSize: 10, fontWeight: 500,
                  padding: '2px 8px', borderRadius: 4,
                  border: '1px solid #e2e8f0',
                  background: '#f0fdf4', color: '#16a34a',
                  cursor: 'pointer',
                }}
              >
                Mark ready
              </button>
            )}
            {output.status === 'ready' && output.requires_approval && (
              <button
                onClick={() => handleOutputAction(output.id, 'approved')}
                style={{
                  fontSize: 10, fontWeight: 500,
                  padding: '2px 8px', borderRadius: 4,
                  border: '1px solid #e2e8f0',
                  background: '#f0fdf4', color: '#16a34a',
                  cursor: 'pointer',
                }}
              >
                Approve
              </button>
            )}
            {(output.status === 'draft' || output.status === 'ready') && (
              <button
                onClick={() => handleOutputAction(output.id, 'rejected')}
                style={{
                  fontSize: 10, fontWeight: 500,
                  padding: '2px 8px', borderRadius: 4,
                  border: '1px solid #e2e8f0',
                  background: '#fef2f2', color: '#dc2626',
                  cursor: 'pointer',
                }}
              >
                Reject
              </button>
            )}
            {(output.status === 'approved' || output.status === 'rejected') && (
              <button
                onClick={() => handleOutputAction(output.id, 'archived')}
                style={{
                  fontSize: 10, fontWeight: 500,
                  padding: '2px 8px', borderRadius: 4,
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc', color: '#64748b',
                  cursor: 'pointer',
                }}
              >
                Archive
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── TaskCard ───────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  showProject,
  onAction,
  outputCount,
  onOutputCountChange,
}: {
  task: AgentTask
  showProject: boolean
  onAction: (id: string, status: string) => void
  outputCount: number
  onOutputCountChange: (taskId: string, delta: number) => void
}) {
  const actions = getActions(task.status)
  const [generating, setGenerating] = useState(false)
  const [genSuccess, setGenSuccess] = useState(false)
  const [outputsExpanded, setOutputsExpanded] = useState(false)

  async function handleGenerateOutput() {
    setGenerating(true)
    try {
      const res = await fetch(`/api/agent-tasks/${task.id}/generate-output`, {
        method: 'POST',
      })
      if (res.ok) {
        setGenSuccess(true)
        onOutputCountChange(task.id, 1)
        setTimeout(() => setGenSuccess(false), 3000)
      }
    } catch {
      // silently fail
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #f1f5f9',
      borderRadius: 8,
      marginBottom: 8,
      overflow: 'hidden',
    }}>
      <div style={{ padding: '12px 14px' }}>
        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
          <PriorityDot priority={task.priority} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', lineHeight: 1.3 }}>
              {task.title}
            </div>
            {task.description && (
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 3, lineHeight: 1.4 }}>
                {task.description.slice(0, 120)}{task.description.length > 120 ? '…' : ''}
              </div>
            )}
          </div>
          <StatusBadge status={task.status} />
        </div>

        {/* Meta row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          flexWrap: 'wrap', marginBottom: 8,
        }}>
          <span style={{
            fontSize: 10, fontWeight: 500, color: '#475569',
            background: '#f8fafc', border: '1px solid #f1f5f9',
            borderRadius: 4, padding: '1px 6px',
          }}>
            {task.owner_role}
          </span>
          {task.assigned_by_role && task.assigned_by_role !== 'system' && (
            <span style={{ fontSize: 10, color: '#94a3b8' }}>
              from {task.assigned_by_role}
            </span>
          )}
          <span style={{ fontSize: 10, color: '#94a3b8' }}>
            {task.task_type.replace(/_/g, ' ')}
          </span>
          {showProject && task.project_id && (
            <span style={{ fontSize: 10, color: '#94a3b8' }}>
              project:{task.project_id.slice(0, 8)}
            </span>
          )}
          {outputCount > 0 && (
            <span style={{ fontSize: 10, color: '#94a3b8' }}>
              {outputCount} output{outputCount !== 1 ? 's' : ''}
            </span>
          )}
          <span style={{ fontSize: 10, color: '#cbd5e1', marginLeft: 'auto' }}>
            {timeAgo(task.created_at)}
          </span>
        </div>

        {/* Actions row */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {actions.map(a => (
            <button
              key={a.next}
              onClick={() => onAction(task.id, a.next)}
              style={{
                fontSize: 11, fontWeight: 500,
                padding: '3px 10px',
                borderRadius: 5,
                border: '1px solid #e2e8f0',
                background: a.next === 'completed' ? '#f0fdf4'
                  : a.next === 'blocked' ? '#fef2f2'
                  : '#f8fafc',
                color: a.next === 'completed' ? '#16a34a'
                  : a.next === 'blocked' ? '#dc2626'
                  : '#374151',
                cursor: 'pointer',
              }}
            >
              {a.label}
            </button>
          ))}

          {/* Generate output button */}
          {genSuccess ? (
            <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 500 }}>
              Output generated
            </span>
          ) : (
            <button
              onClick={handleGenerateOutput}
              disabled={generating}
              style={{
                fontSize: 11, fontWeight: 500,
                padding: '3px 10px',
                borderRadius: 5,
                border: '1px solid #e2e8f0',
                background: '#eff6ff',
                color: generating ? '#94a3b8' : '#1d4ed8',
                cursor: generating ? 'default' : 'pointer',
                opacity: generating ? 0.7 : 1,
              }}
            >
              {generating ? 'Generating…' : 'Generate output'}
            </button>
          )}

          {/* View outputs button */}
          {outputCount > 0 && (
            <button
              onClick={() => setOutputsExpanded(o => !o)}
              style={{
                fontSize: 11, fontWeight: 500,
                padding: '3px 10px',
                borderRadius: 5,
                border: '1px solid #e2e8f0',
                background: outputsExpanded ? '#0f172a' : '#f8fafc',
                color: outputsExpanded ? '#ffffff' : '#374151',
                cursor: 'pointer',
              }}
            >
              {outputsExpanded ? 'Hide outputs' : `View outputs (${outputCount})`}
            </button>
          )}
        </div>
      </div>

      {/* Inline output expand */}
      {outputsExpanded && (
        <div style={{ borderTop: '1px solid #f1f5f9' }}>
          <OutputExpandSection taskId={task.id} />
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function TasksPanel({ projectId }: Props) {
  const [tasks, setTasks] = useState<AgentTask[]>([])
  const [filter, setFilter] = useState<FilterTab>('all')
  const [loading, setLoading] = useState(true)
  const [composeOpen, setComposeOpen] = useState(false)
  const [outputCounts, setOutputCounts] = useState<Record<string, number>>({})
  const [form, setForm] = useState({
    title: '',
    owner_role: 'Project Manager',
    task_type: 'project_map',
    priority: 'normal',
    description: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const fetchTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (projectId) params.set('project_id', projectId)
      if (filter !== 'all') params.set('status', filter)
      params.set('limit', '100')
      const res = await fetch(`/api/agent-tasks?${params}`)
      const data = await res.json()
      if (data.tasks) setTasks(data.tasks)
    } catch {
      // silently fail — table may not exist yet
    } finally {
      setLoading(false)
    }
  }, [projectId, filter])

  const fetchOutputCounts = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (projectId) params.set('project_id', projectId)
      params.set('limit', '500')
      const res = await fetch(`/api/task-outputs?${params}`)
      const data = await res.json()
      if (data.outputs) {
        const counts: Record<string, number> = {}
        for (const output of data.outputs) {
          if (output.task_id) {
            counts[output.task_id] = (counts[output.task_id] ?? 0) + 1
          }
        }
        setOutputCounts(counts)
      }
    } catch {
      // silently fail
    }
  }, [projectId])

  useEffect(() => {
    setLoading(true)
    fetchTasks()
    fetchOutputCounts()
  }, [fetchTasks, fetchOutputCounts])

  // 30s auto-refresh
  useEffect(() => {
    const id = setInterval(() => {
      fetchTasks()
      fetchOutputCounts()
    }, 30_000)
    return () => clearInterval(id)
  }, [fetchTasks, fetchOutputCounts])

  async function handleAction(id: string, status: string) {
    try {
      await fetch(`/api/agent-tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      fetchTasks()
    } catch {
      // silently fail
    }
  }

  function handleOutputCountChange(taskId: string, delta: number) {
    setOutputCounts(prev => ({
      ...prev,
      [taskId]: (prev[taskId] ?? 0) + delta,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSubmitting(true)
    try {
      await fetch('/api/agent-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          project_id: projectId,
        }),
      })
      setForm({ title: '', owner_role: 'Project Manager', task_type: 'project_map', priority: 'normal', description: '' })
      setComposeOpen(false)
      fetchTasks()
    } catch {
      // silently fail
    } finally {
      setSubmitting(false)
    }
  }

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter)
  const showProject = !projectId

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Header + filter bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
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
            }}
          >
            {t.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setComposeOpen(o => !o)}
          style={{
            fontSize: 11, fontWeight: 600,
            background: composeOpen ? '#0f172a' : '#f8fafc',
            color: composeOpen ? '#ffffff' : '#374151',
            border: '1px solid #e2e8f0',
            borderRadius: 6, padding: '5px 12px',
            cursor: 'pointer',
          }}
        >
          {composeOpen ? '✕ Cancel' : '+ New Task'}
        </button>
      </div>

      {/* Compose form */}
      {composeOpen && (
        <form onSubmit={handleSubmit} style={{
          background: '#fafafa',
          border: '1px solid #f1f5f9',
          borderRadius: 8,
          padding: '14px 16px',
          marginBottom: 16,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            New Task
          </div>
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Task title"
            required
            style={{
              border: '1px solid #e2e8f0', borderRadius: 6,
              padding: '8px 10px', fontSize: 13, color: '#0f172a',
              background: '#ffffff', outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select
              value={form.owner_role}
              onChange={e => setForm(f => ({ ...f, owner_role: e.target.value }))}
              style={{ flex: 1, minWidth: 140, border: '1px solid #e2e8f0', borderRadius: 6, padding: '7px 9px', fontSize: 12, color: '#374151', background: '#ffffff' }}
            >
              {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select
              value={form.task_type}
              onChange={e => setForm(f => ({ ...f, task_type: e.target.value }))}
              style={{ flex: 1, minWidth: 140, border: '1px solid #e2e8f0', borderRadius: 6, padding: '7px 9px', fontSize: 12, color: '#374151', background: '#ffffff' }}
            >
              {TASK_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
            <select
              value={form.priority}
              onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
              style={{ flex: '0 0 100px', border: '1px solid #e2e8f0', borderRadius: 6, padding: '7px 9px', fontSize: 12, color: '#374151', background: '#ffffff' }}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Description (optional)"
            rows={2}
            style={{
              border: '1px solid #e2e8f0', borderRadius: 6,
              padding: '8px 10px', fontSize: 12, color: '#374151',
              background: '#ffffff', resize: 'vertical', outline: 'none',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={submitting || !form.title.trim()}
              style={{
                background: '#0f172a', color: '#ffffff',
                border: 'none', borderRadius: 6,
                padding: '7px 18px', fontSize: 12, fontWeight: 600,
                cursor: submitting ? 'default' : 'pointer',
                opacity: submitting || !form.title.trim() ? 0.6 : 1,
              }}
            >
              {submitting ? 'Creating…' : 'Create Task'}
            </button>
          </div>
        </form>
      )}

      {/* Task list */}
      {loading ? (
        <div style={{ fontSize: 12, color: '#94a3b8', padding: '20px 0', textAlign: 'center' }}>
          Loading tasks…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', padding: '12px 0' }}>
          No tasks{filter !== 'all' ? ` with status "${filter.replace('_', ' ')}"` : ''}.
        </div>
      ) : (
        <div>
          {filtered.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              showProject={showProject}
              onAction={handleAction}
              outputCount={outputCounts[task.id] ?? 0}
              onOutputCountChange={handleOutputCountChange}
            />
          ))}
        </div>
      )}
    </div>
  )
}
