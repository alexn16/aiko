import { NextRequest, NextResponse } from 'next/server'
import { delegateLeadToGmailDraft } from '@/lib/outreach/lead-outreach'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json().catch(() => ({}))
    const result = await delegateLeadToGmailDraft({
      lead_id: params.id,
      project_id: body.project_id ?? undefined,
      operator_name: body.operator_name ?? undefined,
      tone: body.tone ?? undefined,
      message_goal: body.message_goal ?? undefined,
    })
    return NextResponse.json(result, { status: result.success ? 200 : 422 })
  } catch (err) {
    console.error('[api/leads/[id]/outreach-draft]', err)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}
