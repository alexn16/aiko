import { db } from '@/lib/db/client'

// ── Types ──────────────────────────────────────────────────────────────────────

export type OperatingMode = 'read_only' | 'auto_approval' | 'full_access'

export interface ModeState {
  id: string
  mode: OperatingMode
  paused: boolean
  paused_at: string | null
  paused_reason: string | null
  daily_send_limit: number
  sends_today: number
  last_reset_date: string | null
  notes: string | null
  updated_at: string
}

export interface ModeCheckResult {
  allowed: boolean
  reason: string
  mode: OperatingMode
  paused: boolean
}

// ── Action requirements ────────────────────────────────────────────────────────

const ACTION_REQUIREMENTS: Record<string, OperatingMode[]> = {
  // Read Only and above
  'read_internal':    ['read_only', 'auto_approval', 'full_access'],
  'generate_output':  ['read_only', 'auto_approval', 'full_access'],
  'create_task':      ['read_only', 'auto_approval', 'full_access'],
  'run_review':       ['read_only', 'auto_approval', 'full_access'],
  'generate_campaign':['read_only', 'auto_approval', 'full_access'],

  // Auto/Approval Required and above
  'browse_web':           ['auto_approval', 'full_access'],
  'research_leads':       ['auto_approval', 'full_access'],
  'prepare_outreach':     ['auto_approval', 'full_access'],
  'create_approval_item': ['auto_approval', 'full_access'],

  // Full Access only
  'send_outreach':  ['full_access'],
  'send_email':     ['full_access'],
  'auto_followup':  ['full_access'],
}

const MODE_ORDER: Record<OperatingMode, number> = {
  read_only:    0,
  auto_approval: 1,
  full_access:  2,
}

const DEFAULT_STATE: ModeState = {
  id: 'default',
  mode: 'read_only',
  paused: false,
  paused_at: null,
  paused_reason: null,
  daily_send_limit: 50,
  sends_today: 0,
  last_reset_date: null,
  notes: null,
  updated_at: new Date().toISOString(),
}

// ── Helpers ────────────────────────────────────────────────────────────────────

export function getModeLabel(mode: OperatingMode): string {
  switch (mode) {
    case 'read_only':    return 'Read Only'
    case 'auto_approval': return 'Auto / Approval Required'
    case 'full_access':  return 'Full Access'
  }
}

// ── Core functions ─────────────────────────────────────────────────────────────

export async function getModeState(): Promise<ModeState> {
  try {
    const result = await db.query('SELECT * FROM operating_mode LIMIT 1')
    if (!result.rows[0]) return DEFAULT_STATE

    const row = result.rows[0]

    // Reset sends_today if last_reset_date < today
    const today = new Date().toISOString().slice(0, 10)
    if (!row.last_reset_date || row.last_reset_date < today) {
      try {
        await db.query(
          `UPDATE operating_mode SET sends_today=0, last_reset_date=$1 WHERE id=$2`,
          [today, row.id]
        )
        row.sends_today = 0
        row.last_reset_date = today
      } catch {
        // non-fatal
      }
    }

    return {
      id: row.id,
      mode: row.mode as OperatingMode,
      paused: row.paused,
      paused_at: row.paused_at ? String(row.paused_at) : null,
      paused_reason: row.paused_reason ?? null,
      daily_send_limit: row.daily_send_limit,
      sends_today: row.sends_today,
      last_reset_date: row.last_reset_date ?? null,
      notes: row.notes ?? null,
      updated_at: String(row.updated_at),
    }
  } catch {
    // Graceful degradation — table may not exist yet
    return DEFAULT_STATE
  }
}

export async function setMode(
  mode: OperatingMode,
  opts?: { confirmation_token?: string; notes?: string }
): Promise<void> {
  if (mode === 'full_access') {
    if (opts?.confirmation_token !== 'CONFIRM_FULL_ACCESS') {
      throw new Error('Full Access requires explicit confirmation token: CONFIRM_FULL_ACCESS')
    }
  }

  await db.query(
    `UPDATE operating_mode SET mode=$1, enabled_at=NOW(), updated_at=NOW(), notes=$2`,
    [mode, opts?.notes ?? null]
  )

  try {
    await db.query(
      `INSERT INTO mode_action_log (action, mode, allowed, reason)
       VALUES ('mode_changed', $1, true, $2)`,
      [mode, `Mode changed to ${getModeLabel(mode)}`]
    )
  } catch {
    // non-fatal
  }
}

export async function pauseAgents(reason?: string): Promise<void> {
  await db.query(
    `UPDATE operating_mode SET paused=true, paused_at=NOW(), paused_reason=$1, updated_at=NOW()`,
    [reason ?? null]
  )
}

export async function resumeAgents(): Promise<void> {
  await db.query(
    `UPDATE operating_mode SET paused=false, paused_at=NULL, paused_reason=NULL, updated_at=NOW()`
  )
}

export async function canPerformAction(
  action: string,
  context?: { project_id?: string; agent_role?: string }
): Promise<ModeCheckResult> {
  let state: ModeState
  try {
    state = await getModeState()
  } catch {
    // Graceful degradation — if table doesn't exist, allow everything
    return { allowed: true, reason: 'Mode system not yet initialized', mode: 'read_only', paused: false }
  }

  const result: ModeCheckResult = {
    allowed: false,
    reason: '',
    mode: state.mode,
    paused: state.paused,
  }

  // Paused check
  if (state.paused) {
    result.allowed = false
    result.reason = 'Agents are paused. Resume to continue.'
    await logActionCheck(action, state.mode, false, result.reason, context)
    return result
  }

  // Find required modes
  const requiredModes = ACTION_REQUIREMENTS[action] ?? ['full_access']
  const currentOrder = MODE_ORDER[state.mode]
  const lowestRequired = requiredModes.reduce(
    (min, m) => Math.min(min, MODE_ORDER[m]),
    Infinity
  )

  if (currentOrder < lowestRequired) {
    const firstRequired = requiredModes[0]
    result.allowed = false
    result.reason = `Action "${action}" requires ${getModeLabel(firstRequired)} mode or higher.`
    await logActionCheck(action, state.mode, false, result.reason, context)
    return result
  }

  // Send limit check for full_access send actions
  if ((action === 'send_outreach' || action === 'send_email') && state.mode === 'full_access') {
    if (state.sends_today >= state.daily_send_limit) {
      result.allowed = false
      result.reason = `Daily send limit reached (${state.sends_today}/${state.daily_send_limit}). Resets tomorrow.`
      await logActionCheck(action, state.mode, false, result.reason, context)
      return result
    }
  }

  result.allowed = true
  result.reason = `Action "${action}" allowed in ${getModeLabel(state.mode)} mode.`
  await logActionCheck(action, state.mode, true, result.reason, context)
  return result
}

async function logActionCheck(
  action: string,
  mode: OperatingMode,
  allowed: boolean,
  reason: string,
  context?: { project_id?: string; agent_role?: string }
): Promise<void> {
  try {
    await db.query(
      `INSERT INTO mode_action_log (action, mode, project_id, agent_role, allowed, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        action,
        mode,
        context?.project_id ?? null,
        context?.agent_role ?? null,
        allowed,
        reason,
      ]
    )
  } catch {
    // non-fatal — don't block on logging failures
  }
}

export async function incrementSendCount(): Promise<void> {
  try {
    await db.query(`UPDATE operating_mode SET sends_today = sends_today + 1`)
  } catch {
    // non-fatal
  }
}

export async function getActionLog(limit = 50): Promise<Array<{
  id: string
  action: string
  mode: string
  project_id: string | null
  agent_role: string | null
  allowed: boolean
  reason: string | null
  created_at: string
}>> {
  try {
    const result = await db.query(
      `SELECT * FROM mode_action_log ORDER BY created_at DESC LIMIT $1`,
      [limit]
    )
    return result.rows
  } catch {
    return []
  }
}
