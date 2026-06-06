import { NextRequest, NextResponse } from 'next/server'
import { createAgentTask } from '@/lib/agents/tasks'

export const dynamic = 'force-dynamic'

function ownerRoleFor(text: string, fallback?: string | null): string {
  if (fallback && /^[a-z_]+$/i.test(fallback)) return fallback
  const lower = text.toLowerCase()
  if (/copy|draft|write|content/.test(lower)) return 'copywriting_agent'
  if (/research|validate|web operator|browser/.test(lower)) return 'marketing_agent'
  if (/approve|decision|owner/.test(lower)) return 'owner'
  if (/strategy|plan|position|persona|offer/.test(lower)) return 'marketing_agent'
  return 'marketing_agent'
}

function textFromTaskItem(item: unknown): { title: string; description: string; owner_role?: string | null } | null {
  if (typeof item === 'string') {
    const title = item.trim()
    return title ? { title, description: title } : null
  }
  if (!item || typeof item !== 'object') return null
  const record = item as Record<string, unknown>
  const title = String(record.title ?? record.action ?? record.next_action ?? record.day ?? record.description ?? '').trim()
  const description = String(record.description ?? record.action ?? record.next_action ?? title).trim()
  if (!title && !description) return null
  return {
    title: title || description.slice(0, 90),
    description,
    owner_role: record.owner_role ? String(record.owner_role) : record.owner ? String(record.owner) : null,
  }
}

function candidateTaskItems(output: Record<string, unknown>): unknown[] {
  const structured = output.structured_data && typeof output.structured_data === 'object'
    ? output.structured_data as Record<string, unknown>
    : {}
  const candidates = [
    structured.day_by_day_plan,
    structured.next_actions,
    structured.risks,
    structured.content_assets,
    output.next_actions,
  ]
  for (const value of candidates) {
    if (Array.isArray(value) && value.length > 0) return value
  }
  return []
}

export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Valid JSON body is required.' }, { status: 400 })
    }
    const output = body.output && typeof body.output === 'object' ? body.output as Record<string, unknown> : null
    if (!output) {
      return NextResponse.json({ error: 'output is required' }, { status: 400 })
    }

    const projectId = typeof body.project_id === 'string' ? body.project_id : null
    const items = candidateTaskItems(output).map(textFromTaskItem).filter(Boolean).slice(0, 10) as Array<{ title: string; description: string; owner_role?: string | null }>
    if (items.length === 0) {
      return NextResponse.json({
        tasks: [],
        tasks_created: 0,
        tasks_url: '/tasks',
        project_tasks_url: projectId ? `/projects/${projectId}` : null,
        message: 'No task-ready next actions were found.',
        created_web_operator_action: false,
        external_action_executed: false,
      })
    }

    const skillId = String(output.skill_id ?? 'ai_skill_output')
    const tasks = []
    for (const item of items) {
      const owner_role = ownerRoleFor(`${item.title} ${item.description}`, item.owner_role)
      const task = await createAgentTask({
        project_id: projectId ?? undefined,
        owner_role,
        assigned_by_role: 'ai_skill',
        title: item.title.slice(0, 140),
        description: `${item.description}\n\nSource: ${skillId}. Internal task only; no external action was executed.`,
        status: 'planned',
        priority: 'normal',
        task_type: /research|validate|web operator/i.test(item.description) ? 'research' : 'strategy',
      })
      tasks.push(task)
    }

    return NextResponse.json({
      tasks,
      tasks_created: tasks.length,
      tasks_url: '/tasks',
      project_tasks_url: projectId ? `/projects/${projectId}` : null,
      created_web_operator_action: false,
      external_action_executed: false,
    }, { status: 201 })
  } catch (err) {
    console.error('[api/ai-skills/create-tasks POST]', err)
    return NextResponse.json({ error: 'Could not create internal tasks.' }, { status: 500 })
  }
}
