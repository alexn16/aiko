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
  | 'open_gmail' | 'detect_gmail_login'
  | 'fill_gmail_to' | 'fill_gmail_subject' | 'fill_gmail_body' | 'send_gmail_draft'

export interface WebOperatorSession {
  id: string
  status: string
  current_url: string | null
  page_title: string | null
  project_id: string | null
  agent_role: string
  permission_mode: string
  started_at: string
  ended_at: string | null
  last_error: string | null
  recovery_count: number
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
  page_title: string | null
  page_preview: string | null
  retry_count: number
  failure_reason: string | null
  is_sensitive: boolean
  requires_approval: boolean
  approval_item_id: string | null
  source_task_id: string | null
  requested_by_role: string | null
  lead_id: string | null
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
  operator_id?: string | null
  browser_profile_key?: string | null
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
    `INSERT INTO web_operator_sessions (project_id, agent_role, permission_mode, status, operator_id, browser_profile_key)
     VALUES ($1, $2, $3, 'active', $4, $5)
     RETURNING *`,
    [
      opts.project_id ?? null,
      opts.agent_role ?? 'Web Operator',
      permission_mode,
      opts.operator_id ?? null,
      opts.browser_profile_key ?? null,
    ]
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
  operator_id?: string | null
  lead_id?: string | null
}): Promise<WebOperatorAction> {
  const result = await db.query(
    `INSERT INTO web_operator_actions
       (session_id, project_id, agent_role, action_type, target_url,
        description, input, status, requires_approval,
        source_task_id, requested_by_role, operator_id, lead_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
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
      params.operator_id ?? null,
      params.lead_id ?? null,
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
    page_title: string | null
    page_preview: string | null
    retry_count: number
    failure_reason: string | null
    is_sensitive: boolean
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
  if (fields.page_title !== undefined) { sets.push(`page_title=$${idx++}`); values.push(fields.page_title) }
  if (fields.page_preview !== undefined) { sets.push(`page_preview=$${idx++}`); values.push(fields.page_preview) }
  if (fields.retry_count !== undefined) { sets.push(`retry_count=$${idx++}`); values.push(fields.retry_count) }
  if (fields.failure_reason !== undefined) { sets.push(`failure_reason=$${idx++}`); values.push(fields.failure_reason) }
  if (fields.is_sensitive !== undefined) { sets.push(`is_sensitive=$${idx++}`); values.push(fields.is_sensitive) }
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
  operator_id?: string
  limit?: number
} = {}): Promise<WebOperatorAction[]> {
  const conditions: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (filters.project_id) { conditions.push(`project_id=$${idx++}`); values.push(filters.project_id) }
  if (filters.session_id) { conditions.push(`session_id=$${idx++}`); values.push(filters.session_id) }
  if (filters.status) { conditions.push(`status=$${idx++}`); values.push(filters.status) }
  if (filters.agent_role) { conditions.push(`agent_role=$${idx++}`); values.push(filters.agent_role) }
  if (filters.operator_id) { conditions.push(`operator_id=$${idx++}`); values.push(filters.operator_id) }

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
    item_type: 'web_operator_action',
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
  operator_id?: string | null
  lead_id?: string | null
  profileKey?: string | null
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
    const action = await logWebOperatorAction({ ...opts, status: 'blocked', requires_approval: false, operator_id: opts.operator_id ?? null })
    await updateWebOperatorAction(action.id, { output: { error: modeCheck.reason } })
    return { success: false, action, error: modeCheck.reason }
  }

  // 2. Check if action requires approval
  const needsApproval = requiresApproval(opts.action_type, modeCheck.mode)
  if (needsApproval) {
    const action = await logWebOperatorAction({ ...opts, status: 'waiting_approval', requires_approval: true, operator_id: opts.operator_id ?? null })
    const approval = await requireOperatorApproval(action.id, {
      project_id: opts.project_id,
      title: opts.description,
      content: `Web Operator action requested:\nType: ${opts.action_type}\nURL: ${opts.target_url ?? 'n/a'}\nDescription: ${opts.description}`,
      agent_role: opts.agent_role ?? 'Web Operator',
    })
    return { success: false, action, approval, waiting_approval: true }
  }

  // 3. Log as running
  const action = await logWebOperatorAction({ ...opts, status: 'running', operator_id: opts.operator_id ?? null })

  // 4. Check browser runtime
  const browserAvailable = await checkBrowserRuntime()
  if (!browserAvailable) {
    await updateWebOperatorAction(action.id, {
      status: 'failed',
      output: { error: 'Browser runtime not configured. Install and configure Playwright to enable web automation.' },
      failure_reason: 'browser_not_available',
      completed_at: new Date().toISOString(),
    })
    return { success: false, action, error: 'Browser runtime not configured.' }
  }

  // 5. Execute via browser runtime
  // Playwright is available — route to executor
  try {
    const { executeWebAction, recoverSession } = await import('./playwright-executor')
    let result
    const execOpts = {
      action_type: opts.action_type,
      target_url: opts.target_url ?? undefined,
      description: opts.description,
      input: opts.input,
      profileKey: opts.profileKey ?? undefined,
    }
    try {
      result = await executeWebAction(action, execOpts)
    } catch (execErr) {
      // If browser crashed, attempt session recovery and retry once
      const reason = (execErr as { failure_reason?: string }).failure_reason ?? 'unknown_error'
      if (reason === 'browser_not_available' && opts.session_id) {
        const recovery = await recoverSession()
        if (recovery.success) {
          // Increment session recovery_count
          await db.query(
            `UPDATE web_operator_sessions SET recovery_count = recovery_count + 1 WHERE id=$1`,
            [opts.session_id]
          ).catch(() => {})
          result = await executeWebAction(action, execOpts)
        } else {
          throw execErr
        }
      } else {
        throw execErr
      }
    }

    // Extract page state from result, strip _page from stored output
    const pageState = result._page
    const cleanOutput = { ...result.output }

    await updateWebOperatorAction(action.id, {
      status: 'completed',
      output: cleanOutput,
      screenshot_url: pageState?.screenshot_url ?? result.screenshot_url ?? null,
      page_title: pageState?.title ?? null,
      page_preview: pageState?.preview ?? null,
      is_sensitive: pageState?.is_sensitive ?? false,
      retry_count: result.retry_count ?? 0,
      completed_at: new Date().toISOString(),
    })

    // Update session current_url and page_title if we have page state
    if (pageState?.url && opts.session_id) {
      await db.query(
        `UPDATE web_operator_sessions SET current_url=$1, page_title=$2 WHERE id=$3`,
        [pageState.url, pageState.title ?? null, opts.session_id]
      ).catch(() => {})
    }

    // Update operator current_url if operator_id is present (direct db.query to avoid circular imports)
    if (opts.operator_id && pageState?.url) {
      await db.query(
        `UPDATE web_operators SET current_url=$1, updated_at=NOW() WHERE id=$2`,
        [pageState.url, opts.operator_id]
      ).catch(() => {})
    }

    // Refresh and return updated action
    const updated = await db.query(`SELECT * FROM web_operator_actions WHERE id=$1`, [action.id])
    return { success: true, action: updated.rows[0] ? rowToAction(updated.rows[0]) : action }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    const failure_reason = (err as { failure_reason?: string }).failure_reason ?? 'unknown_error'
    await updateWebOperatorAction(action.id, {
      status: 'failed',
      output: { error: errMsg },
      failure_reason,
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
    page_title: row.page_title ? String(row.page_title) : null,
    project_id: row.project_id ? String(row.project_id) : null,
    agent_role: String(row.agent_role),
    permission_mode: String(row.permission_mode),
    started_at: String(row.started_at),
    ended_at: row.ended_at ? String(row.ended_at) : null,
    last_error: row.last_error ? String(row.last_error) : null,
    recovery_count: typeof row.recovery_count === 'number' ? row.recovery_count : parseInt(String(row.recovery_count ?? '0'), 10),
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
    page_title: row.page_title ? String(row.page_title) : null,
    page_preview: row.page_preview ? String(row.page_preview) : null,
    retry_count: typeof row.retry_count === 'number' ? row.retry_count : parseInt(String(row.retry_count ?? '0'), 10),
    failure_reason: row.failure_reason ? String(row.failure_reason) : null,
    is_sensitive: Boolean(row.is_sensitive),
    requires_approval: Boolean(row.requires_approval),
    approval_item_id: row.approval_item_id ? String(row.approval_item_id) : null,
    source_task_id: row.source_task_id ? String(row.source_task_id) : null,
    requested_by_role: row.requested_by_role ? String(row.requested_by_role) : null,
    lead_id: row.lead_id ? String(row.lead_id) : null,
    created_at: String(row.created_at),
    completed_at: row.completed_at ? String(row.completed_at) : null,
  }
}
