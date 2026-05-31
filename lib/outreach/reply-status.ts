/**
 * reply-status.ts
 *
 * Manages Gmail reply-status checks for leads.
 * All checks go through Web Operator (browser-only). No Gmail API / IMAP / SMTP.
 */

import { db } from '@/lib/db/client'
import { checkLeadReplyViaGmailWorkflow, type GmailReplyCheckInput } from '@/lib/web-operator/gmail-status-workflow'

export interface LeadReplySummary {
  lead_id:        string
  lead_email:     string | null
  last_checked_at: string | null
  last_reply_at:  string | null
  reply_summary:  string | null
}

/**
 * checkLeadReplyViaOperator
 *
 * Initiates a browser-based Gmail reply check for a single lead.
 * Persists `last_checked_at` immediately, then updates `last_reply_at` and
 * `reply_summary` if a reply is found.
 *
 * Throws if the lead does not exist or has no email address.
 */
export async function checkLeadReplyViaOperator(opts: {
  lead_id:      string
  project_id?:  string
  operator_id?: string
  profile_key?: string
}): Promise<{
  action_id:    string
  has_reply:    boolean
  summary:      string
  error?:       string
}> {
  // 1. Load lead
  const leadRes = await db.query(
    `SELECT id, email, company_name, status FROM leads WHERE id = $1`,
    [opts.lead_id]
  )
  const lead = leadRes.rows[0]
  if (!lead) throw new Error(`Lead ${opts.lead_id} not found`)
  if (!lead.email) throw new Error(`Lead ${opts.lead_id} has no email address — cannot check reply`)

  // 2. Stamp last_checked_at immediately (shows check is in progress)
  await recordLeadReplyCheck(opts.lead_id)

  // 3. Run browser workflow
  const input: GmailReplyCheckInput = {
    lead_id:      opts.lead_id,
    lead_email:   lead.email as string,
    company_name: lead.company_name as string | undefined,
    project_id:   opts.project_id,
    operator_id:  opts.operator_id,
    profile_key:  opts.profile_key,
  }
  const result = await checkLeadReplyViaGmailWorkflow(input)

  // 4. Update reply fields if a reply was found
  if (result.has_reply && !result.error) {
    await updateLeadReplyStatus(opts.lead_id, {
      last_reply_at:  new Date().toISOString(),
      reply_summary:  result.summary,
    })
  }

  return {
    action_id: result.action_id,
    has_reply: result.has_reply,
    summary:   result.summary,
    error:     result.error,
  }
}

/**
 * recordLeadReplyCheck — stamps last_checked_at on the lead row.
 * Called at the start of a check so the UI can show "checking now…".
 */
export async function recordLeadReplyCheck(lead_id: string): Promise<void> {
  await db.query(
    `UPDATE leads SET last_checked_at = NOW() WHERE id = $1`,
    [lead_id]
  )
}

/**
 * updateLeadReplyStatus — writes reply fields after a successful check.
 */
export async function updateLeadReplyStatus(
  lead_id: string,
  fields: { last_reply_at?: string; reply_summary?: string }
): Promise<void> {
  const sets: string[] = []
  const vals: unknown[] = []
  let i = 1
  if (fields.last_reply_at !== undefined) { sets.push(`last_reply_at = $${i++}`); vals.push(fields.last_reply_at) }
  if (fields.reply_summary !== undefined) { sets.push(`reply_summary = $${i++}`); vals.push(fields.reply_summary) }
  if (sets.length === 0) return
  vals.push(lead_id)
  await db.query(`UPDATE leads SET ${sets.join(', ')} WHERE id = $${i}`, vals)
}

/**
 * getLeadReplySummary — reads reply-status fields for a lead.
 */
export async function getLeadReplySummary(lead_id: string): Promise<LeadReplySummary | null> {
  const res = await db.query(
    `SELECT id AS lead_id, email AS lead_email,
            last_checked_at, last_reply_at, reply_summary
     FROM leads WHERE id = $1`,
    [lead_id]
  )
  if (!res.rows[0]) return null
  const row = res.rows[0]
  return {
    lead_id:         String(row.lead_id),
    lead_email:      row.lead_email ? String(row.lead_email) : null,
    last_checked_at: row.last_checked_at ? new Date(row.last_checked_at).toISOString() : null,
    last_reply_at:   row.last_reply_at   ? new Date(row.last_reply_at).toISOString()   : null,
    reply_summary:   row.reply_summary   ? String(row.reply_summary)                   : null,
  }
}
