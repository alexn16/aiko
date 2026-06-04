import { NextRequest, NextResponse } from 'next/server'
import { createExecutionTasksFromPlan } from '@/lib/strategy-execution-planner'

export const dynamic = 'force-dynamic'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await createExecutionTasksFromPlan(params.id)
    return NextResponse.json({
      plan: result.plan,
      tasks_created: result.tasks.length,
      tasks: result.tasks,
    }, { status: 201 })
  } catch (err) {
    console.error('[strategy-execution-plan create-tasks]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
