'use client'
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AgentGrid } from '@/components/agents/AgentGrid'
import { ActivityFeed } from '@/components/agents/ActivityFeed'
import { AikoBrand } from '@/components/brand/AikoBrand'
import { Card } from '@/components/ui/Card'
import { Agent, AgentLog } from '@/lib/db/schema'

interface DashboardSummary {
  setup: {
    setup_required: boolean
    can_ceo_think: boolean
    connected_profile_count: number
    recommended_next_step: string
  }
  ceo_brain: {
    can_think: boolean
    provider_name: string | null
    model: string | null
    status: string | null
    auth_method: string | null
    running_on_ollama: boolean
  }
  providers: {
    chatgpt_connected: boolean
    claude_connected: boolean
    ollama_active_for_ceo: boolean
  }
  mode: {
    mode: string
    label: string
    paused: boolean
    sends_today: number
    daily_send_limit: number
  }
  counts: {
    active_projects: number
    active_web_operators: number
    waiting_user: number
    pending_approvals: number
    active_improvement_proposals: number
  }
  browser: {
    runtime_available: boolean
    active_session_id: string | null
  }
  improvement_health: {
    blocked_by_validation: number
    waiting_for_implementation: number
    duplicate_collapsed: number
    capabilities_validated_this_week: number
  }
  warnings: Array<{
    severity: 'info' | 'warning' | 'danger'
    title: string
    message: string
    href?: string
  }>
  recent_files: RecentFile[]
  recent_executive_reports: RecentReport[]
  recent_decisions: RecentDecision[]
}

interface RecentFile {
  id: string
  filename: string
  title: string | null
  content_type: string
  source_entity_type: string | null
  created_at: string
  project_name: string | null
}

interface RecentReport {
  id: string
  title: string
  summary: string | null
  created_at: string
  project_name: string | null
}

interface RecentDecision {
  id: string
  decision_type: string
  title: string
  summary: string | null
  created_at: string
  project_name: string | null
}

const QUICK_LINKS = [
  { label: 'CEO Chat', href: '/ceo' },
  { label: 'Start Campaign', href: '/start-campaign' },
  { label: 'Operators', href: '/operators' },
  { label: 'Approvals', href: '/approvals' },
  { label: 'Files', href: '/files' },
  { label: 'System Improvements', href: '/system' },
]

const CAPABILITY_CARDS = [
  ['Create project', 'Start from CEO Chat and let AÏKO create the workspace, PM assignment, strategy brief, and launch checklist.'],
  ['Plan campaign', 'Use the Strategy Brief, Campaign Builder, and Strategy Execution Planner to turn an idea into tasks.'],
  ['Research with Web Operator', 'Delegate safe browser research through Skills and Playbooks with login/CAPTCHA takeover.'],
  ['Create content draft', 'Prepare outreach, Gmail drafts, Canva drafts, and campaign copy for review.'],
  ['Generate report', 'Create executive project reports and PM reports from real project context.'],
  ['Export files', 'Export reports, lead CSVs, strategy briefs, decisions, and project bundles.'],
  ['Create custom agent', 'Define focused internal agents that inherit AÏKO safety constraints.'],
  ['Improve itself safely', 'Create capability proposals, Codex prompts, lifecycle status, and validation records without self-rewriting code.'],
]

const SMOKE_CHECKS = [
  ['CEO brain responds', '/ceo'],
  ['Setup complete', '/setup'],
  ['Web Operator opens example site', '/operators'],
  ['Approval queue works', '/approvals'],
  ['File export works', '/files'],
  ['Self-improvement proposal exists', '/system'],
]

function emptySummary(): DashboardSummary {
  return {
    setup: { setup_required: true, can_ceo_think: false, connected_profile_count: 0, recommended_next_step: 'Loading setup status.' },
    ceo_brain: { can_think: false, provider_name: null, model: null, status: null, auth_method: null, running_on_ollama: false },
    providers: { chatgpt_connected: false, claude_connected: false, ollama_active_for_ceo: false },
    mode: { mode: 'read_only', label: 'Read Only', paused: false, sends_today: 0, daily_send_limit: 50 },
    counts: { active_projects: 0, active_web_operators: 0, waiting_user: 0, pending_approvals: 0, active_improvement_proposals: 0 },
    browser: { runtime_available: false, active_session_id: null },
    improvement_health: { blocked_by_validation: 0, waiting_for_implementation: 0, duplicate_collapsed: 0, capabilities_validated_this_week: 0 },
    warnings: [],
    recent_files: [],
    recent_executive_reports: [],
    recent_decisions: [],
  }
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary>(emptySummary())
  const [loading, setLoading] = useState(true)
  const [agents, setAgents] = useState<Agent[]>([])
  const [logs, setLogs] = useState<AgentLog[]>([])
  const [projectId, setProjectId] = useState('')

  useEffect(() => {
    fetch('/api/dashboard/summary')
      .then(r => r.json())
      .then(data => {
        if (!data.error) setSummary(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(d => {
        if (d.projects?.[0]?.id) setProjectId(d.projects[0].id)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!projectId) return
    const src = new EventSource(`/api/agents/stream?projectId=${projectId}`)
    src.onmessage = e => {
      const d = JSON.parse(e.data)
      if (d.agents) setAgents(d.agents)
      if (d.logs) setLogs(d.logs)
    }
    return () => src.close()
  }, [projectId])

  const metrics = [
    { label: 'Active projects', value: summary.counts.active_projects, href: '/projects' },
    { label: 'Web Operators', value: summary.counts.active_web_operators, href: '/operators' },
    { label: 'Waiting user', value: summary.counts.waiting_user, href: '/operators' },
    { label: 'Pending approvals', value: summary.counts.pending_approvals, href: '/approvals' },
    { label: 'Improvement proposals', value: summary.counts.active_improvement_proposals, href: '/system' },
  ]

  return (
    <div style={{ padding: '34px 32px 48px', maxWidth: 1180, margin: '0 auto' }} className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ marginBottom: 14 }}>
            <AikoBrand size="md" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 750, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
            AÏKO MVP Dashboard
          </h1>
          <p style={{ margin: '5px 0 0', fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
            Owner overview for setup, safety, work in progress, and supervised execution.
          </p>
        </div>
        <StatusPill
          label={summary.setup.can_ceo_think ? 'CEO brain connected' : 'CEO brain needs setup'}
          tone={summary.setup.can_ceo_think ? 'good' : 'warn'}
        />
      </div>

      <section style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 16, marginBottom: 18 }}>
        <Card padding={18}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            <StatusBlock
              label="CEO brain"
              value={summary.ceo_brain.provider_name ?? 'Not connected'}
              detail={[summary.ceo_brain.model, summary.ceo_brain.auth_method].filter(Boolean).join(' · ') || summary.setup.recommended_next_step}
              tone={summary.ceo_brain.can_think ? 'good' : 'warn'}
            />
            <StatusBlock
              label="Setup"
              value={summary.setup.setup_required ? 'Needs attention' : 'Complete'}
              detail={`${summary.setup.connected_profile_count} connected profile${summary.setup.connected_profile_count === 1 ? '' : 's'}`}
              tone={summary.setup.setup_required ? 'warn' : 'good'}
            />
            <StatusBlock
              label="Operating mode"
              value={summary.mode.paused ? 'Paused' : summary.mode.label}
              detail={`${summary.mode.sends_today}/${summary.mode.daily_send_limit} sends today`}
              tone={summary.mode.mode === 'read_only' || summary.mode.paused ? 'warn' : 'good'}
            />
          </div>
        </Card>

        <Card padding={18}>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Quick links
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {QUICK_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  color: '#0f172a',
                  textDecoration: 'none',
                  fontSize: 12,
                  fontWeight: 650,
                  padding: '8px 10px',
                  background: '#ffffff',
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </Card>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
        {metrics.map(metric => (
          <Link key={metric.label} href={metric.href} style={{ textDecoration: 'none' }}>
            <Card padding={14} style={{ minHeight: 82 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', lineHeight: 1, fontFamily: 'DM Mono, monospace' }}>
                {loading ? '…' : metric.value}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 650, marginTop: 8, lineHeight: 1.3 }}>
                {metric.label}
              </div>
            </Card>
          </Link>
        ))}
      </section>

      {summary.warnings.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <SectionTitle label="Owner warnings" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            {summary.warnings.map(warning => (
              <WarningRow key={`${warning.title}-${warning.message}`} warning={warning} />
            ))}
          </div>
        </section>
      )}

      <section style={{ marginBottom: 24 }}>
        <SectionTitle label="What can AÏKO do?" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
          {CAPABILITY_CARDS.map(([title, description]) => (
            <Card key={title} padding={14} style={{ minHeight: 126 }}>
              <div style={{ fontSize: 13, fontWeight: 750, color: '#0f172a', marginBottom: 7 }}>{title}</div>
              <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{description}</div>
            </Card>
          ))}
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <Card padding={18}>
          <SectionTitle label="Run smoke test" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {SMOKE_CHECKS.map(([label, href]) => (
              <label key={label} style={{ display: 'flex', gap: 9, alignItems: 'center', fontSize: 12, color: '#334155' }}>
                <input type="checkbox" style={{ width: 15, height: 15 }} />
                <span style={{ flex: 1 }}>{label}</span>
                <Link href={href} style={{ color: '#6366f1', textDecoration: 'none', fontWeight: 650 }}>Open</Link>
              </label>
            ))}
          </div>
        </Card>

        <Card padding={18}>
          <SectionTitle label="Improvement health" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <SmallStat label="Blocked validation" value={summary.improvement_health.blocked_by_validation} />
            <SmallStat label="Waiting implementation" value={summary.improvement_health.waiting_for_implementation} />
            <SmallStat label="Duplicates collapsed" value={summary.improvement_health.duplicate_collapsed} />
            <SmallStat label="Validated this week" value={summary.improvement_health.capabilities_validated_this_week} />
          </div>
        </Card>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, marginBottom: 26 }}>
        <RecentList
          title="Recent files"
          empty="No files generated yet."
          items={summary.recent_files.map(file => ({
            id: file.id,
            title: file.title || file.filename,
            meta: [file.project_name, file.content_type, file.source_entity_type].filter(Boolean).join(' · '),
            href: '/files',
          }))}
        />
        <RecentList
          title="Recent executive reports"
          empty="No reports generated yet."
          items={summary.recent_executive_reports.map(report => ({
            id: report.id,
            title: report.title,
            meta: [report.project_name, formatDate(report.created_at)].filter(Boolean).join(' · '),
            href: '/reports',
          }))}
        />
        <RecentList
          title="Recent decisions"
          empty="No decisions recorded yet."
          items={summary.recent_decisions.map(decision => ({
            id: decision.id,
            title: decision.title,
            meta: [decision.project_name, decision.decision_type.replace(/_/g, ' ')].filter(Boolean).join(' · '),
            href: decision.project_name ? '/projects' : '/ceo',
          }))}
        />
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 18, alignItems: 'start' }}>
        <div>
          <SectionTitle label="Live agents" />
          <AgentGrid agents={agents} />
        </div>
        <Card>
          <SectionTitle label="Activity" />
          <ActivityFeed logs={logs} />
        </Card>
      </section>
    </div>
  )
}

function SectionTitle({ label }: { label: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
      {label}
    </div>
  )
}

function StatusPill({ label, tone }: { label: string; tone: 'good' | 'warn' }) {
  return (
    <span style={{
      borderRadius: 999,
      padding: '7px 11px',
      fontSize: 12,
      fontWeight: 700,
      color: tone === 'good' ? '#166534' : '#92400e',
      background: tone === 'good' ? '#dcfce7' : '#fef3c7',
      border: `1px solid ${tone === 'good' ? '#bbf7d0' : '#fde68a'}`,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

function StatusBlock({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: 'good' | 'warn' }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: tone === 'good' ? '#16a34a' : '#f59e0b', flexShrink: 0 }} />
        <span style={{ fontSize: 14, color: '#0f172a', fontWeight: 750 }}>{value}</span>
      </div>
      <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.4 }}>{detail}</div>
    </div>
  )
}

function WarningRow({ warning }: { warning: DashboardSummary['warnings'][number] }) {
  const palette = warning.severity === 'danger'
    ? { bg: '#fef2f2', border: '#fecaca', title: '#991b1b' }
    : warning.severity === 'warning'
      ? { bg: '#fffbeb', border: '#fde68a', title: '#92400e' }
      : { bg: '#f8fafc', border: '#e2e8f0', title: '#334155' }
  const body = (
    <div style={{ background: palette.bg, border: `1px solid ${palette.border}`, borderRadius: 8, padding: '12px 13px', minHeight: 88 }}>
      <div style={{ fontSize: 13, color: palette.title, fontWeight: 750, marginBottom: 4 }}>{warning.title}</div>
      <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.45 }}>{warning.message}</div>
    </div>
  )
  return warning.href ? <Link href={warning.href} style={{ textDecoration: 'none' }}>{body}</Link> : body
}

function SmallStat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ border: '1px solid #f1f5f9', borderRadius: 8, padding: '10px 11px' }}>
      <div style={{ fontSize: 19, color: '#0f172a', fontWeight: 800, fontFamily: 'DM Mono, monospace' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>{label}</div>
    </div>
  )
}

function RecentList({ title, empty, items }: {
  title: string
  empty: string
  items: Array<{ id: string; title: string; meta: string; href: string }>
}) {
  return (
    <Card padding={16}>
      <SectionTitle label={title} />
      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: '#94a3b8', padding: '5px 0 2px' }}>{empty}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {items.slice(0, 5).map(item => (
            <Link key={item.id} href={item.href} style={{ textDecoration: 'none' }}>
              <div style={{ fontSize: 12, color: '#0f172a', fontWeight: 650, lineHeight: 1.35 }}>{item.title}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, lineHeight: 1.35 }}>{item.meta || 'No project'}</div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  )
}

function formatDate(value: string) {
  if (!value) return ''
  return new Date(value).toLocaleDateString()
}
