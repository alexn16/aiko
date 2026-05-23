'use client'
import { useState } from 'react'
import { PMChatPanel } from './PMChatPanel'
import { PMReportPanel } from './PMReportPanel'
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

type Tab = 'overview' | 'pm-chat' | 'reports' | 'agents' | 'activity'

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

export function ProjectWorkspaceTabs({ project, memory, agents, leads, activity, hasProvider }: Props) {
  const [tab, setTab] = useState<Tab>('overview')

  const activeAgents = agents.filter(a => !['idle', 'paused'].includes(a.status))

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview',  label: 'Overview' },
    { id: 'pm-chat',   label: project.pm_name ? `Chat with ${project.pm_name}` : 'PM Chat' },
    { id: 'reports',   label: 'Reports' },
    { id: 'agents',    label: `Agents (${agents.length})` },
    { id: 'activity',  label: 'Activity' },
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
      </div>
    </div>
  )
}
