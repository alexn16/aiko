import { NextRequest, NextResponse } from 'next/server'
import { updateApprovalStatus } from '@/lib/approvals'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { status, review_note, decision_reason, content } = body

    if (!status) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 })
    }

    const updated = await updateApprovalStatus(params.id, status, {
      review_note,
      decision_reason,
      content,
    })

    if (!updated) {
      return NextResponse.json({ error: 'Item not found or update failed' }, { status: 404 })
    }

    return NextResponse.json({ item: updated })
  } catch (err) {
    console.error('[api/approval-items/[id] PATCH]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
