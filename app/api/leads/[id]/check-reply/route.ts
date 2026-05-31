import { NextRequest, NextResponse } from 'next/server'
import { checkLeadReplyViaOperator, getLeadReplySummary } from '@/lib/outreach/reply-status'
import { canPerformAction } from '@/lib/operating-mode'

export const dynamic = 'force-dynamic'

/**
 * POST /api/leads/[id]/check-reply
 *
 * Triggers a browser-based Gmail reply check for a single lead via Web Operator.
 * No Gmail API / IMAP / SMTP — everything goes through Playwright.
 *
 * Optional body params:
 *   project_id?  — scopes operating-mode check
 *   operator_id? — uses specific operator's browser profile
 *   profile_key? — explicit browser-profile key
 *
 * GET /api/leads/[id]/check-reply
 *   Returns current reply-status fields for the lead (no browser action).
 */

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const leadId = params.id
  let body: Record<string, string> = {}
  try { body = await req.json() } catch { /* body optional */ }

  const projectId  = body.project_id  ?? undefined
  const operatorId = body.operator_id ?? undefined
  const profileKey = body.profile_key ?? undefined

  // Operating-mode guard
  const modeCheck = await canPerformAction('browse_web', { project_id: projectId })
  if (!modeCheck.allowed) {
    return NextResponse.json(
      { error: `Operating mode blocked: ${modeCheck.reason}` },
      { status: 403 }
    )
  }

  try {
    const result = await checkLeadReplyViaOperator({
      lead_id:     leadId,
      project_id:  projectId,
      operator_id: operatorId,
      profile_key: profileKey,
    })

    return NextResponse.json({
      ok:        !result.error,
      lead_id:   leadId,
      action_id: result.action_id,
      has_reply: result.has_reply,
      summary:   result.summary,
      ...(result.error ? { error: result.error } : {}),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('not found')) {
      return NextResponse.json({ error: msg }, { status: 404 })
    }
    if (msg.includes('no email address')) {
      return NextResponse.json({ error: msg }, { status: 422 })
    }
    console.error(`[leads/${leadId}/check-reply POST]`, err)
    return NextResponse.json({ error: 'Internal error during reply check' }, { status: 500 })
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const summary = await getLeadReplySummary(params.id)
  if (!summary) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }
  return NextResponse.json(summary)
}
