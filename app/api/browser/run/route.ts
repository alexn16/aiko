import { NextRequest, NextResponse } from 'next/server'
import { runBrowserAgent } from '@/lib/agents/browser-agent'
import { getModelConfig } from '@/lib/models/config'
import { enqueueBrowserTask } from '@/lib/queue/agent-queue'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  const { agentId, projectId, instruction } = await request.json()

  const modelConfig = await getModelConfig('browserAgent')
  if (!modelConfig) {
    return NextResponse.json({ error: 'Browser agent model not configured' }, { status: 400 })
  }

  enqueueBrowserTask(() =>
    runBrowserAgent({ instruction, agentId, projectId, modelConfig }).catch(console.error)
  )

  return NextResponse.json({ status: 'started' })
}
