import { NextRequest, NextResponse } from 'next/server'
import { runResearchAgent } from '@/lib/agents/research-agent'
import { getModelConfig } from '@/lib/models/config'
import { enqueueBrowserTask } from '@/lib/queue/agent-queue'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  const { url, projectId, agentId, instruction } = await request.json()

  const modelConfig = await getModelConfig('researchAgent')
  if (!modelConfig) {
    return NextResponse.json({ error: 'Research agent model not configured' }, { status: 400 })
  }

  const task = url
    ? `Visit ${url} and extract all leads you find. ${instruction ?? ''}`
    : (instruction ?? 'Find leads for this project')

  enqueueBrowserTask(() =>
    runResearchAgent({ instruction: task, projectId, agentId, modelConfig }).catch(console.error)
  )

  return NextResponse.json({ status: 'started' })
}
