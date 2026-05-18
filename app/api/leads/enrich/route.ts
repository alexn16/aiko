import { NextRequest, NextResponse } from 'next/server'
import { runLeadGenAgent } from '@/lib/agents/leadgen-agent'
import { getModelConfig } from '@/lib/models/config'
import { enqueueBrowserTask } from '@/lib/queue/agent-queue'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  const { leadId, projectId, agentId } = await request.json()

  const modelConfig = await getModelConfig('leadGenAgent')
  if (!modelConfig) {
    return NextResponse.json({ error: 'Lead gen agent model not configured' }, { status: 400 })
  }

  enqueueBrowserTask(() =>
    runLeadGenAgent({ leadId, projectId, agentId, modelConfig }).catch(console.error)
  )

  return NextResponse.json({ status: 'started' })
}
