import { db } from '@/lib/db/client'
import { createInstruction } from '@/lib/agents/internal-communication'
import type { AgentTaskOutput } from '@/lib/agents/task-outputs'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ApprovalItem {
  id: string
  project_id: string | null
  output_id: string | null
  task_id: string | null
  item_type: string
  title: string
  content: string
  status: string
  requested_by_role: string
  reviewed_by_user_id: string | null
  review_note: string | null
  decision_reason: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
  // joined fields
  project_name?: string
}

// ── Core functions ─────────────────────────────────────────────────────────────

export async function createApprovalItem(params: {
  project_id?: string | null
  output_id?: string | null
  task_id?: string | null
  item_type?: string
  title: string
  content?: string
  status?: string
  requested_by_role?: string
  reviewed_by_user_id?: string | null
  review_note?: string | null
  decision_reason?: string | null
}): Promise<ApprovalItem> {
  const result = await db.query(
    `INSERT INTO approval_items
       (project_id, output_id, task_id, item_type, title, content, status, requested_by_role,
        reviewed_by_user_id, review_note, decision_reason)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      params.project_id ?? null,
      params.output_id ?? null,
      params.task_id ?? null,
      params.item_type ?? 'outreach_draft',
      params.title,
      params.content ?? '',
      params.status ?? 'pending',
      params.requested_by_role ?? 'system',
      params.reviewed_by_user_id ?? null,
      params.review_note ?? null,
      params.decision_reason ?? null,
    ]
  )
  return result.rows[0] as ApprovalItem
}

export async function listApprovalItems(filters: {
  project_id?: string
  status?: string
  item_type?: string
  limit?: number
} = {}): Promise<ApprovalItem[]> {
  const conditions: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (filters.project_id) {
    conditions.push(`ai.project_id = $${idx++}`)
    values.push(filters.project_id)
  }
  if (filters.status) {
    conditions.push(`ai.status = $${idx++}`)
    values.push(filters.status)
  }
  if (filters.item_type) {
    conditions.push(`ai.item_type = $${idx++}`)
    values.push(filters.item_type)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = filters.limit ?? 50

  try {
    const result = await db.query(
      `SELECT ai.*, p.name AS project_name
       FROM approval_items ai
       LEFT JOIN projects p ON p.id = ai.project_id
       ${where}
       ORDER BY ai.created_at DESC
       LIMIT ${limit}`,
      values
    )
    return result.rows as ApprovalItem[]
  } catch {
    return []
  }
}

export async function getApprovalItem(id: string): Promise<ApprovalItem | null> {
  try {
    const result = await db.query(
      `SELECT ai.*, p.name AS project_name
       FROM approval_items ai
       LEFT JOIN projects p ON p.id = ai.project_id
       WHERE ai.id = $1`,
      [id]
    )
    return (result.rows[0] as ApprovalItem) ?? null
  } catch {
    return null
  }
}

export async function updateApprovalStatus(
  id: string,
  status: string,
  opts?: {
    review_note?: string
    decision_reason?: string
    content?: string
  }
): Promise<ApprovalItem | null> {
  const sets: string[] = ['status=$2', 'reviewed_at=NOW()', 'updated_at=NOW()']
  const values: unknown[] = [id, status]
  let idx = 3

  if (opts?.review_note !== undefined) {
    sets.push(`review_note=$${idx++}`)
    values.push(opts.review_note)
  }
  if (opts?.decision_reason !== undefined) {
    sets.push(`decision_reason=$${idx++}`)
    values.push(opts.decision_reason)
  }
  if (opts?.content !== undefined) {
    sets.push(`content=$${idx++}`)
    values.push(opts.content)
  }

  let updated: ApprovalItem | null = null
  try {
    const result = await db.query(
      `UPDATE approval_items SET ${sets.join(', ')} WHERE id=$1 RETURNING *`,
      values
    )
    updated = (result.rows[0] as ApprovalItem) ?? null
  } catch {
    return null
  }

  if (!updated) return null

  // Side effects — wrapped in try/catch so they never block the status update
  try {
    if (status === 'approved') {
      // Update linked output
      if (updated.output_id) {
        await db.query(
          `UPDATE agent_task_outputs SET status='approved', updated_at=NOW() WHERE id=$1`,
          [updated.output_id]
        ).catch(() => {})
      }
      // Notify PM
      await createInstruction({
        from_role: 'Approval',
        to_role: 'Project Manager',
        subject: `Item approved: ${updated.title}`,
        content: `The following item has been approved and is ready for next steps: ${updated.title}`,
        project_id: updated.project_id ?? undefined,
      })
    } else if (status === 'rejected') {
      // Update linked output
      if (updated.output_id) {
        await db.query(
          `UPDATE agent_task_outputs SET status='rejected', updated_at=NOW() WHERE id=$1`,
          [updated.output_id]
        ).catch(() => {})
      }
      // Notify owner
      await createInstruction({
        from_role: 'Approval',
        to_role: updated.requested_by_role,
        subject: `Item rejected: ${updated.title}`,
        content: `The following item was rejected${opts?.review_note ? `. Review note: ${opts.review_note}` : ''}: ${updated.title}`,
        project_id: updated.project_id ?? undefined,
      })
    } else if (status === 'changes_requested') {
      // Reset linked output to draft
      if (updated.output_id) {
        await db.query(
          `UPDATE agent_task_outputs SET status='draft', updated_at=NOW() WHERE id=$1`,
          [updated.output_id]
        ).catch(() => {})
      }
      // Notify owner with changes note
      await createInstruction({
        from_role: 'Approval',
        to_role: updated.requested_by_role,
        subject: `Changes requested: ${updated.title}`,
        content: `Client requested changes. Note: ${opts?.review_note ?? '(no note provided)'}`,
        project_id: updated.project_id ?? undefined,
      })
      // Create revision task — use dynamic import to avoid circular dependency
      try {
        const { createAgentTask } = await import('@/lib/agents/tasks')
        await createAgentTask({
          project_id: updated.project_id ?? undefined,
          owner_role: updated.requested_by_role,
          assigned_by_role: 'Approval',
          title: `Revise: ${updated.title}`,
          status: 'planned',
          task_type: 'copywriting',
        })
      } catch {
        // non-fatal
      }
    }
  } catch {
    // side effects are best-effort — status update already succeeded
  }

  return updated
}

export async function createApprovalFromOutput(output: AgentTaskOutput): Promise<ApprovalItem> {
  return createApprovalItem({
    project_id: output.project_id,
    output_id: output.id,
    task_id: (output as AgentTaskOutput & { task_id?: string | null }).task_id ?? null,
    item_type: output.output_type,
    title: output.title,
    content: output.content,
    requested_by_role: output.agent_role,
    status: 'pending',
  })
}

export async function getApprovalSummaryForProject(project_id: string): Promise<{
  total: number
  pending: number
  approved: number
  changes_requested: number
  rejected: number
  pending_items: ApprovalItem[]
}> {
  try {
    const [statsRes, pendingRes] = await Promise.all([
      db.query(
        `SELECT status, COUNT(*) AS n FROM approval_items WHERE project_id=$1 GROUP BY status`,
        [project_id]
      ),
      db.query(
        `SELECT ai.*, p.name AS project_name
         FROM approval_items ai
         LEFT JOIN projects p ON p.id = ai.project_id
         WHERE ai.project_id=$1 AND ai.status='pending'
         ORDER BY ai.created_at DESC LIMIT 5`,
        [project_id]
      ),
    ])

    const counts: Record<string, number> = {}
    for (const row of statsRes.rows) {
      counts[row.status] = parseInt(row.n, 10)
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0)

    return {
      total,
      pending: counts['pending'] ?? 0,
      approved: counts['approved'] ?? 0,
      changes_requested: counts['changes_requested'] ?? 0,
      rejected: counts['rejected'] ?? 0,
      pending_items: pendingRes.rows as ApprovalItem[],
    }
  } catch {
    return { total: 0, pending: 0, approved: 0, changes_requested: 0, rejected: 0, pending_items: [] }
  }
}

export async function getApprovalSummaryForCompany(): Promise<{
  total: number
  pending: number
  approved: number
  changes_requested: number
  rejected: number
  pending_items: ApprovalItem[]
}> {
  try {
    const [statsRes, pendingRes] = await Promise.all([
      db.query(`SELECT status, COUNT(*) AS n FROM approval_items GROUP BY status`),
      db.query(
        `SELECT ai.*, p.name AS project_name
         FROM approval_items ai
         LEFT JOIN projects p ON p.id = ai.project_id
         WHERE ai.status='pending'
         ORDER BY ai.created_at DESC LIMIT 5`
      ),
    ])

    const counts: Record<string, number> = {}
    for (const row of statsRes.rows) {
      counts[row.status] = parseInt(row.n, 10)
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0)

    return {
      total,
      pending: counts['pending'] ?? 0,
      approved: counts['approved'] ?? 0,
      changes_requested: counts['changes_requested'] ?? 0,
      rejected: counts['rejected'] ?? 0,
      pending_items: pendingRes.rows as ApprovalItem[],
    }
  } catch {
    return { total: 0, pending: 0, approved: 0, changes_requested: 0, rejected: 0, pending_items: [] }
  }
}
