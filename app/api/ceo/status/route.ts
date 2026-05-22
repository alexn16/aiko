import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'

export async function GET() {
  try {
    const [projects, pms, approvals, leads, agents] = await Promise.all([
      db.query(`
        SELECT p.id, p.name, p.active, p.goal, p.created_at,
               pm.name AS pm_name, pm.status AS pm_status, pm.current_focus
        FROM projects p
        LEFT JOIN project_managers pm ON pm.id = p.assigned_pm_id
        WHERE p.active = true
        ORDER BY p.created_at DESC
      `),
      db.query('SELECT id, name, specialty, status, current_focus FROM project_managers ORDER BY name'),
      db.query("SELECT COUNT(*) AS n FROM approvals WHERE status IN ('pending','quality_passed')"),
      db.query('SELECT COUNT(*) AS n FROM leads'),
      db.query("SELECT COUNT(*) AS n FROM agents WHERE status NOT IN ('idle','paused')"),
    ])

    return NextResponse.json({
      projects: projects.rows,
      project_managers: pms.rows,
      pending_approvals: parseInt(approvals.rows[0]?.n ?? '0', 10),
      total_leads: parseInt(leads.rows[0]?.n ?? '0', 10),
      active_agents: parseInt(agents.rows[0]?.n ?? '0', 10),
    })
  } catch (err) {
    console.error('[api/ceo/status]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
