export const dynamic = 'force-dynamic'

import { db } from '@/lib/db/client'
import Link from 'next/link'

async function getProjects() {
  const result = await db.query(`
    SELECT p.id, p.name, p.description, p.goal, p.active, p.created_at,
           pm.name AS pm_name, pm.specialty AS pm_specialty,
           COUNT(DISTINCT l.id) AS lead_count,
           COUNT(DISTINCT a.id) FILTER (WHERE a.status NOT IN ('idle','paused')) AS active_agents
    FROM projects p
    LEFT JOIN project_managers pm ON pm.id = p.assigned_pm_id
    LEFT JOIN leads l ON l.project_id = p.id
    LEFT JOIN agents a ON a.project_id = p.id
    WHERE p.active = true
    GROUP BY p.id, pm.name, pm.specialty
    ORDER BY p.created_at DESC
  `)
  return result.rows
}

export default async function ProjectsPage() {
  const projects = await getProjects()

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.03em', margin: 0 }}>
              Projects
            </h1>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: '4px 0 0' }}>
              {projects.length} active project{projects.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Link href="/ceo" style={{
            background: '#0f172a', color: '#ffffff', textDecoration: 'none',
            fontSize: 12, fontWeight: 500, padding: '7px 14px', borderRadius: 8,
            letterSpacing: '-0.01em',
          }}>
            + New project via CEO
          </Link>
        </div>
      </div>

      {projects.length === 0 ? (
        <div style={{
          padding: '64px 24px', textAlign: 'center',
          background: '#ffffff', borderRadius: 12,
          border: '1px solid #f1f5f9',
        }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>◆</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>No projects yet</div>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 16px' }}>
            Tell the CEO to create a project and assign a Project Manager.
          </p>
          <Link href="/ceo" style={{
            background: '#0f172a', color: '#ffffff', textDecoration: 'none',
            fontSize: 12, fontWeight: 500, padding: '8px 16px', borderRadius: 8,
          }}>
            Open CEO
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {projects.map((p: {
            id: string; name: string; description: string | null; goal: string | null;
            pm_name: string | null; pm_specialty: string | null;
            lead_count: number; active_agents: number; created_at: string;
          }) => (
            <Link key={p.id} href={`/projects/${p.id}`} style={{ textDecoration: 'none' }}>
              <div style={{
                background: '#ffffff', borderRadius: 10,
                border: '1px solid #f1f5f9',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                padding: '16px 20px',
                display: 'flex', alignItems: 'center', gap: 20,
                transition: 'box-shadow 0.15s, border-color 0.15s',
              }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'
                  ;(e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'
                  ;(e.currentTarget as HTMLElement).style.borderColor = '#f1f5f9'
                }}
              >
                {/* Project initial */}
                <div style={{
                  width: 40, height: 40, borderRadius: 10, background: '#f1f5f9',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, fontWeight: 700, color: '#0f172a', flexShrink: 0,
                }}>
                  {p.name.charAt(0).toUpperCase()}
                </div>

                {/* Main info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>
                    {p.name}
                  </div>
                  {p.goal && (
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 2, lineHeight: 1.4 }}>
                      {p.goal}
                    </div>
                  )}
                  {!p.goal && p.description && (
                    <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.4 }}>
                      {p.description}
                    </div>
                  )}
                </div>

                {/* PM */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {p.pm_name ? (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#0f172a' }}>{p.pm_name}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>{p.pm_specialty}</div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: '#cbd5e1' }}>No PM</div>
                  )}
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 18, color: '#0f172a', lineHeight: 1 }}>
                      {p.lead_count}
                    </div>
                    <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>leads</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 18, color: p.active_agents > 0 ? '#10b981' : '#cbd5e1', lineHeight: 1 }}>
                      {p.active_agents}
                    </div>
                    <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>active</div>
                  </div>
                </div>

                <div style={{ color: '#cbd5e1', fontSize: 16 }}>›</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
