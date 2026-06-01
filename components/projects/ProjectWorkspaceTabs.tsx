'use client'
import { useState, useEffect } from 'react'
import { PMChatPanel } from './PMChatPanel'
import { PMReportPanel } from './PMReportPanel'
import { InternalCommsPanel } from '@/components/agents/InternalCommsPanel'
import { TasksPanel } from '@/components/agents/TasksPanel'
import { OutputsPanel } from '@/components/agents/OutputsPanel'
import { ProjectApprovalsPanel } from '@/components/approvals/ProjectApprovalsPanel'
import { ProjectCampaignsPanel } from '@/components/campaigns/ProjectCampaignsPanel'
import { ProjectResearchPanel } from '@/components/tools/ProjectResearchPanel'
import { ProjectOperatorPanel } from '@/components/web-operator/ProjectOperatorPanel'
import { ProjectLeadsPanel } from '@/components/leads/ProjectLeadsPanel'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Agent {
  id: string
  name: string
  status: string
  current_task: string | null
}

interface ActivityLog {
  action: string
  details: Record<string, unknown> | null
  created_at: string
  agent_name: string
}

interface ProjectMemory {
  notes: string | null
  next_steps: string[]
  blockers: string[]
}

interface Project {
  id: string
  name: string
  goal: string | null
  description: string | null
  target_market: string | null
  value_prop: string | null
  pm_name: string | null
  pm_specialty: string | null
  pm_focus: string | null
  assigned_pm_id: string | null
}

interface LeadStats {
  total: string | number
  new_count: string | number
  contacted: string | number
  qualified: string | number
}

interface Props {
  project: Project
  memory: ProjectMemory | null
  agents: Agent[]
  leads: LeadStats
  activity: ActivityLog[]
  hasProvider: boolean
}

type Tab = 'overview' | 'pm-chat' | 'reports' | 'agents' | 'activity' | 'comms' | 'tasks' | 'outputs' | 'approvals' | 'campaigns' | 'research' | 'leads' | 'operator' | 'decisions'

const STATUS_DOT: Record<string, string> = {
  active: '#10b981', browsing: '#3b82f6', writing: '#f59e0b',
  waiting: '#94a3b8', error: '#ef4444', idle: '#e2e8f0', paused: '#e2e8f0',
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)    return `${Math.round(diff)}s ago`
  if (diff < 3600)  return `${Math.round(diff / 60)}m ago`
  return `${Math.round(diff / 3600)}h ago`
}

const CARD: React.CSSProperties = {
  background: '#ffffff', borderRadius: 10,
  border: '1px solid #f1f5f9',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
}

const LABEL: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, color: '#94a3b8',
  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10,
}

// ── Component ─────────────────────────────────────────────────────────────────

// ── Launch Template Strip ──────────────────────────────────────────────────────

interface ChecklistItem { key: string; label: string; completed: boolean }
interface LaunchTpl {
  id: string; status: string; checklist: ChecklistItem[]
  checklist_done: number; start_campaign_url: string
  campaign_goal: string | null
}

function LaunchTemplateStrip({ projectId }: { projectId: string }) {
  const [tpl, setTpl]         = useState<LaunchTpl | null>(null)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    setFetching(true)
    fetch(`/api/projects/${projectId}/launch-template`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.template) setTpl({
          ...d.template,
          checklist_done: d.template.checklist?.filter((i: ChecklistItem) => i.completed).length ?? 0,
          start_campaign_url: `/start-campaign?project_id=${projectId}`,
        })
      })
      .catch(() => null)
      .finally(() => setFetching(false))
  }, [projectId])

  if (fetching) {
    return (
      <div style={{
        marginBottom: 16, padding: '10px 18px',
        background: '#fafbff', border: '1px solid #e0e7ff', borderRadius: 10,
        fontSize: 11, color: '#94a3b8',
      }}>
        Loading launch plan…
      </div>
    )
  }

  if (!tpl) return null

  const total = tpl.checklist.length
  const done  = tpl.checklist_done
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div style={{
      marginBottom: 16, padding: '14px 18px',
      background: '#fafbff', border: '1px solid #c7d2fe', borderRadius: 10,
      display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#3730a3', marginBottom: 4 }}>
          🗂 First Campaign Launch Plan
        </div>
        {/* Mini progress bar */}
        <div style={{ height: 4, background: '#e0e7ff', borderRadius: 2, width: 200, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${pct}%`,
            background: pct === 100 ? '#10b981' : '#6366f1', borderRadius: 2,
          }} />
        </div>
        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>
          {done}/{total} steps · {tpl.status.replace(/_/g, ' ')}
          {tpl.campaign_goal && <span style={{ marginLeft: 6, color: '#6366f1' }}>{tpl.campaign_goal}</span>}
        </div>
      </div>
      <a
        href={tpl.start_campaign_url}
        style={{
          background: '#6366f1', color: '#ffffff', textDecoration: 'none',
          borderRadius: 6, padding: '7px 14px', fontSize: 12, fontWeight: 600,
          whiteSpace: 'nowrap', flexShrink: 0,
        }}
      >
        ▶ Open First Campaign Flow
      </a>
    </div>
  )
}

// ── Strategy Brief Strip ───────────────────────────────────────────────────────

interface StrategyBriefData {
  id: string; title: string; objective: string; target_audience: string
  recommended_channel: string; value_proposition: string; research_prompt: string
  recommended_operator_id:   string | null
  recommended_operator_name: string | null
  operator_reason:           string | null
}

function StrategyBriefStrip({ projectId }: { projectId: string }) {
  const [brief, setBrief]       = useState<StrategyBriefData | null>(null)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    setFetching(true)
    fetch(`/api/projects/${projectId}/strategy-brief`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.brief) setBrief(d.brief) })
      .catch(() => null)
      .finally(() => setFetching(false))
  }, [projectId])

  if (fetching) {
    return (
      <div style={{
        marginBottom: 12, padding: '10px 18px',
        background: '#f0fdf4', border: '1px solid #d1fae5', borderRadius: 10,
        fontSize: 11, color: '#94a3b8',
      }}>
        Loading strategy brief…
      </div>
    )
  }

  if (!brief) return null

  return (
    <div style={{
      marginBottom: 12, padding: '14px 18px',
      background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#14532d', marginBottom: 6 }}>
        📋 {brief.title || 'First Campaign Strategy Brief'}
      </div>
      {brief.objective && (
        <div style={{ fontSize: 12, color: '#166534', marginBottom: 6 }}>{brief.objective}</div>
      )}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
        {brief.target_audience && (
          <div style={{ fontSize: 11, color: '#374151' }}>
            <span style={{ color: '#15803d', fontWeight: 600 }}>Audience: </span>
            {brief.target_audience}
          </div>
        )}
        {brief.recommended_channel && (
          <div style={{ fontSize: 11, color: '#374151' }}>
            <span style={{ color: '#15803d', fontWeight: 600 }}>Channel: </span>
            {brief.recommended_channel}
          </div>
        )}
        {brief.recommended_operator_name && (
          <div style={{ fontSize: 11, color: '#374151' }}>
            <span style={{ color: '#15803d', fontWeight: 600 }}>Operator: </span>
            {brief.recommended_operator_name}
            {brief.operator_reason && (
              <span style={{ color: '#6b7280', marginLeft: 4 }}>({brief.operator_reason})</span>
            )}
          </div>
        )}
        {!brief.recommended_operator_name && (
          <div style={{ fontSize: 11, color: '#92400e' }}>
            <span style={{ fontWeight: 600 }}>Operator: </span>
            None yet —{' '}
            <a href="/operators" style={{ color: '#6366f1', fontWeight: 600 }}>
              create one first
            </a>
          </div>
        )}
      </div>
      {brief.value_proposition && (
        <div style={{ fontSize: 11, color: '#374151', marginBottom: 8 }}>
          <span style={{ color: '#15803d', fontWeight: 600 }}>Value prop: </span>
          {brief.value_proposition}
        </div>
      )}
      <a
        href={`/start-campaign?project_id=${projectId}`}
        style={{
          background: '#16a34a', color: '#ffffff', textDecoration: 'none',
          borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 600,
          display: 'inline-block',
        }}
      >
        ▶ Open First Campaign Flow
      </a>
      <div style={{ fontSize: 10, color: '#15803d', marginTop: 8 }}>
        🔒 Guidance only — does not trigger research or outreach.
      </div>
    </div>
  )
}

// ── Decision Log Panel ─────────────────────────────────────────────────────────

interface ProjectDecisionRow {
  id: string
  decision_type: string
  title: string
  summary: string | null
  decided_by_role: string | null
  created_at: string
}

const DECISION_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  project_created:           { bg: '#dbeafe', color: '#1d4ed8', label: 'Project' },
  pm_assigned:               { bg: '#fce7f3', color: '#9d174d', label: 'PM' },
  strategy_brief_created:    { bg: '#ede9fe', color: '#5b21b6', label: 'Brief' },
  operator_recommended:      { bg: '#d1fae5', color: '#065f46', label: 'Operator' },
  operator_changed:          { bg: '#d1fae5', color: '#065f46', label: 'Operator' },
  launch_template_created:   { bg: '#fef3c7', color: '#92400e', label: 'Launch' },
  lead_approved:             { bg: '#dcfce7', color: '#166534', label: 'Lead ✓' },
  lead_rejected:             { bg: '#fee2e2', color: '#991b1b', label: 'Lead ✗' },
  approval_approved:         { bg: '#dcfce7', color: '#166534', label: 'Approved' },
  approval_rejected:         { bg: '#fee2e2', color: '#991b1b', label: 'Rejected' },
  approval_changes_requested:{ bg: '#fef3c7', color: '#92400e', label: 'Changes' },
  campaign_approved:         { bg: '#dbeafe', color: '#1e40af', label: 'Campaign' },
  research_prompt_changed:   { bg: '#f3f4f6', color: '#374151', label: 'Research' },
  next_step_changed:         { bg: '#f3f4f6', color: '#374151', label: 'Next Step' },
}

type DecisionFilter = 'all' | 'setup' | 'leads' | 'approvals'

const FILTER_TYPES: Record<DecisionFilter, string[]> = {
  all:       [],
  setup:     ['project_created', 'pm_assigned', 'strategy_brief_created', 'operator_recommended', 'operator_changed', 'launch_template_created', 'research_prompt_changed'],
  leads:     ['lead_approved', 'lead_rejected'],
  approvals: ['approval_approved', 'approval_rejected', 'approval_changes_requested', 'campaign_approved'],
}

function roleLabel(role: string | null): string {
  if (!role) return ''
  if (role === 'system') return 'AÏKO'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

function DecisionLogPanel({ projectId }: { projectId: string }) {
  const [decisions, setDecisions]   = useState<ProjectDecisionRow[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [filter, setFilter]         = useState<DecisionFilter>('all')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/projects/${projectId}/decisions?limit=50`)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(d => setDecisions(d.decisions ?? []))
      .catch(() => setError('Could not load decision log.'))
      .finally(() => setLoading(false))
  }, [projectId])

  const filtered = filter === 'all'
    ? decisions
    : decisions.filter(d => FILTER_TYPES[filter].includes(d.decision_type))

  if (loading) {
    return <div style={{ color: '#94a3b8', fontSize: 13, padding: '16px 0' }}>Loading decision log…</div>
  }
  if (error) {
    return <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>
  }

  const FILTERS: { id: DecisionFilter; label: string }[] = [
    { id: 'all',       label: `All (${decisions.length})` },
    { id: 'setup',     label: 'Setup' },
    { id: 'leads',     label: 'Leads' },
    { id: 'approvals', label: 'Approvals' },
  ]

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>📋 Decision Log</div>
        <div style={{ fontSize: 12, color: '#64748b' }}>
          Why this project is moving in this direction — read-only memory. Does not trigger any action.
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            style={{
              padding: '5px 12px', borderRadius: 20,
              border: filter === f.id ? '1.5px solid #6366f1' : '1.5px solid #e2e8f0',
              background: filter === f.id ? '#6366f1' : '#ffffff',
              color: filter === f.id ? '#ffffff' : '#64748b',
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && decisions.length === 0 && (
        <div style={{
          padding: '28px 20px', textAlign: 'center',
          background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0',
          color: '#64748b', fontSize: 13, lineHeight: 1.6,
        }}>
          <div style={{ fontSize: 22, marginBottom: 8 }}>📋</div>
          <div style={{ fontWeight: 600, marginBottom: 6, color: '#0f172a' }}>No decisions recorded yet</div>
          Decisions appear automatically when you create projects, assign PMs,
          approve leads, and respond to approval requests.
        </div>
      )}

      {filtered.length === 0 && decisions.length > 0 && (
        <div style={{
          padding: '20px', textAlign: 'center',
          background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0',
          color: '#94a3b8', fontSize: 13,
        }}>
          No {filter} decisions yet.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(d => {
          const badge = DECISION_BADGE[d.decision_type] ?? { bg: '#f1f5f9', color: '#475569', label: d.decision_type.replace(/_/g, ' ') }
          const when = new Date(d.created_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
          })
          const time = new Date(d.created_at).toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit',
          })
          const actor = roleLabel(d.decided_by_role)
          return (
            <div key={d.id} style={{
              padding: '14px 18px',
              background: '#ffffff', borderRadius: 10,
              border: '1px solid #f1f5f9',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              display: 'flex', gap: 14, alignItems: 'flex-start',
            }}>
              {/* Badge */}
              <div style={{
                background: badge.bg, color: badge.color,
                borderRadius: 6, padding: '3px 10px',
                fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
                textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2,
              }}>
                {badge.label}
              </div>
              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>
                  {d.title}
                </div>
                {d.summary && (
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                    {d.summary}
                  </div>
                )}
                <div style={{ fontSize: 11, color: '#94a3b8' }}>
                  {actor && (
                    <span style={{ marginRight: 8, fontWeight: 500, color: '#64748b' }}>
                      {actor}
                    </span>
                  )}
                  {when} · {time}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ProjectWorkspaceTabs({ project, memory, agents, leads, activity, hasProvider }: Props) {
  const [tab, setTab] = useState<Tab>('overview')

  const activeAgents = agents.filter(a => !['idle', 'paused'].includes(a.status))

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview',  label: 'Overview' },
    { id: 'pm-chat',   label: project.pm_name ? `Chat with ${project.pm_name}` : 'PM Chat' },
    { id: 'reports',   label: 'Reports' },
    { id: 'agents',    label: `Agents (${agents.length})` },
    { id: 'activity',  label: 'Activity' },
    { id: 'comms',     label: 'Comms' },
    { id: 'tasks',     label: 'Tasks' },
    { id: 'outputs',   label: 'Outputs' },
    { id: 'approvals', label: 'Approvals' },
    { id: 'campaigns', label: 'Campaigns' },
    { id: 'research',  label: 'Research' },
    { id: 'leads',     label: 'Leads' },
    { id: 'operator',  label: 'Operator' },
    { id: 'decisions', label: 'Decision Log' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      {/* Tab bar */}
      <div style={{
        display: 'flex', alignItems: 'flex-end',
        borderBottom: '1px solid #f1f5f9',
        padding: '0 32px',
        background: '#ffffff', flexShrink: 0,
        gap: 0,
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '12px 4px', marginRight: 20, height: 44,
              fontSize: 13,
              fontWeight: tab === t.id ? 500 : 400,
              color: tab === t.id ? '#0f172a' : '#94a3b8',
              borderBottom: tab === t.id
                ? `2px solid ${t.id === 'pm-chat' ? '#6366f1' : '#0f172a'}`
                : '2px solid transparent',
              letterSpacing: '-0.01em',
              transition: 'color 0.1s',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
            {t.id === 'pm-chat' && (
              <span style={{
                marginLeft: 6, fontSize: 9, fontWeight: 600,
                background: '#eef2ff', color: '#6366f1',
                borderRadius: 4, padding: '1px 5px',
                verticalAlign: 'middle',
              }}>
                NEW
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>

        {/* ── Overview ────────────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '24px 32px' }}>

            {/* Stats strip */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
              {[
                { label: 'Total leads', value: leads.total   ?? 0 },
                { label: 'New',         value: leads.new_count ?? 0 },
                { label: 'Contacted',   value: leads.contacted  ?? 0 },
                { label: 'Qualified',   value: leads.qualified  ?? 0 },
                { label: 'Agents on',   value: activeAgents.length },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, padding: '12px 14px', ...CARD, textAlign: 'center' }}>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 22, color: '#0f172a', fontWeight: 400 }}>
                    {s.value}
                  </div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* First Campaign Strategy Brief */}
            <StrategyBriefStrip projectId={project.id} />

            {/* First Campaign Launch card */}
            <LaunchTemplateStrip projectId={project.id} />

            {/* PM Chat teaser */}
            <div style={{
              marginBottom: 20, padding: '14px 18px',
              background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#4338ca', marginBottom: 2 }}>
                  {project.pm_name
                    ? `Talk to ${project.pm_name} about this project`
                    : 'No Project Manager assigned yet'}
                </div>
                <div style={{ fontSize: 12, color: '#6366f1' }}>
                  {project.pm_name
                    ? `${project.pm_name} manages execution: strategy, leads, copywriting, outreach, and approvals.`
                    : 'Ask the CEO to assign a PM — open CEO Chat and say "assign a PM to [project name]".'}
                </div>
              </div>
              {project.pm_name && (
                <button
                  onClick={() => setTab('pm-chat')}
                  style={{
                    background: '#6366f1', color: '#ffffff', border: 'none', borderRadius: 8,
                    padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }}
                >
                  Open PM Chat →
                </button>
              )}
            </div>

            {/* Grid: memory + agents + activity */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>

              {/* Project memory */}
              <div style={{ ...CARD, padding: '16px 18px' }}>
                <div style={LABEL}>Project memory</div>
                {memory ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {memory.notes && (
                      <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, margin: 0 }}>
                        {memory.notes}
                      </p>
                    )}
                    {memory.next_steps?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500, marginBottom: 5 }}>Next steps</div>
                        {memory.next_steps.map((s, i) => (
                          <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                            <span style={{ color: '#6366f1', fontSize: 11, flexShrink: 0, marginTop: 1 }}>→</span>
                            <span style={{ fontSize: 11, color: '#374151', lineHeight: 1.5 }}>{s}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {memory.blockers?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 500, marginBottom: 5 }}>Blockers</div>
                        {memory.blockers.map((b, i) => (
                          <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                            <span style={{ color: '#ef4444', fontSize: 11, flexShrink: 0, marginTop: 1 }}>!</span>
                            <span style={{ fontSize: 11, color: '#374151', lineHeight: 1.5 }}>{b}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {!memory.notes && !memory.next_steps?.length && (
                      <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>No notes yet.</div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>No memory recorded yet.</div>
                )}
              </div>

              {/* Agents summary */}
              <div style={{ ...CARD, padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={LABEL}>Agents</div>
                  <button
                    onClick={() => setTab('agents')}
                    style={{ fontSize: 11, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    View all →
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {agents.slice(0, 6).map(a => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 6px', borderRadius: 5, background: '#fafafa' }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, background: STATUS_DOT[a.status] ?? '#e2e8f0' }} />
                      <span style={{ fontSize: 11, fontWeight: 500, color: '#0f172a', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.name}
                      </span>
                    </div>
                  ))}
                  {agents.length > 6 && (
                    <div style={{ fontSize: 11, color: '#94a3b8', paddingLeft: 12 }}>+{agents.length - 6} more</div>
                  )}
                </div>
              </div>

              {/* Activity */}
              <div style={{ ...CARD, padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={LABEL}>Recent activity</div>
                  <button
                    onClick={() => setTab('activity')}
                    style={{ fontSize: 11, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    View all →
                  </button>
                </div>
                {activity.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>No activity yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {activity.slice(0, 5).map((log, i) => {
                      const text = typeof log.details?.message === 'string' ? log.details.message
                        : typeof log.details?.summary === 'string' ? log.details.summary
                        : log.action.replace(/_/g, ' ')
                      return (
                        <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#cbd5e1', flexShrink: 0, marginTop: 1, minWidth: 28 }}>
                            {timeAgo(log.created_at)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>{log.agent_name}</span>
                            <span style={{ fontSize: 11, color: '#374151', lineHeight: 1.4, marginLeft: 5 }}>
                              {String(text).slice(0, 80)}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── PM Chat ─────────────────────────────────────────────────────── */}
        {tab === 'pm-chat' && (
          <PMChatPanel
            projectId={project.id}
            pmName={project.pm_name}
            pmSpecialty={project.pm_specialty}
            hasProvider={hasProvider}
          />
        )}

        {/* ── Reports ─────────────────────────────────────────────────────── */}
        {tab === 'reports' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '24px 32px' }}>
            <PMReportPanel projectId={project.id} />
          </div>
        )}

        {/* ── Agents ──────────────────────────────────────────────────────── */}
        {tab === 'agents' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '24px 32px' }}>
            <div style={{ ...CARD, padding: '18px 20px', maxWidth: 680 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={LABEL}>All agents</div>
                <Link href="/team" style={{ fontSize: 11, color: '#6366f1', textDecoration: 'none' }}>
                  Manage team →
                </Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {agents.map(a => (
                  <div key={a.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', borderRadius: 7, background: '#fafafa',
                    border: '1px solid #f1f5f9',
                  }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: STATUS_DOT[a.status] ?? '#e2e8f0' }} />
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#0f172a', flex: 1 }}>{a.name}</span>
                    <span style={{ fontSize: 10, color: '#94a3b8', textTransform: 'capitalize' }}>{a.status}</span>
                    {a.current_task && (
                      <span style={{ fontSize: 10, color: '#64748b', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: 'italic' }}>
                        {a.current_task}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Activity ────────────────────────────────────────────────────── */}
        {tab === 'activity' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '24px 32px' }}>
            <div style={{ ...CARD, padding: '18px 20px', maxWidth: 720 }}>
              <div style={LABEL}>Activity log</div>
              {activity.length === 0 ? (
                <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>No activity yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {activity.map((log, i) => {
                    const isError = log.action === 'error'
                    const text = typeof log.details?.message === 'string' ? log.details.message
                      : typeof log.details?.summary === 'string' ? log.details.summary
                      : log.action.replace(/_/g, ' ')
                    return (
                      <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#cbd5e1', flexShrink: 0, marginTop: 2, minWidth: 36 }}>
                          {timeAgo(log.created_at)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>{log.agent_name}</span>
                          <span style={{ fontSize: 12, color: isError ? '#ef4444' : '#374151', lineHeight: 1.5, marginLeft: 6 }}>
                            {String(text)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Comms ───────────────────────────────────────────────────────── */}
        {tab === 'comms' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '24px 32px' }}>
            <div style={{ maxWidth: 760 }}>
              <InternalCommsPanel projectId={project.id} />
            </div>
          </div>
        )}

        {/* ── Tasks ───────────────────────────────────────────────────────── */}
        {tab === 'tasks' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '24px 32px' }}>
            <div style={{ maxWidth: 760 }}>
              <TasksPanel projectId={project.id} />
            </div>
          </div>
        )}

        {/* ── Outputs ─────────────────────────────────────────────────────── */}
        {tab === 'outputs' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '24px 32px' }}>
            <div style={{ maxWidth: 760 }}>
              <OutputsPanel projectId={project.id} />
            </div>
          </div>
        )}

        {/* ── Approvals ───────────────────────────────────────────────────── */}
        {tab === 'approvals' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '24px 32px' }}>
            <div style={{ maxWidth: 760 }}>
              <ProjectApprovalsPanel projectId={project.id} />
            </div>
          </div>
        )}

        {/* ── Campaigns ───────────────────────────────────────────────────── */}
        {tab === 'campaigns' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '24px 32px' }}>
            <div style={{ maxWidth: 760 }}>
              <ProjectCampaignsPanel projectId={project.id} />
            </div>
          </div>
        )}

        {/* ── Research ────────────────────────────────────────────────────── */}
        {tab === 'research' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '24px 32px' }}>
            <div style={{ maxWidth: 720 }}>
              <ProjectResearchPanel projectId={project.id} projectName={project.name} />
            </div>
          </div>
        )}

        {/* ── Leads ───────────────────────────────────────────────────────── */}
        {tab === 'leads' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '24px 32px' }}>
            <div style={{ maxWidth: 760 }}>
              <ProjectLeadsPanel projectId={project.id} />
            </div>
          </div>
        )}

        {/* ── Operator ────────────────────────────────────────────────────── */}
        {tab === 'operator' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '24px 32px' }}>
            <div style={{ maxWidth: 760 }}>
              <ProjectOperatorPanel projectId={project.id} />
            </div>
          </div>
        )}

        {/* ── Decision Log ─────────────────────────────────────────────────── */}
        {tab === 'decisions' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '24px 32px' }}>
            <div style={{ maxWidth: 760 }}>
              <DecisionLogPanel projectId={project.id} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
