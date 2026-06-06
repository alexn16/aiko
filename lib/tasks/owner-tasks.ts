import { db } from '@/lib/db/client'

export type OwnerTaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done' | 'archived'

export type OwnerTask = {
  id: string
  project_id: string | null
  project_name: string | null
  owner_role: string
  assigned_by_role: string
  title: string
  description: string
  status: OwnerTaskStatus
  raw_status: string
  priority: string
  task_type: string
  source: string
  assigned_agent_name: string | null
  assigned_agent_id: string | null
  output_summary: string | null
  output_file_id: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export function toOwnerTaskStatus(status: string): OwnerTaskStatus {
  if (status === 'completed' || status === 'done') return 'done'
  if (status === 'in_progress' || status === 'working' || status === 'assigned') return 'in_progress'
  if (status === 'blocked' || status === 'failed') return 'blocked'
  if (status === 'archived') return 'archived'
  return 'todo'
}

export function toAgentTaskStatus(status: string): string {
  if (status === 'todo') return 'planned'
  if (status === 'done') return 'completed'
  if (status === 'in_progress') return 'in_progress'
  if (status === 'blocked') return 'blocked'
  if (status === 'archived') return 'archived'
  return status
}

export function sourceLabel(task: { assigned_by_role?: string | null; task_type?: string | null }): string {
  if (task.assigned_by_role === 'ai_skill') return 'AI skill'
  if (task.assigned_by_role === 'strategy_execution_planner') return 'Strategy plan'
  if (task.task_type?.includes('strategy')) return 'Strategy plan'
  return task.assigned_by_role?.replace(/_/g, ' ') || 'Manual'
}

export function mapOwnerTask(row: Record<string, unknown>): OwnerTask {
  const rawStatus = String(row.status ?? 'planned')
  const output = parseTaskOutput(row.output)
  return {
    id: String(row.id),
    project_id: row.project_id ? String(row.project_id) : null,
    project_name: row.project_name ? String(row.project_name) : null,
    owner_role: String(row.owner_role ?? 'marketing_agent'),
    assigned_by_role: String(row.assigned_by_role ?? 'system'),
    title: String(row.title ?? ''),
    description: String(row.description ?? ''),
    status: toOwnerTaskStatus(rawStatus),
    raw_status: rawStatus,
    priority: String(row.priority ?? 'normal'),
    task_type: String(row.task_type ?? 'strategy'),
    source: sourceLabel({
      assigned_by_role: row.assigned_by_role ? String(row.assigned_by_role) : null,
      task_type: row.task_type ? String(row.task_type) : null,
    }),
    assigned_agent_name: stringOrNull(output.assigned_agent_name),
    assigned_agent_id: stringOrNull(output.assigned_agent_id ?? row.owner_agent_id),
    output_summary: stringOrNull(output.output_summary),
    output_file_id: stringOrNull(output.output_file_id),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    completed_at: row.completed_at ? String(row.completed_at) : null,
  }
}

function parseTaskOutput(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
    } catch {
      return {}
    }
  }
  return {}
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

export async function listOwnerTasks(filters: {
  project_id?: string | null
  owner_role?: string | null
  status?: string | null
  active?: boolean
  limit?: number
} = {}): Promise<OwnerTask[]> {
  const conditions: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (filters.project_id) {
    conditions.push(`t.project_id = $${idx++}`)
    values.push(filters.project_id)
  }
  if (filters.owner_role) {
    conditions.push(`t.owner_role = $${idx++}`)
    values.push(filters.owner_role)
  }
  if (filters.status) {
    conditions.push(`t.status = $${idx++}`)
    values.push(toAgentTaskStatus(filters.status))
  } else if (filters.active) {
    conditions.push(`t.status NOT IN ('completed', 'done', 'archived')`)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = Math.max(1, Math.min(filters.limit ?? 100, 500))
  const result = await db.query(
    `SELECT t.*, p.name AS project_name
       FROM agent_tasks t
       LEFT JOIN projects p ON p.id = t.project_id
      ${where}
      ORDER BY
        CASE
          WHEN t.status = 'blocked' THEN 0
          WHEN t.priority = 'urgent' THEN 1
          WHEN t.priority = 'high' THEN 2
          WHEN t.status IN ('planned', 'todo') THEN 3
          WHEN t.status = 'in_progress' THEN 4
          ELSE 5
        END,
        t.created_at DESC
      LIMIT ${limit}`,
    values,
  )
  return result.rows.map(row => mapOwnerTask(row))
}

export async function updateOwnerTaskStatus(id: string, status: OwnerTaskStatus, note?: string | null): Promise<OwnerTask | null> {
  const agentStatus = toAgentTaskStatus(status)
  const outputPatch = note
    ? `output = COALESCE(output, '{}'::jsonb) || jsonb_build_object('last_note', $2::text),`
    : ''
  const values = note ? [agentStatus, note, id] : [agentStatus, id]
  const idIndex = note ? 3 : 2
  const result = await db.query(
    `UPDATE agent_tasks
        SET status = $1,
            ${outputPatch}
            started_at = CASE WHEN $1 = 'in_progress' THEN COALESCE(started_at, NOW()) ELSE started_at END,
            completed_at = CASE WHEN $1 = 'completed' THEN NOW() WHEN $1 IN ('planned', 'in_progress', 'blocked') THEN NULL ELSE completed_at END,
            updated_at = NOW()
      WHERE id = $${idIndex}
      RETURNING *`,
    values,
  )
  if (!result.rows[0]) return null
  return mapOwnerTask(result.rows[0])
}
