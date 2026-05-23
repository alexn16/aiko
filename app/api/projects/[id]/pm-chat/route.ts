import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { callAI, getProviderForRole, getAnyConnectedProvider } from '@/lib/ai/router'
import { getTaskSummaryForProject } from '@/lib/agents/tasks'

// ── Context builder ────────────────────────────────────────────────────────────

async function buildProjectContext(projectId: string): Promise<{
  project: Record<string, unknown> | null
  pm: Record<string, unknown> | null
  memory: Record<string, unknown> | null
  agents: Record<string, unknown>[]
  recentActivity: Record<string, unknown>[]
  latestReport: Record<string, unknown> | null
  pendingApprovals: number
  task_summary: {
    total: number
    by_status: Record<string, number>
    active_titles: string[]
  }
}> {
  const [projectRes, memRes, agentRes, activityRes, reportRes, approvalRes, taskSummary] = await Promise.all([
    db.query(`
      SELECT p.*, pm.id AS pm_id, pm.name AS pm_name,
             pm.specialty AS pm_specialty, pm.current_focus AS pm_focus
      FROM projects p
      LEFT JOIN project_managers pm ON pm.id = p.assigned_pm_id
      WHERE p.id = $1
    `, [projectId]),
    db.query('SELECT * FROM project_memory WHERE project_id=$1', [projectId]),
    db.query('SELECT name, role, status, current_task FROM agents WHERE project_id=$1 ORDER BY name', [projectId]),
    db.query(`
      SELECT al.action, al.details, al.created_at, a.name AS agent_name
      FROM agent_logs al
      JOIN agents a ON a.id = al.agent_id
      WHERE al.project_id=$1
      ORDER BY al.created_at DESC LIMIT 10
    `, [projectId]),
    db.query(`
      SELECT * FROM project_manager_reports
      WHERE project_id=$1
      ORDER BY created_at DESC LIMIT 1
    `, [projectId]),
    db.query(`
      SELECT COUNT(*) AS n FROM approvals
      WHERE project_id=$1 AND status IN ('pending','quality_passed')
    `, [projectId]),
    getTaskSummaryForProject(projectId),
  ])

  const project = projectRes.rows[0] ?? null
  return {
    project,
    pm: project ? { id: project.pm_id, name: project.pm_name, specialty: project.pm_specialty, focus: project.pm_focus } : null,
    memory: memRes.rows[0] ?? null,
    agents: agentRes.rows,
    recentActivity: activityRes.rows,
    latestReport: reportRes.rows[0] ?? null,
    pendingApprovals: parseInt(approvalRes.rows[0]?.n ?? '0', 10),
    task_summary: {
      total: taskSummary.total,
      by_status: taskSummary.by_status,
      active_titles: taskSummary.active.slice(0, 5).map(t => t.title),
    },
  }
}

// ── System prompt ──────────────────────────────────────────────────────────────

function buildSystemPrompt(ctx: Awaited<ReturnType<typeof buildProjectContext>>): string {
  const pm = ctx.project?.pm_name ?? 'Project Manager'
  const projectName = ctx.project?.name ?? 'this project'
  const specialty = ctx.project?.pm_specialty ?? ''
  const goal = ctx.project?.goal ?? ''
  const targetMarket = ctx.project?.target_market ?? ''
  const valueProp = ctx.project?.value_prop ?? ''

  const memNotes = ctx.memory?.notes ?? ''
  const nextSteps: string[] = Array.isArray(ctx.memory?.next_steps) ? ctx.memory.next_steps as string[] : []
  const blockers: string[] = Array.isArray(ctx.memory?.blockers) ? ctx.memory.blockers as string[] : []

  const agentList = ctx.agents.map((a) => `${a.name} (${a.status ?? 'idle'})`).join(', ')
  const pendingStr = ctx.pendingApprovals > 0 ? `${ctx.pendingApprovals} approval(s) pending` : 'no pending approvals'
  const taskStr = ctx.task_summary.total > 0
    ? `${ctx.task_summary.total} tasks — ${JSON.stringify(ctx.task_summary.by_status)}${ctx.task_summary.active_titles.length > 0 ? `; active: ${ctx.task_summary.active_titles.join(', ')}` : ''}`
    : 'no tasks yet'

  return `You are ${pm}, Project Manager for ${projectName} at AÏKO, an AI marketing company.

Your personality: direct, operational, focused on execution. You speak in first person. You know this project deeply. You do not mix up other projects.

Project details:
- Name: ${projectName}
- Goal: ${goal || 'Not defined yet'}
- Target market: ${targetMarket || 'Not defined yet'}
- Value proposition: ${valueProp || 'Not defined yet'}
- Your specialty: ${specialty}

Project memory:
${memNotes ? `Notes: ${memNotes}` : 'No notes yet.'}
${nextSteps.length > 0 ? `Next steps: ${nextSteps.join('; ')}` : ''}
${blockers.length > 0 ? `Blockers: ${blockers.join('; ')}` : ''}

Agents available: ${agentList || 'None assigned yet'}
Approvals: ${pendingStr}
Tasks: ${taskStr}

Your responsibilities:
- Manage marketing execution for ${projectName} only
- Coordinate agents: Research, Lead Gen, Copywriting, Quality, Outreach, Strategy, Reporting
- Keep project memory updated when priorities or status change
- Recommend next actions clearly
- Never send external messages without explicit client approval
- Escalate to CEO when cross-project coordination is needed

Speak naturally and operationally. 2-5 sentences per message. Mention specific agents when coordinating work. If you need more information, ask. Never output raw JSON or technical field names in your reply.`
}

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const res = await db.query(
      `SELECT * FROM project_manager_chats WHERE project_id=$1 ORDER BY created_at ASC`,
      [params.id]
    )
    return NextResponse.json({ messages: res.rows })
  } catch (err) {
    console.error('[pm-chat GET]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ── POST ───────────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { message } = await req.json()
    if (!message?.trim()) {
      return NextResponse.json({ error: 'No message provided' }, { status: 400 })
    }

    // Check provider
    const provider = await getProviderForRole('project_manager')
      ?? await getProviderForRole('ceo')
      ?? await getAnyConnectedProvider()

    if (!provider) {
      return NextResponse.json(
        { error: 'No AI provider connected. Go to Connect AI to add one.' },
        { status: 503 }
      )
    }

    // Load project context
    const ctx = await buildProjectContext(params.id)
    if (!ctx.project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const pmId: string | null = ctx.pm?.id ? String(ctx.pm.id) : null

    // Save user message
    await db.query(
      `INSERT INTO project_manager_chats (project_id, project_manager_id, role, content)
       VALUES ($1, $2, 'user', $3)`,
      [params.id, pmId, message.trim()]
    )

    // Fetch chat history for context (last 20 messages)
    const histRes = await db.query(
      `SELECT role, content FROM project_manager_chats
       WHERE project_id=$1
       ORDER BY created_at DESC LIMIT 20`,
      [params.id]
    )
    const history = histRes.rows.reverse().map((r: { role: string; content: string }) => ({
      role: r.role === 'project_manager' ? 'assistant' : 'user',
      content: r.content,
    })) as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>

    // Build system prompt
    const systemPrompt = buildSystemPrompt(ctx)

    // Call AI
    const response = await callAI({
      role: 'project_manager',
      messages: [
        { role: 'system', content: systemPrompt },
        ...history,
      ],
      maxTokens: 600,
      temperature: 0.5,
    })

    // Save PM response
    await db.query(
      `INSERT INTO project_manager_chats (project_id, project_manager_id, role, content)
       VALUES ($1, $2, 'project_manager', $3)`,
      [params.id, pmId, response]
    )

    return NextResponse.json({ response, pm_name: ctx.project.pm_name ?? 'PM' })
  } catch (err) {
    console.error('[pm-chat POST]', err)
    const msg = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
