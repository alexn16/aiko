import { NextRequest, NextResponse } from 'next/server'
import { generateOutreachMessage } from '@/lib/agents/copywriting-agent'
import { getModelConfig } from '@/lib/models/config'
import { enqueueLlmTask } from '@/lib/queue/agent-queue'

export async function POST(request: NextRequest) {
  const { leadId, projectId, agentId, channel } = await request.json()

  const modelConfig = await getModelConfig('copywritingAgent')
  if (!modelConfig) {
    return NextResponse.json({ error: 'Copywriting agent model not configured' }, { status: 400 })
  }

  enqueueLlmTask(() =>
    generateOutreachMessage({
      leadId,
      projectId,
      channel: channel ?? 'email',
      modelConfig,
      agentId,
      qualityModelConfig: modelConfig,
    }).catch(console.error)
  )

  return NextResponse.json({ status: 'started' })
}
