'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Project   { id: string; name: string; status: string; created_at: string }
interface Operator  { id: string; name: string; role: string; status: string; browser_profile_key: string | null; project_id: string | null }
interface Lead      { id: string; company_name: string | null; contact_name: string | null; email: string | null; status: string }
interface ContactedLead extends Lead {
  last_checked_at: string | null
  last_reply_at:   string | null
  reply_summary:   string | null
}
interface ApprovalRow { id: string; title: string; created_at: string; action_type: string; description: string }
interface ResumeRow   { id: string; action_type: string; description: string; project_id: string | null; operator_id: string | null; approval_item_id: string }
interface TrailRow    { action_id: string; action_type: string; description: string; status: string; created_at: string; completed_at: string | null; lead_id: string | null; failure_reason: string | null }

interface Summary {
  projects:          Project[]
  operators:         Operator[]
  lead_counts:       Record<string, number>
  approved_leads:    Lead[]
  contacted_leads:   ContactedLead[]
  pending_approvals: ApprovalRow[]
  resume_candidates: ResumeRow[]
  recent_trail:      TrailRow[]
}

// ── Style helpers ──────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  padding: '20px 24px',
  marginBottom: 16,
}

const BADGE = (done: boolean): React.CSSProperties => ({
  display: 'inline-block',
  borderRadius: 20,
  padding: '2px 9px',
  fontSize: 10,
  fontWeight: 700,
  background: done ? '#f0fdf4' : '#f8fafc',
  color:      done ? '#166534' : '#94a3b8',
  border:     done ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
  marginLeft: 8,
  verticalAlign: 'middle',
})

const BTN = (variant: 'primary' | 'secondary' | 'ghost'): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 5,
  borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600,
  cursor: 'pointer', border: '1px solid',
  background:   variant === 'primary' ? '#6366f1' : variant === 'secondary' ? '#f8fafc' : 'transparent',
  color:        variant === 'primary' ? '#ffffff'  : variant === 'secondary' ? '#0f172a' : '#6366f1',
  borderColor:  variant === 'primary' ? '#6366f1' : variant === 'secondary' ? '#e2e8f0' : 'transparent',
})

const LINK: React.CSSProperties = {
  fontSize: 11, color: '#6366f1', textDecoration: 'none', marginLeft: 4,
}

const STEP_NUM = (done: boolean): React.CSSProperties => ({
  width: 26, height: 26, borderRadius: '50%',
  background: done ? '#6366f1' : '#f1f5f9',
  color:      done ? '#ffffff'  : '#94a3b8',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 12, fontWeight: 700, flexShrink: 0,
})

function StepHeader({ n, title, done, detail }: { n: number; title: string; done: boolean; detail?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <div style={STEP_NUM(done)}>{done ? '✓' : n}</div>
      <div>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{title}</span>
        {done && <span style={BADGE(true)}>Done</span>}
        {detail && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{detail}</div>}
      </div>
    </div>
  )
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return `${Math.round(diff)}s ago`
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  return `${Math.round(diff / 86400)}d ago`
}

const STATUS_DOT: Record<string, string> = {
  idle:    '#10b981', running: '#f59e0b', error: '#ef4444',
  paused:  '#94a3b8', offline: '#cbd5e1',
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function StartCampaignPage() {
  const [summary, setSummary]       = useState<Summary | null>(null)
  const [loading, setLoading]       = useState(true)
  const [selectedProject, setSelectedProject] = useState('')
  const [selectedOperator, setSelectedOperator] = useState('')
  const [newProjectName, setNewProjectName]     = useState('')
  const [creatingProject, setCreatingProject]   = useState(false)
  const [researchQuery, setResearchQuery]       = useState('')
  const [researching, setResearching]           = useState(false)
  const [researchResult, setResearchResult]     = useState<string | null>(null)
  const [draftingLead, setDraftingLead]         = useState<string | null>(null)
  const [draftResult, setDraftResult]           = useState<Record<string, string>>({})
  const [checkingReply, setCheckingReply]       = useState<string | null>(null)
  const [replyResult, setReplyResult]           = useState<Record<string, string>>({})
  const [resuming, setResuming]                 = useState<string | null>(null)
  const [resumeResult, setResumeResult]         = useState<Record<string, string>>({})

  const fetchSummary = useCallback(async (projectId?: string) => {
    const qs = projectId ? `?project_id=${projectId}` : ''
    try {
      const res = await fetch(`/api/start-campaign/summary${qs}`)
      if (res.ok) {
        const data = await res.json() as Summary
        setSummary(data)
      }
    } catch { /* non-fatal */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSummary(selectedProject || undefined)
  }, [fetchSummary, selectedProject])

  // ── Derived state ────────────────────────────────────────────────────────────
  const lc = summary?.lead_counts ?? {}
  const totalLeads     = Object.values(lc).reduce((a, b) => a + b, 0)
  const discoveredLeads = (lc.discovered ?? 0) + (lc.needs_review ?? 0)
  const approvedLeads  = lc.approved ?? 0
  const contactedLeads = (lc.contacted ?? 0) + (lc.replied ?? 0) + (lc.interested ?? 0)

  const hasProject    = !!selectedProject
  const hasOperator   = !!selectedOperator
  const hasLeads      = totalLeads > 0
  const hasApproved   = approvedLeads > 0
  const hasPending    = (summary?.pending_approvals?.length ?? 0) > 0
  const hasResumable  = (summary?.resume_candidates?.length ?? 0) > 0
  const hasContacted  = (summary?.contacted_leads?.length ?? 0) > 0

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function handleCreateProject() {
    if (!newProjectName.trim()) return
    setCreatingProject(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName.trim(), description: '' }),
      })
      if (res.ok) {
        const data = await res.json()
        const id = data.project?.id ?? data.id
        if (id) {
          setSelectedProject(id)
          setNewProjectName('')
          await fetchSummary(id)
        }
      }
    } catch { /* non-fatal */ } finally {
      setCreatingProject(false)
    }
  }

  async function handleResearch() {
    if (!researchQuery.trim()) return
    setResearching(true)
    setResearchResult(null)
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
      setResearchResult(
        data.message ?? data.delegation?.message ?? 'Research delegated to Web Operator.'
      )
      await fetchSummary(selectedProject || undefined)
    } catch {
      setResearchResult('Error delegating research.')
    } finally {
      setResearching(false)
    }
  }

  async function handleDraft(leadId: string) {
    setDraftingLead(leadId)
    setDraftResult(prev => ({ ...prev, [leadId]: '' }))
    try {
      const res = await fetch(`/api/leads/${leadId}/outreach-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id:   selectedProject || undefined,
          operator_name: selectedOperator
            ? (summary?.operators.find(o => o.id === selectedOperator)?.name ?? undefined)
            : undefined,
        }),
      })
      const data = await res.json()
      setDraftResult(prev => ({
        ...prev,
        [leadId]: data.message ?? (data.ok ? 'Draft delegated to Web Operator.' : data.error ?? 'Error.'),
      }))
      await fetchSummary(selectedProject || undefined)
    } catch {
      setDraftResult(prev => ({ ...prev, [leadId]: 'Error preparing draft.' }))
    } finally {
      setDraftingLead(null)
    }
  }

  async function handleResume(actionId: string) {
    setResuming(actionId)
    try {
      const res = await fetch(`/api/web-operator/actions/${actionId}/resume`, { method: 'POST' })
      const data = await res.json()
      setResumeResult(prev => ({
        ...prev,
        [actionId]: data.message ?? (data.ok ? 'Action resumed.' : data.error ?? 'Error.'),
      }))
      await fetchSummary(selectedProject || undefined)
    } catch {
      setResumeResult(prev => ({ ...prev, [actionId]: 'Error resuming action.' }))
    } finally {
      setResuming(null)
    }
  }

  async function handleCheckReply(leadId: string) {
    setCheckingReply(leadId)
    setReplyResult(prev => ({ ...prev, [leadId]: 'Checking Gmail via browser…' }))
    try {
      const res = await fetch(`/api/leads/${leadId}/check-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: selectedProject || undefined }),
      })
      const data = await res.json()
      setReplyResult(prev => ({
        ...prev,
        [leadId]: data.summary ?? (data.has_reply ? '✓ Reply found.' : data.error ?? 'No reply found.'),
      }))
      await fetchSummary(selectedProject || undefined)
    } catch {
      setReplyResult(prev => ({ ...prev, [leadId]: 'Error checking reply.' }))
    } finally {
      setCheckingReply(null)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: '48px 40px', color: '#94a3b8', fontSize: 14 }}>
        Loading campaign flow…
      </div>
    )
  }

  const selectedProjectName = summary?.projects.find(p => p.id === selectedProject)?.name ?? null
  const selectedOperatorObj = summary?.operators.find(o => o.id === selectedOperator) ?? null

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px 80px' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>
          First Campaign Flow
        </h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 6, marginBottom: 0 }}>
          Follow these steps to run your first complete AÏKO marketing workflow — from research to reply.
          Each step uses the existing system. No new automation is triggered automatically.
        </p>
      </div>

      {/* ── Step 1: Project ── */}
      <div style={CARD}>
        <StepHeader
          n={1} title="Choose or create a project"
          done={hasProject}
          detail={selectedProjectName ? `Active: ${selectedProjectName}` : undefined}
        />
        <p style={{ fontSize: 12, color: '#64748b', marginTop: 0, marginBottom: 12 }}>
          Projects scope leads, operators, and campaigns. Everything in AÏKO lives inside a project.
        </p>
        {summary!.projects.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <select
              value={selectedProject}
              onChange={e => setSelectedProject(e.target.value)}
              style={{
                border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px',
                fontSize: 12, color: '#0f172a', background: '#fafafa', marginRight: 8,
              }}
            >
              <option value="">— select a project —</option>
              {summary!.projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <Link href="/projects" style={LINK}>Manage projects →</Link>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            placeholder="New project name…"
            value={newProjectName}
            onChange={e => setNewProjectName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateProject()}
            style={{
              border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px',
              fontSize: 12, color: '#0f172a', background: '#fafafa', width: 200,
            }}
          />
          <button
            onClick={handleCreateProject}
            disabled={creatingProject || !newProjectName.trim()}
            style={BTN('secondary')}
          >
            {creatingProject ? '…' : '+ Create project'}
          </button>
        </div>
      </div>

      {/* ── Step 2: Operator ── */}
      <div style={CARD}>
        <StepHeader
          n={2} title="Choose a Web Operator"
          done={hasOperator}
          detail={selectedOperatorObj ? `${selectedOperatorObj.name} · ${selectedOperatorObj.status}` : undefined}
        />
        <p style={{ fontSize: 12, color: '#64748b', marginTop: 0, marginBottom: 12 }}>
          A Web Operator is a named browser agent. It does all the external work — research, Gmail drafts, and reply checks.
        </p>
        {summary!.operators.length === 0 ? (
          <div style={{ fontSize: 12, color: '#f59e0b', marginBottom: 8 }}>
            No operators configured yet.{' '}
            <Link href="/operators" style={LINK}>Create one →</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            {summary!.operators.map(op => (
              <button
                key={op.id}
                onClick={() => setSelectedOperator(op.id === selectedOperator ? '' : op.id)}
                style={{
                  ...BTN(op.id === selectedOperator ? 'primary' : 'secondary'),
                  position: 'relative',
                }}
              >
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: STATUS_DOT[op.status] ?? '#94a3b8',
                  display: 'inline-block',
                }} />
                {op.name}
              </button>
            ))}
            <Link href="/operators" style={{ ...LINK, alignSelf: 'center' }}>Manage →</Link>
          </div>
        )}
      </div>

      {/* ── Step 3: Research ── */}
      <div style={CARD}>
        <StepHeader
          n={3} title="Research leads"
          done={hasLeads}
          detail={hasLeads ? `${totalLeads} lead${totalLeads !== 1 ? 's' : ''} in system` : undefined}
        />
        <p style={{ fontSize: 12, color: '#64748b', marginTop: 0, marginBottom: 12 }}>
          Ask the Web Operator to search the web for prospects. Results are saved as leads automatically.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <input
            placeholder="e.g. Find parking companies in Madrid"
            value={researchQuery}
            onChange={e => setResearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleResearch()}
            style={{
              border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px',
              fontSize: 12, color: '#0f172a', background: '#fafafa', width: 320,
            }}
          />
          <button
            onClick={handleResearch}
            disabled={researching || !researchQuery.trim()}
            style={BTN('primary')}
          >
            {researching ? '…' : '🔍 Ask operator to research'}
          </button>
        </div>
        {researchResult && (
          <div style={{ fontSize: 11, color: '#0369a1', fontStyle: 'italic', marginBottom: 6 }}>
            {researchResult}
          </div>
        )}
        {hasLeads && (
          <div style={{ fontSize: 11, color: '#64748b' }}>
            {Object.entries(lc).map(([status, count]) => (
              <span key={status} style={{ marginRight: 10 }}>
                <strong>{count}</strong> {status.replace(/_/g, ' ')}
              </span>
            ))}
            <Link href={selectedProject ? `/leads?project_id=${selectedProject}` : '/leads'} style={LINK}>
              View leads →
            </Link>
          </div>
        )}
      </div>

      {/* ── Step 4: Review leads ── */}
      <div style={CARD}>
        <StepHeader
          n={4} title="Review and approve leads"
          done={approvedLeads > 0}
          detail={approvedLeads > 0 ? `${approvedLeads} approved` : discoveredLeads > 0 ? `${discoveredLeads} awaiting review` : undefined}
        />
        <p style={{ fontSize: 12, color: '#64748b', marginTop: 0, marginBottom: 12 }}>
          Review discovered leads in the Leads tab. Approve the ones worth contacting. Rejected leads are excluded from outreach.
        </p>
        {discoveredLeads > 0 && (
          <div style={{ fontSize: 11, color: '#f59e0b', marginBottom: 8, fontWeight: 500 }}>
            {discoveredLeads} lead{discoveredLeads !== 1 ? 's' : ''} waiting for review.
          </div>
        )}
        <Link
          href={selectedProject ? `/projects/${selectedProject}` : '/leads'}
          style={{ ...BTN('secondary'), textDecoration: 'none', display: 'inline-flex' }}
        >
          Go to leads →
        </Link>
      </div>

      {/* ── Step 5: Gmail draft ── */}
      <div style={CARD}>
        <StepHeader
          n={5} title="Prepare Gmail draft"
          done={false}
          detail={hasApproved
            ? `${approvedLeads} approved lead${approvedLeads !== 1 ? 's' : ''} ready`
            : 'Approve leads first'}
        />
        <p style={{ fontSize: 12, color: '#64748b', marginTop: 0, marginBottom: 12 }}>
          The Web Operator opens Gmail and creates a draft for the lead. No email is sent automatically.
          You review and send from Gmail directly.
        </p>
        {!hasApproved && (
          <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic', marginBottom: 8 }}>
            No approved leads with email addresses yet. Approve leads in Step 4 first.
          </div>
        )}
        {summary!.approved_leads.map(lead => (
          <div key={lead.id} style={{
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            padding: '8px 0', borderBottom: '1px solid #f8fafc',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#0f172a' }}>
                {lead.company_name ?? lead.contact_name ?? 'Unknown'}
              </div>
              <div style={{ fontSize: 10, color: '#64748b' }}>{lead.email}</div>
            </div>
            <button
              onClick={() => handleDraft(lead.id)}
              disabled={draftingLead === lead.id}
              style={BTN('secondary')}
            >
              {draftingLead === lead.id ? '…' : '✉ Prepare draft'}
            </button>
            {draftResult[lead.id] && (
              <div style={{ width: '100%', fontSize: 10, color: '#6366f1', fontStyle: 'italic' }}>
                {draftResult[lead.id]}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Step 6: Approval ── */}
      <div style={CARD}>
        <StepHeader
          n={6} title="Approve risky actions (if needed)"
          done={!hasPending}
          detail={hasPending ? `${summary!.pending_approvals.length} pending` : 'Nothing waiting'}
        />
        <p style={{ fontSize: 12, color: '#64748b', marginTop: 0, marginBottom: 12 }}>
          Sending emails requires approval unless you are in Full Access mode.
          Review and approve browser actions before they execute.
        </p>
        {hasPending ? (
          <>
            {summary!.pending_approvals.slice(0, 5).map(item => (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
                borderBottom: '1px solid #f8fafc', fontSize: 11,
              }}>
                <span style={{
                  background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a',
                  borderRadius: 4, padding: '1px 6px', fontWeight: 700, fontSize: 10,
                }}>
                  PENDING
                </span>
                <span style={{ flex: 1, color: '#0f172a', fontWeight: 500 }}>
                  {item.title || item.description || item.action_type}
                </span>
                <span style={{ color: '#94a3b8' }}>{timeAgo(item.created_at)}</span>
              </div>
            ))}
            <div style={{ marginTop: 10 }}>
              <Link href="/approvals" style={{ ...BTN('primary'), textDecoration: 'none', display: 'inline-flex' }}>
                Go to Approval Center →
              </Link>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#10b981' }}>✓ No pending approvals</span>
            <Link href="/approvals" style={LINK}>Open Approval Center →</Link>
          </div>
        )}
      </div>

      {/* ── Step 7: Resume ── */}
      <div style={CARD}>
        <StepHeader
          n={7} title="Resume approved actions"
          done={!hasResumable}
          detail={hasResumable ? `${summary!.resume_candidates.length} ready to run` : 'Nothing to resume'}
        />
        <p style={{ fontSize: 12, color: '#64748b', marginTop: 0, marginBottom: 12 }}>
          After approving an action, you must explicitly resume it. AÏKO never auto-executes approved actions.
        </p>
        {hasResumable ? (
          summary!.resume_candidates.map(rc => (
            <div key={rc.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              padding: '8px 0', borderBottom: '1px solid #f8fafc',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#0f172a' }}>
                  {rc.description || rc.action_type}
                </div>
                <div style={{ fontSize: 10, color: '#64748b' }}>{rc.action_type}</div>
              </div>
              <button
                onClick={() => handleResume(rc.id)}
                disabled={resuming === rc.id}
                style={BTN('primary')}
              >
                {resuming === rc.id ? '…' : '▶ Resume'}
              </button>
              {rc.operator_id && (
                <Link href={`/operators/${rc.operator_id}`} style={LINK}>View operator →</Link>
              )}
              {resumeResult[rc.id] && (
                <div style={{ width: '100%', fontSize: 10, color: '#6366f1', fontStyle: 'italic' }}>
                  {resumeResult[rc.id]}
                </div>
              )}
            </div>
          ))
        ) : (
          <div style={{ fontSize: 11, color: '#10b981' }}>
            ✓ No approved actions waiting.{' '}
            <Link href="/approvals" style={LINK}>Approval Center →</Link>
          </div>
        )}
      </div>

      {/* ── Step 8: Reply check ── */}
      <div style={CARD}>
        <StepHeader
          n={8} title="Check for replies"
          done={false}
          detail={hasContacted
            ? `${contactedLeads} lead${contactedLeads !== 1 ? 's' : ''} contacted`
            : 'Send outreach first'}
        />
        <p style={{ fontSize: 12, color: '#64748b', marginTop: 0, marginBottom: 12 }}>
          After sending, the Web Operator can check Gmail for replies by searching your inbox — browser only, no Gmail API.
          Reads subject + snippet only. No email body is opened.
        </p>
        {summary!.contacted_leads.length === 0 ? (
          <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
            No contacted leads yet. Send outreach in Step 5 first.
          </div>
        ) : (
          summary!.contacted_leads.map(lead => (
            <div key={lead.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              padding: '8px 0', borderBottom: '1px solid #f8fafc',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#0f172a' }}>
                  {lead.company_name ?? lead.email}
                </div>
                <div style={{ fontSize: 10, color: '#64748b' }}>
                  {lead.email}
                  {lead.last_checked_at && <span style={{ marginLeft: 8 }}>checked {timeAgo(lead.last_checked_at)}</span>}
                  {lead.last_reply_at   && <span style={{ marginLeft: 8, color: '#10b981' }}>replied {timeAgo(lead.last_reply_at)}</span>}
                </div>
                {lead.reply_summary && (
                  <div style={{ fontSize: 10, color: '#0369a1', marginTop: 2, fontStyle: 'italic' }}>
                    {lead.reply_summary}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleCheckReply(lead.id)}
                disabled={checkingReply === lead.id}
                style={BTN('secondary')}
              >
                {checkingReply === lead.id ? '…' : '📬 Check reply'}
              </button>
              {replyResult[lead.id] && (
                <div style={{ width: '100%', fontSize: 10, color: '#0369a1', fontStyle: 'italic' }}>
                  {replyResult[lead.id]}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* ── Step 9: Execution trail ── */}
      <div style={CARD}>
        <StepHeader
          n={9} title="View execution trail"
          done={summary!.recent_trail.length > 0}
          detail={summary!.recent_trail.length > 0
            ? `${summary!.recent_trail.length} recent event${summary!.recent_trail.length !== 1 ? 's' : ''}`
            : 'No activity yet'}
        />
        <p style={{ fontSize: 12, color: '#64748b', marginTop: 0, marginBottom: 12 }}>
          The execution trail shows everything AÏKO has done for this project — research, drafts, approvals, sends, and reply checks.
        </p>
        {summary!.recent_trail.length === 0 ? (
          <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
            No activity yet. Complete earlier steps to generate trail events.
          </div>
        ) : (
          <div style={{ paddingLeft: 4 }}>
            {summary!.recent_trail.map((row, i) => {
              const isOk = row.status === 'completed'
              const isBad = row.status === 'failed' || row.status === 'blocked'
              return (
                <div key={row.action_id} style={{ display: 'flex', gap: 10, paddingBottom: 8 }}>
                  <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', marginTop: 3,
                      background: isBad ? '#ef4444' : isOk ? '#10b981' : '#f59e0b',
                    }} />
                    {i < summary!.recent_trail.length - 1 && (
                      <div style={{ flex: 1, width: 1, background: '#f1f5f9', marginTop: 2 }} />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: '#0f172a', fontWeight: 500 }}>
                      {row.description || row.action_type.replace(/_/g, ' ')}
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>
                      {row.action_type.replace(/_/g, ' ')} · {timeAgo(row.completed_at ?? row.created_at)}
                      {row.status === 'failed' && row.failure_reason && (
                        <span style={{ color: '#ef4444', marginLeft: 6 }}>✗ {row.failure_reason}</span>
                      )}
                    </div>
                    {row.lead_id && (
                      <Link href={`/leads`} style={{ fontSize: 9, color: '#6366f1', textDecoration: 'none' }}>
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
          <div style={{ marginTop: 12 }}>
            <Link href={`/projects/${selectedProject}`} style={LINK}>
              View full project trail →
            </Link>
          </div>
        )}
      </div>

      {/* Footer note */}
      <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 8 }}>
        This page is a guided view over the existing AÏKO system.
        Nothing is sent or executed automatically — you stay in control at every step.
      </div>
    </div>
  )
}
