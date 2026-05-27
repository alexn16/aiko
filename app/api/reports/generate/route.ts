import { NextRequest, NextResponse } from 'next/server'
import { runReportingAgent } from '@/lib/agents/reporting-agent'
import { getAnyConnectedProvider } from '@/lib/ai/router'
import { db } from '@/lib/db/client'

export async function POST(request: NextRequest) {
  const { projectId } = await request.json()

  const provider = await getAnyConnectedProvider()
  if (!provider) {
    return NextResponse.json({ error: 'No AI provider connected. Go to Connect AI to add one.' }, { status: 503 })
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

  const report = await runReportingAgent({ projectId, agentId })
  return NextResponse.json({ report })
}
