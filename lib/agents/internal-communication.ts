import { db } from '@/lib/db/client'

// ── Types ──────────────────────────────────────────────────────────────────────

export type MessageType =
  | 'update'
  | 'request'
  | 'handoff'
  | 'blocker'
  | 'approval_request'
  | 'report'
  | 'instruction'
  | 'review'

export type MessageStatus = 'sent' | 'read' | 'acknowledged' | 'resolved'

export interface AgentMessageParams {
  project_id?: string
  from_role: string
  to_role: string
  subject: string
  content: string
  message_type?: MessageType
  from_agent_id?: string
  to_agent_id?: string
  metadata?: Record<string, unknown>
}

export interface AgentMessageFilters {
  project_id?: string
  from_role?: string
  to_role?: string
  message_type?: MessageType
  status?: MessageStatus
  limit?: number
}

export interface AgentMessage {
  id: string
  project_id: string | null
  from_agent_id: string | null
  from_role: string
  from_agent_name: string | null
  to_agent_id: string | null
  to_role: string
  to_agent_name: string | null
  message_type: MessageType
  subject: string
  content: string
  status: MessageStatus
  metadata: Record<string, unknown>
  created_at: string
}

// ── Core functions ─────────────────────────────────────────────────────────────

export async function sendAgentMessage(params: AgentMessageParams): Promise<string> {
  const result = await db.query(
    `INSERT INTO agent_messages
       (project_id, from_agent_id, from_role, to_agent_id, to_role,
        message_type, subject, content, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id`,
    [
      params.project_id ?? null,
      params.from_agent_id ?? null,
      params.from_role,
      params.to_agent_id ?? null,
      params.to_role,
      params.message_type ?? 'update',
      params.subject,
      params.content,
      JSON.stringify(params.metadata ?? {}),
    ]
  )
  return result.rows[0].id as string
}

export async function listAgentMessages(filters: AgentMessageFilters = {}): Promise<AgentMessage[]> {
  const conditions: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (filters.project_id) {
    conditions.push(`m.project_id = $${idx++}`)
    values.push(filters.project_id)
  }
  if (filters.from_role) {
    conditions.push(`m.from_role = $${idx++}`)
    values.push(filters.from_role)
  }
  if (filters.to_role) {
    conditions.push(`m.to_role = $${idx++}`)
    values.push(filters.to_role)
  }
  if (filters.message_type) {
    conditions.push(`m.message_type = $${idx++}`)
    values.push(filters.message_type)
  }
  if (filters.status) {
    conditions.push(`m.status = $${idx++}`)
    values.push(filters.status)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = filters.limit ?? 50

  const result = await db.query(
    `SELECT
       m.*,
       fa.name AS from_agent_name,
       ta.name AS to_agent_name
     FROM agent_messages m
     LEFT JOIN agents fa ON fa.id = m.from_agent_id
     LEFT JOIN agents ta ON ta.id = m.to_agent_id
     ${where}
     ORDER BY m.created_at DESC
     LIMIT ${limit}`,
    values
  )

  return result.rows as AgentMessage[]
}

export async function acknowledgeAgentMessage(id: string): Promise<void> {
  await db.query(
    `UPDATE agent_messages SET status = 'acknowledged' WHERE id = $1`,
    [id]
  )
}

export async function resolveAgentMessage(id: string): Promise<void> {
  await db.query(
    `UPDATE agent_messages SET status = 'resolved' WHERE id = $1`,
    [id]
  )
}

// ── Convenience helpers ────────────────────────────────────────────────────────

export async function createHandoff(params: AgentMessageParams): Promise<string> {
  return sendAgentMessage({ ...params, message_type: 'handoff' })
}

export async function createBlocker(params: AgentMessageParams): Promise<string> {
  return sendAgentMessage({ ...params, message_type: 'blocker' })
}

export async function createManagerReport(params: AgentMessageParams): Promise<string> {
  return sendAgentMessage({ ...params, message_type: 'report' })
}

export async function createInstruction(params: AgentMessageParams): Promise<string> {
  return sendAgentMessage({ ...params, message_type: 'instruction' })
}
