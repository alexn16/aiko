/**
 * lib/execution-trail.ts
 *
 * Builds a chronological execution trail for business objects (leads, campaigns,
 * projects) by combining web_operator_actions and approval_items.
 *
 * SAFETY:
 * - Screenshots are only returned when is_sensitive = false.
 * - Approval "approved" ≠ "sent". The trail shows them as separate events.
 * - No secrets or internal content are included.
 */

import { db } from '@/lib/db/client'

// ── Types ──────────────────────────────────────────────────────────────────────

export type TrailEventType =
  | 'lead_discovered'
  | 'lead_approved'
  | 'lead_rejected'
  | 'draft_created'
  | 'draft_failed'
  | 'approval_requested'
  | 'approval_approved'
  | 'approval_rejected'
  | 'approval_changes_requested'
  | 'operator_resumed'
  | 'email_sent'
  | 'action_completed'
  | 'action_failed'
  | 'action_blocked'
  | 'waiting_approval'
  | 'waiting_user'
  | 'reply_check'
  | 'reply_found'

export interface TrailEvent {
  timestamp: string
  type: TrailEventType
  title: string
  detail: string | null
  status: string
  actor: string | null            // agent role or 'user'
  approval_item_id: string | null
  action_id: string | null
  screenshot_url: string | null   // null for sensitive actions
  failure_reason: string | null
}

// ── Internal helpers ───────────────────────────────────────────────────────────

function actionToEvents(row: Record<string, unknown>): TrailEvent[] {
  const events: TrailEvent[] = []
  const baseEvent = {
    actor: row.agent_role ? String(row.agent_role) : null,
    approval_item_id: row.approval_item_id ? String(row.approval_item_id) : null,
    action_id: String(row.id),
    // Never expose sensitive screenshots
    screenshot_url: row.is_sensitive ? null : (row.screenshot_url ? String(row.screenshot_url) : null),
    failure_reason: row.failure_reason ? String(row.failure_reason) : null,
  }

  const actionType = String(row.action_type)
  const description = String(row.description ?? '')
  const status = String(row.status)
  const createdAt = String(row.created_at)
  const completedAt = row.completed_at ? String(row.completed_at) : null

  // Creation event
  if (status === 'waiting_approval' || status === 'approved') {
    events.push({
      ...baseEvent,
      timestamp: createdAt,
      type: 'approval_requested',
      title: `Approval requested: ${description.slice(0, 80)}`,
      detail: `Action type: ${actionType}`,
      status: 'pending',
    })
  } else if (status === 'blocked') {
    events.push({
      ...baseEvent,
      timestamp: createdAt,
      type: 'action_blocked',
      title: `Action blocked: ${description.slice(0, 80)}`,
      detail: String((row.output as Record<string, unknown>)?.error ?? 'Operating mode blocked this action'),
      status: 'blocked',
    })
  } else if (status === 'running' || status === 'completed' || status === 'failed') {
    const isDraft = ['create_email_draft', 'fill_gmail_body', 'fill_gmail_subject', 'fill_gmail_to'].includes(actionType)
    const isSend = ['send_email', 'send_gmail_draft', 'submit_form'].includes(actionType)
    const isReplyCheck = ['check_gmail_reply', 'search_gmail'].includes(actionType)

    if (isReplyCheck && status === 'completed') {
      const output = (row.output ?? {}) as Record<string, unknown>
      const hasReply = Boolean(output.has_reply)
      events.push({
        ...baseEvent,
        timestamp: completedAt ?? createdAt,
        type: hasReply ? 'reply_found' : 'reply_check',
        title: hasReply ? `Reply found from lead` : `No reply found`,
        detail: typeof output.summary === 'string' ? output.summary : description.slice(0, 120),
        status: 'completed',
      })
      return events
    } else if (isReplyCheck && status === 'failed') {
      events.push({
        ...baseEvent,
        timestamp: completedAt ?? createdAt,
        type: 'action_failed',
        title: `Reply check failed`,
        detail: String((row.output as Record<string, unknown>)?.error ?? row.failure_reason ?? 'Unknown error'),
        status: 'failed',
      })
      return events
    } else if (isDraft && status === 'completed') {
      events.push({
        ...baseEvent,
        timestamp: completedAt ?? createdAt,
        type: 'draft_created',
        title: `Gmail draft prepared`,
        detail: description.slice(0, 120),
        status: 'completed',
      })
    } else if (isSend && status === 'completed') {
      events.push({
        ...baseEvent,
        timestamp: completedAt ?? createdAt,
        type: 'email_sent',
        title: `Email sent via Web Operator`,
        detail: description.slice(0, 120),
        status: 'completed',
      })
    } else if (status === 'failed') {
      events.push({
        ...baseEvent,
        timestamp: completedAt ?? createdAt,
        type: isDraft ? 'draft_failed' : 'action_failed',
        title: `Action failed: ${description.slice(0, 60)}`,
        detail: String((row.output as Record<string, unknown>)?.error ?? row.failure_reason ?? 'Unknown error'),
        status: 'failed',
      })
    } else if (status === 'completed') {
      events.push({
        ...baseEvent,
        timestamp: completedAt ?? createdAt,
        type: 'action_completed',
        title: `${actionType.replace(/_/g, ' ')} completed`,
        detail: description.slice(0, 120),
        status: 'completed',
      })
    }
  }

  // Resumed event: action previously had status 'approved' and is now completed
  if (status === 'completed' && row.approval_item_id) {
    // Insert a 'resumed' marker between approval and completion
    events.unshift({
      ...baseEvent,
      timestamp: createdAt, // will be sorted; completedAt is the end
      type: 'operator_resumed',
      title: `Operator action resumed after approval`,
      detail: `Action type: ${actionType}`,
      status: 'resumed',
    })
  }

  return events
}

function approvalToEvent(row: Record<string, unknown>): TrailEvent | null {
  const status = String(row.status)
  const reviewedAt = row.reviewed_at ? String(row.reviewed_at) : null
  const createdAt = String(row.created_at)

  const base = {
    actor: 'user',
    approval_item_id: String(row.id),
    action_id: null,
    screenshot_url: null,
    failure_reason: null,
  }

  if (status === 'approved' && reviewedAt) {
    return {
      ...base,
      timestamp: reviewedAt,
      type: 'approval_approved',
      title: `Approved: ${String(row.title ?? '').replace('Web Operator: ', '').slice(0, 80)}`,
      detail: row.review_note ? String(row.review_note) : 'Approved — waiting for explicit resume.',
      status: 'approved',
    }
  }
  if (status === 'rejected' && reviewedAt) {
    return {
      ...base,
      timestamp: reviewedAt,
      type: 'approval_rejected',
      title: `Rejected: ${String(row.title ?? '').slice(0, 80)}`,
      detail: row.review_note ? String(row.review_note) : null,
      status: 'rejected',
    }
  }
  if (status === 'changes_requested' && reviewedAt) {
    return {
      ...base,
      timestamp: reviewedAt,
      type: 'approval_changes_requested',
      title: `Changes requested: ${String(row.title ?? '').slice(0, 80)}`,
      detail: row.review_note ? String(row.review_note) : null,
      status: 'changes_requested',
    }
  }
  if (status === 'pending') {
    return {
      ...base,
      timestamp: createdAt,
      type: 'waiting_approval',
      title: `Waiting for approval: ${String(row.title ?? '').replace('Web Operator: ', '').slice(0, 80)}`,
      detail: 'Go to the Approval Center to review this item.',
      status: 'pending',
    }
  }
  return null
}

function sortEvents(events: TrailEvent[]): TrailEvent[] {
  return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
}

// ── Public functions ───────────────────────────────────────────────────────────

export async function getLeadExecutionTrail(leadId: string): Promise<TrailEvent[]> {
  try {
    const [leadRes, actionsRes] = await Promise.all([
      db.query(`SELECT id, status, created_at, updated_at FROM leads WHERE id = $1`, [leadId]),
      db.query(
        `SELECT woa.*, ai.id AS ai_id, ai.status AS ai_status,
                ai.title AS ai_title, ai.review_note, ai.reviewed_at,
                ai.created_at AS ai_created_at
         FROM web_operator_actions woa
         LEFT JOIN approval_items ai ON ai.id = woa.approval_item_id
         WHERE woa.lead_id = $1
         ORDER BY woa.created_at ASC`,
        [leadId]
      ),
    ])

    const events: TrailEvent[] = []

    // Lead status events
    const lead = leadRes.rows[0]
    if (lead) {
      if (lead.status === 'approved' || lead.status === 'contacted' || lead.status === 'replied' || lead.status === 'interested') {
        events.push({
          timestamp: String(lead.updated_at ?? lead.created_at),
          type: 'lead_approved',
          title: 'Lead approved',
          detail: null,
          status: 'approved',
          actor: 'user',
          approval_item_id: null,
          action_id: null,
          screenshot_url: null,
          failure_reason: null,
        })
      }
      if (lead.status === 'rejected') {
        events.push({
          timestamp: String(lead.updated_at ?? lead.created_at),
          type: 'lead_rejected',
          title: 'Lead rejected',
          detail: null,
          status: 'rejected',
          actor: 'user',
          approval_item_id: null,
          action_id: null,
          screenshot_url: null,
          failure_reason: null,
        })
      }
    }

    // Action + approval events
    for (const row of actionsRes.rows) {
      events.push(...actionToEvents(row))

      // Approval event from the joined approval_item
      if (row.ai_id) {
        const approvalRow = {
          id: row.ai_id,
          status: row.ai_status,
          title: row.ai_title,
          review_note: row.review_note,
          reviewed_at: row.reviewed_at,
          created_at: row.ai_created_at,
        }
        const approvalEvent = approvalToEvent(approvalRow)
        if (approvalEvent) events.push(approvalEvent)
      }
    }

    return sortEvents(events)
  } catch {
    return []
  }
}

export async function getCampaignExecutionTrail(campaignId: string): Promise<TrailEvent[]> {
  try {
    // campaign_items → approval_items → web_operator_actions
    const res = await db.query(
      `SELECT woa.*,
              ai.id AS ai_id, ai.status AS ai_status, ai.title AS ai_title,
              ai.review_note, ai.reviewed_at, ai.created_at AS ai_created_at
       FROM campaign_items ci
       LEFT JOIN approval_items ai ON ai.id = ci.approval_item_id
       LEFT JOIN web_operator_actions woa ON woa.approval_item_id = ai.id
       WHERE ci.campaign_id = $1
         AND (woa.id IS NOT NULL OR ai.id IS NOT NULL)
       ORDER BY COALESCE(woa.created_at, ai.created_at) ASC`,
      [campaignId]
    )

    const events: TrailEvent[] = []
    const seenActionIds = new Set<string>()
    const seenApprovalIds = new Set<string>()

    for (const row of res.rows) {
      if (row.id && !seenActionIds.has(String(row.id))) {
        seenActionIds.add(String(row.id))
        events.push(...actionToEvents(row))
      }
      if (row.ai_id && !seenApprovalIds.has(String(row.ai_id))) {
        seenApprovalIds.add(String(row.ai_id))
        const approvalRow = {
          id: row.ai_id,
          status: row.ai_status,
          title: row.ai_title,
          review_note: row.review_note,
          reviewed_at: row.reviewed_at,
          created_at: row.ai_created_at,
        }
        const approvalEvent = approvalToEvent(approvalRow)
        if (approvalEvent) events.push(approvalEvent)
      }
    }

    return sortEvents(events)
  } catch {
    return []
  }
}

export async function getProjectExecutionTrail(
  projectId: string,
  limit = 50
): Promise<TrailEvent[]> {
  try {
    const res = await db.query(
      `SELECT woa.*,
              ai.id AS ai_id, ai.status AS ai_status, ai.title AS ai_title,
              ai.review_note, ai.reviewed_at, ai.created_at AS ai_created_at
       FROM web_operator_actions woa
       LEFT JOIN approval_items ai ON ai.id = woa.approval_item_id
       WHERE woa.project_id = $1
       ORDER BY woa.created_at DESC
       LIMIT $2`,
      [projectId, limit]
    )

    const events: TrailEvent[] = []
    const seenApprovalIds = new Set<string>()

    for (const row of res.rows) {
      events.push(...actionToEvents(row))
      if (row.ai_id && !seenApprovalIds.has(String(row.ai_id))) {
        seenApprovalIds.add(String(row.ai_id))
        const approvalRow = {
          id: row.ai_id,
          status: row.ai_status,
          title: row.ai_title,
          review_note: row.review_note,
          reviewed_at: row.reviewed_at,
          created_at: row.ai_created_at,
        }
        const approvalEvent = approvalToEvent(approvalRow)
        if (approvalEvent) events.push(approvalEvent)
      }
    }

    return sortEvents(events)
  } catch {
    return []
  }
}

export function formatTrailEventType(type: TrailEventType): string {
  const labels: Record<TrailEventType, string> = {
    lead_discovered: 'Lead discovered',
    lead_approved: 'Lead approved',
    lead_rejected: 'Lead rejected',
    draft_created: 'Draft created',
    draft_failed: 'Draft failed',
    approval_requested: 'Approval requested',
    approval_approved: 'Approved',
    approval_rejected: 'Rejected',
    approval_changes_requested: 'Changes requested',
    operator_resumed: 'Action resumed',
    email_sent: 'Email sent',
    action_completed: 'Action completed',
    action_failed: 'Action failed',
    action_blocked: 'Action blocked',
    waiting_approval: 'Awaiting approval',
    waiting_user: 'Waiting for user',
    reply_check: 'Reply checked — no reply',
    reply_found: 'Reply found',
  }
  return labels[type] ?? type.replace(/_/g, ' ')
}
