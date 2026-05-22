import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  try {
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
        SELECT COUNT(*) AS total,
               COUNT(*) FILTER (WHERE status='new') AS new_count,
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
    ])

    if (!project.rows[0]) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({
      project: project.rows[0],
      memory: memory.rows[0] ?? null,
      map: map.rows[0] ?? null,
      agents: agents.rows,
      leads: leads.rows[0],
      activity: activity.rows,
    })
  } catch (err) {
    console.error('[api/projects/[id]]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
