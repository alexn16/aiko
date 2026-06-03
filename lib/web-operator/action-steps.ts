import { db } from '@/lib/db/client'
import type { PlaybookExecutionPlan, PlaybookPlanStep } from '@/lib/web-operator/playbooks'

export type WebOperatorActionStepStatus =
  | 'planned'
  | 'running'
  | 'waiting_user'
  | 'waiting_approval'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'blocked'

export interface WebOperatorActionStep {
  id: string
  action_id: string
  operator_id: string | null
  project_id: string | null
  step_index: number
  step_id: string
  title: string
  status: WebOperatorActionStepStatus
  approval_required: boolean
  forbidden: boolean
  url: string | null
  screenshot_url: string | null
  message: string | null
  result: Record<string, unknown>
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

const SENSITIVE_RESULT_KEYS = ['password', 'secret', 'token', 'api_key', 'apiKey', 'authorization', 'body', 'email_body']

function titleForStep(stepId: string, fallback?: string): string {
  return fallback || stepId.replace(/_/g, ' ')
}

function redactResult(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_RESULT_KEYS.some(k => key.toLowerCase().includes(k.toLowerCase()))) {
      out[key] = '[redacted]'
    } else if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      out[key] = redactResult(entry)
    } else {
      out[key] = entry
    }
  }
  return out
}

function rowToStep(row: Record<string, unknown>): WebOperatorActionStep {
  return {
    id: String(row.id),
    action_id: String(row.action_id),
    operator_id: row.operator_id ? String(row.operator_id) : null,
    project_id: row.project_id ? String(row.project_id) : null,
    step_index: typeof row.step_index === 'number' ? row.step_index : parseInt(String(row.step_index ?? '0'), 10),
    step_id: String(row.step_id),
    title: String(row.title),
    status: String(row.status) as WebOperatorActionStepStatus,
    approval_required: Boolean(row.approval_required),
    forbidden: Boolean(row.forbidden),
    url: row.url ? String(row.url) : null,
    screenshot_url: row.screenshot_url ? String(row.screenshot_url) : null,
    message: row.message ? String(row.message) : null,
    result: redactResult(row.result),
    started_at: row.started_at ? String(row.started_at) : null,
    completed_at: row.completed_at ? String(row.completed_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

function normalizePlanStep(step: PlaybookPlanStep): { step_id: string; title: string; approval_required: boolean; forbidden: boolean } {
  const stepId = step.step_type || step.label || 'step'
  return {
    step_id: stepId,
    title: titleForStep(stepId, step.label),
    approval_required: Boolean(step.requires_approval),
    forbidden: Boolean(step.forbidden),
  }
}

function buildRowsFromPlan(plan: PlaybookExecutionPlan): Array<{ step_id: string; title: string; approval_required: boolean; forbidden: boolean }> {
  const rows: Array<{ step_id: string; title: string; approval_required: boolean; forbidden: boolean }> = []
  const seen = new Set<string>()
  const add = (row: { step_id: string; title: string; approval_required: boolean; forbidden: boolean }) => {
    if (seen.has(row.step_id)) return
    seen.add(row.step_id)
    rows.push(row)
  }
  for (const step of plan.steps ?? []) add(normalizePlanStep(step))
  for (const gate of plan.approval_gates ?? []) add({ step_id: gate, title: titleForStep(gate), approval_required: true, forbidden: false })
  for (const forbidden of plan.forbidden_steps ?? []) add({ step_id: forbidden, title: titleForStep(forbidden), approval_required: false, forbidden: true })
  return rows
}

export async function createStepsForAction(
  actionId: string,
  playbookPlan: PlaybookExecutionPlan | Record<string, unknown> | null | undefined
): Promise<WebOperatorActionStep[]> {
  if (!playbookPlan || typeof playbookPlan !== 'object') return []
  const plan = playbookPlan as PlaybookExecutionPlan
  const rows = buildRowsFromPlan(plan)
  if (rows.length === 0) return []

  const actionRes = await db.query(
    `SELECT operator_id, project_id, target_url, screenshot_url FROM web_operator_actions WHERE id=$1`,
    [actionId]
  )
  const action = actionRes.rows[0] ?? {}
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const initialStatus: WebOperatorActionStepStatus = row.forbidden ? 'blocked' : index === 0 ? 'running' : 'planned'
    await db.query(
      `INSERT INTO web_operator_action_steps
         (action_id, operator_id, project_id, step_index, step_id, title, status,
          approval_required, forbidden, url, screenshot_url, message, started_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (action_id, step_index) DO UPDATE SET
         step_id=EXCLUDED.step_id,
         title=EXCLUDED.title,
         approval_required=EXCLUDED.approval_required,
         forbidden=EXCLUDED.forbidden,
         updated_at=NOW()`,
      [
        actionId,
        action.operator_id ?? null,
        action.project_id ?? null,
        index,
        row.step_id,
        row.title,
        initialStatus,
        row.approval_required,
        row.forbidden,
        index === 0 ? action.target_url ?? null : null,
        index === 0 ? action.screenshot_url ?? null : null,
        row.forbidden ? 'Forbidden by playbook.' : index === 0 ? 'Started first safe step.' : null,
        index === 0 && !row.forbidden ? new Date().toISOString() : null,
      ]
    )
  }
  return listStepsForAction(actionId)
}

export async function listStepsForAction(actionId: string): Promise<WebOperatorActionStep[]> {
  try {
    const res = await db.query(
      `SELECT * FROM web_operator_action_steps WHERE action_id=$1 ORDER BY step_index ASC`,
      [actionId]
    )
    return res.rows.map(rowToStep)
  } catch {
    return []
  }
}

export async function getCurrentStepForAction(actionId: string): Promise<WebOperatorActionStep | null> {
  const res = await db.query(
    `SELECT * FROM web_operator_action_steps
     WHERE action_id=$1 AND status IN ('running','waiting_user','waiting_approval')
     ORDER BY step_index ASC LIMIT 1`,
    [actionId]
  )
  if (res.rows[0]) return rowToStep(res.rows[0])
  const planned = await db.query(
    `SELECT * FROM web_operator_action_steps
     WHERE action_id=$1 AND status='planned' AND forbidden=false
     ORDER BY step_index ASC LIMIT 1`,
    [actionId]
  )
  return planned.rows[0] ? rowToStep(planned.rows[0]) : null
}

export async function updateActionStepStatus(
  stepId: string,
  status: WebOperatorActionStepStatus,
  opts: {
    message?: string | null
    url?: string | null
    screenshot_url?: string | null
    result?: Record<string, unknown> | null
    enforceApproval?: boolean
  } = {}
): Promise<WebOperatorActionStep | null> {
  const existingRes = await db.query(
    `SELECT s.*, a.status AS action_status, a.approval_item_id
     FROM web_operator_action_steps s
     JOIN web_operator_actions a ON a.id=s.action_id
     WHERE s.id=$1`,
    [stepId]
  )
  const existing = existingRes.rows[0]
  if (!existing) return null
  if (Boolean(existing.forbidden) && status === 'completed') {
    throw new Error('Forbidden playbook steps cannot be marked completed.')
  }
  if (opts.enforceApproval !== false && Boolean(existing.approval_required) && status === 'completed') {
    const approvedExecution = existing.approval_item_id && existing.action_status === 'completed'
    if (!approvedExecution) {
      throw new Error('Approval-required playbook steps cannot be completed until the approved action runs.')
    }
  }

  const now = new Date().toISOString()
  const startedAt = ['running', 'waiting_user', 'waiting_approval'].includes(status) ? now : existing.started_at
  const completedAt = ['completed', 'failed', 'skipped', 'blocked'].includes(status) ? now : null
  const res = await db.query(
    `UPDATE web_operator_action_steps SET
       status=$1,
       message=COALESCE($2, message),
       url=COALESCE($3, url),
       screenshot_url=COALESCE($4, screenshot_url),
       result=COALESCE($5::jsonb, result),
       started_at=COALESCE(started_at, $6),
       completed_at=$7,
       updated_at=NOW()
     WHERE id=$8
     RETURNING *`,
    [
      status,
      opts.message ?? null,
      opts.url ?? null,
      opts.screenshot_url ?? null,
      opts.result ? JSON.stringify(redactResult(opts.result)) : null,
      startedAt,
      completedAt,
      stepId,
    ]
  )
  return res.rows[0] ? rowToStep(res.rows[0]) : null
}

async function updateCurrentOrNamedStep(
  actionId: string,
  status: WebOperatorActionStepStatus,
  opts: { stepId?: string | null; message?: string | null; url?: string | null; screenshot_url?: string | null; result?: Record<string, unknown> | null } = {}
): Promise<WebOperatorActionStep | null> {
  let step: WebOperatorActionStep | null = null
  if (opts.stepId) {
    const res = await db.query(
      `SELECT * FROM web_operator_action_steps WHERE action_id=$1 AND step_id=$2 ORDER BY step_index ASC LIMIT 1`,
      [actionId, opts.stepId]
    )
    step = res.rows[0] ? rowToStep(res.rows[0]) : null
  }
  step = step ?? await getCurrentStepForAction(actionId)
  if (!step) return null
  return updateActionStepStatus(step.id, status, opts)
}

export async function markStepWaitingUser(
  actionId: string,
  opts: { stepId?: string | null; message?: string | null; url?: string | null; screenshot_url?: string | null } = {}
): Promise<WebOperatorActionStep | null> {
  return updateCurrentOrNamedStep(actionId, 'waiting_user', opts)
}

export async function markStepWaitingApproval(
  actionId: string,
  opts: { stepId?: string | null; message?: string | null } = {}
): Promise<WebOperatorActionStep | null> {
  return updateCurrentOrNamedStep(actionId, 'waiting_approval', opts)
}

export async function markStepCompleted(
  actionId: string,
  opts: { stepId?: string | null; message?: string | null; url?: string | null; screenshot_url?: string | null; result?: Record<string, unknown> | null } = {}
): Promise<WebOperatorActionStep | null> {
  return updateCurrentOrNamedStep(actionId, 'completed', opts)
}

export async function markStepFailed(
  actionId: string,
  opts: { stepId?: string | null; message?: string | null; result?: Record<string, unknown> | null } = {}
): Promise<WebOperatorActionStep | null> {
  return updateCurrentOrNamedStep(actionId, 'failed', opts)
}

export async function markLatestWaitingUserStepReadyForOperator(
  operatorId: string,
  message = 'Manual blocker cleared. Ready to resume.'
): Promise<WebOperatorActionStep | null> {
  const res = await db.query(
    `SELECT s.*
     FROM web_operator_action_steps s
     JOIN web_operator_actions a ON a.id=s.action_id
     WHERE a.operator_id=$1 AND s.status='waiting_user'
     ORDER BY s.updated_at DESC
     LIMIT 1`,
    [operatorId]
  )
  const step = res.rows[0] ? rowToStep(res.rows[0]) : null
  if (!step) return null
  return updateActionStepStatus(step.id, 'planned', { message, enforceApproval: false })
}
