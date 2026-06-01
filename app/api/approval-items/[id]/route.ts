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

    // Record decision for approve / reject / changes_requested (non-fatal)
    if (updated.project_id && ['approved', 'rejected', 'changes_requested'].includes(status)) {
      try {
        const { recordProjectDecision } = await import('@/lib/project-decisions')
        const typeMap: Record<string, 'approval_approved' | 'approval_rejected' | 'approval_changes_requested'> = {
          approved:           'approval_approved',
          rejected:           'approval_rejected',
          changes_requested:  'approval_changes_requested',
        }
        const decisionType = typeMap[status]
        if (decisionType) {
          await recordProjectDecision({
            project_id:          String(updated.project_id),
            decision_type:       decisionType,
            title:               `Approval item "${updated.title ?? 'untitled'}" — ${status.replace(/_/g, ' ')}`,
            summary:             decision_reason ?? review_note ?? null,
            decided_by_role:     'user',
            related_entity_type: 'approval_item',
            related_entity_id:   params.id,
            metadata:            { item_type: updated.item_type ?? null, status },
          })
        }
      } catch { /* non-fatal */ }
    }

    return NextResponse.json({ item: updated })
  } catch (err) {
    console.error('[api/approval-items/[id] PATCH]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
