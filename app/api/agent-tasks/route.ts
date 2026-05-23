import { NextRequest, NextResponse } from 'next/server'
import { createAgentTask, listAgentTasks } from '@/lib/agents/tasks'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const s = req.nextUrl.searchParams
    const tasks = await listAgentTasks({
      project_id: s.get('project_id') ?? undefined,
      owner_role: s.get('owner_role') ?? undefined,
      status: s.get('status') ?? undefined,
      task_type: s.get('task_type') ?? undefined,
      priority: s.get('priority') ?? undefined,
      limit: s.get('limit') ? parseInt(s.get('limit')!, 10) : undefined,
    })
    return NextResponse.json({ tasks })
  } catch (err) {
    console.error('[api/agent-tasks GET]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.owner_role || !body.title) {
      return NextResponse.json({ error: 'owner_role and title are required' }, { status: 400 })
    }
    const task = await createAgentTask(body)
    return NextResponse.json({ task }, { status: 201 })
  } catch (err) {
    console.error('[api/agent-tasks POST]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
