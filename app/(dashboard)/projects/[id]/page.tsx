export const dynamic = 'force-dynamic'

import { db } from '@/lib/db/client'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ProjectWorkspaceTabs } from '@/components/projects/ProjectWorkspaceTabs'

async function getProjectData(id: string) {
  const [project, memory, agents, leads, activity, providerCheck] = await Promise.all([
    db.query(`
      SELECT p.*, pm.id AS pm_id, pm.name AS pm_name,
             pm.specialty AS pm_specialty, pm.current_focus AS pm_focus
      FROM projects p
      LEFT JOIN project_managers pm ON pm.id = p.assigned_pm_id
      WHERE p.id = $1
    `, [id]),
    db.query('SELECT * FROM project_memory WHERE project_id=$1', [id]),
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
      ORDER BY al.created_at DESC LIMIT 30
    `, [id]),
    db.query(`SELECT COUNT(*) AS n FROM provider_connections WHERE status='connected'`).catch(() => ({ rows: [{ n: '0' }] })),
  ])

  if (!project.rows[0]) return null

  return {
    project: project.rows[0],
    memory: memory.rows[0] ?? null,
    agents: agents.rows,
    leads: leads.rows[0],
    activity: activity.rows,
    hasProvider: parseInt(providerCheck.rows[0]?.n ?? '0', 10) > 0,
  }
}

export default async function ProjectWorkspacePage({ params }: { params: { id: string } }) {
  const data = await getProjectData(params.id)
  if (!data) notFound()

  const { project, memory, agents, leads, activity, hasProvider } = data

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        padding: '16px 32px 14px', flexShrink: 0,
        borderBottom: '1px solid #f1f5f9', background: '#ffffff',
      }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Link href="/ceo" style={{ fontSize: 11, color: '#94a3b8', textDecoration: 'none' }}>CEO</Link>
          <span style={{ fontSize: 11, color: '#cbd5e1' }}>›</span>
          <Link href="/projects" style={{ fontSize: 11, color: '#94a3b8', textDecoration: 'none' }}>Projects</Link>
          <span style={{ fontSize: 11, color: '#cbd5e1' }}>›</span>
          <span style={{ fontSize: 11, color: '#64748b' }}>{project.name}</span>
        </div>

        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.03em', margin: 0 }}>
              {project.name}
            </h1>
            {project.goal && (
              <p style={{ fontSize: 12, color: '#64748b', margin: '3px 0 0', lineHeight: 1.5 }}>
                {project.goal}
              </p>
            )}
          </div>

          {/* PM badge */}
          {project.pm_name ? (
            <div style={{
              padding: '7px 12px', background: '#f8fafc', borderRadius: 8,
              border: '1px solid #f1f5f9', textAlign: 'right', flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%', background: '#6366f1',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, color: '#ffffff', fontWeight: 700,
              }}>
                {project.pm_name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{project.pm_name}</div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>{project.pm_specialty}</div>
              </div>
            </div>
          ) : (
            <Link href="/ceo" style={{
              padding: '7px 12px', background: '#fef2f2', borderRadius: 8,
              border: '1px solid #fecaca', fontSize: 11, color: '#ef4444',
              textDecoration: 'none', flexShrink: 0,
            }}>
              No PM assigned — assign via CEO Chat →
            </Link>
          )}
        </div>
      </div>

      {/* ── Tabbed workspace ────────────────────────────────────────────────── */}
      <ProjectWorkspaceTabs
        project={project}
        memory={memory}
        agents={agents}
        leads={leads}
        activity={activity}
        hasProvider={hasProvider}
      />
    </div>
  )
}
