import { NextRequest, NextResponse } from 'next/server'
import { updateWebOperatorAction, getWebOperatorStatus } from '@/lib/web-operator/web-operator'
import { updateApprovalStatus } from '@/lib/approvals'
import { db } from '@/lib/db/client'

export const dynamic = 'force-dynamic'

/**
 * POST /api/web-operator/approve-action
 *
 * Called from the operator UI when a user approves/rejects a pending browser
 * action that was gated by an approval_item.
 *
 * On APPROVED:
 *   - Marks the approval_item as approved.
 *   - Marks the web_operator_action status as 'approved' (ready to resume).
 *   - Does NOT auto-execute the action. The user must explicitly click
 *     "Resume operator action" to trigger execution.
 *
 * On REJECTED:
 *   - Marks the approval_item as rejected.
 *   - Marks the web_operator_action as failed with reason 'rejected_by_user'.
 *
 * Safety: approval ≠ execution. Resume is always an explicit separate step.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action_id, approval_id, decision } = body as {
      action_id: string
      approval_id: string
      decision: 'approved' | 'rejected'
    }

    if (!action_id || !approval_id || !decision) {
      return NextResponse.json(
        { error: 'action_id, approval_id, and decision are required' },
        { status: 400 }
      )
    }

    // Guard: verify the action exists and hasn't already been completed
    const actionRes = await db.query(
      `SELECT id, status, approval_item_id FROM web_operator_actions WHERE id = $1`,
      [action_id]
    )
    const action = actionRes.rows[0]
    if (!action) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 })
    }
    if (action.status === 'completed') {
      return NextResponse.json(
        { error: 'Action already completed — cannot change approval decision' },
        { status: 409 }
      )
    }

    if (decision === 'approved') {
      // 1. Mark approval item approved
      await updateApprovalStatus(approval_id, 'approved')

      // 2. Mark action as approved-but-not-yet-executed (ready to resume)
      await updateWebOperatorAction(action_id, { status: 'approved' })

      return NextResponse.json({
        ok: true,
        decision,
        action_id,
        ready_to_resume: true,
        message: 'Action approved. Use the "Resume operator action" button to execute it.',
      })
    } else {
      // Rejected — mark action as failed
      await updateApprovalStatus(approval_id, 'rejected')
      await updateWebOperatorAction(action_id, {
        status: 'failed',
        output: { error: 'Action rejected by user' },
        failure_reason: 'rejected_by_user',
        completed_at: new Date().toISOString(),
      })
      return NextResponse.json({ ok: true, decision, action_id })
    }
  } catch (err) {
    console.error('[web-operator/approve-action POST]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
