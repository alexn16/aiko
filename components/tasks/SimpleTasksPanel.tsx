'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AdvancedDisclosure } from '@/components/ui/AdvancedDisclosure'
import { EmptyState } from '@/components/ui/EmptyState'
import { PrimaryAction } from '@/components/ui/PrimaryAction'
import { StatusPill } from '@/components/ui/StatusPill'

type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done' | 'archived'

type OwnerTask = {
  id: string
  project_id: string | null
  project_name: string | null
  owner_role: string
  assigned_agent_name: string | null
  output_summary: string | null
  output_file_id: string | null
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
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
  { value: 'archived', label: 'Archived' },
]

const tabOptions: Array<{ value: string; label: string }> = [
  { value: 'todo', label: 'Todo' },
  { value: 'in_progress', label: 'Working' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
]

const statusTone: Record<TaskStatus, { tone: 'gray' | 'blue' | 'red' | 'green'; label: string }> = {
  todo: { tone: 'gray', label: 'Todo' },
  in_progress: { tone: 'blue', label: 'Working' },
  blocked: { tone: 'red', label: 'Blocked' },
  done: { tone: 'green', label: 'Done' },
  archived: { tone: 'gray', label: 'Archived' },
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
  const [statusFilter, setStatusFilter] = useState('todo')
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
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {tabOptions.map(tab => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                style={{
                  border: '1px solid #e5e7eb',
                  background: statusFilter === tab.value ? '#111827' : '#ffffff',
                  color: statusFilter === tab.value ? '#ffffff' : '#6b7280',
                  borderRadius: 999,
                  padding: '8px 14px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <AdvancedDisclosure title="Filters">
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {!projectId && (
                <select
                  value={projectFilter}
                  onChange={event => setProjectFilter(event.target.value)}
                  style={{ height: 38, border: '1px solid #d1d5db', borderRadius: 12, padding: '0 10px', color: '#111827' }}
                >
                  <option value="">All projects</option>
                  {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select>
              )}
              <select
                value={ownerFilter}
                onChange={event => setOwnerFilter(event.target.value)}
                style={{ height: 38, border: '1px solid #d1d5db', borderRadius: 12, padding: '0 10px', color: '#111827' }}
              >
                <option value="">All owners</option>
                {ownerRoles.map(role => <option key={role} value={role}>{formatRole(role)}</option>)}
              </select>
              <select
                value={statusFilter}
                onChange={event => setStatusFilter(event.target.value)}
                style={{ height: 38, border: '1px solid #d1d5db', borderRadius: 12, padding: '0 10px', color: '#111827' }}
              >
                {statusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
          </AdvancedDisclosure>
        </>
      )}

      {message && (
        <div style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: 8, padding: 10, fontSize: 13 }}>
          {message}
        </div>
      )}

      {loading ? (
        <div style={{ color: '#64748b', fontSize: 13 }}>Loading tasks...</div>
      ) : tasks.length === 0 ? (
        <EmptyState title="No tasks yet." description="Tasks created from plans will appear here." />
      ) : (
        <div style={{ display: 'grid', gap: 0, borderTop: '1px solid #f3f4f6' }}>
          {tasks.map(task => {
            const tone = statusTone[task.status]
            return (
              <div key={task.id} style={{
                borderBottom: '1px solid #f3f4f6',
                background: '#ffffff',
                padding: compact ? '12px 0' : '16px 0',
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', gap: 16, alignItems: 'center' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: '#0f172a', fontSize: compact ? 14 : 15, fontWeight: 900, lineHeight: 1.35 }}>
                      {task.title}
                    </div>
                    <div style={{ color: '#64748b', fontSize: 12, marginTop: 5, lineHeight: 1.5 }}>
                      {task.project_name ?? 'No project'} · {task.assigned_agent_name ?? formatRole(task.owner_role)}
                    </div>
                  </div>
                  <StatusPill tone={tone.tone}>{tone.label}</StatusPill>
                  {task.status !== 'done' ? (
                    <PrimaryAction onClick={() => updateTask(task, 'done')} variant="secondary">Done</PrimaryAction>
                  ) : (
                    <PrimaryAction onClick={() => updateTask(task, 'todo')} variant="secondary">Reopen</PrimaryAction>
                  )}
                </div>
                {!compact && (
                  <AdvancedDisclosure title="Details">
                    {ownerDescription(task.description) && (
                      <p style={{ margin: 0, color: '#334155', fontSize: 13, lineHeight: 1.55 }}>
                        {ownerDescription(task.description)}
                      </p>
                    )}
                    {task.output_summary && (
                      <p style={{ margin: '10px 0 0', color: '#475569', fontSize: 13, lineHeight: 1.55 }}>
                        <strong>Output:</strong> {task.output_summary}
                      </p>
                    )}
                    <div style={{ color: '#6b7280', fontSize: 12, marginTop: 10 }}>
                      Source: {task.source} · Created {taskAge(task.created_at)}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  {task.status !== 'blocked' && task.status !== 'done' && (
                    <button style={{ ...buttonStyle, background: '#fff7ed', borderColor: '#fed7aa', color: '#c2410c' }} onClick={() => updateTask(task, 'blocked')}>Mark blocked</button>
                  )}
                  {task.status !== 'todo' && (
                    <button style={buttonStyle} onClick={() => updateTask(task, 'todo')}>Reopen</button>
                  )}
                  {task.project_id && (
                    <Link href={`/projects/${task.project_id}`} style={{ ...buttonStyle, textDecoration: 'none' }}>Open project</Link>
                  )}
                  {task.output_file_id && (
                    <Link href={`/files?file_id=${task.output_file_id}`} style={{ ...buttonStyle, textDecoration: 'none' }}>Open output</Link>
                  )}
                    </div>
                  </AdvancedDisclosure>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
