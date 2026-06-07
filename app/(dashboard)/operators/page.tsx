'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { WebOperator } from '@/lib/web-operator/operators'
import { AdvancedDisclosure } from '@/components/ui/AdvancedDisclosure'
import { EmptyState } from '@/components/ui/EmptyState'
import { MinimalCard } from '@/components/ui/MinimalCard'
import { PageShell } from '@/components/ui/PageShell'
import { PrimaryAction } from '@/components/ui/PrimaryAction'
import { StatusPill } from '@/components/ui/StatusPill'

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
  const label = STATUS_LABEL[status] ?? status.replace(/_/g, ' ')
  const tone =
    status === 'working' ? 'blue' :
    status === 'waiting_approval' || status === 'waiting_user' || status === 'user_controlling' ? 'amber' :
    status === 'ready_to_resume' ? 'green' :
    status === 'error' ? 'red' : 'gray'
  return (
    <StatusPill tone={tone}>{label}</StatusPill>
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
    return { title: 'Approval needed', text: 'Kevin needs approval before doing this.' }
  }
  if (op.waiting_reason === 'profile_locked') {
    return {
      title: 'Chrome profile is already open',
      text: 'Close Chrome or use a dedicated AÏKO Chrome profile.',
    }
  }
  if (op.status === 'waiting_user' || op.status === 'ready_to_resume' || op.requires_user_input) {
    const isLogin = op.waiting_reason === 'login_required'
    const isCaptcha = op.waiting_reason === 'captcha_detected'
    const isSecurity = op.waiting_reason === 'security_checkpoint'
    const text =
      isLogin ? 'Kevin needs your help. Log in to Chrome, then click Resume.' :
      isCaptcha ? 'Kevin needs your help. Complete the CAPTCHA in Chrome, then click Resume.' :
      isSecurity ? 'Kevin needs your help. Complete the security check in Chrome, then click Resume.' :
      'Kevin needs your help in Chrome. Complete this, then click Resume.'
    return { title: 'Kevin needs your help', text }
  }
  return null
}

function browserStatusLabel(mode: string): string {
  if (mode === 'system_chrome') return 'Normal Chrome'
  if (mode === 'persistent') return 'AÏKO profile'
  if (mode === 'isolated') return 'Isolated'
  return 'Unknown'
}

export default function OperatorsPage() {
  const [operators, setOperators] = useState<WebOperator[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [browserMode, setBrowserMode] = useState<string>('persistent')

  // Create form
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('Web Operator')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const loadOperators = useCallback(async () => {
    try {
      const [opRes, browserRes] = await Promise.all([
        fetch('/api/web-operators'),
        fetch('/api/browser/setup').catch(() => null),
      ])
      if (opRes.ok) {
        const data = await opRes.json()
        setOperators(data.operators ?? [])
      }
      if (browserRes?.ok) {
        const b = await browserRes.json()
        setBrowserMode(b.mode ?? 'persistent')
      }
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
    border: '1px solid #e5e7eb',
    borderRadius: 20,
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
    <PageShell
      title="Operators"
      subtitle={`Supervised browser work. Browser: ${browserMode === 'system_chrome' ? 'Normal Chrome' : browserMode === 'persistent' ? 'AÏKO profile' : 'Isolated'}`}
      maxWidth={960}
    >

      {/* Operator grid */}
      {loading ? (
        <div style={{ color: '#94a3b8', fontSize: 13 }}>Loading…</div>
      ) : operators.length === 0 ? (
        <MinimalCard><EmptyState title="No operators yet." description="Create or use the default operator." /></MinimalCard>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
          {operators.map(op => {
            const notice = operatorNotice(op)
            return (
            <div key={op.id} style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: 20,
              padding: 20,
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

              <p style={{ minHeight: 40, margin: '0 0 14px', color: '#4b5563', fontSize: 13, lineHeight: 1.55 }}>
                {notice?.text ?? op.current_task ?? op.current_goal ?? (op.status === 'idle' ? 'Kevin is idle.' : 'Working.')}
              </p>

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

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginTop: 14 }}>
                <PrimaryAction href={`/operators/${op.id}`}>Open</PrimaryAction>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>
                  Browser: {browserStatusLabel(browserMode)} · {op.project_name ?? 'No project'}
                </span>
              </div>

              <AdvancedDisclosure>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 8, display: 'grid', gap: 5 }}>
                  <div>Role: {op.role}</div>
                  {op.current_url ? <div style={{ wordBreak: 'break-all' }}>Website: {truncate(op.current_url, 90)}</div> : null}
                  {op.current_workflow ? <div>Workflow: {op.current_workflow}</div> : null}
                  {op.current_goal ? <div>Goal: {truncate(op.current_goal, 100)}</div> : null}
                  {op.current_task ? <div>Task: {truncate(op.current_task, 100)}</div> : null}
                  {op.memory_summary ? <div>{truncate(op.memory_summary, 120)}</div> : null}
                  <div>Updated {timeAgo(op.updated_at)}</div>
                </div>
                <div style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'DM Mono, monospace', marginTop: 8 }}>
                  profile: {op.browser_profile_key}
                  {op.waiting_reason ? <div>reason: {op.waiting_reason}</div> : null}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
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

                  <Link
                    href={`/operator?operator_id=${op.id}`}
                    style={{ fontSize: 11, color: '#6366f1', textDecoration: 'none', fontWeight: 500 }}
                  >
                    Actions →
                  </Link>
                </div>
              </AdvancedDisclosure>

            </div>
          )})}
        </div>
      )}

      {/* Create new operator */}
      <AdvancedDisclosure title="Create operator">
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
      </AdvancedDisclosure>

      {/* Info note */}
      <div style={{
        padding: '12px 0',
        fontSize: 12, color: '#64748b', lineHeight: 1.6,
      }}>
        AÏKO never sends, posts, publishes, or bypasses login/CAPTCHA without you.
      </div>
    </PageShell>
  )
}
