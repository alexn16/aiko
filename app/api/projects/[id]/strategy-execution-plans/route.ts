import { NextRequest, NextResponse } from 'next/server'
import {
  generateStrategyExecutionPlan,
  generateStrategyExecutionPlanFromBrief,
  generateStrategyExecutionPlanFromText,
  listStrategyExecutionPlans,
  createExecutionTasksFromPlan,
} from '@/lib/strategy-execution-planner'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const plans = await listStrategyExecutionPlans(params.id)
    return NextResponse.json({ plans })
  } catch (err) {
    console.error('[strategy-execution-plans GET]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json().catch(() => ({}))
    const createTasks = Boolean(body.create_tasks)
    const createMissingCapabilityProposals = body.create_missing_capability_proposals !== false

    let planResult
    if (typeof body.strategy_text === 'string' && body.strategy_text.trim()) {
      planResult = await generateStrategyExecutionPlanFromText({
        projectId: params.id,
        strategyText: body.strategy_text.trim(),
        strategyBriefId: typeof body.strategy_brief_id === 'string' ? body.strategy_brief_id : null,
        createdByRole: 'CEO',
        createMissingCapabilityProposals,
      })
    } else if (typeof body.strategy_brief_id === 'string' && body.strategy_brief_id.trim()) {
      const plan = await generateStrategyExecutionPlanFromBrief(params.id, body.strategy_brief_id.trim())
      planResult = { plan, proposals: [] }
    } else {
      const plan = await generateStrategyExecutionPlan(params.id)
      planResult = { plan, proposals: [] }
    }

    let tasksCreated = 0
    if (createTasks) {
      const taskResult = await createExecutionTasksFromPlan(planResult.plan.id)
      tasksCreated = taskResult.tasks.length
      planResult.plan = taskResult.plan
    }

    return NextResponse.json({
      plan: planResult.plan,
      missing_capabilities: planResult.plan.missing_capabilities,
      proposals: planResult.proposals,
      tasks_created: tasksCreated,
      ready_to_execute: planResult.plan.missing_capabilities.length === 0,
    }, { status: 201 })
  } catch (err) {
    console.error('[strategy-execution-plans POST]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
