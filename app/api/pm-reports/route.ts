import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'

/**
 * GET /api/pm-reports
 * Returns the latest PM report for each active project.
 */
export async function GET() {
  try {
    const result = await db.query(`
      SELECT DISTINCT ON (r.project_id)
        r.*,
        pm.name  AS pm_name,
        p.name   AS project_name
      FROM project_manager_reports r
      LEFT JOIN project_managers pm ON pm.id = r.project_manager_id
      JOIN      projects         p  ON p.id  = r.project_id
      WHERE p.active = true
      ORDER BY r.project_id, r.created_at DESC
    `)
    return NextResponse.json({ reports: result.rows })
  } catch (err) {
    console.error('[api/pm-reports GET]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
