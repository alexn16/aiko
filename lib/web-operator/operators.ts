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
  status: string          // idle | working | waiting_approval | paused | error
  project_id: string | null
  browser_profile_key: string
  current_session_id: string | null
  current_url: string | null
  current_task: string | null
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
