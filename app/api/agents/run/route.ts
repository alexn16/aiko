import { NextRequest, NextResponse } from 'next/server'
import { orchestrate } from '@/lib/agents/orchestrator'
import { enqueueBrowserTask, enqueueLlmTask } from '@/lib/queue/agent-queue'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  const { agentId, projectId, instruction } = await request.json()

  if (!agentId || !projectId || !instruction) {
    return NextResponse.json({ error: 'agentId, projectId, and instruction are required' }, { status: 400 })
  }

  // Run async — return immediately so the UI doesn't block
  enqueueBrowserTask(() =>
    orchestrate({ agentId, projectId, instruction }).catch(console.error)
  )

  return NextResponse.json({ status: 'started' })
}
