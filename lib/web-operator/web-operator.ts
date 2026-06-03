import { db } from '@/lib/db/client'
import { canPerformAction, getModeState } from '@/lib/operating-mode'
import { createApprovalItem } from '@/lib/approvals'
import { getSkillById, getSkillForUrl, getRecommendedSkillForInstruction, validateSkillAction } from '@/lib/web-operator/skills'
import type { SkillDecision, WebOperatorSkill } from '@/lib/web-operator/skills'
import type { PlaybookExecutionPlan } from '@/lib/web-operator/playbooks'
import {
  createStepsForAction,
  markStepCompleted,
  markStepFailed,
  markStepWaitingApproval,
  markStepWaitingUser,
} from '@/lib/web-operator/action-steps'
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
  | 'search_gmail' | 'check_gmail_reply'
  | 'collect_public_info' | 'summarize' | 'create_account'
  | 'open_canva' | 'create_design_draft' | 'edit_text' | 'upload_user_approved_assets' | 'export_design'
  | 'publish_design' | 'share_design' | 'download_final_asset'
  | 'search_pages' | 'search_groups' | 'read_public_posts' | 'collect_public_leads'
  | 'send_message' | 'post_comment' | 'join_group' | 'create_post' | 'post'
  | 'search_companies' | 'read_public_profiles' | 'collect_company_info'
  | 'send_connection_request' | 'follow_account' | 'search_mail' | 'check_reply'

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
  skill_id: string | null
  skill_name: string | null
  skill_decision: Record<string, unknown> | null
  playbook_id: string | null
  playbook_name: string | null
  playbook_plan: Record<string, unknown> | null
  created_at: string
  completed_at: string | null
}

// ── Internal helpers ───────────────────────────────────────────────────────────

const SENSITIVE_ACTIONS = [
  'send_email', 'send_gmail_draft', 'submit_form', 'create_email_draft', 'download_file',
  'publish_design', 'share_design', 'download_final_asset', 'send_message', 'post_comment',
  'join_group', 'create_post', 'post', 'send_connection_request', 'follow_account',
]

function isSensitiveAction(type: string): boolean {
  return SENSITIVE_ACTIONS.includes(type)
}

const ALWAYS_REQUIRES_APPROVAL = [
  'send_email', 'send_gmail_draft', 'submit_form', 'publish_design', 'share_design',
  'download_final_asset', 'send_message', 'post_comment', 'join_group', 'create_post',
  'post', 'send_connection_request', 'follow_account',
]
const AUTO_REQUIRES_APPROVAL = ['send_email', 'send_gmail_draft', 'submit_form', 'create_email_draft', 'fill_form', 'click']

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
  skill_id?: string | null
  skill_name?: string | null
  skill_decision?: Record<string, unknown> | SkillDecision | null
  playbook_id?: string | null
  playbook_name?: string | null
  playbook_plan?: Record<string, unknown> | PlaybookExecutionPlan | null
}): Promise<WebOperatorAction> {
  const result = await db.query(
    `INSERT INTO web_operator_actions
       (session_id, project_id, agent_role, action_type, target_url,
        description, input, status, requires_approval,
        source_task_id, requested_by_role, operator_id, lead_id,
        skill_id, skill_name, skill_decision, playbook_id, playbook_name, playbook_plan)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
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
      params.skill_id ?? null,
      params.skill_name ?? null,
      params.skill_decision ? JSON.stringify(params.skill_decision) : null,
      params.playbook_id ?? null,
      params.playbook_name ?? null,
      params.playbook_plan ? JSON.stringify(params.playbook_plan) : null,
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
    skill_id: string | null
    skill_name: string | null
    skill_decision: Record<string, unknown> | SkillDecision | null
    playbook_id: string | null
    playbook_name: string | null
    playbook_plan: Record<string, unknown> | PlaybookExecutionPlan | null
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
  if (fields.skill_id !== undefined) { sets.push(`skill_id=$${idx++}`); values.push(fields.skill_id) }
  if (fields.skill_name !== undefined) { sets.push(`skill_name=$${idx++}`); values.push(fields.skill_name) }
  if (fields.skill_decision !== undefined) { sets.push(`skill_decision=$${idx++}`); values.push(fields.skill_decision ? JSON.stringify(fields.skill_decision) : null) }
  if (fields.playbook_id !== undefined) { sets.push(`playbook_id=$${idx++}`); values.push(fields.playbook_id) }
  if (fields.playbook_name !== undefined) { sets.push(`playbook_name=$${idx++}`); values.push(fields.playbook_name) }
  if (fields.playbook_plan !== undefined) { sets.push(`playbook_plan=$${idx++}`); values.push(fields.playbook_plan ? JSON.stringify(fields.playbook_plan) : null) }

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

async function resolveSkillForAction(opts: {
  action_type: WebOperatorActionType
  target_url?: string | null
  description: string
  skill_id?: string | null
}): Promise<{ skill: WebOperatorSkill | null; decision: SkillDecision | null }> {
  const skill = opts.skill_id
    ? await getSkillById(opts.skill_id)
    : opts.target_url
      ? await getSkillForUrl(opts.target_url)
      : await getRecommendedSkillForInstruction(opts.description)
  if (!skill) return { skill: null, decision: null }
  const decision = await validateSkillAction(skill.skill_id, opts.action_type)
  return { skill, decision }
}

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
  skill_id?: string | null
  skill_name?: string | null
  skill_decision?: Record<string, unknown> | SkillDecision | null
  playbook_id?: string | null
  playbook_name?: string | null
  playbook_plan?: Record<string, unknown> | PlaybookExecutionPlan | null
}): Promise<{
  success: boolean
  action: WebOperatorAction
  error?: string
  waiting_approval?: boolean
  waiting_user?: boolean
  approval?: ApprovalItem
}> {
  const skillResolution = await resolveSkillForAction(opts)
  const skill = skillResolution.skill
  const skillDecision = (opts.skill_decision as SkillDecision | null) ?? skillResolution.decision
  const skillFields = {
    skill_id: skill?.skill_id ?? opts.skill_id ?? null,
    skill_name: skill?.name ?? opts.skill_name ?? null,
    skill_decision: skillDecision ?? null,
  }
  const playbookFields = {
    playbook_id: opts.playbook_id ?? null,
    playbook_name: opts.playbook_name ?? null,
    playbook_plan: opts.playbook_plan ?? null,
  }

  if (skillDecision?.blocked) {
    const action = await logWebOperatorAction({
      ...opts,
      ...skillFields,
      ...playbookFields,
      status: 'blocked',
      requires_approval: false,
      operator_id: opts.operator_id ?? null,
    })
    await createStepsForAction(action.id, playbookFields.playbook_plan).catch(() => {})
    await markStepFailed(action.id, { stepId: opts.action_type, message: skillDecision.reason }).catch(() => {})
    await updateWebOperatorAction(action.id, {
      output: { error: skillDecision.reason, skill_decision: skillDecision },
      failure_reason: 'skill_blocked',
      completed_at: new Date().toISOString(),
    })
    const updated = await db.query(`SELECT * FROM web_operator_actions WHERE id=$1`, [action.id])
    return {
      success: false,
      action: updated.rows[0] ? rowToAction(updated.rows[0]) : action,
      error: skillDecision.reason,
    }
  }

  // 1. Check operating mode
  const modeCheck = await canPerformAction(
    isSensitiveAction(opts.action_type) ? 'send_email' : 'browse_web',
    { project_id: opts.project_id ?? undefined, agent_role: opts.agent_role }
  )

  if (!modeCheck.allowed) {
    const action = await logWebOperatorAction({ ...opts, ...skillFields, ...playbookFields, status: 'blocked', requires_approval: false, operator_id: opts.operator_id ?? null })
    await createStepsForAction(action.id, playbookFields.playbook_plan).catch(() => {})
    await markStepFailed(action.id, { stepId: opts.action_type, message: modeCheck.reason }).catch(() => {})
    await updateWebOperatorAction(action.id, {
      output: { error: modeCheck.reason },
      failure_reason: 'operating_mode_blocked',
      completed_at: new Date().toISOString(),
    })
    return { success: false, action, error: modeCheck.reason }
  }

  // 2. Check if action requires approval
  const needsApproval = requiresApproval(opts.action_type, modeCheck.mode) || Boolean(skillDecision?.requires_approval)
  if (needsApproval) {
    const action = await logWebOperatorAction({ ...opts, ...skillFields, ...playbookFields, status: 'waiting_approval', requires_approval: true, operator_id: opts.operator_id ?? null })
    await createStepsForAction(action.id, playbookFields.playbook_plan).catch(() => {})
    await markStepWaitingApproval(action.id, {
      stepId: opts.action_type,
      message: skillDecision?.reason ?? 'Approval required before this step can run.',
    }).catch(() => {})
    const approval = await requireOperatorApproval(action.id, {
      project_id: opts.project_id,
      title: opts.description,
      content: `Web Operator action requested:
Type: ${opts.action_type}
Skill: ${skillFields.skill_name ?? 'n/a'}
Playbook: ${playbookFields.playbook_name ?? 'n/a'}
URL: ${opts.target_url ?? 'n/a'}
Description: ${opts.description}
Reason: ${skillDecision?.reason ?? 'Operating mode requires approval.'}`,
      agent_role: opts.agent_role ?? 'Web Operator',
    })
    const updated = await db.query(`SELECT * FROM web_operator_actions WHERE id=$1`, [action.id])
    return {
      success: false,
      action: updated.rows[0] ? rowToAction(updated.rows[0]) : action,
      approval,
      waiting_approval: true,
    }
  }

  // 3. Log as running
  const action = await logWebOperatorAction({ ...opts, ...skillFields, ...playbookFields, status: 'running', operator_id: opts.operator_id ?? null })
  await createStepsForAction(action.id, playbookFields.playbook_plan).catch(() => {})

  // 4. Check browser runtime
  const browserAvailable = await checkBrowserRuntime()
  if (!browserAvailable) {
    await markStepFailed(action.id, {
      stepId: opts.action_type,
      message: 'Browser runtime not configured.',
    }).catch(() => {})
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
    await markStepCompleted(action.id, {
      stepId: opts.action_type,
      message: 'Browser action completed.',
      url: pageState?.url ?? opts.target_url ?? null,
      screenshot_url: pageState?.is_sensitive ? null : pageState?.screenshot_url ?? result.screenshot_url ?? null,
      result: cleanOutput,
    }).catch(() => {})

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

    // ── Manual takeover required (CAPTCHA / login / security checkpoint) ──
    // Do NOT mark as failed — mark as waiting_user so user can take over.
    const isManualTakeover =
      err instanceof Error && err.name === 'ManualTakeoverRequired'
    if (isManualTakeover) {
      const takeoverErr = err as { pageState?: { waiting_reason?: string; url?: string; title?: string; screenshot_url?: string | null } }
      const ps = takeoverErr.pageState ?? {}
      await updateWebOperatorAction(action.id, {
        status: 'waiting_user',
        output: {
          waiting_for_user: true,
          waiting_reason: ps.waiting_reason ?? 'manual_takeover_required',
          url: ps.url ?? null,
        },
        failure_reason: ps.waiting_reason ?? 'manual_takeover_required',
        page_title: ps.title ?? null,
        completed_at: new Date().toISOString(),
      })
      await markStepWaitingUser(action.id, {
        stepId: opts.action_type,
        message: ps.waiting_reason ?? 'manual_takeover_required',
        url: ps.url ?? null,
        screenshot_url: ps.screenshot_url ?? null,
      }).catch(() => {})

      // Update operator status to waiting_user
      if (opts.operator_id) {
        await db.query(
          `UPDATE web_operators SET
            status='waiting_user',
            requires_user_input=true,
            waiting_reason=$1,
            current_url=$2,
            updated_at=NOW()
           WHERE id=$3`,
          [ps.waiting_reason ?? 'manual_takeover_required', ps.url ?? null, opts.operator_id]
        ).catch(() => {})
        // Store the pending action so Resume can retry it
        await db.query(
        `UPDATE web_operators SET
            pending_action_type=$1,
            pending_action_payload=$2,
            pending_action_created_at=NOW()
           WHERE id=$3`,
          [opts.action_type, JSON.stringify({ ...(opts.input ?? {}), ...(opts.playbook_plan ? { playbook: opts.playbook_plan } : {}) }), opts.operator_id]
        ).catch(() => {})
      }

      const updated = await db.query(`SELECT * FROM web_operator_actions WHERE id=$1`, [action.id])
      return {
        success: false,
        action: updated.rows[0] ? rowToAction(updated.rows[0]) : action,
        error: errMsg,
        waiting_user: true,
      }
    }

    const failure_reason = (err as { failure_reason?: string }).failure_reason ?? 'unknown_error'
    await markStepFailed(action.id, {
      stepId: opts.action_type,
      message: errMsg,
    }).catch(() => {})
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

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null) return value as Record<string, unknown>
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : null
    } catch {
      return null
    }
  }
  return null
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
    skill_id: row.skill_id ? String(row.skill_id) : null,
    skill_name: row.skill_name ? String(row.skill_name) : null,
    skill_decision: parseJsonObject(row.skill_decision),
    playbook_id: row.playbook_id ? String(row.playbook_id) : null,
    playbook_name: row.playbook_name ? String(row.playbook_name) : null,
    playbook_plan: parseJsonObject(row.playbook_plan),
    created_at: String(row.created_at),
    completed_at: row.completed_at ? String(row.completed_at) : null,
  }
}
