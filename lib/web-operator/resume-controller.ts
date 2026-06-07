import { db } from '@/lib/db/client'
import { canPerformAction, getModeState, resumeAgents } from '@/lib/operating-mode'
import {
  listWebOperators,
  markLoginCompleted,
  resumeOperatorWorkflow,
  updateOperatorMemory,
  updateOperatorStatus,
  type WebOperator,
} from '@/lib/web-operator/operators'

export type ResumeSummary = {
  ok: boolean
  intent: 'manual_takeover_completed'
  checked_count: number
  resolved_count: number
  resumed_count: number
  failed_count: number
  errors: string[]
  ready_to_resume_count: number
  still_needs_approval_count: number
  still_blocked_missing_capability_count: number
  read_only_blocked: boolean
  paused_cleared: boolean
  message: string
  operators: Array<{
    id: string
    name: string
    status: string
    message: string
  }>
}

const MANUAL_WAITING_REASONS = new Set([
  'login_required',
  'captcha_detected',
  'security_checkpoint',
  'manual_takeover',
  'manual_takeover_required',
  'two_factor_required',
])

export function isManualTakeoverCompletedIntent(text: string): boolean {
  return /\b(browser is unblocked|all is unblocked|i logged in|i'?m logged in|logged in|login completed|captcha completed|i solved it|continue|resume|use the browser now|you can use (?:it|the browser) now|it is ready|i completed it)\b/i.test(text)
}

export async function findResolvableManualBlockers(): Promise<WebOperator[]> {
  const operators = await listWebOperators()
  return operators.filter(op => {
    if (['waiting_user', 'user_controlling', 'ready_to_resume'].includes(op.status)) return true
    if (op.requires_user_input) return true
    if (op.waiting_reason && MANUAL_WAITING_REASONS.has(op.waiting_reason)) return true
    return false
  })
}

export async function markManualBlockerResolved(operatorId: string): Promise<{ success: boolean; message: string }> {
  const result = await markLoginCompleted(operatorId)
  if (result.success) return { success: true, message: result.message }

  await updateOperatorMemory(operatorId, {
    requires_user_input: false,
    waiting_reason: null,
    memory_summary: 'User confirmed the browser blocker is cleared. Ready to resume.',
  })
  await updateOperatorStatus(operatorId, 'ready_to_resume', { current_task: 'Ready to resume' })
  return { success: true, message: 'Kevin is ready to resume.' }
}

export async function resumeReadyOperatorWork(operatorId: string): Promise<{ success: boolean; message: string }> {
  const modeCheck = await canPerformAction('browse_web', { agent_role: 'web_operator' })
  if (!modeCheck.allowed) {
    return { success: false, message: modeCheck.reason }
  }
  return resumeOperatorWorkflow(operatorId)
}

export async function resumeAllSafeBrowserWork(): Promise<ResumeSummary> {
  const operators = await findResolvableManualBlockers()
  let pausedCleared = false
  let readOnlyBlocked = false
  let resolvedCount = 0
  let resumedCount = 0
  let failedCount = 0
  const errors: string[] = []
  let approvalCount = await countPendingApprovals()
  let missingCapabilityCount = await countActiveMissingCapabilities()
  const details: ResumeSummary['operators'] = []

  const mode = await getModeState().catch(() => null)
  if (mode?.paused) {
    await resumeAgents()
    pausedCleared = true
  }

  const refreshedMode = await getModeState().catch(() => null)
  if (refreshedMode?.mode === 'read_only') {
    readOnlyBlocked = true
  }

  for (const op of operators) {
    let message = 'Kevin is ready to continue.'
    try {
      if (op.status !== 'ready_to_resume' || op.requires_user_input || op.waiting_reason) {
        const resolved = await markManualBlockerResolved(op.id)
        if (resolved.success) resolvedCount += 1
        message = resolved.message
      }

      if (!readOnlyBlocked && op.pending_action_type) {
        const resumed = await resumeReadyOperatorWork(op.id)
        if (resumed.success) {
          resumedCount += 1
          message = resumed.message || 'Kevin resumed browser work.'
        } else if (/approval/i.test(resumed.message)) {
          approvalCount += 1
          message = 'Kevin needs approval before doing this.'
        } else {
          message = resumed.message
        }
      }
    } catch (err) {
      failedCount += 1
      errors.push(err instanceof Error ? err.message : 'Unknown error.')
      message = 'Could not resume this operator.'
    }

    details.push({ id: op.id, name: op.name, status: op.status, message })
  }

  const readyCount = Math.max(0, resolvedCount - resumedCount)
  const baseMessage = buildResumeMessage({
    checkedCount: operators.length,
    resolvedCount,
    resumedCount,
    readyCount,
    approvalCount,
    missingCapabilityCount,
    readOnlyBlocked,
  })
  const message = failedCount > 0
    ? `${baseMessage} (${failedCount} operator${failedCount === 1 ? '' : 's'} could not be resumed.)`
    : baseMessage

  return {
    ok: true,
    intent: 'manual_takeover_completed',
    checked_count: operators.length,
    resolved_count: resolvedCount,
    resumed_count: resumedCount,
    failed_count: failedCount,
    errors,
    ready_to_resume_count: readyCount,
    still_needs_approval_count: approvalCount,
    still_blocked_missing_capability_count: missingCapabilityCount,
    read_only_blocked: readOnlyBlocked,
    paused_cleared: pausedCleared,
    message,
    operators: details,
  }
}

export async function getResumeSummary(): Promise<ResumeSummary> {
  return resumeAllSafeBrowserWork()
}

async function countPendingApprovals(): Promise<number> {
  try {
    const res = await db.query(`SELECT COUNT(*)::int AS n FROM approval_items WHERE status='pending'`)
    return Number(res.rows[0]?.n ?? 0)
  } catch {
    return 0
  }
}

async function countActiveMissingCapabilities(): Promise<number> {
  try {
    const res = await db.query(
      `SELECT COUNT(*)::int AS n
       FROM system_improvement_proposals
       WHERE status NOT IN ('validated_available','rejected','archived')`,
    )
    return Number(res.rows[0]?.n ?? 0)
  } catch {
    return 0
  }
}

function buildResumeMessage(input: {
  checkedCount: number
  resolvedCount: number
  resumedCount: number
  readyCount: number
  approvalCount: number
  missingCapabilityCount: number
  readOnlyBlocked: boolean
}): string {
  if (input.checkedCount === 0) {
    return input.missingCapabilityCount > 0 || input.approvalCount > 0
      ? 'No browser task is currently waiting for manual help. The remaining blockers are missing capabilities or approvals.'
      : 'No browser task is currently waiting for manual help.'
  }
  if (input.readOnlyBlocked) {
    return 'Kevin can continue in the browser, but AÏKO is in Read Only mode. Switch to Approval mode to let Kevin use the browser.'
  }
  if (input.resumedCount > 0) {
    return 'Kevin can continue in the browser now. I resumed the browser work that was waiting for your help. Anything that requires approval will still wait for approval. Native integrations that are not built, like CRM sync or calendar booking, remain unavailable.'
  }
  if (input.readyCount > 0 || input.resolvedCount > 0) {
    return 'Kevin can continue in the browser now. Click Resume if the browser work has not restarted yet. Anything that requires approval will still wait for approval. Native integrations that are not built, like CRM sync or calendar booking, remain unavailable.'
  }
  return 'No browser task was resumed. The remaining blockers are missing capabilities or approvals.'
}
