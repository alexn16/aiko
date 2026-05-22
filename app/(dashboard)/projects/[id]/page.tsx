export const dynamic = 'force-dynamic'

import { db } from '@/lib/db/client'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { PMReportPanel } from '@/components/projects/PMReportPanel'

async function getProjectData(id: string) {
  const [project, memory, map, agents, leads, activity] = await Promise.all([
    db.query(`
      SELECT p.*, pm.name AS pm_name, pm.specialty AS pm_specialty, pm.current_focus AS pm_focus
      FROM projects p
      LEFT JOIN project_managers pm ON pm.id = p.assigned_pm_id
      WHERE p.id = $1
    `, [id]),
    db.query('SELECT * FROM project_memory WHERE project_id=$1', [id]),
    db.query('SELECT * FROM project_map WHERE project_id=$1', [id]),
    db.query('SELECT * FROM agents WHERE project_id=$1 ORDER BY name', [id]),
    db.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status='new')       AS new_count,
        COUNT(*) FILTER (WHERE status='contacted') AS contacted,
        COUNT(*) FILTER (WHERE status='qualified') AS qualified
      FROM leads WHERE project_id=$1
    `, [id]),
    db.query(`
      SELECT al.action, al.details, al.created_at, a.name AS agent_name
      FROM agent_logs al
      JOIN agents a ON a.id = al.agent_id
      WHERE al.project_id=$1
      ORDER BY al.created_at DESC LIMIT 20
    `, [id]),
  ])

  if (!project.rows[0]) return null

  return {
    project: project.rows[0],
    memory: memory.rows[0] ?? null,
    map: map.rows[0] ?? null,
    agents: agents.rows,
    leads: leads.rows[0],
    activity: activity.rows,
  }
}

const STATUS_DOT: Record<string, string> = {
  active: '#10b981', browsing: '#3b82f6', writing: '#f59e0b',
  waiting: '#94a3b8', error: '#ef4444', idle: '#e2e8f0', paused: '#e2e8f0',
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return `${Math.round(diff)}s ago`
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`
  return `${Math.round(diff / 3600)}h ago`
}

export default async function ProjectWorkspacePage({ params }: { params: { id: string } }) {
  const data = await getProjectData(params.id)
  if (!data) notFound()

  const { project, memory, map, agents, leads, activity } = data
  const activeAgents = agents.filter((a: { status: string }) => !['idle', 'paused'].includes(a.status))

  const LABEL: React.CSSProperties = {
    fontSize: 10, fontWeight: 600, color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10,
  }

  const CARD: React.CSSProperties = {
    background: '#ffffff', borderRadius: 10,
    border: '1px solid #f1f5f9',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  }

  return (
    <div style={{ padding: '28px 32px' }}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <Link href="/projects" style={{ fontSize: 12, color: '#94a3b8', textDecoration: 'none' }}>
            Projects
          </Link>
          <span style={{ fontSize: 12, color: '#cbd5e1' }}>›</span>
          <span style={{ fontSize: 12, color: '#64748b' }}>{project.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.03em', margin: 0 }}>
              {project.name}
            </h1>
            {project.goal && (
              <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0', lineHeight: 1.5 }}>
                {project.goal}
              </p>
            )}
          </div>
          {project.pm_name ? (
            <div style={{
              padding: '8px 14px', background: '#f8fafc', borderRadius: 8,
              border: '1px solid #f1f5f9', textAlign: 'right',
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{project.pm_name}</div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>{project.pm_specialty}</div>
              {project.pm_focus && (
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 2, fontStyle: 'italic' }}>
                  {project.pm_focus}
                </div>
              )}
            </div>
          ) : (
            <div style={{
              padding: '8px 14px', background: '#fef2f2', borderRadius: 8,
              border: '1px solid #fecaca', fontSize: 11, color: '#ef4444',
            }}>
              No PM assigned
            </div>
          )}
        </div>
      </div>

      {/* ── Stats strip ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        {[
          { label: 'Total leads', value: leads.total ?? 0 },
          { label: 'New',         value: leads.new_count ?? 0 },
          { label: 'Contacted',   value: leads.contacted ?? 0 },
          { label: 'Qualified',   value: leads.qualified ?? 0 },
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

      {/* ── Main grid: 3 cols ────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>

        {/* Column 1: PM Report (full height) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <PMReportPanel projectId={project.id} />

          {/* Pipeline map */}
          <div style={{ ...CARD, padding: '16px 18px' }}>
            <div style={LABEL}>Pipeline map</div>
            {map && Array.isArray(map.nodes) && map.nodes.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {map.nodes.map((node: { id: string; label: string; type: string; count?: number }, i: number) => (
                  <div key={node.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {i > 0 && (
                      <span style={{ color: '#cbd5e1', fontSize: 10, paddingLeft: 20 }}>↓</span>
                    )}
                    {i === 0 && <span style={{ width: 6, height: 6, background: '#6366f1', borderRadius: '50%', flexShrink: 0 }} />}
                    {i > 0 && <span style={{ width: 6, height: 6, background: '#e2e8f0', borderRadius: '50%', flexShrink: 0 }} />}
                    <span style={{ fontSize: 11, fontWeight: 500, color: '#374151' }}>{node.label}</span>
                    {node.count !== undefined && (
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#94a3b8', marginLeft: 'auto' }}>
                        {node.count}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
                No map yet — ask the CEO to generate one.
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Project memory + Agents */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Project memory */}
          <div style={{ ...CARD, padding: '16px 18px' }}>
            <div style={LABEL}>Project memory</div>
            {memory ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {memory.notes && (
                  <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, margin: 0 }}>
                    {memory.notes}
                  </p>
                )}
                {Array.isArray(memory.next_steps) && memory.next_steps.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500, marginBottom: 5 }}>Next steps</div>
                    {memory.next_steps.map((s: string, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                        <span style={{ color: '#6366f1', fontSize: 11, flexShrink: 0, marginTop: 1 }}>→</span>
                        <span style={{ fontSize: 11, color: '#374151', lineHeight: 1.5 }}>{s}</span>
                      </div>
                    ))}
                  </div>
                )}
                {Array.isArray(memory.blockers) && memory.blockers.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 500, marginBottom: 5 }}>Blockers</div>
                    {memory.blockers.map((b: string, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                        <span style={{ color: '#ef4444', fontSize: 11, flexShrink: 0, marginTop: 1 }}>!</span>
                        <span style={{ fontSize: 11, color: '#374151', lineHeight: 1.5 }}>{b}</span>
                      </div>
                    ))}
                  </div>
                )}
                {!memory.notes && (!memory.next_steps || memory.next_steps.length === 0) && (
                  <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>No notes yet.</div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>No memory recorded yet.</div>
            )}
          </div>

          {/* Agents */}
          <div style={{ ...CARD, padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={LABEL}>Agents</div>
              <Link href="/team" style={{ fontSize: 11, color: '#6366f1', textDecoration: 'none' }}>
                Manage →
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {agents.slice(0, 10).map((a: {
                id: string; name: string; status: string; current_task: string | null
              }) => (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '5px 7px', borderRadius: 6, background: '#fafafa',
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: STATUS_DOT[a.status] ?? '#e2e8f0',
                  }} />
                  <span style={{
                    fontSize: 11, fontWeight: 500, color: '#0f172a',
                    flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {a.name}
                  </span>
                  {a.current_task && (
                    <span style={{
                      fontSize: 9, color: '#94a3b8',
                      maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {a.current_task}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Column 3: Activity feed */}
        <div>
          <div style={{ ...CARD, padding: '16px 18px' }}>
            <div style={LABEL}>Recent activity</div>
            {activity.length === 0 ? (
              <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>No activity yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {activity.map((log: {
                  action: string
                  details: Record<string, unknown> | null
                  created_at: string
                  agent_name: string
                }, i: number) => {
                  const isError = log.action === 'error'
                  const text = typeof log.details?.message === 'string'
                    ? log.details.message
                    : typeof log.details?.summary === 'string'
                      ? log.details.summary
                      : log.action.replace(/_/g, ' ')

                  return (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <div style={{
                        fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#cbd5e1',
                        flexShrink: 0, marginTop: 1, minWidth: 30,
                      }}>
                        {timeAgo(log.created_at)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>
                          {log.agent_name}
                        </span>
                        <span style={{
                          fontSize: 11,
                          color: isError ? '#ef4444' : '#374151',
                          lineHeight: 1.5, marginLeft: 5,
                        }}>
                          {text}
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
    </div>
  )
}
