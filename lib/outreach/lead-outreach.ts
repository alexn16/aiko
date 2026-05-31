import { callAI } from '@/lib/ai/router'
import { canPerformAction, incrementSendCount } from '@/lib/operating-mode'
import { db } from '@/lib/db/client'
import type { Lead } from '@/lib/leads'

// ── Get single lead ────────────────────────────────────────────────────────────

export async function getLeadById(id: string): Promise<Lead | null> {
  const res = await db.query(
    `SELECT l.*, p.name AS project_name
     FROM leads l
     LEFT JOIN projects p ON p.id = l.project_id
     WHERE l.id = $1`,
    [id]
  )
  return (res.rows[0] as Lead) ?? null
}

// ── Draft generation ───────────────────────────────────────────────────────────

export async function generateLeadOutreachDraft(
  lead: Lead,
  opts?: { tone?: string; message_goal?: string }
): Promise<{ subject: string; body: string }> {
  const prompt = `Generate a cold outreach email for this lead.

Lead info:
- Company: ${lead.company_name}
- Website: ${lead.website ?? 'not found'}
- Location: ${lead.location ?? 'unknown'}
- Category: ${lead.category ?? 'unknown'}
- Contact name: ${lead.contact_name ?? 'Decision maker'}
- Email: ${lead.email ?? 'unknown'}
- Notes: ${lead.notes ?? 'none'}
- Source context: ${lead.source_text?.slice(0, 400) ?? 'none'}

Tone: ${opts?.tone ?? 'professional, concise, human'}
Goal: ${opts?.message_goal ?? 'introduce our AI marketing services and request a brief discovery call'}

RULES:
- Subject: max 60 characters, no clickbait
- Body: max 150 words, plain text, no HTML, no attachments
- Do NOT invent contact details — only use what's in the lead
- Sign off as "The AÏKO Team"
- Be specific about why we're reaching out to this company

Return JSON only: { "subject": "...", "body": "..." }`

  const raw = await callAI({
    role: 'copywriting',
    messages: [
      { role: 'system', content: 'You are a B2B copywriting assistant. Return valid JSON only — no explanation, no markdown.' },
      { role: 'user', content: prompt },
    ],
    maxTokens: 600,
    jsonMode: true,
  })

  try {
    const parsed = JSON.parse(raw)
    return {
      subject: String(parsed.subject ?? `Introduction from AÏKO`).slice(0, 120),
      body: String(parsed.body ?? raw).slice(0, 2000),
    }
  } catch {
    // Fallback: treat raw as body
    return {
      subject: `Introduction — ${lead.company_name}`,
      body: raw.slice(0, 2000),
    }
  }
}

// ── Task creation ──────────────────────────────────────────────────────────────

export async function createLeadOutreachTask(lead: Lead, project_id?: string | null): Promise<string | null> {
  try {
    const pid = project_id ?? lead.project_id
    if (!pid) return null
    const res = await db.query(
      `INSERT INTO agent_tasks
         (project_id, owner_role, assigned_by_role, title, status, task_type, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        pid,
        'Copywriting',
        'CEO',
        `Outreach draft: ${lead.company_name}`,
        'in_progress',
        'copywriting',
        `Prepare Gmail outreach draft for ${lead.company_name} (${lead.email ?? 'no email'})`,
      ]
    )
    return res.rows[0]?.id ?? null
  } catch {
    return null
  }
}

// ── Main orchestration ─────────────────────────────────────────────────────────

export interface OutreachDraftResult {
  success: boolean
  message: string
  blocked_reason?: string
  draft?: { subject: string; body: string }
  delegation?: {
    status: string
    message: string
    actionId?: string
    approvalId?: string
  }
}

export async function delegateLeadToGmailDraft(opts: {
  lead_id: string
  project_id?: string
  operator_name?: string
  tone?: string
  message_goal?: string
}): Promise<OutreachDraftResult> {
  // 1. Load lead
  const lead = await getLeadById(opts.lead_id)
  if (!lead) {
    return { success: false, message: 'Lead not found.' }
  }

  // 2. Check lead status
  if (lead.status !== 'approved') {
    return {
      success: false,
      message: `Lead "${lead.company_name}" is not approved (status: ${lead.status}). Approve the lead first.`,
      blocked_reason: 'lead_not_approved',
    }
  }

  // 3. Check email
  if (!lead.email) {
    return {
      success: false,
      message: `Lead "${lead.company_name}" has no email address. Use a Web Operator to visit the source website and find contact details.`,
      blocked_reason: 'no_email',
    }
  }

  // 4. Check operating mode
  const modeCheck = await canPerformAction('prepare_outreach')
  if (!modeCheck.allowed) {
    return { success: false, message: modeCheck.reason, blocked_reason: 'mode_blocked' }
  }

  // 5. Generate email draft
  let draft: { subject: string; body: string }
  try {
    draft = await generateLeadOutreachDraft(lead, { tone: opts.tone, message_goal: opts.message_goal })
  } catch (err) {
    return { success: false, message: `Could not generate email draft: ${err instanceof Error ? err.message : String(err)}` }
  }

  // 6. Create tracking task (non-blocking)
  await createLeadOutreachTask(lead, opts.project_id).catch(() => {})

  // 7. Delegate to Web Operator via Gmail
  const { delegateGmailDraft } = await import('@/lib/web-operator/delegation')
  const delegation = await delegateGmailDraft({
    to: lead.email,
    subject: draft.subject,
    body: draft.body,
    projectId: opts.project_id ?? lead.project_id ?? undefined,
    requestedByRole: 'Copywriting',
    operatorName: opts.operator_name,
    leadId: lead.id,   // link action to this lead for execution trail
  })

  // 8. Do NOT mark lead as 'contacted' here — draft created ≠ email sent.
  // Lead stays 'approved' until the draft is actually sent via sendLeadOutreachViaOperator.
  // Add a note to the lead so the draft can be traced.
  if (delegation.status === 'completed' || delegation.status === 'approval_required') {
    const note = `Gmail draft prepared${delegation.status === 'approval_required' ? ' (pending approval)' : ''}. Subject: "${draft.subject}"`
    await db.query(
      `UPDATE leads SET notes = COALESCE(notes || ' | ', '') || $1, updated_at=NOW() WHERE id=$2`,
      [note, lead.id]
    ).catch(() => {})
  }

  return {
    success: delegation.status !== 'failed',
    message: delegation.message,
    draft,
    delegation: {
      status: delegation.status,
      message: delegation.message,
      actionId: delegation.actionId,
      approvalId: delegation.approvalId,
    },
  }
}

// ── Send ───────────────────────────────────────────────────────────────────────

export interface OutreachSendResult {
  success: boolean
  message: string
  blocked_reason?: string
}

export async function sendLeadOutreachViaOperator(opts: {
  lead_id: string
  project_id?: string
  operator_name?: string
}): Promise<OutreachSendResult> {
  const lead = await getLeadById(opts.lead_id)
  if (!lead) return { success: false, message: 'Lead not found.' }

  if (lead.status !== 'approved' && lead.status !== 'contacted') {
    return {
      success: false,
      message: `Lead must be approved or contacted before sending. Current status: ${lead.status}`,
      blocked_reason: 'lead_not_approved',
    }
  }

  const modeCheck = await canPerformAction('send_email')
  if (!modeCheck.allowed) {
    return { success: false, message: modeCheck.reason, blocked_reason: 'mode_blocked' }
  }

  if (modeCheck.mode === 'auto_approval') {
    return {
      success: false,
      message: 'Sending requires Full Access mode. Go to Settings → Operating Mode to enable it, then confirm.',
      blocked_reason: 'needs_full_access',
    }
  }

  // Full Access: send via operator
  const { delegateSendGmail } = await import('@/lib/web-operator/delegation')
  const delegation = await delegateSendGmail({
    projectId: opts.project_id ?? lead.project_id ?? undefined,
    requestedByRole: 'Copywriting',
    operatorName: opts.operator_name,
  })

  if (delegation.status === 'completed') {
    await incrementSendCount()
    await db.query(
      `UPDATE leads SET status='contacted', updated_at=NOW() WHERE id=$1`,
      [lead.id]
    ).catch(() => {})
  }

  return { success: delegation.status === 'completed', message: delegation.message }
}

// ── Summary for context ────────────────────────────────────────────────────────

export async function getLeadOutreachSummaryForProject(project_id: string): Promise<{
  approved_with_email: number
  approved_no_email: number
  contacted: number
  replied: number
  interested: number
}> {
  try {
    const res = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE status='approved' AND email IS NOT NULL) AS approved_with_email,
         COUNT(*) FILTER (WHERE status='approved' AND (email IS NULL OR email='')) AS approved_no_email,
         COUNT(*) FILTER (WHERE status='contacted') AS contacted,
         COUNT(*) FILTER (WHERE status='replied') AS replied,
         COUNT(*) FILTER (WHERE status='interested') AS interested
       FROM leads WHERE project_id=$1`,
      [project_id]
    )
    const r = res.rows[0]
    return {
      approved_with_email: parseInt(r.approved_with_email ?? '0'),
      approved_no_email: parseInt(r.approved_no_email ?? '0'),
      contacted: parseInt(r.contacted ?? '0'),
      replied: parseInt(r.replied ?? '0'),
      interested: parseInt(r.interested ?? '0'),
    }
  } catch {
    return { approved_with_email: 0, approved_no_email: 0, contacted: 0, replied: 0, interested: 0 }
  }
}
