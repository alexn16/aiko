import { db } from '@/lib/db/client'
import { callAI } from '@/lib/ai/router'
import { createApprovalFromOutput } from '@/lib/approvals'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AgentTaskOutput {
  id: string
  task_id: string | null
  project_id: string | null
  agent_role: string
  output_type: string
  title: string
  content: string
  structured_data: Record<string, unknown>
  status: string
  requires_approval: boolean
  created_at: string
  updated_at: string
}

const APPROVAL_REQUIRED_TYPES = new Set(['outreach_draft', 'approval_item'])

// ── Core functions ─────────────────────────────────────────────────────────────

export async function createTaskOutput(params: {
  task_id?: string | null
  project_id?: string | null
  agent_role?: string
  output_type?: string
  title: string
  content?: string
  structured_data?: Record<string, unknown>
  status?: string
  requires_approval?: boolean
}): Promise<AgentTaskOutput> {
  const output_type = params.output_type ?? 'note'
  const requires_approval = params.requires_approval !== undefined
    ? params.requires_approval
    : APPROVAL_REQUIRED_TYPES.has(output_type)

  const result = await db.query(
    `INSERT INTO agent_task_outputs
       (task_id, project_id, agent_role, output_type, title, content, structured_data, status, requires_approval)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      params.task_id ?? null,
      params.project_id ?? null,
      params.agent_role ?? 'system',
      output_type,
      params.title,
      params.content ?? '',
      JSON.stringify(params.structured_data ?? {}),
      params.status ?? 'draft',
      requires_approval,
    ]
  )
  const output = result.rows[0] as AgentTaskOutput

  // Auto-create approval item when the output requires approval
  if (requires_approval) {
    try {
      await createApprovalFromOutput(output)
    } catch {
      // non-fatal — approval item creation should never block output creation
    }
  }

  return output
}

export async function listTaskOutputs(filters: {
  project_id?: string
  task_id?: string
  output_type?: string
  status?: string
  limit?: number
} = {}): Promise<AgentTaskOutput[]> {
  const conditions: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (filters.project_id) {
    conditions.push(`project_id = $${idx++}`)
    values.push(filters.project_id)
  }
  if (filters.task_id) {
    conditions.push(`task_id = $${idx++}`)
    values.push(filters.task_id)
  }
  if (filters.output_type) {
    conditions.push(`output_type = $${idx++}`)
    values.push(filters.output_type)
  }
  if (filters.status) {
    conditions.push(`status = $${idx++}`)
    values.push(filters.status)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = filters.limit ?? 50

  try {
    const result = await db.query(
      `SELECT * FROM agent_task_outputs ${where} ORDER BY created_at DESC LIMIT ${limit}`,
      values
    )
    return result.rows as AgentTaskOutput[]
  } catch {
    return []
  }
}

export async function getTaskOutputsForTask(task_id: string): Promise<AgentTaskOutput[]> {
  try {
    const result = await db.query(
      `SELECT * FROM agent_task_outputs WHERE task_id = $1 ORDER BY created_at DESC`,
      [task_id]
    )
    return result.rows as AgentTaskOutput[]
  } catch {
    return []
  }
}

export async function updateTaskOutputStatus(id: string, status: string): Promise<AgentTaskOutput | null> {
  try {
    const result = await db.query(
      `UPDATE agent_task_outputs SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [status, id]
    )
    return result.rows[0] as AgentTaskOutput ?? null
  } catch {
    return null
  }
}

export async function updateTaskOutput(id: string, fields: {
  status?: string
  content?: string
  title?: string
}): Promise<AgentTaskOutput | null> {
  const sets: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (fields.status !== undefined) {
    sets.push(`status=$${idx++}`)
    values.push(fields.status)
  }
  if (fields.content !== undefined) {
    sets.push(`content=$${idx++}`)
    values.push(fields.content)
  }
  if (fields.title !== undefined) {
    sets.push(`title=$${idx++}`)
    values.push(fields.title)
  }
  if (sets.length === 0) return null

  sets.push(`updated_at=NOW()`)
  values.push(id)

  try {
    const result = await db.query(
      `UPDATE agent_task_outputs SET ${sets.join(', ')} WHERE id=$${idx} RETURNING *`,
      values
    )
    return result.rows[0] as AgentTaskOutput ?? null
  } catch {
    return null
  }
}

export async function attachOutputToTask(task_id: string, output_id: string): Promise<void> {
  try {
    await db.query(
      `UPDATE agent_tasks
       SET output = jsonb_set(COALESCE(output,'{}'), '{latest_output_id}', to_jsonb($2::text)), updated_at=NOW()
       WHERE id=$1`,
      [task_id, output_id]
    )
  } catch {
    // non-fatal
  }
}

export async function getOutputSummaryForProject(project_id: string): Promise<{
  total: number
  by_status: Record<string, number>
  by_type: Record<string, number>
  pending_approval: AgentTaskOutput[]
  recent: AgentTaskOutput[]
}> {
  try {
    const [allRes, pendingRes, recentRes] = await Promise.all([
      db.query(
        `SELECT status, output_type FROM agent_task_outputs WHERE project_id=$1`,
        [project_id]
      ),
      db.query(
        `SELECT * FROM agent_task_outputs
         WHERE project_id=$1 AND status IN ('draft','ready') AND requires_approval=true
         ORDER BY created_at DESC LIMIT 10`,
        [project_id]
      ),
      db.query(
        `SELECT * FROM agent_task_outputs
         WHERE project_id=$1
         ORDER BY created_at DESC LIMIT 5`,
        [project_id]
      ),
    ])

    const by_status: Record<string, number> = {}
    const by_type: Record<string, number> = {}
    for (const row of allRes.rows) {
      by_status[row.status] = (by_status[row.status] ?? 0) + 1
      by_type[row.output_type] = (by_type[row.output_type] ?? 0) + 1
    }

    return {
      total: allRes.rows.length,
      by_status,
      by_type,
      pending_approval: pendingRes.rows as AgentTaskOutput[],
      recent: recentRes.rows as AgentTaskOutput[],
    }
  } catch {
    return { total: 0, by_status: {}, by_type: {}, pending_approval: [], recent: [] }
  }
}

export async function getOutputSummaryForCompany(): Promise<{
  total: number
  by_status: Record<string, number>
  by_type: Record<string, number>
  pending_approval: AgentTaskOutput[]
  recent: AgentTaskOutput[]
}> {
  try {
    const [allRes, pendingRes, recentRes] = await Promise.all([
      db.query(`SELECT status, output_type FROM agent_task_outputs`),
      db.query(
        `SELECT * FROM agent_task_outputs
         WHERE status IN ('draft','ready') AND requires_approval=true
         ORDER BY created_at DESC LIMIT 10`
      ),
      db.query(
        `SELECT * FROM agent_task_outputs ORDER BY created_at DESC LIMIT 5`
      ),
    ])

    const by_status: Record<string, number> = {}
    const by_type: Record<string, number> = {}
    for (const row of allRes.rows) {
      by_status[row.status] = (by_status[row.status] ?? 0) + 1
      by_type[row.output_type] = (by_type[row.output_type] ?? 0) + 1
    }

    return {
      total: allRes.rows.length,
      by_status,
      by_type,
      pending_approval: pendingRes.rows as AgentTaskOutput[],
      recent: recentRes.rows as AgentTaskOutput[],
    }
  } catch {
    return { total: 0, by_status: {}, by_type: {}, pending_approval: [], recent: [] }
  }
}

// ── AI generation ──────────────────────────────────────────────────────────────

export async function generateOutputForTask(
  task_id: string,
  projectContext?: Record<string, unknown>
): Promise<AgentTaskOutput> {
  // 1. Load task
  const taskRes = await db.query(`SELECT * FROM agent_tasks WHERE id=$1`, [task_id])
  const task = taskRes.rows[0]
  if (!task) throw new Error(`Task not found: ${task_id}`)

  // 2. Load project context
  let projectName = ''
  let projectGoal = ''
  let memoryNotes = ''
  let mapNodes = ''

  if (task.project_id) {
    try {
      const [projRes, memRes, mapRes] = await Promise.all([
        db.query(
          `SELECT p.name, p.goal FROM projects p WHERE p.id=$1`,
          [task.project_id]
        ),
        db.query(`SELECT notes FROM project_memory WHERE project_id=$1`, [task.project_id]),
        db.query(`SELECT nodes FROM project_map WHERE project_id=$1`, [task.project_id]),
      ])
      if (projRes.rows[0]) {
        projectName = projRes.rows[0].name ?? ''
        projectGoal = projRes.rows[0].goal ?? ''
      }
      if (memRes.rows[0]?.notes) {
        memoryNotes = String(memRes.rows[0].notes)
      }
      if (mapRes.rows[0]?.nodes) {
        const nodes = mapRes.rows[0].nodes
        if (Array.isArray(nodes)) {
          mapNodes = nodes.map((n: Record<string, unknown>) => n.label ?? n.id).join(', ')
        }
      }
    } catch {
      // non-fatal
    }
  }

  // 3. Load last 5 internal messages
  let recentMessages = ''
  if (task.project_id) {
    try {
      const msgRes = await db.query(
        `SELECT from_role, to_role, subject FROM agent_messages
         WHERE project_id=$1 ORDER BY created_at DESC LIMIT 5`,
        [task.project_id]
      )
      recentMessages = msgRes.rows
        .map((m: { from_role: string; to_role: string; subject: string }) =>
          `${m.from_role} → ${m.to_role}: ${m.subject}`)
        .join('\n')
    } catch {
      // non-fatal
    }
  }

  // 4. Build system prompt
  const systemPrompt = `You are an AI agent in AÏKO, an AI marketing company. You are generating a deliverable output for an assigned task.

Task: ${task.title}
Task type: ${task.task_type}
Owner role: ${task.owner_role}
Description: ${task.description}

Project: ${projectName ? `${projectName}${projectGoal ? ` — ${projectGoal}` : ''}` : 'Not specified'}
Project memory notes: ${memoryNotes || 'None'}
Project map stages: ${mapNodes || 'None'}

Recent internal messages:
${recentMessages || '(none)'}

Generate an appropriate output deliverable for this task. Return ONLY valid JSON:
{
  "title": "concise deliverable title",
  "output_type": "research_brief|lead_list|outreach_draft|qa_review|report|campaign_proposal|project_map_update|memory_update|approval_item|note",
  "content": "the full text of the deliverable (2-5 paragraphs, professional, specific to the task)",
  "structured_data": {}
}

Rules:
- content must be substantive and specific to the task — not generic filler
- output_type must match the task_type: research→research_brief, strategy→campaign_proposal, lead_generation→lead_list, copywriting→outreach_draft, qa_review→qa_review, report→report, approval_preparation→approval_item, project_map→project_map_update, memory_update→memory_update, client_update→note
- Do NOT include instructions to send emails or make external API calls
- structured_data can be {} unless you have structured data to include`

  const userPrompt = `Generate a deliverable output for this task: "${task.title}" (type: ${task.task_type})`

  // 5. Call AI
  const raw = await callAI({
    role: 'project_manager',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    maxTokens: 1000,
    temperature: 0.6,
  })

  // 6. Parse response
  let parsed: { title?: string; content?: string; output_type?: string; structured_data?: Record<string, unknown> } = {}
  try {
    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    // If parse fails, create a note with raw text
    parsed = {
      title: `Output for: ${task.title}`,
      output_type: 'note',
      content: raw.slice(0, 4000),
      structured_data: {},
    }
  }

  // 7. Create output record
  const output = await createTaskOutput({
    task_id,
    project_id: task.project_id ?? null,
    agent_role: task.owner_role,
    output_type: parsed.output_type ?? 'note',
    title: parsed.title ?? `Output for: ${task.title}`,
    content: parsed.content ?? '',
    structured_data: parsed.structured_data ?? {},
  })

  // 8. Attach output to task
  await attachOutputToTask(task_id, output.id)

  // 9. Move task to review
  try {
    await db.query(
      `UPDATE agent_tasks SET status='review', updated_at=NOW() WHERE id=$1`,
      [task_id]
    )
  } catch {
    // non-fatal
  }

  return output
}
