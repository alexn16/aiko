import { db } from '@/lib/db/client'
import { canPerformAction, getModeState } from '@/lib/operating-mode'
import { createApprovalItem } from '@/lib/approvals'
import type { ModeState } from '@/lib/operating-mode'
import type { ApprovalItem } from '@/lib/approvals'

// ── Types ──────────────────────────────────────────────────────────────────────

export type WebOperatorActionType =
  | 'search' | 'open_url' | 'read_page' | 'click' | 'type'
  | 'fill_form' | 'create_email_draft' | 'send_email' | 'submit_form'
  | 'download_file' | 'copy_data' | 'login_required'
  | 'approval_required' | 'blocked'

export interface WebOperatorSession {
  id: string
  status: string
  current_url: string | null
  project_id: string | null
  agent_role: string
  permission_mode: string
  started_at: string
  ended_at: string | null
  last_error: string | null
}

export interface WebOperatorAction {
  id: string
  session_id: string | null
  project_id: string | null
  agent_role: string
  action_type: WebOperatorActionType
  target_url: string | null
  description: string
  status: string
  input: Record<string, unknown>
  output: Record<string, unknown>
  screenshot_url: string | null
  requires_approval: boolean
  approval_item_id: string | null
  source_task_id: string | null
  requested_by_role: string | null
  created_at: string
  completed_at: string | null
}

// ── Internal helpers ───────────────────────────────────────────────────────────

const SENSITIVE_ACTIONS = ['send_email', 'submit_form', 'create_email_draft', 'download_file']

function isSensitiveAction(type: string): boolean {
  return SENSITIVE_ACTIONS.includes(type)
}

const ALWAYS_REQUIRES_APPROVAL = ['send_email', 'submit_form']
const AUTO_REQUIRES_APPROVAL = ['send_email', 'submit_form', 'create_email_draft', 'fill_form', 'click']

function requiresApproval(action_type: string, mode: string): boolean {
  if (ALWAYS_REQUIRES_APPROVAL.includes(action_type) && mode !== 'full_access') return true
  if (mode === 'auto_approval' && AUTO_REQUIRES_APPROVAL.includes(action_type)) return true
  return false
}

async function checkBrowserRuntime(): Promise<boolean> {
  try {
    const pw = await import('playwright').catch(() => null)
    return pw !== null
  } catch {
    return false
  }
}

// ── Session functions ──────────────────────────────────────────────────────────

export async function startWebOperatorSession(opts: {
  project_id?: string | null
  agent_role?: string
  permission_mode?: string
}): Promise<WebOperatorSession> {
  let permission_mode = opts.permission_mode
  if (!permission_mode) {
    try {
      const state = await getModeState()
      permission_mode = state.mode
    } catch {
      permission_mode = 'read_only'
    }
  }

  const result = await db.query(
    `INSERT INTO web_operator_sessions (project_id, agent_role, permission_mode, status)
     VALUES ($1, $2, $3, 'active')
     RETURNING *`,
    [opts.project_id ?? null, opts.agent_role ?? 'Web Operator', permission_mode]
  )
  return rowToSession(result.rows[0])
}

export async function stopWebOperatorSession(session_id: string): Promise<void> {
  await db.query(
    `UPDATE web_operator_sessions SET status='stopped', ended_at=NOW() WHERE id=$1`,
    [session_id]
  )
}

export async function getWebOperatorSession(session_id: string): Promise<WebOperatorSession | null> {
  try {
    const result = await db.query(
      `SELECT * FROM web_operator_sessions WHERE id=$1`,
      [session_id]
    )
    return result.rows[0] ? rowToSession(result.rows[0]) : null
  } catch {
    return null
  }
}

export async function getActiveSession(): Promise<WebOperatorSession | null> {
  try {
    const result = await db.query(
      `SELECT * FROM web_operator_sessions
       WHERE status NOT IN ('stopped','error')
       ORDER BY started_at DESC LIMIT 1`
    )
    return result.rows[0] ? rowToSession(result.rows[0]) : null
  } catch {
    return null
  }
}

// ── Action functions ───────────────────────────────────────────────────────────

export async function logWebOperatorAction(params: {
  session_id?: string | null
  project_id?: string | null
  agent_role?: string
  action_type: WebOperatorActionType
  target_url?: string | null
  description: string
  input?: Record<string, unknown>
  status?: string
  requires_approval?: boolean
  source_task_id?: string | null
  requested_by_role?: string | null
}): Promise<WebOperatorAction> {
  const result = await db.query(
    `INSERT INTO web_operator_actions
       (session_id, project_id, agent_role, action_type, target_url,
        description, input, status, requires_approval,
        source_task_id, requested_by_role)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      params.session_id ?? null,
      params.project_id ?? null,
      params.agent_role ?? 'Web Operator',
      params.action_type,
      params.target_url ?? null,
      params.description,
      JSON.stringify(params.input ?? {}),
      params.status ?? 'pending',
      params.requires_approval ?? false,
      params.source_task_id ?? null,
      params.requested_by_role ?? null,
    ]
  )
  return rowToAction(result.rows[0])
}

export async function updateWebOperatorAction(
  id: string,
  fields: Partial<{
    status: string
    output: Record<string, unknown>
    screenshot_url: string | null
    completed_at: string
    approval_item_id: string | null
  }>
): Promise<void> {
  const sets: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (fields.status !== undefined) { sets.push(`status=$${idx++}`); values.push(fields.status) }
  if (fields.output !== undefined) { sets.push(`output=$${idx++}`); values.push(JSON.stringify(fields.output)) }
  if (fields.screenshot_url !== undefined) { sets.push(`screenshot_url=$${idx++}`); values.push(fields.screenshot_url) }
  if (fields.completed_at !== undefined) { sets.push(`completed_at=$${idx++}`); values.push(fields.completed_at) }
  if (fields.approval_item_id !== undefined) { sets.push(`approval_item_id=$${idx++}`); values.push(fields.approval_item_id) }

  if (sets.length === 0) return
  values.push(id)
  await db.query(`UPDATE web_operator_actions SET ${sets.join(', ')} WHERE id=$${idx}`, values)
}

export async function listWebOperatorActions(filters: {
  project_id?: string
  session_id?: string
  status?: string
  agent_role?: string
  limit?: number
} = {}): Promise<WebOperatorAction[]> {
  const conditions: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (filters.project_id) { conditions.push(`project_id=$${idx++}`); values.push(filters.project_id) }
  if (filters.session_id) { conditions.push(`session_id=$${idx++}`); values.push(filters.session_id) }
  if (filters.status) { conditions.push(`status=$${idx++}`); values.push(filters.status) }
  if (filters.agent_role) { conditions.push(`agent_role=$${idx++}`); values.push(filters.agent_role) }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = filters.limit ?? 50

  try {
    const result = await db.query(
      `SELECT * FROM web_operator_actions ${where} ORDER BY created_at DESC LIMIT ${limit}`,
      values
    )
    return result.rows.map(rowToAction)
  } catch {
    return []
  }
}

export async function requireOperatorApproval(
  action_id: string,
  opts: { project_id?: string | null; title: string; content: string; agent_role: string }
): Promise<ApprovalItem> {
  const approval = await createApprovalItem({
    project_id: opts.project_id ?? null,
    item_type: 'approval_item',
    title: `Web Operator: ${opts.title}`,
    content: opts.content,
    requested_by_role: opts.agent_role,
    status: 'pending',
  })
  await updateWebOperatorAction(action_id, { status: 'waiting_approval', approval_item_id: approval.id })
  return approval
}

// ── Main execution ─────────────────────────────────────────────────────────────

export async function runWebOperatorAction(opts: {
  session_id?: string | null
  project_id?: string | null
  agent_role?: string
  action_type: WebOperatorActionType
  target_url?: string | null
  description: string
  input?: Record<string, unknown>
  source_task_id?: string | null
  requested_by_role?: string | null
}): Promise<{
  success: boolean
  action: WebOperatorAction
  error?: string
  waiting_approval?: boolean
  approval?: ApprovalItem
}> {
  // 1. Check operating mode
  const modeCheck = await canPerformAction(
    isSensitiveAction(opts.action_type) ? 'send_email' : 'browse_web',
    { project_id: opts.project_id ?? undefined, agent_role: opts.agent_role }
  )

  if (!modeCheck.allowed) {
    const action = await logWebOperatorAction({ ...opts, status: 'blocked', requires_approval: false })
    await updateWebOperatorAction(action.id, { output: { error: modeCheck.reason } })
    return { success: false, action, error: modeCheck.reason }
  }

  // 2. Check if action requires approval
  const needsApproval = requiresApproval(opts.action_type, modeCheck.mode)
  if (needsApproval) {
    const action = await logWebOperatorAction({ ...opts, status: 'waiting_approval', requires_approval: true })
    const approval = await requireOperatorApproval(action.id, {
      project_id: opts.project_id,
      title: opts.description,
      content: `Web Operator action requested:\nType: ${opts.action_type}\nURL: ${opts.target_url ?? 'n/a'}\nDescription: ${opts.description}`,
      agent_role: opts.agent_role ?? 'Web Operator',
    })
    return { success: false, action, approval, waiting_approval: true }
  }

  // 3. Log as running
  const action = await logWebOperatorAction({ ...opts, status: 'running' })

  // 4. Check browser runtime
  const browserAvailable = await checkBrowserRuntime()
  if (!browserAvailable) {
    await updateWebOperatorAction(action.id, {
      status: 'failed',
      output: { error: 'Browser runtime not configured. Install and configure Playwright to enable web automation.' },
      completed_at: new Date().toISOString(),
    })
    return { success: false, action, error: 'Browser runtime not configured.' }
  }

  // 5. Execute via browser runtime
  // Playwright is available — route to executor
  try {
    const { executeWebAction } = await import('./playwright-executor')
    const result = await executeWebAction(action, opts)
    await updateWebOperatorAction(action.id, {
      status: 'completed',
      output: result.output,
      screenshot_url: result.screenshot_url ?? null,
      completed_at: new Date().toISOString(),
    })
    // Refresh and return updated action
    const updated = await db.query(`SELECT * FROM web_operator_actions WHERE id=$1`, [action.id])
    return { success: true, action: updated.rows[0] ? rowToAction(updated.rows[0]) : action }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    await updateWebOperatorAction(action.id, {
      status: 'failed',
      output: { error: errMsg },
      completed_at: new Date().toISOString(),
    })
    return { success: false, action, error: errMsg }
  }
}

// ── Status ─────────────────────────────────────────────────────────────────────

export async function getWebOperatorStatus(): Promise<{
  browser_available: boolean
  active_session: WebOperatorSession | null
  pending_approvals: number
  recent_actions: WebOperatorAction[]
  mode: ModeState
}> {
  const [browserAvailable, activeSession, mode, recentActions] = await Promise.all([
    checkBrowserRuntime(),
    getActiveSession(),
    getModeState(),
    listWebOperatorActions({ limit: 5 }),
  ])

  let pending_approvals = 0
  try {
    const res = await db.query(
      `SELECT COUNT(*) AS n FROM approval_items WHERE status='pending' AND title LIKE 'Web Operator:%'`
    )
    pending_approvals = parseInt(res.rows[0]?.n ?? '0', 10)
  } catch {
    // non-fatal
  }

  return {
    browser_available: browserAvailable,
    active_session: activeSession,
    pending_approvals,
    recent_actions: recentActions,
    mode,
  }
}

// ── Row mappers ────────────────────────────────────────────────────────────────

function rowToSession(row: Record<string, unknown>): WebOperatorSession {
  return {
    id: String(row.id),
    status: String(row.status),
    current_url: row.current_url ? String(row.current_url) : null,
    project_id: row.project_id ? String(row.project_id) : null,
    agent_role: String(row.agent_role),
    permission_mode: String(row.permission_mode),
    started_at: String(row.started_at),
    ended_at: row.ended_at ? String(row.ended_at) : null,
    last_error: row.last_error ? String(row.last_error) : null,
  }
}

function rowToAction(row: Record<string, unknown>): WebOperatorAction {
  return {
    id: String(row.id),
    session_id: row.session_id ? String(row.session_id) : null,
    project_id: row.project_id ? String(row.project_id) : null,
    agent_role: String(row.agent_role),
    action_type: row.action_type as WebOperatorActionType,
    target_url: row.target_url ? String(row.target_url) : null,
    description: String(row.description),
    status: String(row.status),
    input: typeof row.input === 'object' && row.input !== null ? row.input as Record<string, unknown> : {},
    output: typeof row.output === 'object' && row.output !== null ? row.output as Record<string, unknown> : {},
    screenshot_url: row.screenshot_url ? String(row.screenshot_url) : null,
    requires_approval: Boolean(row.requires_approval),
    approval_item_id: row.approval_item_id ? String(row.approval_item_id) : null,
    source_task_id: row.source_task_id ? String(row.source_task_id) : null,
    requested_by_role: row.requested_by_role ? String(row.requested_by_role) : null,
    created_at: String(row.created_at),
    completed_at: row.completed_at ? String(row.completed_at) : null,
  }
}
