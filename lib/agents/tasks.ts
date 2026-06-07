import { db } from '@/lib/db/client'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AgentTask {
  id: string
  project_id: string | null
  owner_agent_id: string | null
  owner_role: string
  assigned_by_agent_id: string | null
  assigned_by_role: string
  source_message_id: string | null
  title: string
  description: string
  status: string
  priority: string
  task_type: string
  output: Record<string, unknown>
  due_at: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

// ── Internal helpers ───────────────────────────────────────────────────────────

/**
 * Clean a task title coming from an agent message subject.
 * Strips raw URL/query artifacts and truncates to a readable length.
 */
function cleanTaskTitle(subject: string): string {
  return subject
    .replace(/^(Blocked|Completed|Failed):\s*/i, '')  // strip status prefix
    .replace(/https?:\/\/\S+/g, m => { try { return new URL(m).hostname } catch { return m.slice(0, 40) } })
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140)
}

function inferTaskType(subject: string, content: string): string {
  const text = `${subject} ${content}`.toLowerCase()
  if (/research/.test(text)) return 'research'
  if (/strategy|strategic|direction|proposal|plan/.test(text)) return 'strategy'
  if (/lead|leads|enrich/.test(text)) return 'lead_generation'
  if (/copy|draft|write|outreach message/.test(text)) return 'copywriting'
  if (/review|qa|quality/.test(text)) return 'qa_review'
  if (/outreach|send|campaign/.test(text)) return 'outreach_preparation'
  if (/report|summary|update/.test(text)) return 'report'
  if (/approval|approve/.test(text)) return 'approval_preparation'
  if (/map|pipeline/.test(text)) return 'project_map'
  if (/memory/.test(text)) return 'memory_update'
  if (/client/.test(text)) return 'client_update'
  return 'project_map'
}

// ── Core functions ─────────────────────────────────────────────────────────────

export async function createAgentTask(params: {
  project_id?: string
  owner_role: string
  assigned_by_role?: string
  source_message_id?: string
  title: string
  description?: string
  status?: string
  priority?: string
  task_type?: string
}): Promise<AgentTask> {
  const result = await db.query(
    `INSERT INTO agent_tasks
       (project_id, owner_role, assigned_by_role, source_message_id,
        title, description, status, priority, task_type)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      params.project_id ?? null,
      params.owner_role,
      params.assigned_by_role ?? 'system',
      params.source_message_id ?? null,
      params.title,
      params.description ?? '',
      params.status ?? 'planned',
      params.priority ?? 'normal',
      params.task_type ?? 'project_map',
    ]
  )
  return result.rows[0] as AgentTask
}

export async function listAgentTasks(filters: {
  project_id?: string
  owner_role?: string
  status?: string
  task_type?: string
  priority?: string
  limit?: number
} = {}): Promise<AgentTask[]> {
  const conditions: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (filters.project_id) {
    conditions.push(`project_id = $${idx++}`)
    values.push(filters.project_id)
  }
  if (filters.owner_role) {
    conditions.push(`owner_role = $${idx++}`)
    values.push(filters.owner_role)
  }
  if (filters.status) {
    conditions.push(`status = $${idx++}`)
    values.push(filters.status)
  }
  if (filters.task_type) {
    conditions.push(`task_type = $${idx++}`)
    values.push(filters.task_type)
  }
  if (filters.priority) {
    conditions.push(`priority = $${idx++}`)
    values.push(filters.priority)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = filters.limit ?? 100

  const result = await db.query(
    `SELECT * FROM agent_tasks ${where} ORDER BY created_at DESC LIMIT ${limit}`,
    values
  )
  return result.rows as AgentTask[]
}

export async function updateAgentTaskStatus(id: string, status: string): Promise<void> {
  await db.query(
    `UPDATE agent_tasks SET status=$1, updated_at=NOW() WHERE id=$2`,
    [status, id]
  )
}

export async function completeAgentTask(id: string, output?: Record<string, unknown>): Promise<void> {
  await db.query(
    `UPDATE agent_tasks
     SET status='completed', completed_at=NOW(), output=$1, updated_at=NOW()
     WHERE id=$2`,
    [JSON.stringify(output ?? {}), id]
  )
}

export async function createTaskFromAgentMessage(message: {
  id: string
  project_id?: string | null
  from_role: string
  to_role: string
  message_type: string
  subject: string
  content: string
}): Promise<AgentTask | null> {
  const { id, project_id, from_role, to_role, message_type, subject, content } = message

  if (message_type === 'report' || message_type === 'update') {
    return null
  }

  let status: string
  let owner_role: string
  let assigned_by_role: string
  let task_type: string

  if (message_type === 'instruction') {
    status = 'planned'
    owner_role = to_role
    assigned_by_role = from_role
    task_type = inferTaskType(subject, content)
  } else if (message_type === 'handoff') {
    status = 'planned'
    owner_role = to_role
    assigned_by_role = from_role
    task_type = inferTaskType(subject, content)
  } else if (message_type === 'approval_request') {
    status = 'review'
    owner_role = to_role
    assigned_by_role = from_role
    task_type = 'approval_preparation'
  } else if (message_type === 'blocker') {
    status = 'blocked'
    owner_role = from_role
    assigned_by_role = 'system'
    task_type = inferTaskType(subject, content)
  } else {
    return null
  }

  return createAgentTask({
    project_id: project_id ?? undefined,
    owner_role,
    assigned_by_role,
    source_message_id: id,
    title: cleanTaskTitle(subject),
    description: content.slice(0, 200),
    status,
    task_type,
  })
}

// ── Summary helpers ────────────────────────────────────────────────────────────

function buildSummary(tasks: AgentTask[]) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const by_status: Record<string, number> = {}
  for (const t of tasks) {
    by_status[t.status] = (by_status[t.status] ?? 0) + 1
  }

  return {
    total: tasks.length,
    by_status,
    active: tasks.filter(t => t.status === 'in_progress'),
    blocked: tasks.filter(t => t.status === 'blocked'),
    review: tasks.filter(t => t.status === 'review'),
    completed_today: tasks.filter(t => {
      if (!t.completed_at) return false
      return new Date(t.completed_at) >= today
    }),
  }
}

export async function getTaskSummaryForProject(project_id: string): Promise<{
  total: number
  by_status: Record<string, number>
  active: AgentTask[]
  blocked: AgentTask[]
  review: AgentTask[]
  completed_today: AgentTask[]
}> {
  try {
    const tasks = await listAgentTasks({ project_id, limit: 500 })
    return buildSummary(tasks)
  } catch {
    return { total: 0, by_status: {}, active: [], blocked: [], review: [], completed_today: [] }
  }
}

export async function getTaskSummaryForCompany(): Promise<{
  total: number
  by_status: Record<string, number>
  active: AgentTask[]
  blocked: AgentTask[]
  review: AgentTask[]
  completed_today: AgentTask[]
}> {
  try {
    const tasks = await listAgentTasks({ limit: 1000 })
    return buildSummary(tasks)
  } catch {
    return { total: 0, by_status: {}, active: [], blocked: [], review: [], completed_today: [] }
  }
}
