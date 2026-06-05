'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { WebOperator } from '@/lib/web-operator/operators'

export const dynamic = 'force-dynamic'

const STATUS_COLOR: Record<string, string> = {
  idle: '#94a3b8',
  working: '#3b82f6',
  waiting_approval: '#f59e0b',
  waiting_user: '#f59e0b',
  user_controlling: '#8b5cf6',
  ready_to_resume: '#10b981',
  paused: '#f97316',
  error: '#ef4444',
}

const STATUS_LABEL: Record<string, string> = {
  idle: 'idle',
  working: 'working',
  waiting_approval: 'needs approval',
  waiting_user: 'needs your help',
  user_controlling: 'user controlling',
  ready_to_resume: 'ready to resume',
  paused: 'paused',
  error: 'error',
}

function StatusDot({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? '#94a3b8'
  const label = STATUS_LABEL[status] ?? status.replace(/_/g, ' ')
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
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
  return `${Math.round(diff / 3600)}h ago`
}

function truncate(str: string | null | undefined, n = 50): string {
  if (!str) return ''
  return str.length > n ? str.slice(0, n) + '…' : str
}

interface Project { id: string; name: string }

function operatorNotice(op: WebOperator): { title: string; text: string } | null {
  if (op.status === 'waiting_approval') {
    return {
      title: 'Approval needed',
      text: 'Kevin needs approval before doing this.',
    }
  }
  if (op.status === 'waiting_user' || op.status === 'ready_to_resume' || op.requires_user_input) {
    return {
      title: 'Kevin needs your help',
      text: 'Complete this in the browser, then click Resume.',
    }
  }
  return null
}

export default function OperatorsPage() {
  const [operators, setOperators] = useState<WebOperator[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  // Create form
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('Web Operator')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const loadOperators = useCallback(async () => {
    try {
      const res = await fetch('/api/web-operators')
      if (!res.ok) return
      const data = await res.json()
      setOperators(data.operators ?? [])
    } catch {
      // non-fatal
    } finally {
      setLoading(false)
    }
  }, [])

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects')
      if (!res.ok) return
      const data = await res.json()
      setProjects(data.projects ?? [])
    } catch {
      // non-fatal
    }
  }, [])

  useEffect(() => {
    loadOperators()
    loadProjects()
    const interval = setInterval(loadOperators, 30000)
    return () => clearInterval(interval)
  }, [loadOperators, loadProjects])

  async function handleAssignProject(operatorId: string, projectId: string) {
    try {
      await fetch(`/api/web-operators/${operatorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId }),
      })
      await loadOperators()
    } catch {
      // non-fatal
    }
  }

  async function handleStopSession(operatorId: string) {
    try {
      await fetch(`/api/web-operators/${operatorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'idle' }),
      })
      await loadOperators()
    } catch {
      // non-fatal
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    setCreateError('')
    try {
      const res = await fetch('/api/web-operators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), role: newRole.trim() || 'Web Operator' }),
      })
      if (!res.ok) {
        const data = await res.json()
        setCreateError(data.error ?? 'Failed to create operator')
        return
      }
      setNewName('')
      setNewRole('Web Operator')
      await loadOperators()
    } catch (err) {
      setCreateError(String(err))
    } finally {
      setCreating(false)
    }
  }

  const CARD: React.CSSProperties = {
    background: '#ffffff',
    border: '1px solid #f1f5f9',
    borderRadius: 10,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    padding: '18px 20px',
    marginBottom: 16,
  }

  const INPUT: React.CSSProperties = {
    background: '#fafafa', border: '1px solid #e2e8f0', borderRadius: 6,
    padding: '8px 10px', fontSize: 12, color: '#0f172a',
    width: '100%', boxSizing: 'border-box',
  }

  const LABEL: React.CSSProperties = {
    fontSize: 10, fontWeight: 600, color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4,
  }

  return (
    <div style={{ padding: '40px 32px', maxWidth: 960 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', margin: '0 0 4px' }}>
          Web Operators
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
          Named browser agents working in parallel. Each operator has an isolated browser context — separate cookies, sessions, and storage state.
        </p>
      </div>

      {/* Operator grid */}
      {loading ? (
        <div style={{ color: '#94a3b8', fontSize: 13 }}>Loading…</div>
      ) : operators.length === 0 ? (
        <div style={{ ...CARD, color: '#94a3b8', fontSize: 13, fontStyle: 'italic' }}>
          No operators yet. Create one below.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
          {operators.map(op => {
            const notice = operatorNotice(op)
            return (
            <div key={op.id} style={{
              background: '#ffffff',
              border: '1px solid #f1f5f9',
              borderRadius: 10,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              padding: '18px 20px',
            }}>
              {/* Name + status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 3 }}>{op.name}</div>
                  <StatusDot status={op.status} />
                </div>
                {op.latest_screenshot && (
                  <img
                    src={op.latest_screenshot}
                    alt="Latest screenshot"
                    style={{ width: 80, height: 50, objectFit: 'cover', borderRadius: 5, border: '1px solid #e2e8f0', flexShrink: 0, marginLeft: 10 }}
                  />
                )}
              </div>

              {/* Role badge */}
              <div style={{
                display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                fontSize: 10, fontWeight: 600, background: '#f1f5f9', color: '#64748b',
                marginBottom: 10,
              }}>
                {op.role}
              </div>

              {/* Project */}
              {op.project_name && (
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>
                  Project: <span style={{ color: '#0f172a', fontWeight: 500 }}>{op.project_name}</span>
                </div>
              )}

              {/* Attention state */}
              {notice && (
                <div style={{
                  display: 'block',
                  background: '#fffbeb', border: '1px solid #fde68a',
                  borderRadius: 6, padding: '8px 10px', marginBottom: 8,
                }}>
                  <div style={{ fontSize: 12, color: '#92400e', fontWeight: 700 }}>{notice.title}</div>
                  <div style={{ fontSize: 11, color: '#78350f', marginTop: 2 }}>
                    {notice.text}
                  </div>
                </div>
              )}

              {/* Current URL */}
              {op.current_url && (
                <div style={{ fontSize: 10, color: '#6366f1', fontFamily: 'DM Mono, monospace', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {truncate(op.current_url, 50)}
                </div>
              )}

              {/* Last updated */}
              <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 12 }}>
                Updated {timeAgo(op.updated_at)}
              </div>

              <details style={{ marginBottom: 12 }}>
                <summary style={{ cursor: 'pointer', color: '#94a3b8', fontSize: 11, fontWeight: 700 }}>Advanced</summary>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 8, display: 'grid', gap: 5 }}>
                  {op.current_workflow ? <div>Workflow: {op.current_workflow}</div> : null}
                  {op.current_goal ? <div>Goal: {truncate(op.current_goal, 100)}</div> : null}
                  {op.current_task ? <div>Task: {truncate(op.current_task, 100)}</div> : null}
                  {op.memory_summary ? <div>{truncate(op.memory_summary, 120)}</div> : null}
                </div>
                <div style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'DM Mono, monospace', marginTop: 8 }}>
                  profile: {op.browser_profile_key}
                  {op.waiting_reason ? <div>reason: {op.waiting_reason}</div> : null}
                </div>
              </details>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Assign to project */}
                <select
                  defaultValue=""
                  onChange={e => { if (e.target.value) handleAssignProject(op.id, e.target.value) }}
                  style={{
                    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 5,
                    padding: '5px 8px', fontSize: 11, color: '#374151', cursor: 'pointer',
                  }}
                >
                  <option value="" disabled>Assign project…</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>

                {/* Stop session */}
                {op.status === 'working' && (
                  <button
                    onClick={() => handleStopSession(op.id)}
                    style={{
                      background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
                      borderRadius: 5, padding: '5px 12px', fontSize: 11,
                      fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Stop session
                  </button>
                )}

                {/* View detail */}
                <Link
                  href={`/operators/${op.id}`}
                  style={{ fontSize: 11, color: '#0f172a', textDecoration: 'none', fontWeight: 600 }}
                >
                  View →
                </Link>

                {/* View actions */}
                <Link
                  href={`/operator?operator_id=${op.id}`}
                  style={{ fontSize: 11, color: '#6366f1', textDecoration: 'none', fontWeight: 500 }}
                >
                  Actions →
                </Link>
              </div>
            </div>
          )})}
        </div>
      )}

      {/* Create new operator */}
      <div style={CARD}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 14 }}>
          Create new operator
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div>
            <div style={LABEL}>Name</div>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              style={INPUT}
              placeholder="e.g. Kevin"
              onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
            />
          </div>
          <div>
            <div style={LABEL}>Role</div>
            <input
              value={newRole}
              onChange={e => setNewRole(e.target.value)}
              style={INPUT}
              placeholder="Web Operator"
            />
          </div>
        </div>
        {createError && (
          <div style={{ fontSize: 11, color: '#dc2626', marginBottom: 8 }}>{createError}</div>
        )}
        <button
          onClick={handleCreate}
          disabled={creating || !newName.trim()}
          style={{
            background: creating || !newName.trim() ? '#e2e8f0' : '#0f172a',
            color: creating || !newName.trim() ? '#94a3b8' : '#ffffff',
            border: 'none', borderRadius: 7, padding: '9px 20px',
            fontSize: 12, fontWeight: 600, cursor: creating ? 'not-allowed' : 'pointer',
          }}
        >
          {creating ? 'Creating…' : 'Create operator'}
        </button>
      </div>

      {/* Info note */}
      <div style={{
        padding: '12px 16px', background: '#f8fafc', borderRadius: 8,
        fontSize: 12, color: '#64748b', lineHeight: 1.6,
      }}>
        Name an operator in CEO Chat to route tasks to them:
        <br />
        &ldquo;Kevin, open Gmail.&rdquo; · &ldquo;Hana, research parking management companies.&rdquo; · &ldquo;Ask Kevin to search for leads.&rdquo;
        <br />
        Each operator&apos;s browser profile is isolated — cookies and login sessions never mix.
      </div>
    </div>
  )
}
