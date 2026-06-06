'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done' | 'archived'

type OwnerTask = {
  id: string
  project_id: string | null
  project_name: string | null
  owner_role: string
  title: string
  description: string
  status: TaskStatus
  priority: string
  source: string
  created_at: string
}

type Props = {
  projectId?: string
  compact?: boolean
}

const statusOptions: Array<{ value: string; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
  { value: 'archived', label: 'Archived' },
]

const statusTone: Record<TaskStatus, { bg: string; color: string; label: string }> = {
  todo: { bg: '#f1f5f9', color: '#475569', label: 'To do' },
  in_progress: { bg: '#dbeafe', color: '#1d4ed8', label: 'In progress' },
  blocked: { bg: '#fee2e2', color: '#991b1b', label: 'Blocked' },
  done: { bg: '#dcfce7', color: '#166534', label: 'Done' },
  archived: { bg: '#f3f4f6', color: '#6b7280', label: 'Archived' },
}

const buttonStyle: React.CSSProperties = {
  border: '1px solid #dbeafe',
  background: '#eff6ff',
  color: '#1d4ed8',
  borderRadius: 8,
  padding: '7px 10px',
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
}

function formatRole(role: string) {
  return role.replace(/_/g, ' ')
}

function taskAge(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const hours = Math.max(0, Math.round(diff / 36e5))
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function ownerDescription(description: string) {
  const trimmed = description.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'Internal task created from a plan.'
  }
  return trimmed.split('\n\nSource:')[0]
}

export function SimpleTasksPanel({ projectId, compact = false }: Props) {
  const [tasks, setTasks] = useState<OwnerTask[]>([])
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([])
  const [projectFilter, setProjectFilter] = useState(projectId ?? '')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const ownerRoles = useMemo(() => {
    return Array.from(new Set(tasks.map(task => task.owner_role))).sort()
  }, [tasks])

  const loadTasks = useCallback(async () => {
    setLoading(true)
    setMessage('')
    try {
      const params = new URLSearchParams()
      if (projectId) params.set('project_id', projectId)
      else if (projectFilter) params.set('project_id', projectFilter)
      if (ownerFilter) params.set('owner_role', ownerFilter)
      if (statusFilter === 'active') params.set('active', 'true')
      else if (statusFilter) params.set('status', statusFilter)
      params.set('limit', compact ? '20' : '100')
      const res = await fetch(`/api/tasks?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not load tasks.')
      setTasks(Array.isArray(data.tasks) ? data.tasks : [])
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not load tasks.')
    } finally {
      setLoading(false)
    }
  }, [compact, ownerFilter, projectFilter, projectId, statusFilter])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  useEffect(() => {
    if (projectId) return
    fetch('/api/projects')
      .then(res => res.ok ? res.json() : null)
      .then(data => setProjects(Array.isArray(data?.projects) ? data.projects : []))
      .catch(() => setProjects([]))
  }, [projectId])

  async function updateTask(task: OwnerTask, status: TaskStatus) {
    setMessage('')
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const data = await res.json()
    if (!res.ok) {
      setMessage(data.error ?? 'Could not update task.')
      return
    }
    await loadTasks()
  }

  return (
    <div style={{ display: 'grid', gap: compact ? 12 : 16 }}>
      {!compact && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {!projectId && (
            <select
              value={projectFilter}
              onChange={event => setProjectFilter(event.target.value)}
              style={{ height: 38, border: '1px solid #cbd5e1', borderRadius: 8, padding: '0 10px', color: '#0f172a' }}
            >
              <option value="">All projects</option>
              {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          )}
          <select
            value={ownerFilter}
            onChange={event => setOwnerFilter(event.target.value)}
            style={{ height: 38, border: '1px solid #cbd5e1', borderRadius: 8, padding: '0 10px', color: '#0f172a' }}
          >
            <option value="">All owners</option>
            {ownerRoles.map(role => <option key={role} value={role}>{formatRole(role)}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={event => setStatusFilter(event.target.value)}
            style={{ height: 38, border: '1px solid #cbd5e1', borderRadius: 8, padding: '0 10px', color: '#0f172a' }}
          >
            {statusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
      )}

      {message && (
        <div style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: 8, padding: 10, fontSize: 13 }}>
          {message}
        </div>
      )}

      {loading ? (
        <div style={{ color: '#64748b', fontSize: 13 }}>Loading tasks...</div>
      ) : tasks.length === 0 ? (
        <div style={{ color: '#64748b', fontSize: 13 }}>
          Tasks created from plans will appear here.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {tasks.map(task => {
            const tone = statusTone[task.status]
            return (
              <div key={task.id} style={{
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                borderRadius: 8,
                padding: compact ? 12 : 14,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: '#0f172a', fontSize: compact ? 14 : 15, fontWeight: 900, lineHeight: 1.35 }}>
                      {task.title}
                    </div>
                    <div style={{ color: '#64748b', fontSize: 12, marginTop: 5, lineHeight: 1.5 }}>
                      {task.project_name ?? 'No project'} · {formatRole(task.owner_role)} · {task.source} · {taskAge(task.created_at)}
                    </div>
                  </div>
                  <span style={{
                    flexShrink: 0,
                    borderRadius: 999,
                    padding: '4px 8px',
                    background: tone.bg,
                    color: tone.color,
                    fontSize: 11,
                    fontWeight: 900,
                  }}>
                    {tone.label}
                  </span>
                </div>
                {!compact && ownerDescription(task.description) && (
                  <p style={{ margin: '10px 0 0', color: '#334155', fontSize: 13, lineHeight: 1.55 }}>
                    {ownerDescription(task.description)}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  {task.status !== 'done' && (
                    <button style={buttonStyle} onClick={() => updateTask(task, 'done')}>Mark done</button>
                  )}
                  {task.status !== 'blocked' && task.status !== 'done' && (
                    <button style={{ ...buttonStyle, background: '#fff7ed', borderColor: '#fed7aa', color: '#c2410c' }} onClick={() => updateTask(task, 'blocked')}>Mark blocked</button>
                  )}
                  {task.status !== 'todo' && (
                    <button style={buttonStyle} onClick={() => updateTask(task, 'todo')}>Reopen</button>
                  )}
                  {task.project_id && (
                    <Link href={`/projects/${task.project_id}`} style={{ ...buttonStyle, textDecoration: 'none' }}>Open project</Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
