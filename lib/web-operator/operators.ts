import { db } from '@/lib/db/client'
import {
  startWebOperatorSession,
  stopWebOperatorSession,
} from '@/lib/web-operator/web-operator'
import type { WebOperatorSession } from '@/lib/web-operator/web-operator'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface WebOperator {
  id: string
  name: string
  role: string
  status: string          // idle | working | waiting_approval | waiting_user | user_controlling | ready_to_resume | paused | error
  project_id: string | null
  browser_profile_key: string
  current_session_id: string | null
  current_url: string | null
  current_task: string | null
  current_goal: string | null
  current_workflow: string | null
  last_instruction: string | null
  memory_summary: string | null
  requires_user_input: boolean
  waiting_reason: string | null
  pending_action_type: string | null
  pending_action_payload: Record<string, unknown> | null
  pending_action_created_at: string | null
  created_at: string
  updated_at: string
  // joined
  project_name?: string
  latest_screenshot?: string | null
}

// ── Row mapper ─────────────────────────────────────────────────────────────────

function rowToOperator(row: Record<string, unknown>): WebOperator {
  return {
    id: String(row.id),
    name: String(row.name),
    role: String(row.role ?? 'Web Operator'),
    status: String(row.status ?? 'idle'),
    project_id: row.project_id ? String(row.project_id) : null,
    browser_profile_key: String(row.browser_profile_key ?? 'default'),
    current_session_id: row.current_session_id ? String(row.current_session_id) : null,
    current_url: row.current_url ? String(row.current_url) : null,
    current_task: row.current_task ? String(row.current_task) : null,
    current_goal: row.current_goal ? String(row.current_goal) : null,
    current_workflow: row.current_workflow ? String(row.current_workflow) : null,
    last_instruction: row.last_instruction ? String(row.last_instruction) : null,
    memory_summary: row.memory_summary ? String(row.memory_summary) : null,
    requires_user_input: Boolean(row.requires_user_input),
    waiting_reason: row.waiting_reason ? String(row.waiting_reason) : null,
    pending_action_type: row.pending_action_type ? String(row.pending_action_type) : null,
    pending_action_payload: row.pending_action_payload && typeof row.pending_action_payload === 'object'
      ? row.pending_action_payload as Record<string, unknown>
      : null,
    pending_action_created_at: row.pending_action_created_at ? String(row.pending_action_created_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    project_name: row.project_name ? String(row.project_name) : undefined,
    latest_screenshot: row.latest_screenshot ? String(row.latest_screenshot) : null,
  }
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

// ── CRUD ───────────────────────────────────────────────────────────────────────

export async function getOrCreateOperatorByName(name: string): Promise<WebOperator> {
  try {
    const existing = await db.query(
      `SELECT wo.*, p.name AS project_name FROM web_operators wo
       LEFT JOIN projects p ON p.id = wo.project_id
       WHERE LOWER(wo.name) = LOWER($1)`,
      [name]
    )
    if (existing.rows[0]) return rowToOperator(existing.rows[0])

    const browser_profile_key = slugify(name)
    const inserted = await db.query(
      `INSERT INTO web_operators (name, role, status, browser_profile_key)
       VALUES ($1, 'Web Operator', 'idle', $2)
       RETURNING *`,
      [name, browser_profile_key]
    )
    return rowToOperator(inserted.rows[0])
  } catch (err) {
    // Graceful fallback if table doesn't exist
    return {
      id: 'fallback',
      name,
      role: 'Web Operator',
      status: 'idle',
      project_id: null,
      browser_profile_key: slugify(name),
      current_session_id: null,
      current_url: null,
      current_task: null,
      current_goal: null,
      current_workflow: null,
      last_instruction: null,
      memory_summary: null,
      requires_user_input: false,
      waiting_reason: null,
      pending_action_type: null,
      pending_action_payload: null,
      pending_action_created_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }
}

export async function createWebOperator(params: {
  name: string
  role?: string
  project_id?: string | null
}): Promise<WebOperator> {
  const browser_profile_key = slugify(params.name)
  const result = await db.query(
    `INSERT INTO web_operators (name, role, status, browser_profile_key, project_id)
     VALUES ($1, $2, 'idle', $3, $4)
     RETURNING *`,
    [
      params.name,
      params.role ?? 'Web Operator',
      browser_profile_key,
      params.project_id ?? null,
    ]
  )
  return rowToOperator(result.rows[0])
}

export async function getWebOperator(id: string): Promise<WebOperator | null> {
  try {
    const result = await db.query(
      `SELECT wo.*, p.name AS project_name
       FROM web_operators wo
       LEFT JOIN projects p ON p.id = wo.project_id
       WHERE wo.id = $1`,
      [id]
    )
    return result.rows[0] ? rowToOperator(result.rows[0]) : null
  } catch {
    return null
  }
}

export async function getWebOperatorByName(name: string): Promise<WebOperator | null> {
  try {
    const result = await db.query(
      `SELECT wo.*, p.name AS project_name
       FROM web_operators wo
       LEFT JOIN projects p ON p.id = wo.project_id
       WHERE LOWER(wo.name) = LOWER($1)`,
      [name]
    )
    return result.rows[0] ? rowToOperator(result.rows[0]) : null
  } catch {
    return null
  }
}

export async function listWebOperators(): Promise<WebOperator[]> {
  try {
    const result = await db.query(
      `SELECT wo.*,
              p.name AS project_name,
              (SELECT screenshot_url FROM web_operator_actions
               WHERE operator_id = wo.id AND screenshot_url IS NOT NULL
               ORDER BY created_at DESC LIMIT 1) AS latest_screenshot
       FROM web_operators wo
       LEFT JOIN projects p ON p.id = wo.project_id
       ORDER BY wo.updated_at DESC`
    )
    return result.rows.map(rowToOperator)
  } catch {
    return []
  }
}

export async function assignOperatorToProject(
  operator_id: string,
  project_id: string
): Promise<void> {
  await db.query(
    `UPDATE web_operators SET project_id=$1, updated_at=NOW() WHERE id=$2`,
    [project_id, operator_id]
  )
}

export async function updateOperatorStatus(
  operator_id: string,
  status: string,
  opts?: {
    current_url?: string | null
    current_task?: string | null
    current_session_id?: string | null
  }
): Promise<void> {
  try {
    const sets: string[] = ['status=$1', 'updated_at=NOW()']
    const values: unknown[] = [status]
    let idx = 2

    if (opts?.current_url !== undefined) { sets.push(`current_url=$${idx++}`); values.push(opts.current_url) }
    if (opts?.current_task !== undefined) { sets.push(`current_task=$${idx++}`); values.push(opts.current_task) }
    if (opts?.current_session_id !== undefined) { sets.push(`current_session_id=$${idx++}`); values.push(opts.current_session_id) }

    values.push(operator_id)
    await db.query(
      `UPDATE web_operators SET ${sets.join(', ')} WHERE id=$${idx}`,
      values
    )
  } catch {
    // non-fatal: table may not exist yet
  }
}

export async function startOperatorSession(
  operator_id: string,
  opts: { project_id?: string; permission_mode?: string }
): Promise<WebOperatorSession> {
  await updateOperatorStatus(operator_id, 'working')

  const operator = await getWebOperator(operator_id)
  const session = await startWebOperatorSession({
    project_id: opts.project_id ?? operator?.project_id ?? null,
    agent_role: operator?.role ?? 'Web Operator',
    permission_mode: opts.permission_mode,
  })

  // Store operator_id and browser_profile_key on the session
  try {
    await db.query(
      `UPDATE web_operator_sessions SET operator_id=$1, browser_profile_key=$2 WHERE id=$3`,
      [operator_id, operator?.browser_profile_key ?? 'default', session.id]
    )
  } catch {
    // non-fatal if columns don't exist yet
  }

  await updateOperatorStatus(operator_id, 'working', { current_session_id: session.id })
  return session
}

export async function stopOperatorSession(operator_id: string): Promise<void> {
  const operator = await getWebOperator(operator_id)
  if (operator?.current_session_id) {
    await stopWebOperatorSession(operator.current_session_id).catch(() => {})
  }
  await updateOperatorStatus(operator_id, 'idle', {
    current_session_id: null,
    current_url: null,
    current_task: null,
  })
}

export async function getOperatorStatus(operator_id: string): Promise<{
  operator: WebOperator | null
  current_session: Record<string, unknown> | null
  recent_actions: Record<string, unknown>[]
  latest_screenshot: string | null
}> {
  try {
    const [operator, actionsRes] = await Promise.all([
      getWebOperator(operator_id),
      db.query(
        `SELECT * FROM web_operator_actions
         WHERE operator_id = $1
         ORDER BY created_at DESC LIMIT 5`,
        [operator_id]
      ),
    ])

    let current_session: Record<string, unknown> | null = null
    if (operator?.current_session_id) {
      const sesRes = await db.query(
        `SELECT * FROM web_operator_sessions WHERE id=$1`,
        [operator.current_session_id]
      )
      current_session = sesRes.rows[0] ?? null
    }

    const recent_actions = actionsRes.rows
    const latest_screenshot = recent_actions.find(
      (a: Record<string, unknown>) => a.screenshot_url
    )?.screenshot_url as string | null ?? null

    return { operator, current_session, recent_actions, latest_screenshot }
  } catch {
    return { operator: null, current_session: null, recent_actions: [], latest_screenshot: null }
  }
}

export async function resolveOperatorFromText(text: string): Promise<WebOperator | null> {
  try {
    const operators = await listWebOperators()
    if (operators.length === 0) return null

    const lower = text.toLowerCase()
    for (const op of operators) {
      if (lower.includes(op.name.toLowerCase())) {
        return op
      }
    }
    return null
  } catch {
    return null
  }
}

// ── Operator memory ────────────────────────────────────────────────────────────

export async function updateOperatorMemory(
  operator_id: string,
  opts: {
    current_goal?: string | null
    current_workflow?: string | null
    last_instruction?: string | null
    memory_summary?: string | null
    requires_user_input?: boolean
    waiting_reason?: string | null
  }
): Promise<void> {
  try {
    const sets: string[] = []
    const vals: unknown[] = []
    let i = 1

    if (opts.current_goal !== undefined) { sets.push(`current_goal=$${i++}`); vals.push(opts.current_goal) }
    if (opts.current_workflow !== undefined) { sets.push(`current_workflow=$${i++}`); vals.push(opts.current_workflow) }
    if (opts.last_instruction !== undefined) { sets.push(`last_instruction=$${i++}`); vals.push(opts.last_instruction) }
    if (opts.memory_summary !== undefined) { sets.push(`memory_summary=$${i++}`); vals.push(opts.memory_summary) }
    if (opts.requires_user_input !== undefined) { sets.push(`requires_user_input=$${i++}`); vals.push(opts.requires_user_input) }
    if (opts.waiting_reason !== undefined) { sets.push(`waiting_reason=$${i++}`); vals.push(opts.waiting_reason) }

    if (sets.length === 0) return
    sets.push(`updated_at=NOW()`)
    vals.push(operator_id)
    await db.query(
      `UPDATE web_operators SET ${sets.join(', ')} WHERE id=$${i}`,
      vals
    )
  } catch {
    // non-fatal
  }
}

export async function getOperatorMemory(operator_id: string): Promise<{
  current_goal: string | null
  current_workflow: string | null
  last_instruction: string | null
  memory_summary: string | null
  requires_user_input: boolean
  waiting_reason: string | null
  current_url: string | null
  current_task: string | null
} | null> {
  try {
    const result = await db.query(
      `SELECT current_goal, current_workflow, last_instruction, memory_summary,
              requires_user_input, waiting_reason, current_url, current_task
       FROM web_operators WHERE id=$1`,
      [operator_id]
    )
    if (!result.rows[0]) return null
    const row = result.rows[0]
    return {
      current_goal: row.current_goal ? String(row.current_goal) : null,
      current_workflow: row.current_workflow ? String(row.current_workflow) : null,
      last_instruction: row.last_instruction ? String(row.last_instruction) : null,
      memory_summary: row.memory_summary ? String(row.memory_summary) : null,
      requires_user_input: Boolean(row.requires_user_input),
      waiting_reason: row.waiting_reason ? String(row.waiting_reason) : null,
      current_url: row.current_url ? String(row.current_url) : null,
      current_task: row.current_task ? String(row.current_task) : null,
    }
  } catch {
    return null
  }
}

export async function summarizeOperatorState(operator_id: string): Promise<string> {
  try {
    const result = await db.query(
      `SELECT name, status, current_url, current_task, current_goal, last_instruction,
              current_workflow, requires_user_input, waiting_reason
       FROM web_operators WHERE id=$1`,
      [operator_id]
    )
    if (!result.rows[0]) return 'Operator not found'
    const row = result.rows[0]
    const name = String(row.name ?? 'Unknown')
    const status = String(row.status ?? 'idle')
    const workflow = row.current_workflow ? String(row.current_workflow) : null
    const goal = row.current_goal ? String(row.current_goal) : null
    const lastInstr = row.last_instruction ? String(row.last_instruction) : null
    const waiting = Boolean(row.requires_user_input)
    const waitReason = row.waiting_reason ? String(row.waiting_reason) : null
    const url = row.current_url ? String(row.current_url) : null

    const parts = [name, status]
    if (workflow) parts.push(workflow)
    if (goal) parts.push(`Goal: ${goal}`)
    if (lastInstr) parts.push(`Last: ${lastInstr}`)
    if (url && !goal) parts.push(url)
    parts.push(waiting ? `Waiting: ${waitReason ?? 'user input needed'}` : 'Waiting: no')

    return parts.join(' | ')
  } catch {
    return 'Operator state unavailable'
  }
}

export async function clearOperatorWorkflow(operator_id: string): Promise<void> {
  try {
    await db.query(
      `UPDATE web_operators
       SET current_goal=NULL, current_workflow=NULL, last_instruction=NULL,
           requires_user_input=false, waiting_reason=NULL,
           current_task=NULL, status='idle',
           pending_action_type=NULL, pending_action_payload=NULL, pending_action_created_at=NULL,
           updated_at=NOW()
       WHERE id=$1`,
      [operator_id]
    )
  } catch {
    // non-fatal
  }
}

// ── Takeover / pending action helpers ──────────────────────────────────────────

export async function storePendingAction(
  operator_id: string,
  action_type: string,
  payload: Record<string, unknown>
): Promise<void> {
  // Strip any sensitive fields before storing
  const safePayload = { ...payload }
  delete safePayload.password
  delete safePayload.secret
  delete safePayload.token
  delete safePayload.apiKey
  await db.query(
    `UPDATE web_operators SET
      pending_action_type=$1, pending_action_payload=$2, pending_action_created_at=NOW(), updated_at=NOW()
     WHERE id=$3`,
    [action_type, JSON.stringify(safePayload), operator_id]
  )
}

export async function clearPendingAction(operator_id: string): Promise<void> {
  await db.query(
    `UPDATE web_operators SET pending_action_type=NULL, pending_action_payload=NULL, pending_action_created_at=NULL, updated_at=NOW() WHERE id=$1`,
    [operator_id]
  )
}

export async function markLoginCompleted(
  operator_id: string
): Promise<{ success: boolean; was_logged_in: boolean; message: string }> {
  const op = await getWebOperator(operator_id)
  if (!op) return { success: false, was_logged_in: false, message: 'Operator not found' }

  try {
    const { executeDetectGmailLogin } = await import('./playwright-executor')
    const result = await executeDetectGmailLogin({ profileKey: op.browser_profile_key })
    const isLoggedIn = result.output?.is_logged_in === true

    if (isLoggedIn) {
      await updateOperatorMemory(operator_id, {
        requires_user_input: false,
        waiting_reason: null,
        memory_summary: 'Logged in. Ready to continue workflow.',
      })
      await updateOperatorStatus(operator_id, 'ready_to_resume', {
        current_task: op.pending_action_type ? `Resume: ${op.pending_action_type}` : 'Ready',
      })
      return { success: true, was_logged_in: true, message: 'Login confirmed. Operator is ready to resume.' }
    } else {
      return { success: false, was_logged_in: false, message: 'Still not logged in. Please complete the login in the operator browser and try again.' }
    }
  } catch (err) {
    return {
      success: false,
      was_logged_in: false,
      message: `Could not verify login: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

export async function resumeOperatorWorkflow(
  operator_id: string
): Promise<{ success: boolean; result?: unknown; message: string }> {
  const op = await getWebOperator(operator_id)
  if (!op?.pending_action_type) {
    return { success: false, message: 'No pending action to resume.' }
  }
  if (op.requires_user_input) {
    return { success: false, message: `Cannot resume: ${op.waiting_reason ?? 'user input still required'}` }
  }

  const { delegateToWebOperator } = await import('./delegation')
  const result = await delegateToWebOperator({
    operatorName: op.name,
    projectId: op.project_id ?? undefined,
    requestedByRole: 'Resume',
    actionType: op.pending_action_type,
    instruction: `Resume: ${op.pending_action_type}`,
    payload: op.pending_action_payload ?? {},
  })

  if (result.status === 'completed') {
    await clearPendingAction(operator_id)
    await updateOperatorStatus(operator_id, 'idle')
  }

  return {
    success: result.status === 'completed',
    result,
    message: result.message,
  }
}

export async function pauseOperator(operator_id: string, reason?: string): Promise<void> {
  await updateOperatorMemory(operator_id, { waiting_reason: reason ?? 'Paused by user' })
  await updateOperatorStatus(operator_id, 'paused')
}

export async function markUserControlling(operator_id: string): Promise<void> {
  await updateOperatorStatus(operator_id, 'user_controlling', { current_task: 'User is in control' })
  await updateOperatorMemory(operator_id, { requires_user_input: false, waiting_reason: null })
}
