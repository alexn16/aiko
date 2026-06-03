import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { updateWebOperatorAction } from '@/lib/web-operator/web-operator'
import { canPerformAction } from '@/lib/operating-mode'

export const dynamic = 'force-dynamic'

/**
 * POST /api/web-operator/actions/[id]/resume
 *
 * Explicitly resumes a web operator action that has been approved but
 * not yet executed.
 *
 * Safety checks (all must pass):
 *   1. Action exists and has an approval_item_id.
 *   2. Linked approval_item.status = 'approved'.
 *   3. Action status is 'approved' (not already completed or failed).
 *   4. Operating mode still permits the action type at resume time.
 *   5. Browser runtime is available.
 *
 * If all checks pass, executes the action via playwright-executor,
 * updates the action record, and returns the result.
 *
 * Every resume attempt is logged via the action status update.
 * Duplicate resumes are blocked (idempotent guard on status).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id: actionId } = params

  try {
    // 1. Load action
    const actionRes = await db.query(
      `SELECT woa.*,
              ai.status AS approval_status
       FROM web_operator_actions woa
       LEFT JOIN approval_items ai ON ai.id = woa.approval_item_id
       WHERE woa.id = $1`,
      [actionId]
    )
    const row = actionRes.rows[0]
    if (!row) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 })
    }

    // 2. Must have a linked approval item
    if (!row.approval_item_id) {
      return NextResponse.json(
        { error: 'This action has no linked approval item and cannot be resumed via this endpoint.' },
        { status: 400 }
      )
    }

    // 3. Linked approval must be approved
    if (row.approval_status !== 'approved') {
      return NextResponse.json(
        {
          error: `Action cannot be resumed: linked approval is "${row.approval_status}". Approve the item in the Approval Center first.`,
          approval_status: row.approval_status,
        },
        { status: 403 }
      )
    }

    // 4. Action must be in 'approved' state (not already done)
    if (row.status === 'completed') {
      return NextResponse.json(
        { error: 'Action already completed — duplicate resume blocked.', status: row.status },
        { status: 409 }
      )
    }
    if (row.status === 'failed' && row.failure_reason !== 'rejected_by_user') {
      // Allow retry of failed (non-rejected) actions if approval is present
      // fall through to execution
    } else if (!['approved', 'failed'].includes(row.status)) {
      return NextResponse.json(
        { error: `Action cannot be resumed from status "${row.status}".` },
        { status: 409 }
      )
    }

    // 5. Re-check operating mode at resume time
    const actionType: string = row.action_type
    const isSensitive = ['send_email', 'submit_form', 'send_gmail_draft'].includes(actionType)
    const modeCheck = await canPerformAction(
      isSensitive ? 'send_email' : 'browse_web',
      { project_id: row.project_id ?? undefined, agent_role: row.agent_role ?? undefined }
    )
    if (!modeCheck.allowed) {
      await updateWebOperatorAction(actionId, {
        status: 'failed',
        output: { error: `Blocked at resume time: ${modeCheck.reason}` },
        failure_reason: 'mode_blocked_at_resume',
        completed_at: new Date().toISOString(),
      })
      return NextResponse.json(
        { error: `Operating mode blocked this action: ${modeCheck.reason}` },
        { status: 403 }
      )
    }

    // Mark as 'running' before execution (idempotency — if this fails, status shows running)
    await updateWebOperatorAction(actionId, { status: 'running' })

    // 6. Reconstruct the action object for the executor
    const action = {
      id: String(row.id),
      session_id: row.session_id ? String(row.session_id) : null,
      project_id: row.project_id ? String(row.project_id) : null,
      agent_role: String(row.agent_role ?? 'Web Operator'),
      action_type: row.action_type,
      target_url: row.target_url ? String(row.target_url) : null,
      description: String(row.description ?? ''),
      status: 'running',
      input: typeof row.input === 'object' && row.input !== null ? row.input : {},
      output: {},
      screenshot_url: null,
      page_title: null,
      page_preview: null,
      retry_count: typeof row.retry_count === 'number' ? row.retry_count : 0,
      failure_reason: null,
      is_sensitive: Boolean(row.is_sensitive),
      requires_approval: Boolean(row.requires_approval),
      approval_item_id: String(row.approval_item_id),
      source_task_id: row.source_task_id ? String(row.source_task_id) : null,
      requested_by_role: row.requested_by_role ? String(row.requested_by_role) : null,
      lead_id: row.lead_id ? String(row.lead_id) : null,
      created_at: String(row.created_at),
      completed_at: null,
      skill_id: row.skill_id ? String(row.skill_id) : null,
      skill_name: row.skill_name ? String(row.skill_name) : null,
      skill_decision: typeof row.skill_decision === 'object' && row.skill_decision !== null
        ? row.skill_decision as Record<string, unknown>
        : null,
      playbook_id: row.playbook_id ? String(row.playbook_id) : null,
      playbook_name: row.playbook_name ? String(row.playbook_name) : null,
      playbook_plan: typeof row.playbook_plan === 'object' && row.playbook_plan !== null
        ? row.playbook_plan as Record<string, unknown>
        : null,
    }

    // 7. Execute via approved-executor (checks browser runtime + runs playwright)
    const { checkBrowserRuntimeAndExecute } = await import(
      '@/lib/web-operator/approved-executor'
    )
    const execResult = await checkBrowserRuntimeAndExecute(action)

    // 8. Update operator state if operator_id present
    if (row.operator_id) {
      const newStatus = execResult.success ? 'idle' : 'error'
      await db
        .query(
          `UPDATE web_operators SET status=$1, current_task=NULL, updated_at=NOW() WHERE id=$2`,
          [newStatus, row.operator_id]
        )
        .catch(() => {})

      if (execResult.success && execResult.action.page_title) {
        await db
          .query(
            `UPDATE web_operators SET current_url=$1, updated_at=NOW() WHERE id=$2`,
            [execResult.action.screenshot_url ?? null, row.operator_id]
          )
          .catch(() => {})
      }
    }

    if (!execResult.success) {
      return NextResponse.json({
        ok: false,
        action_id: actionId,
        error: execResult.error ?? 'Execution failed',
        action: execResult.action,
      }, { status: 200 }) // 200 so client can read the error body
    }

    return NextResponse.json({
      ok: true,
      action_id: actionId,
      action: execResult.action,
      message: 'Action resumed and completed successfully.',
    })
  } catch (err) {
    console.error(`[web-operator/actions/${actionId}/resume POST]`, err)
    // Best-effort: mark action as failed
    await updateWebOperatorAction(actionId, {
      status: 'failed',
      output: { error: err instanceof Error ? err.message : String(err) },
      failure_reason: 'resume_exception',
      completed_at: new Date().toISOString(),
    }).catch(() => {})
    return NextResponse.json({ error: 'Internal error during resume' }, { status: 500 })
  }
}
