import { db } from '@/lib/db/client'
import { canPerformAction, getModeState } from '@/lib/operating-mode'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ToolRun {
  id: string
  project_id: string | null
  agent_role: string
  tool_type: string
  action: string
  status: string
  input: Record<string, unknown>
  output: Record<string, unknown>
  error: string | null
  permission_mode: string
  created_at: string
  completed_at: string | null
}

export interface ToolConnection {
  id: string
  tool_type: string
  name: string
  status: string
  config: Record<string, unknown>
  last_tested_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
  // NOTE: never return encrypted_secret to client
}

// ── Tool connection helpers ────────────────────────────────────────────────────

export async function getToolConnection(tool_type: string): Promise<ToolConnection | null> {
  try {
    const result = await db.query(
      `SELECT id, tool_type, name, status, config, last_tested_at, last_error, created_at, updated_at
       FROM tool_connections WHERE tool_type=$1 LIMIT 1`,
      [tool_type]
    )
    return result.rows[0] ?? null
  } catch {
    return null
  }
}

export async function listToolConnections(): Promise<ToolConnection[]> {
  try {
    const result = await db.query(
      `SELECT id, tool_type, name, status, config, last_tested_at, last_error, created_at, updated_at
       FROM tool_connections ORDER BY tool_type ASC`
    )
    return result.rows as ToolConnection[]
  } catch {
    return []
  }
}

export async function checkToolAvailable(tool_type: string): Promise<{ available: boolean; reason: string }> {
  const conn = await getToolConnection(tool_type)
  if (!conn || conn.status !== 'connected') {
    return { available: false, reason: 'Tool not connected. Configure it at /tools.' }
  }
  return { available: true, reason: 'Tool available.' }
}

// ── Tool run logging ───────────────────────────────────────────────────────────

export async function logToolRun(params: {
  project_id?: string
  agent_role?: string
  tool_type: string
  action: string
  input?: Record<string, unknown>
  status?: string
  permission_mode?: string
}): Promise<string> {
  let permission_mode = params.permission_mode
  if (!permission_mode) {
    try {
      const state = await getModeState()
      permission_mode = state.mode
    } catch {
      permission_mode = 'read_only'
    }
  }

  const result = await db.query(
    `INSERT INTO tool_runs (project_id, agent_role, tool_type, action, input, status, permission_mode)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [
      params.project_id ?? null,
      params.agent_role ?? 'system',
      params.tool_type,
      params.action,
      JSON.stringify(params.input ?? {}),
      params.status ?? 'running',
      permission_mode,
    ]
  )
  return result.rows[0].id as string
}

export async function updateToolRunResult(
  id: string,
  status: string,
  output?: Record<string, unknown>,
  error?: string,
  completed_at?: string
): Promise<void> {
  await db.query(
    `UPDATE tool_runs
     SET status=$1, output=$2, error=$3, completed_at=$4
     WHERE id=$5`,
    [
      status,
      JSON.stringify(output ?? {}),
      error ?? null,
      completed_at ?? new Date().toISOString(),
      id,
    ]
  )
}

export async function listToolRuns(filters: {
  project_id?: string
  tool_type?: string
  status?: string
  agent_role?: string
  limit?: number
} = {}): Promise<Array<ToolRun & { project_name: string | null }>> {
  const conditions: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (filters.project_id) {
    conditions.push(`tr.project_id = $${idx++}`)
    values.push(filters.project_id)
  }
  if (filters.tool_type) {
    conditions.push(`tr.tool_type = $${idx++}`)
    values.push(filters.tool_type)
  }
  if (filters.status) {
    conditions.push(`tr.status = $${idx++}`)
    values.push(filters.status)
  }
  if (filters.agent_role) {
    conditions.push(`tr.agent_role = $${idx++}`)
    values.push(filters.agent_role)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = filters.limit ?? 50

  try {
    const result = await db.query(
      `SELECT tr.*, p.name AS project_name
       FROM tool_runs tr
       LEFT JOIN projects p ON p.id = tr.project_id
       ${where}
       ORDER BY tr.created_at DESC
       LIMIT ${limit}`,
      values
    )
    return result.rows as Array<ToolRun & { project_name: string | null }>
  } catch {
    return []
  }
}

// ── Run tool ───────────────────────────────────────────────────────────────────

export async function runTool(opts: {
  tool_type: string
  action: string
  input: Record<string, unknown>
  project_id?: string
  agent_role?: string
}): Promise<{ success: boolean; output: Record<string, unknown>; run_id: string; error?: string }> {
  // 1. Check operating mode
  const check = await canPerformAction('browse_web', {
    project_id: opts.project_id,
    agent_role: opts.agent_role,
  })
  if (!check.allowed) {
    return { success: false, error: check.reason, run_id: '', output: {} }
  }

  // 2. Check tool availability
  const toolCheck = await checkToolAvailable(opts.tool_type)
  if (!toolCheck.available) {
    return { success: false, error: toolCheck.reason, run_id: '', output: {} }
  }

  // 3. Log the run
  const run_id = await logToolRun({
    project_id: opts.project_id,
    agent_role: opts.agent_role,
    tool_type: opts.tool_type,
    action: opts.action,
    input: opts.input,
    status: 'running',
  })

  // 4. Execute tool via dynamic import to avoid circular deps
  try {
    let output: Record<string, unknown>

    if (opts.tool_type === 'web_search') {
      const { searchWeb } = await import('./web-search')
      const result = await searchWeb({
        query: String(opts.input.query ?? ''),
        project_id: opts.project_id,
        agent_role: opts.agent_role,
        num_results: opts.input.num_results as number | undefined,
      })
      output = result as unknown as Record<string, unknown>
    } else if (opts.tool_type === 'website_reader') {
      const { readWebsite } = await import('./website-reader')
      const result = await readWebsite({
        url: String(opts.input.url ?? ''),
        project_id: opts.project_id,
        agent_role: opts.agent_role,
      })
      output = result as unknown as Record<string, unknown>
    } else {
      throw new Error('Unknown tool type')
    }

    await updateToolRunResult(run_id, 'completed', output)
    return { success: true, output, run_id }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    await updateToolRunResult(run_id, 'failed', {}, errMsg)
    return { success: false, output: {}, run_id, error: errMsg }
  }
}

// ── Test tool connection ───────────────────────────────────────────────────────

export async function testToolConnection(tool_type: string): Promise<{ success: boolean; status: string; error?: string }> {
  try {
    let success = false
    let error: string | undefined

    if (tool_type === 'website_reader') {
      // Website reader just needs fetch to work
      const res = await fetch('https://example.com', {
        signal: AbortSignal.timeout(10000),
        headers: { 'User-Agent': 'AIKO-Research-Bot/1.0 (internal research tool)' },
      })
      success = res.ok
      if (!success) error = `HTTP ${res.status}`
    } else if (tool_type === 'web_search') {
      const conn = await getToolConnection(tool_type)
      if (!conn?.config || !conn.config.provider) {
        error = 'No provider configured.'
      } else {
        // Do a minimal test search
        const { searchWeb } = await import('./web-search')
        await searchWeb({ query: 'test', num_results: 1 })
        success = true
      }
    } else {
      error = 'Unknown tool type'
    }

    const newStatus = success ? 'connected' : 'error'
    await db.query(
      `UPDATE tool_connections
       SET status=$1, last_tested_at=NOW(), last_error=$2, updated_at=NOW()
       WHERE tool_type=$3`,
      [newStatus, error ?? null, tool_type]
    )

    return { success, status: newStatus, error }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    await db.query(
      `UPDATE tool_connections
       SET status='error', last_tested_at=NOW(), last_error=$1, updated_at=NOW()
       WHERE tool_type=$2`,
      [errMsg, tool_type]
    )
    return { success: false, status: 'error', error: errMsg }
  }
}
