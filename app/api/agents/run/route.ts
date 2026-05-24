import { NextRequest, NextResponse } from 'next/server'
import { orchestrate } from '@/lib/agents/orchestrator'
import { enqueueBrowserTask, enqueueLlmTask } from '@/lib/queue/agent-queue'
import { canPerformAction } from '@/lib/operating-mode'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  const { agentId, projectId, instruction } = await request.json()

  if (!agentId || !projectId || !instruction) {
    return NextResponse.json({ error: 'agentId, projectId, and instruction are required' }, { status: 400 })
  }

  // Operating mode check — running agents that may browse requires auto_approval or above
  const modeCheck = await canPerformAction('browse_web', { project_id: projectId })
  if (!modeCheck.allowed) {
    return NextResponse.json(
      { error: modeCheck.reason, mode: modeCheck.mode, paused: modeCheck.paused },
      { status: 403 }
    )
  }

  // Run async — return immediately so the UI doesn't block
  enqueueBrowserTask(() =>
    orchestrate({ agentId, projectId, instruction }).catch(console.error)
  )

  return NextResponse.json({ status: 'started' })
}
