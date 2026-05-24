import { NextRequest, NextResponse } from 'next/server'
import { updateWebOperatorAction, runWebOperatorAction, listWebOperatorActions } from '@/lib/web-operator/web-operator'
import { updateApprovalStatus } from '@/lib/approvals'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action_id, approval_id, decision } = body as {
      action_id: string
      approval_id: string
      decision: 'approved' | 'rejected'
    }

    if (!action_id || !approval_id || !decision) {
      return NextResponse.json({ error: 'action_id, approval_id, and decision are required' }, { status: 400 })
    }

    // Update approval item
    await updateApprovalStatus(approval_id, decision)

    if (decision === 'approved') {
      // Mark action as approved and attempt execution
      await updateWebOperatorAction(action_id, { status: 'approved' })

      // Fetch the action to re-execute it (now bypassing approval gate since it's been approved)
      const actions = await listWebOperatorActions({ limit: 1 })
      const action = actions.find(a => a.id === action_id) ?? null

      if (action) {
        // Re-execute the approved action — note: skip approval check since already approved
        // We directly check browser runtime and execute
        const { checkBrowserRuntimeAndExecute } = await import('@/lib/web-operator/approved-executor')
        const execResult = await checkBrowserRuntimeAndExecute(action)
        return NextResponse.json({ success: execResult.success, action: execResult.action, decision })
      }

      return NextResponse.json({ success: true, decision })
    } else {
      // Rejected — mark action as failed
      await updateWebOperatorAction(action_id, {
        status: 'failed',
        output: { error: 'Action rejected by user' },
        completed_at: new Date().toISOString(),
      })
      return NextResponse.json({ success: true, decision })
    }
  } catch (err) {
    console.error('[web-operator/approve-action POST]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
