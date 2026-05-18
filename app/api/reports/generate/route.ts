import { NextRequest, NextResponse } from 'next/server'
import { runReportingAgent } from '@/lib/agents/reporting-agent'
import { getModelConfig } from '@/lib/models/config'
import { db } from '@/lib/db/client'

export async function POST(request: NextRequest) {
  const { projectId } = await request.json()

  const modelConfig = await getModelConfig('reportingAgent')
  if (!modelConfig) {
    return NextResponse.json({ error: 'Reporting agent model not configured' }, { status: 400 })
  }

  // Find or create reporting agent row
  const agentResult = await db.query(
    "SELECT id FROM agents WHERE project_id=$1 AND name='Reporting Agent' LIMIT 1",
    [projectId]
  )
  const agentId = agentResult.rows[0]?.id

  if (!agentId) {
    return NextResponse.json({ error: 'Reporting Agent not found for this project' }, { status: 404 })
  }

  const report = await runReportingAgent({ projectId, agentId, modelConfig })
  return NextResponse.json({ report })
}
