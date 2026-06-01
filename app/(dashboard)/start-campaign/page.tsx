'use client'
import React, { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Project       { id: string; name: string; status: string; created_at: string }
interface Operator      { id: string; name: string; role: string; status: string; browser_profile_key: string | null; project_id: string | null }
interface ApprovedLead  { id: string; company_name: string | null; contact_name: string | null; email: string | null; status: string }
interface ContactedLead extends ApprovedLead {
  last_checked_at: string | null
  last_reply_at:   string | null
  reply_summary:   string | null
}
interface ApprovalRow  { id: string; title: string; created_at: string; action_type: string; description: string }
interface ResumeRow    { id: string; action_type: string; description: string; project_id: string | null; operator_id: string | null; approval_item_id: string }
interface TrailRow     { action_id: string; action_type: string; description: string; status: string; created_at: string; completed_at: string | null; lead_id: string | null; failure_reason: string | null }

interface ChecklistItem { key: string; label: string; completed: boolean; note?: string }
interface LaunchTemplate {
  id: string; project_id: string; status: string
  target_audience_hint: string | null; campaign_goal: string | null
  checklist: ChecklistItem[]; checklist_done: number
  start_campaign_url: string
}

interface StrategyBrief {
  id: string; project_id: string
  title: string; objective: string; target_audience: string
  research_prompt: string; recommended_channel: string; value_proposition: string
  risks: string[]; assumptions: string[]; next_actions: string[]
  recommended_operator_id:   string | null
  recommended_operator_name: string | null
  operator_reason:           string | null
}

interface Summary {
  projects:          Project[]
  operators:         Operator[]
  lead_counts:       Record<string, number>
  approved_leads:    ApprovedLead[]
  contacted_leads:   ContactedLead[]
  pending_approvals: ApprovalRow[]
  resume_candidates: ResumeRow[]
  recent_trail:      TrailRow[]
  launch_template:   LaunchTemplate | null
  strategy_brief:    StrategyBrief | null
}

// ok | error | loading state for each action
type ActionState = { status: 'idle' | 'loading' | 'ok' | 'error'; message: string }
const idle: ActionState = { status: 'idle', message: '' }

// ── Style constants ────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  padding: '20px 24px',
  marginBottom: 12,
}

// Highlight a card with a left accent when it needs attention
const CARD_ATTENTION: React.CSSProperties = {
  ...CARD,
  borderLeft: '3px solid #f59e0b',
}

const CARD_DONE: React.CSSProperties = {
  ...CARD,
  borderLeft: '3px solid #10b981',
}

function cardStyle(done: boolean, needsAttention: boolean): React.CSSProperties {
  if (done) return CARD_DONE
  if (needsAttention) return CARD_ATTENTION
  return CARD
}

function btnStyle(
  variant: 'primary' | 'secondary' | 'danger',
  disabled = false
): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    border: '1px solid',
    opacity: disabled ? 0.45 : 1,
    transition: 'opacity 0.1s',
    userSelect: 'none',
  }
  if (variant === 'primary')    return { ...base, background: '#6366f1', color: '#ffffff', borderColor: '#6366f1' }
  if (variant === 'danger')     return { ...base, background: '#fef2f2', color: '#dc2626', borderColor: '#fecaca' }
  return { ...base, background: '#f8fafc', color: '#0f172a', borderColor: '#e2e8f0' }
}

const LINK_STYLE: React.CSSProperties = {
  fontSize: 11, color: '#6366f1', textDecoration: 'none',
}

const INPUT_STYLE: React.CSSProperties = {
  border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px',
  fontSize: 12, color: '#0f172a', background: '#fafafa',
}

const PILL = (color: string, bg: string, border: string): React.CSSProperties => ({
  display: 'inline-block', borderRadius: 20, padding: '1px 8px',
  fontSize: 10, fontWeight: 700,
  color, background: bg, border: `1px solid ${border}`,
})

function ResultMsg({ state }: { state: ActionState }) {
  if (state.status === 'idle') return null
  const color =
    state.status === 'loading' ? '#64748b' :
    state.status === 'ok'      ? '#15803d' : '#dc2626'
  const icon =
    state.status === 'loading' ? '…' :
    state.status === 'ok'      ? '✓' : '✗'
  return (
    <div style={{ fontSize: 11, color, marginTop: 6, fontStyle: 'italic' }}>
      {icon} {state.message}
    </div>
  )
}

const STATUS_DOT: Record<string, string> = {
  idle:    '#10b981',
  running: '#f59e0b',
  error:   '#ef4444',
  paused:  '#94a3b8',
  offline: '#cbd5e1',
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)    return `${Math.round(diff)}s ago`
  if (diff < 3600)  return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  return `${Math.round(diff / 86400)}d ago`
}

function StepNum({ n, done }: { n: number; done: boolean }) {
  return (
    <div style={{
      width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
      background: done ? '#6366f1' : '#f1f5f9',
      color:      done ? '#ffffff'  : '#94a3b8',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 700,
    }}>
      {done ? '✓' : n}
    </div>
  )
}

function StepHeader({
  n, title, done, badge, detail,
}: {
  n: number; title: string; done: boolean; badge?: string; detail?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <StepNum n={n} done={done} />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{title}</span>
          {done && (
            <span style={PILL('#166534', '#f0fdf4', '#bbf7d0')}>Done</span>
          )}
          {badge && !done && (
            <span style={PILL('#92400e', '#fffbeb', '#fde68a')}>{badge}</span>
          )}
        </div>
        {detail && (
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{detail}</div>
        )}
      </div>
    </div>
  )
}

function SafetyNote({ text }: { text: string }) {
  return (
    <div style={{
      fontSize: 10, color: '#94a3b8', marginTop: 10,
      paddingTop: 8, borderTop: '1px solid #f8fafc',
    }}>
      🔒 {text}
    </div>
  )
}

function EmptyState({ icon, text, action }: { icon: string; text: string; action?: React.ReactNode }) {
  return (
    <div style={{
      padding: '14px 16px', background: '#f8fafc', borderRadius: 8,
      fontSize: 12, color: '#64748b', marginBottom: 8,
    }}>
      <span style={{ marginRight: 6 }}>{icon}</span>{text}
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  )
}

function Hint({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic', marginBottom: 10 }}>
      {text}
    </div>
  )
}

// ── Launch Template Checklist Card ────────────────────────────────────────────

function LaunchTemplateCard({
  template,
  projectId,
}: {
  template: LaunchTemplate
  projectId: string
}) {
  const done  = template.checklist_done
  const total = template.checklist.length
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0

  const statusColor: Record<string, string> = {
    draft:       '#94a3b8',
    ready:       '#3b82f6',
    in_progress: '#f59e0b',
    completed:   '#10b981',
    archived:    '#cbd5e1',
  }

  return (
    <div style={{
      background: '#fafbff',
      border: '1px solid #c7d2fe',
      borderRadius: 10,
      padding: '16px 20px',
      marginBottom: 16,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#3730a3' }}>
          🗂 First Campaign Launch Plan
        </span>
        <span style={{
          fontSize: 10, fontWeight: 700, borderRadius: 20,
          padding: '1px 8px', background: '#ede9fe', color: '#5b21b6',
          border: '1px solid #c4b5fd',
        }}>
          {done}/{total} steps complete
        </span>
        <span style={{
          fontSize: 10, fontWeight: 700, borderRadius: 20,
          padding: '1px 8px',
          background: '#f1f5f9',
          color: statusColor[template.status] ?? '#94a3b8',
          border: `1px solid ${statusColor[template.status] ?? '#e2e8f0'}`,
          textTransform: 'capitalize',
        }}>
          {template.status.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: '#e0e7ff', borderRadius: 2, marginBottom: 12, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: pct === 100 ? '#10b981' : '#6366f1',
          borderRadius: 2,
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Checklist */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {template.checklist.map(item => (
          <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span style={{
              width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
              background: item.completed ? '#6366f1' : '#f1f5f9',
              color:      item.completed ? '#ffffff'  : '#cbd5e1',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 700,
            }}>
              {item.completed ? '✓' : ''}
            </span>
            <span style={{
              color:           item.completed ? '#166534' : '#0f172a',
              textDecoration:  item.completed ? 'line-through' : 'none',
              opacity:         item.completed ? 0.7 : 1,
            }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* Context hints */}
      {(template.target_audience_hint || template.campaign_goal) && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #e0e7ff', fontSize: 11, color: '#6366f1' }}>
          {template.campaign_goal && <div>Goal: {template.campaign_goal}</div>}
          {template.target_audience_hint && <div>Audience: {template.target_audience_hint}</div>}
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 10, color: '#94a3b8' }}>
        This checklist is guidance only — it does not trigger any actions.{' '}
        <Link href={`/projects/${projectId}`} style={{ color: '#6366f1', textDecoration: 'none' }}>
          View project →
        </Link>
      </div>
    </div>
  )
}

// ── Strategy Brief Card ───────────────────────────────────────────────────────

function StrategyBriefCard({
  brief,
  onUseResearchPrompt,
  onUseOperator,
}: {
  brief: StrategyBrief
  onUseResearchPrompt: (prompt: string) => void
  onUseOperator: (operatorId: string) => void
}) {
  const [expanded, setExpanded] = React.useState(false)

  const hasOperator     = !!brief.recommended_operator_id
  const operatorName    = brief.recommended_operator_name
  const operatorReason  = brief.operator_reason

  return (
    <div style={{
      background: '#f0fdf4',
      border: '1px solid #86efac',
      borderRadius: 10,
      padding: '16px 20px',
      marginBottom: 16,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#14532d', flex: 1 }}>
          📋 {brief.title || 'First Campaign Strategy Brief'}
        </span>
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 11, color: '#16a34a', fontWeight: 600, padding: 0,
          }}
        >
          {expanded ? 'Collapse ▲' : 'Expand ▼'}
        </button>
      </div>

      {/* Compact summary (always visible) */}
      {brief.objective && (
        <div style={{ fontSize: 11, color: '#166534', marginBottom: 8, fontStyle: 'italic' }}>
          {brief.objective}
        </div>
      )}

      {/* Operator recommendation (always visible) */}
      <div style={{
        background: hasOperator ? '#dcfce7' : '#fef9c3',
        border: `1px solid ${hasOperator ? '#86efac' : '#fde047'}`,
        borderRadius: 8, padding: '10px 12px', marginBottom: expanded ? 10 : 0,
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', marginBottom: 2,
            color: hasOperator ? '#15803d' : '#854d0e' }}>
            Recommended Operator
          </div>
          {hasOperator ? (
            <div style={{ fontSize: 12, color: '#0f172a', fontWeight: 600 }}>
              {operatorName}
              {operatorReason && (
                <span style={{ fontWeight: 400, color: '#374151', marginLeft: 6 }}>
                  — {operatorReason}
                </span>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#92400e' }}>
              No operator available yet.{' '}
              <Link href="/operators" style={{ color: '#6366f1', fontWeight: 600 }}>
                Create operator →
              </Link>
            </div>
          )}
        </div>
        {hasOperator && brief.recommended_operator_id && (
          <button
            onClick={() => onUseOperator(brief.recommended_operator_id!)}
            style={btnStyle('primary')}
            title="Selects this operator in Step 2. Does not run any browser action."
          >
            Use this operator
          </button>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {brief.target_audience && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#15803d', textTransform: 'uppercase', marginBottom: 2 }}>Target Audience</div>
              <div style={{ fontSize: 12, color: '#0f172a' }}>{brief.target_audience}</div>
            </div>
          )}
          {brief.value_proposition && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#15803d', textTransform: 'uppercase', marginBottom: 2 }}>Value Proposition</div>
              <div style={{ fontSize: 12, color: '#0f172a' }}>{brief.value_proposition}</div>
            </div>
          )}
          {brief.recommended_channel && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#15803d', textTransform: 'uppercase', marginBottom: 2 }}>Recommended Channel</div>
              <div style={{ fontSize: 12, color: '#0f172a', textTransform: 'capitalize' }}>{brief.recommended_channel}</div>
            </div>
          )}
          {brief.research_prompt && (
            <div style={{
              background: '#dcfce7', border: '1px solid #86efac', borderRadius: 6, padding: '10px 12px',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#15803d', textTransform: 'uppercase', marginBottom: 4 }}>
                Suggested Research Prompt
              </div>
              <div style={{ fontSize: 12, color: '#0f172a', marginBottom: 8 }}>{brief.research_prompt}</div>
              <button
                onClick={() => onUseResearchPrompt(brief.research_prompt)}
                style={btnStyle('secondary')}
              >
                ↓ Use in Step 3
              </button>
            </div>
          )}
          {brief.risks.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#15803d', textTransform: 'uppercase', marginBottom: 2 }}>Risks &amp; Assumptions</div>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: '#374151' }}>
                {brief.risks.map((r, i) => <li key={i}>{r}</li>)}
                {brief.assumptions.map((a, i) => <li key={`a${i}`} style={{ color: '#6b7280' }}>{a}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 10, color: '#15803d' }}>
        🔒 This brief is guidance only — it does not research, contact, send, or approve anything.
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

// ── Root export (Suspense boundary required for useSearchParams) ───────────────

export default function StartCampaignPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: '48px 40px', color: '#94a3b8', fontSize: 14 }}>
        Loading campaign flow…
      </div>
    }>
      <StartCampaignInner />
    </Suspense>
  )
}

function StartCampaignInner() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const urlProjectId = searchParams.get('project_id') ?? ''

  const [summary, setSummary]       = useState<Summary | null>(null)
  const [loadError, setLoadError]   = useState(false)
  const [loading, setLoading]       = useState(true)

  // Pre-select project from URL query param (?project_id=...)
  const [selectedProject,  setSelectedProject]  = useState(urlProjectId)
  const [selectedOperator, setSelectedOperator] = useState('')

  const [newProjectName, setNewProjectName]     = useState('')
  const [createState, setCreateState]           = useState<ActionState>(idle)

  const [researchQuery, setResearchQuery]       = useState('')
  const [researchState, setResearchState]       = useState<ActionState>(idle)

  // Per-lead action states keyed by lead id
  const [draftStates,  setDraftStates]  = useState<Record<string, ActionState>>({})
  const [replyStates,  setReplyStates]  = useState<Record<string, ActionState>>({})
  // Per-action resume states keyed by action id
  const [resumeStates, setResumeStates] = useState<Record<string, ActionState>>({})

  // Track whether any draft was prepared this session (for step 5 "done")
  const [anyDraftDone, setAnyDraftDone] = useState(false)

  // Sync project selection to URL so refresh preserves it
  const selectProject = useCallback((id: string) => {
    setSelectedProject(id)
    const next = new URLSearchParams(searchParams.toString())
    if (id) { next.set('project_id', id) } else { next.delete('project_id') }
    router.replace(`/start-campaign?${next.toString()}`, { scroll: false })
  }, [router, searchParams])

  const fetchSummary = useCallback(async (projectId?: string) => {
    const qs = projectId ? `?project_id=${projectId}` : ''
    try {
      const res = await fetch(`/api/start-campaign/summary${qs}`)
      if (res.ok) {
        const data = await res.json() as Summary
        setSummary(data)
        setLoadError(false)
      } else {
        setLoadError(true)
      }
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSummary(selectedProject || undefined)
  }, [fetchSummary, selectedProject])

  // Pre-fill research query from strategy brief when a project is first selected
  // Only fills if the user hasn't already typed something
  useEffect(() => {
    const brief = summary?.strategy_brief
    if (brief?.research_prompt && !researchQuery) {
      setResearchQuery(brief.research_prompt)
    }
  // We deliberately only react to brief changes, not researchQuery (user edits)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary?.strategy_brief?.research_prompt])

  // ── Derived state ─────────────────────────────────────────────────────────────

  const lc              = summary?.lead_counts ?? {}
  const totalLeads      = Object.values(lc).reduce((a, b) => a + b, 0)
  const discoveredLeads = (lc.discovered ?? 0) + (lc.needs_review ?? 0)
  const approvedCount   = lc.approved ?? 0
  const contactedCount  = (lc.contacted ?? 0) + (lc.replied ?? 0) + (lc.interested ?? 0)

  const hasProject   = !!selectedProject
  const hasOperator  = !!selectedOperator
  const hasLeads     = totalLeads > 0
  const hasApproved  = approvedCount > 0
  const hasPending   = (summary?.pending_approvals?.length ?? 0) > 0
  const hasResumable = (summary?.resume_candidates?.length ?? 0) > 0
  const hasContacted = (summary?.contacted_leads?.length ?? 0) > 0
  const hasTrail     = (summary?.recent_trail?.length ?? 0) > 0

  // "done" semantics that aren't misleading on a cold start:
  // Steps 6 & 7 are "clear" (nothing to do) — we show a neutral state, not "Done"
  const step5Done = anyDraftDone || contactedCount > 0
  const hasAnySummaryReply = summary?.contacted_leads.some(l => l.reply_summary) ?? false

  // ── Handlers ──────────────────────────────────────────────────────────────────

  async function handleCreateProject() {
    if (!newProjectName.trim()) return
    setCreateState({ status: 'loading', message: 'Creating project…' })
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName.trim(), description: '' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCreateState({ status: 'error', message: data.error ?? 'Failed to create project.' })
        return
      }
      const id = data.project?.id ?? data.id
      if (id) {
        selectProject(id)
        setNewProjectName('')
        setCreateState({ status: 'ok', message: `Project "${newProjectName.trim()}" created.` })
        await fetchSummary(id)
      } else {
        setCreateState({ status: 'error', message: 'Project created but no id returned.' })
      }
    } catch {
      setCreateState({ status: 'error', message: 'Network error. Check console.' })
    }
  }

  async function handleResearch() {
    if (!researchQuery.trim()) return
    setResearchState({ status: 'loading', message: 'Delegating to Web Operator…' })
    try {
      const res = await fetch('/api/ceo/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command:    researchQuery.trim(),
          project_id: selectedProject || undefined,
          operator:   selectedOperator
            ? (summary?.operators.find(o => o.id === selectedOperator)?.name ?? undefined)
            : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setResearchState({ status: 'error', message: data.error ?? 'Research request failed.' })
        return
      }
      const msg = data.message ?? data.delegation?.message ?? 'Research delegated to Web Operator.'
      setResearchState({ status: 'ok', message: msg })
      await fetchSummary(selectedProject || undefined)
    } catch {
      setResearchState({ status: 'error', message: 'Network error — check console.' })
    }
  }

  async function handleDraft(leadId: string) {
    setDraftStates(p => ({ ...p, [leadId]: { status: 'loading', message: 'Asking Web Operator to open Gmail…' } }))
    try {
      const res = await fetch(`/api/leads/${leadId}/outreach-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id:    selectedProject || undefined,
          operator_name: selectedOperator
            ? (summary?.operators.find(o => o.id === selectedOperator)?.name ?? undefined)
            : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setDraftStates(p => ({ ...p, [leadId]: { status: 'error', message: data.error ?? 'Failed to prepare draft.' } }))
        return
      }
      const msg = data.message ?? (data.ok ? 'Draft delegated to Web Operator.' : data.error ?? 'Draft initiated.')
      setDraftStates(p => ({ ...p, [leadId]: { status: 'ok', message: msg } }))
      setAnyDraftDone(true)
      await fetchSummary(selectedProject || undefined)
    } catch {
      setDraftStates(p => ({ ...p, [leadId]: { status: 'error', message: 'Network error.' } }))
    }
  }

  async function handleResume(actionId: string) {
    setResumeStates(p => ({ ...p, [actionId]: { status: 'loading', message: 'Executing approved action…' } }))
    try {
      const res = await fetch(`/api/web-operator/actions/${actionId}/resume`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok && !data.ok) {
        setResumeStates(p => ({ ...p, [actionId]: { status: 'error', message: data.error ?? 'Resume failed.' } }))
        return
      }
      const msg = data.message ?? (data.ok ? 'Action executed.' : data.error ?? 'Done.')
      setResumeStates(p => ({ ...p, [actionId]: { status: 'ok', message: msg } }))
      await fetchSummary(selectedProject || undefined)
    } catch {
      setResumeStates(p => ({ ...p, [actionId]: { status: 'error', message: 'Network error.' } }))
    }
  }

  async function handleCheckReply(leadId: string) {
    setReplyStates(p => ({ ...p, [leadId]: { status: 'loading', message: 'Web Operator opening Gmail to check…' } }))
    try {
      const res = await fetch(`/api/leads/${leadId}/check-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: selectedProject || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setReplyStates(p => ({ ...p, [leadId]: { status: 'error', message: data.error ?? 'Reply check failed.' } }))
        return
      }
      const msg = data.summary ?? (data.has_reply ? '✓ Reply found.' : 'No reply found.')
      setReplyStates(p => ({ ...p, [leadId]: { status: data.has_reply ? 'ok' : 'idle', message: data.has_reply ? msg : '' } }))
      if (!data.has_reply) {
        // Show the "no reply" message briefly via a neutral state
        setReplyStates(p => ({ ...p, [leadId]: { status: 'ok', message: msg } }))
      }
      await fetchSummary(selectedProject || undefined)
    } catch {
      setReplyStates(p => ({ ...p, [leadId]: { status: 'error', message: 'Network error.' } }))
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: '48px 40px', color: '#94a3b8', fontSize: 14 }}>
        Loading campaign flow…
      </div>
    )
  }

  if (loadError || !summary) {
    return (
      <div style={{ padding: '48px 40px', maxWidth: 600 }}>
        <div style={{ fontSize: 14, color: '#dc2626', marginBottom: 8 }}>
          ✗ Could not load campaign summary.
        </div>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
          Make sure the database is connected and the app is running correctly.
        </div>
        <button onClick={() => { setLoading(true); fetchSummary() }} style={btnStyle('secondary')}>
          Retry
        </button>
      </div>
    )
  }

  const selectedProjectObj  = summary.projects.find(p => p.id === selectedProject) ?? null
  const selectedProjectName = selectedProjectObj?.name ?? null
  // If URL had a project_id that doesn't exist in the loaded list, show a warning
  const urlProjectInvalid   = !!urlProjectId && !loading && !selectedProjectObj && summary.projects.length >= 0
  const selectedOperatorObj = summary.operators.find(o => o.id === selectedOperator) ?? null
  const researchDisabled    = researching() || !researchQuery.trim()

  function researching() { return researchState.status === 'loading' }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px 80px' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
          First Campaign Flow
        </h1>
        <p style={{ fontSize: 13, color: '#64748b', margin: 0, lineHeight: 1.6 }}>
          A guided walkthrough of the complete AÏKO marketing loop — from research to reply.
          Each step uses the existing system. <strong>Nothing is sent or executed automatically.</strong>
        </p>
      </div>

      {/* Progress strip */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 24, flexWrap: 'wrap',
      }}>
        {[
          { n: 1, label: 'Project',  done: hasProject },
          { n: 2, label: 'Operator', done: hasOperator },
          { n: 3, label: 'Research', done: hasLeads },
          { n: 4, label: 'Review',   done: hasApproved },
          { n: 5, label: 'Draft',    done: step5Done },
          { n: 6, label: 'Approve',  done: false },
          { n: 7, label: 'Resume',   done: false },
          { n: 8, label: 'Reply',    done: hasAnySummaryReply },
          { n: 9, label: 'Trail',    done: hasTrail },
        ].map(s => (
          <div key={s.n} style={{
            display: 'flex', alignItems: 'center', gap: 4, fontSize: 10,
            color: s.done ? '#166534' : '#94a3b8', fontWeight: s.done ? 600 : 400,
          }}>
            <div style={{
              width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
              background: s.done ? '#6366f1' : '#f1f5f9',
              color:      s.done ? '#ffffff'  : '#94a3b8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 700,
            }}>
              {s.done ? '✓' : s.n}
            </div>
            {s.label}
            {s.n < 9 && <span style={{ color: '#e2e8f0', marginLeft: 2 }}>›</span>}
          </div>
        ))}
      </div>

      {/* ── Invalid project_id warning ── */}
      {urlProjectInvalid && (
        <div style={{
          background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 8,
          padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#92400e',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>⚠️</span>
          <span>
            The project in this URL was not found (it may have been deleted or you may not have access).
            Please select a project below.
          </span>
        </div>
      )}

      {/* ── Strategy brief (shown when project selected + brief exists) ── */}
      {summary.strategy_brief && selectedProject && (
        <StrategyBriefCard
          brief={summary.strategy_brief}
          onUseResearchPrompt={setResearchQuery}
          onUseOperator={setSelectedOperator}
        />
      )}

      {/* ── Launch template checklist (shown when project selected + template exists) ── */}
      {summary.launch_template && selectedProject && (
        <LaunchTemplateCard template={summary.launch_template} projectId={selectedProject} />
      )}

      {/* ── Step 1: Project ── */}
      <div style={cardStyle(hasProject, false)}>
        <StepHeader
          n={1} title="Choose or create a project"
          done={hasProject}
          detail={selectedProjectName ? `Active: ${selectedProjectName}` : 'Projects scope leads, operators, and campaigns.'}
        />

        {summary.projects.length === 0 ? (
          <EmptyState
            icon="📁"
            text="No projects yet. Create one below to get started."
            action={<Link href="/projects" style={LINK_STYLE}>Or go to Projects →</Link>}
          />
        ) : (
          <div style={{ marginBottom: 12 }}>
            <select
              value={selectedProject}
              onChange={e => selectProject(e.target.value)}
              style={{ ...INPUT_STYLE, marginRight: 8, minWidth: 200 }}
            >
              <option value="">— select a project —</option>
              {summary.projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <Link href="/projects" style={LINK_STYLE}>Manage →</Link>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            placeholder="New project name…"
            value={newProjectName}
            onChange={e => setNewProjectName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateProject()}
            style={{ ...INPUT_STYLE, width: 200 }}
          />
          <button
            onClick={handleCreateProject}
            disabled={createState.status === 'loading' || !newProjectName.trim()}
            style={btnStyle('secondary', createState.status === 'loading' || !newProjectName.trim())}
          >
            {createState.status === 'loading' ? '…' : '+ Create project'}
          </button>
        </div>
        <ResultMsg state={createState} />
      </div>

      {/* ── Step 2: Operator ── */}
      <div style={cardStyle(hasOperator, !hasOperator && summary.operators.length > 0)}>
        <StepHeader
          n={2} title="Choose a Web Operator"
          done={hasOperator}
          detail={
            selectedOperatorObj
              ? `${selectedOperatorObj.name} · ${selectedOperatorObj.status}`
              : 'All external work happens through Web Operator — research, Gmail drafts, and reply checks.'
          }
        />

        {summary.operators.length === 0 ? (
          <EmptyState
            icon="🤖"
            text="No operators yet. Create a named Web Operator to do browser work."
            action={<Link href="/operators" style={LINK_STYLE}>Create an operator →</Link>}
          />
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {summary.operators.map(op => (
              <button
                key={op.id}
                onClick={() => setSelectedOperator(op.id === selectedOperator ? '' : op.id)}
                style={btnStyle(op.id === selectedOperator ? 'primary' : 'secondary')}
              >
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: STATUS_DOT[op.status] ?? '#94a3b8',
                  display: 'inline-block', flexShrink: 0,
                }} />
                {op.name}
                {op.status === 'running' && (
                  <span style={{ fontSize: 9, color: op.id === selectedOperator ? '#c7d2fe' : '#f59e0b' }}>busy</span>
                )}
              </button>
            ))}
            <Link href="/operators" style={{ ...LINK_STYLE, alignSelf: 'center', marginLeft: 4 }}>Manage →</Link>
          </div>
        )}

        <SafetyNote text="All external work happens through Web Operator — no direct API or SMTP calls." />
      </div>

      {/* ── Step 3: Research ── */}
      <div style={cardStyle(hasLeads, false)}>
        <StepHeader
          n={3} title="Research leads"
          done={hasLeads}
          detail={
            hasLeads
              ? `${totalLeads} lead${totalLeads !== 1 ? 's' : ''} in system`
              : 'Ask AÏKO to find prospects. Results are extracted as structured leads.'
          }
        />

        {!hasProject && (
          <Hint text="Tip: selecting a project in Step 1 scopes the research and lead extraction." />
        )}
        {!hasOperator && (
          <Hint text="Tip: selecting an operator in Step 2 directs the browser work to a named agent." />
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 0 }}>
          <input
            placeholder="e.g. Find logistics companies in Barcelona"
            value={researchQuery}
            onChange={e => setResearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !researchDisabled && handleResearch()}
            style={{ ...INPUT_STYLE, width: 300 }}
          />
          <button
            onClick={handleResearch}
            disabled={researchDisabled}
            style={btnStyle('primary', researchDisabled)}
          >
            {researchState.status === 'loading' ? '…' : '🔍 Research'}
          </button>
        </div>
        <ResultMsg state={researchState} />

        {hasLeads && (
          <div style={{ marginTop: 10, fontSize: 11, color: '#64748b', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {Object.entries(lc).map(([status, count]) => (
              <span key={status}>
                <strong style={{ color: '#0f172a' }}>{count}</strong> {status.replace(/_/g, ' ')}
              </span>
            ))}
            <Link href={selectedProject ? `/projects/${selectedProject}` : '/leads'} style={LINK_STYLE}>
              View leads →
            </Link>
          </div>
        )}
      </div>

      {/* ── Step 4: Review leads ── */}
      <div style={cardStyle(hasApproved, discoveredLeads > 0)}>
        <StepHeader
          n={4} title="Review and approve leads"
          done={hasApproved}
          badge={discoveredLeads > 0 ? `${discoveredLeads} awaiting review` : undefined}
          detail={
            hasApproved
              ? `${approvedCount} approved lead${approvedCount !== 1 ? 's' : ''} ready for outreach`
              : 'Approve the leads worth contacting. Rejected leads are excluded from all outreach.'
          }
        />

        {!hasLeads ? (
          <EmptyState icon="🔍" text="No leads yet — complete Step 3 first." />
        ) : discoveredLeads === 0 && !hasApproved ? (
          <EmptyState
            icon="✅"
            text="All discovered leads have been reviewed."
            action={<Link href={selectedProject ? `/projects/${selectedProject}` : '/leads'} style={LINK_STYLE}>Go to leads →</Link>}
          />
        ) : (
          <>
            {discoveredLeads > 0 && (
              <div style={{
                fontSize: 11, color: '#92400e', background: '#fffbeb',
                border: '1px solid #fde68a', borderRadius: 6, padding: '6px 10px', marginBottom: 10,
              }}>
                {discoveredLeads} lead{discoveredLeads !== 1 ? 's' : ''} waiting for your review.
              </div>
            )}
            <Link
              href={selectedProject ? `/projects/${selectedProject}` : '/leads'}
              style={{ ...btnStyle('secondary'), textDecoration: 'none', display: 'inline-flex' }}
            >
              Review leads →
            </Link>
          </>
        )}
      </div>

      {/* ── Step 5: Gmail draft ── */}
      <div style={cardStyle(step5Done, hasApproved && !step5Done)}>
        <StepHeader
          n={5} title="Prepare Gmail draft"
          done={step5Done}
          badge={hasApproved && !step5Done ? `${approvedCount} ready` : undefined}
          detail={
            step5Done
              ? 'Draft prepared via Web Operator. Review and send from Gmail.'
              : hasApproved
                ? 'The Web Operator will open Gmail and prepare a draft. Nothing is sent automatically.'
                : 'Approve leads in Step 4 first.'
          }
        />

        {!hasApproved ? (
          <EmptyState
            icon="✉️"
            text="No approved leads with email addresses yet."
            action={<Link href={selectedProject ? `/projects/${selectedProject}` : '/leads'} style={LINK_STYLE}>Approve leads →</Link>}
          />
        ) : summary.approved_leads.length === 0 ? (
          <EmptyState
            icon="📧"
            text="Approved leads exist but none have email addresses."
            action={<Link href={selectedProject ? `/projects/${selectedProject}` : '/leads'} style={LINK_STYLE}>Add emails to leads →</Link>}
          />
        ) : (
          summary.approved_leads.map(lead => {
            const ds = draftStates[lead.id] ?? idle
            return (
              <div key={lead.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap',
                padding: '10px 0', borderBottom: '1px solid #f8fafc',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>
                    {lead.company_name ?? lead.contact_name ?? 'Unknown lead'}
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>{lead.email}</div>
                  <ResultMsg state={ds} />
                </div>
                <button
                  onClick={() => handleDraft(lead.id)}
                  disabled={ds.status === 'loading'}
                  style={btnStyle('secondary', ds.status === 'loading')}
                >
                  {ds.status === 'loading' ? '…' : '✉ Prepare draft'}
                </button>
              </div>
            )
          })
        )}

        <SafetyNote text="Draft is created in Gmail — not sent. You review and send from Gmail directly. Approval does not send." />
      </div>

      {/* ── Step 6: Approval ── */}
      <div style={cardStyle(false, hasPending)}>
        <StepHeader
          n={6} title="Approve risky actions (if needed)"
          done={false}
          badge={hasPending ? `${summary.pending_approvals.length} pending` : undefined}
          detail={
            hasPending
              ? 'Actions are waiting for your approval before the browser executes them.'
              : 'No pending approvals right now. Actions needing approval will appear here.'
          }
        />

        {!hasPending ? (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#10b981' }}>✓ Nothing waiting</span>
            <Link href="/approvals" style={LINK_STYLE}>Open Approval Center →</Link>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 10 }}>
              {summary.pending_approvals.slice(0, 5).map(item => (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
                  borderBottom: '1px solid #f8fafc', flexWrap: 'wrap',
                }}>
                  <span style={PILL('#92400e', '#fffbeb', '#fde68a')}>PENDING</span>
                  <span style={{ flex: 1, fontSize: 11, color: '#0f172a', fontWeight: 500, minWidth: 0 }}>
                    {item.title || item.description || item.action_type.replace(/_/g, ' ')}
                  </span>
                  <span style={{ fontSize: 10, color: '#94a3b8', flexShrink: 0 }}>{timeAgo(item.created_at)}</span>
                </div>
              ))}
              {summary.pending_approvals.length > 5 && (
                <div style={{ fontSize: 10, color: '#94a3b8', paddingTop: 4 }}>
                  +{summary.pending_approvals.length - 5} more in Approval Center
                </div>
              )}
            </div>
            <Link href="/approvals" style={{ ...btnStyle('primary'), textDecoration: 'none', display: 'inline-flex' }}>
              Go to Approval Center →
            </Link>
          </>
        )}

        <SafetyNote text="Approving an action marks it ready — it does not execute automatically. See Step 7." />
      </div>

      {/* ── Step 7: Resume ── */}
      <div style={cardStyle(false, hasResumable)}>
        <StepHeader
          n={7} title="Resume approved actions"
          done={false}
          badge={hasResumable ? `${summary.resume_candidates.length} ready` : undefined}
          detail={
            hasResumable
              ? 'These actions have been approved. Click Resume to execute each one in the browser.'
              : 'No approved actions waiting. Approve actions in Step 6 first.'
          }
        />

        {!hasResumable ? (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>Nothing to resume yet.</span>
            <Link href="/approvals" style={LINK_STYLE}>Approval Center →</Link>
          </div>
        ) : (
          summary.resume_candidates.map(rc => {
            const rs = resumeStates[rc.id] ?? idle
            return (
              <div key={rc.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap',
                padding: '10px 0', borderBottom: '1px solid #f8fafc',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>
                    {rc.description || rc.action_type.replace(/_/g, ' ')}
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>{rc.action_type.replace(/_/g, ' ')}</div>
                  <ResultMsg state={rs} />
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                  <button
                    onClick={() => handleResume(rc.id)}
                    disabled={rs.status === 'loading'}
                    style={btnStyle('primary', rs.status === 'loading')}
                  >
                    {rs.status === 'loading' ? '…' : '▶ Resume'}
                  </button>
                  {rc.operator_id && (
                    <Link href={`/operators/${rc.operator_id}`} style={LINK_STYLE}>View operator →</Link>
                  )}
                </div>
              </div>
            )
          })
        )}

        <SafetyNote text="Resume is the explicit execution step. Clicking Resume sends the action to the browser runtime." />
      </div>

      {/* ── Step 8: Reply check ── */}
      <div style={cardStyle(hasAnySummaryReply, hasContacted && !hasAnySummaryReply)}>
        <StepHeader
          n={8} title="Check for replies"
          done={hasAnySummaryReply}
          badge={hasContacted && !hasAnySummaryReply ? `${contactedCount} contacted` : undefined}
          detail={
            hasAnySummaryReply
              ? 'Reply data has been recorded. Check again any time.'
              : hasContacted
                ? 'Web Operator will search Gmail for emails from each lead — browser only, no Gmail API.'
                : 'Send outreach in Step 5 first.'
          }
        />

        {!hasContacted ? (
          <EmptyState
            icon="📬"
            text="No contacted leads yet. Complete Steps 5–7 to send outreach first."
          />
        ) : (
          summary.contacted_leads.map(lead => {
            const rs = replyStates[lead.id] ?? idle
            return (
              <div key={lead.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap',
                padding: '10px 0', borderBottom: '1px solid #f8fafc',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>
                    {lead.company_name ?? lead.email}
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span>{lead.email}</span>
                    {lead.last_checked_at && (
                      <span>checked {timeAgo(lead.last_checked_at)}</span>
                    )}
                    {lead.last_reply_at && (
                      <span style={{ color: '#10b981', fontWeight: 600 }}>
                        replied {timeAgo(lead.last_reply_at)}
                      </span>
                    )}
                  </div>
                  {lead.reply_summary && (
                    <div style={{ fontSize: 10, color: '#0369a1', marginTop: 3, fontStyle: 'italic' }}>
                      {lead.reply_summary}
                    </div>
                  )}
                  <ResultMsg state={rs} />
                </div>
                <button
                  onClick={() => handleCheckReply(lead.id)}
                  disabled={rs.status === 'loading'}
                  style={btnStyle('secondary', rs.status === 'loading')}
                >
                  {rs.status === 'loading' ? '…' : '📬 Check reply'}
                </button>
              </div>
            )
          })
        )}

        <SafetyNote text="Browser searches Gmail from:lead@email.com — reads subject and snippet only. No email body is opened. No attachments. No external links." />
      </div>

      {/* ── Step 9: Execution trail ── */}
      <div style={cardStyle(hasTrail, false)}>
        <StepHeader
          n={9} title="View execution trail"
          done={hasTrail}
          detail={
            hasTrail
              ? `${summary.recent_trail.length} recent action${summary.recent_trail.length !== 1 ? 's' : ''}`
              : 'Activity from Steps 3–8 will appear here.'
          }
        />

        {!hasTrail ? (
          <EmptyState
            icon="📋"
            text="No activity yet. Complete earlier steps to see trail events here."
          />
        ) : (
          <div style={{ paddingLeft: 2 }}>
            {summary.recent_trail.map((row, i) => {
              const isOk  = row.status === 'completed'
              const isBad = row.status === 'failed' || row.status === 'blocked'
              const dotColor = isBad ? '#ef4444' : isOk ? '#10b981' : '#f59e0b'
              return (
                <div key={row.action_id} style={{ display: 'flex', gap: 10, paddingBottom: 8 }}>
                  <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 3, background: dotColor }} />
                    {i < summary.recent_trail.length - 1 && (
                      <div style={{ flex: 1, width: 1, background: '#f1f5f9', marginTop: 2 }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 500, color: '#0f172a' }}>
                      {row.description || row.action_type.replace(/_/g, ' ')}
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span>{row.action_type.replace(/_/g, ' ')}</span>
                      <span>{timeAgo(row.completed_at ?? row.created_at)}</span>
                      {isBad && row.failure_reason && (
                        <span style={{ color: '#ef4444' }}>✗ {row.failure_reason}</span>
                      )}
                    </div>
                    {row.lead_id && (
                      <Link href="/leads" style={{ fontSize: 9, color: '#6366f1', textDecoration: 'none' }}>
                        view lead →
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {selectedProject && (
          <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid #f8fafc' }}>
            <Link href={`/projects/${selectedProject}`} style={LINK_STYLE}>
              View full project trail in project workspace →
            </Link>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{
        marginTop: 16, padding: '14px 0',
        borderTop: '1px solid #f1f5f9',
        fontSize: 11, color: '#94a3b8', lineHeight: 1.7,
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        <div>🔒 Nothing is sent or executed automatically — you stay in control at every step.</div>
        <div>🔒 All browser actions go through Web Operator (Playwright). No native API integrations.</div>
        <div>🔒 Approval does not execute. Resume is the explicit execution step.</div>
      </div>

    </div>
  )
}
