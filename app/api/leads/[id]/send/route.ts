import { NextRequest, NextResponse } from 'next/server'
import { sendLeadOutreachViaOperator } from '@/lib/outreach/lead-outreach'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json().catch(() => ({}))
    const result = await sendLeadOutreachViaOperator({
      lead_id: params.id,
      project_id: body.project_id ?? undefined,
      operator_name: body.operator_name ?? undefined,
    })
    return NextResponse.json(result, { status: result.success ? 200 : 422 })
  } catch (err) {
    console.error('[api/leads/[id]/send]', err)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}
