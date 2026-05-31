/**
 * gmail-status-workflow.ts
 *
 * Orchestrates a browser-only Gmail reply-status check for a single lead
 * via Web Operator (Playwright). No Gmail API, IMAP, or SMTP used.
 *
 * Safety rules:
 *  - Does NOT open attachments.
 *  - Does NOT click external links in emails.
 *  - Reads only subject + snippet from the Gmail thread-list view.
 *  - Does NOT open individual emails (avoids read-receipts and body exposure).
 *  - Only searches for email from the specific lead_email — minimises data exposure.
 *  - Sensitive screenshots (login/auth pages) are suppressed automatically.
 *  - User handles login / 2-FA prompts manually.
 */

import { runWebOperatorAction } from './web-operator'

export interface GmailReplyCheckInput {
  lead_id:       string
  lead_email:    string
  company_name?: string
  subject_hint?: string
  campaign_id?:  string
  project_id?:   string
  operator_id?:  string
  /** Operator browser-profile key for session isolation */
  profile_key?:  string
}

export interface GmailReplyCheckResult {
  action_id:     string
  has_reply:     boolean
  summary:       string
  latest_thread: {
    subject: string
    snippet: string
    sender:  string
    date:    string
    unread:  boolean
  } | null
  raw_output:    Record<string, unknown>
  error?:        string
}

/**
 * checkLeadReplyViaGmailWorkflow
 *
 * Runs a `check_gmail_reply` Web Operator action for the given lead.
 * Returns a structured result that the caller can persist to the leads table.
 */
export async function checkLeadReplyViaGmailWorkflow(
  opts: GmailReplyCheckInput
): Promise<GmailReplyCheckResult> {
  const displayName = opts.company_name ?? opts.lead_email

  const result = await runWebOperatorAction({
    project_id:   opts.project_id ?? null,
    agent_role:   'Web Operator',
    action_type:  'check_gmail_reply',
    target_url:   'https://mail.google.com/',
    description:  `Check Gmail for replies from ${displayName} (${opts.lead_email})`,
    input: {
      lead_id:      opts.lead_id,
      lead_email:   opts.lead_email,
      company_name: opts.company_name ?? null,
      subject_hint: opts.subject_hint ?? null,
      campaign_id:  opts.campaign_id ?? null,
    },
    operator_id:  opts.operator_id ?? null,
    lead_id:      opts.lead_id,
    profileKey:   opts.profile_key ?? null,
  })

  const output = (result.action.output ?? {}) as Record<string, unknown>
  const hasReply  = Boolean(output.has_reply)
  const summary   = typeof output.summary === 'string'
    ? output.summary
    : (hasReply ? 'Reply found.' : 'No reply found.')
  const latestRaw = output.latest_thread as Record<string, unknown> | null | undefined

  return {
    action_id:    result.action.id,
    has_reply:    hasReply,
    summary,
    latest_thread: latestRaw
      ? {
          subject: String(latestRaw.subject ?? ''),
          snippet: String(latestRaw.snippet ?? ''),
          sender:  String(latestRaw.sender  ?? ''),
          date:    String(latestRaw.date    ?? ''),
          unread:  Boolean(latestRaw.unread),
        }
      : null,
    raw_output: output,
    error: result.success ? undefined
      : (typeof output.error === 'string' ? output.error : (result.error ?? 'Action failed')),
  }
}
