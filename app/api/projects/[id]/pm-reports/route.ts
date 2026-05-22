import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { runProjectManagerReportAgent } from '@/lib/agents/project-manager-report-agent'
import { getAllModelConfigs } from '@/lib/models/config'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await db.query(`
      SELECT r.*, pm.name AS pm_name
      FROM project_manager_reports r
      LEFT JOIN project_managers pm ON pm.id = r.project_manager_id
      WHERE r.project_id = $1
      ORDER BY r.created_at DESC
      LIMIT 10
    `, [params.id])
    return NextResponse.json({ reports: result.rows })
  } catch (err) {
    console.error('[api/projects/[id]/pm-reports GET]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const configs = await getAllModelConfigs()
    const modelConfig =
      configs['projectManagerAgent'] ??
      configs['ceoAgent'] ??
      configs['researchAgent'] ??
      Object.values(configs)[0]

    if (!modelConfig) {
      return NextResponse.json(
        { error: 'No model configured. Add a model in Settings.' },
        { status: 503 }
      )
    }

    const report = await runProjectManagerReportAgent(params.id, modelConfig)
    return NextResponse.json({ report })
  } catch (err) {
    console.error('[api/projects/[id]/pm-reports POST]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
