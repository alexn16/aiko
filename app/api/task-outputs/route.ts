import { NextRequest, NextResponse } from 'next/server'
import { listTaskOutputs, createTaskOutput } from '@/lib/agents/task-outputs'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const filters: {
      project_id?: string
      task_id?: string
      output_type?: string
      status?: string
      limit?: number
    } = {}

    const project_id = searchParams.get('project_id')
    const task_id = searchParams.get('task_id')
    const output_type = searchParams.get('output_type')
    const status = searchParams.get('status')
    const limit = searchParams.get('limit')

    if (project_id) filters.project_id = project_id
    if (task_id) filters.task_id = task_id
    if (output_type) filters.output_type = output_type
    if (status) filters.status = status
    if (limit) filters.limit = parseInt(limit, 10)

    const outputs = await listTaskOutputs(filters)
    return NextResponse.json({ outputs })
  } catch (err) {
    console.error('[api/task-outputs GET]', err)
    return NextResponse.json({ outputs: [] })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }
    const output = await createTaskOutput(body)
    return NextResponse.json({ output }, { status: 201 })
  } catch (err) {
    console.error('[api/task-outputs POST]', err)
    const msg = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
