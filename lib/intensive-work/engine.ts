import { db } from '@/lib/db/client'
import { canPerformAction } from '@/lib/operating-mode'

type AISkillsModule = typeof import('@/lib/ai-skills')
let _aiSkillsModule: Promise<AISkillsModule> | null = null
function getAISkillsModule(): Promise<AISkillsModule> {
  if (!_aiSkillsModule) _aiSkillsModule = import('@/lib/ai-skills')
  return _aiSkillsModule
}

export type IntensiveWorkLevel = 'off' | 'planning_only' | 'safe_internal' | 'browser_research' | 'approval_required'
export type WorkStatus = 'queued' | 'working' | 'waiting_user' | 'waiting_approval' | 'blocked' | 'done' | 'failed' | 'skipped'

export type IntensiveWorkState = {
  enabled: boolean
  level: IntensiveWorkLevel
  work_cycle_interval_seconds: number
  max_actions_per_cycle: number
  max_cycles_per_day: number
  cycles_today: number
  last_cycle_at: string | null
  paused_reason: string | null
}

export type WorkItem = {
  id: string
  project_id: string | null
  task_id: string | null
  assigned_agent_name: string
  assigned_role: string
  work_type: string
  priority: number
  status: WorkStatus
  input: Record<string, unknown>
  output_summary: string | null
  output_file_id: string | null
  blocked_reason: string | null
  requires_approval: boolean
  requires_user_input: boolean
  created_at: string
  started_at: string | null
  completed_at: string | null
  updated_at: string
}

export type WorkCycleSummary = {
  ok: boolean
  status: 'off' | 'completed' | 'waiting' | 'blocked'
  message: string
  state: IntensiveWorkState
  actions_run: number
  max_actions_per_cycle: number
  stopped_reason: string | null
  items: WorkItem[]
}

const DEFAULT_STATE: IntensiveWorkState = {
  enabled: false,
  level: 'off',
  work_cycle_interval_seconds: 300,
  max_actions_per_cycle: 3,
  max_cycles_per_day: 24,
  cycles_today: 0,
  last_cycle_at: null,
  paused_reason: null,
}

export async function getIntensiveWorkState(): Promise<IntensiveWorkState> {
  await ensureIntensiveWorkTables()
  const res = await db.query(`SELECT * FROM intensive_work_state WHERE id='default'`)
  const row = res.rows[0]
  if (!row) return DEFAULT_STATE
  return {
    enabled: Boolean(row.enabled),
    level: String(row.level ?? 'off') as IntensiveWorkLevel,
    work_cycle_interval_seconds: Number(row.work_cycle_interval_seconds ?? 300),
    max_actions_per_cycle: Number(row.max_actions_per_cycle ?? 3),
    max_cycles_per_day: Number(row.max_cycles_per_day ?? 24),
    cycles_today: Number(row.cycles_today ?? 0),
    last_cycle_at: row.last_cycle_at ? String(row.last_cycle_at) : null,
    paused_reason: row.paused_reason ? String(row.paused_reason) : null,
  }
}

export async function setIntensiveWorkState(input: Partial<IntensiveWorkState>): Promise<IntensiveWorkState> {
  await ensureIntensiveWorkTables()
  const level = input.level
  const enabled = input.enabled ?? (level && level !== 'off' ? true : undefined)
  const insertEnabled = typeof enabled === 'boolean' ? enabled : DEFAULT_STATE.enabled
  const insertLevel = level ?? DEFAULT_STATE.level
  const insertInterval = input.work_cycle_interval_seconds ?? DEFAULT_STATE.work_cycle_interval_seconds
  const insertMaxActions = input.max_actions_per_cycle ?? DEFAULT_STATE.max_actions_per_cycle
  const insertMaxCycles = input.max_cycles_per_day ?? DEFAULT_STATE.max_cycles_per_day
  await db.query(
    `INSERT INTO intensive_work_state (id, enabled, level, work_cycle_interval_seconds, max_actions_per_cycle, max_cycles_per_day, paused_reason, updated_at)
     VALUES ('default', $1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (id) DO UPDATE SET
       enabled=COALESCE($7, intensive_work_state.enabled),
       level=COALESCE($8, intensive_work_state.level),
       work_cycle_interval_seconds=COALESCE($9, intensive_work_state.work_cycle_interval_seconds),
       max_actions_per_cycle=COALESCE($10, intensive_work_state.max_actions_per_cycle),
       max_cycles_per_day=COALESCE($11, intensive_work_state.max_cycles_per_day),
       paused_reason=$6,
       updated_at=NOW()`,
    [
      insertEnabled,
      insertLevel,
      insertInterval,
      insertMaxActions,
      insertMaxCycles,
      input.paused_reason ?? null,
      typeof enabled === 'boolean' ? enabled : null,
      level ?? null,
      input.work_cycle_interval_seconds ?? null,
      input.max_actions_per_cycle ?? null,
      input.max_cycles_per_day ?? null,
    ],
  )
  return getIntensiveWorkState()
}

export async function enqueueWorkItem(input: {
  project_id?: string | null
  task_id?: string | null
  assigned_agent_name?: string
  assigned_role?: string
  work_type: string
  priority?: number
  input?: Record<string, unknown>
}): Promise<WorkItem> {
  await ensureIntensiveWorkTables()
  const res = await db.query(
    `INSERT INTO agent_work_queue
       (project_id, task_id, assigned_agent_name, assigned_role, work_type, priority, input)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
     RETURNING *`,
    [
      input.project_id ?? null,
      input.task_id ?? null,
      input.assigned_agent_name ?? 'AÏKO',
      input.assigned_role ?? 'ceo',
      input.work_type,
      input.priority ?? 50,
      JSON.stringify(input.input ?? {}),
    ],
  )
  if (!res.rows[0]) throw new Error('Work item insert did not return a row')
  return mapWorkItem(res.rows[0])
}

export async function enqueueProjectWork(projectId: string, opts: { includeBrowserResearch?: boolean } = {}): Promise<WorkItem[]> {
  const existing = await listWorkItems({ project_id: projectId, statuses: ['queued', 'working', 'waiting_user', 'waiting_approval'] })
  if (existing.length > 0) return existing
  const items = [
    await enqueueWorkItem({
      project_id: projectId,
      assigned_agent_name: 'Marketing Strategy Agent',
      assigned_role: 'marketing_agent',
      work_type: 'strategy_plan',
      priority: 90,
      input: { skill_id: 'create_7_day_plan', prompt: 'Plan the next 7 days of marketing work.' },
    }),
    await enqueueWorkItem({
      project_id: projectId,
      assigned_agent_name: 'CEO',
      assigned_role: 'ceo',
      work_type: 'project_next_step',
      priority: 80,
      input: { skill_id: 'recommend_next_step', prompt: 'What should we do next?' },
    }),
    await enqueueWorkItem({
      project_id: projectId,
      assigned_agent_name: 'Reporting Agent',
      assigned_role: 'reporting_agent',
      work_type: 'report_generation',
      priority: 60,
      input: { prompt: 'Generate a concise executive report.' },
    }),
  ]
  if (opts.includeBrowserResearch) {
    items.push(await enqueueWorkItem({
      project_id: projectId,
      assigned_agent_name: 'Kevin',
      assigned_role: 'web_operator',
      work_type: 'web_research',
      priority: 50,
      input: { query: 'public marketing opportunities and customer research targets' },
    }))
  }
  return items
}

export async function runWorkCycle(): Promise<WorkCycleSummary> {
  await ensureIntensiveWorkTables()
  await resetDailyCounterIfNeeded()
  const state = await getIntensiveWorkState()
  if (!state.enabled || state.level === 'off') {
    return { ok: true, status: 'off', message: 'Intensive Work is off.', state, actions_run: 0, max_actions_per_cycle: state.max_actions_per_cycle, stopped_reason: 'off', items: [] }
  }
  if (state.cycles_today >= state.max_cycles_per_day) {
    return { ok: true, status: 'blocked', message: 'Daily intensive work cycle limit reached.', state, actions_run: 0, max_actions_per_cycle: state.max_actions_per_cycle, stopped_reason: 'daily_limit', items: [] }
  }

  const modeCheck = await canPerformAction('read_internal', { agent_role: 'intensive_work' })
  if (!modeCheck.allowed) {
    return { ok: true, status: 'blocked', message: modeCheck.reason, state, actions_run: 0, max_actions_per_cycle: state.max_actions_per_cycle, stopped_reason: 'operating_mode', items: [] }
  }

  const queued = await listWorkItems({ statuses: ['queued'], limit: state.max_actions_per_cycle })
  const results: WorkItem[] = []
  let stoppedReason: string | null = null

  for (const item of queued) {
    if (results.length >= state.max_actions_per_cycle) break
    if (!isWorkAllowed(item.work_type, state.level)) {
      results.push(await markWorkItem(item.id, 'blocked', { blocked_reason: `Work type ${item.work_type} is not allowed in ${state.level} mode.` }))
      stoppedReason = 'level_blocked'
      break
    }
    const result = await runWorkItem(item.id, state)
    results.push(result)
    if (['waiting_user', 'waiting_approval', 'blocked', 'failed'].includes(result.status)) {
      stoppedReason = result.status
      break
    }
  }

  await db.query(
    `UPDATE intensive_work_state
        SET cycles_today=cycles_today+1, last_cycle_at=NOW(), updated_at=NOW()
      WHERE id='default'`,
  )
  const updatedState = await getIntensiveWorkState()
  const waiting = results.find(item => item.status === 'waiting_user' || item.status === 'waiting_approval')
  const blocked = results.find(item => item.status === 'blocked' || item.status === 'failed')
  const status = waiting ? 'waiting' : blocked ? 'blocked' : 'completed'
  return {
    ok: true,
    status,
    message: summarizeWorkCycle(results, stoppedReason),
    state: updatedState,
    actions_run: results.length,
    max_actions_per_cycle: state.max_actions_per_cycle,
    stopped_reason: stoppedReason,
    items: results,
  }
}

export async function runWorkItem(itemId: string, state = DEFAULT_STATE): Promise<WorkItem> {
  const item = await getWorkItem(itemId)
  if (!item) throw new Error('Work item not found.')
  await markWorkItem(item.id, 'working')
  try {
    if (['strategy_plan', 'project_next_step', 'ai_skill', 'content_draft'].includes(item.work_type)) {
      const { executeAISkill } = await getAISkillsModule()
      const skillId = String(item.input.skill_id ?? (item.work_type === 'content_draft' ? 'create_content_ideas' : 'recommend_next_step'))
      const prompt = String(item.input.prompt ?? item.work_type.replace(/_/g, ' '))
      const output = await executeAISkill(skillId, { prompt, project_id: item.project_id, save_as_file: true })
      return markWorkItem(item.id, 'done', {
        output_summary: output.summary ?? output.content?.slice(0, 220) ?? output.title,
        output_file_id: output.saved_file_id ?? null,
      })
    }
    if (item.work_type === 'task_creation') {
      const { createAgentTask } = await import('@/lib/agents/tasks')
      const task = await createAgentTask({
        project_id: item.project_id ?? undefined,
        owner_role: String(item.input.owner_role ?? 'marketing_agent'),
        assigned_by_role: 'intensive_work',
        title: String(item.input.title ?? 'Follow-up task').slice(0, 140),
        description: String(item.input.description ?? 'Internal task created by Intensive Work. No external action was executed.'),
        status: 'planned',
        priority: 'normal',
        task_type: 'strategy',
      })
      return markWorkItem(item.id, 'done', { output_summary: `Created internal task: ${task.title}` })
    }
    if (item.work_type === 'report_generation') {
      if (!item.project_id) return markWorkItem(item.id, 'blocked', { blocked_reason: 'Report generation needs a project.' })
      const { generateProjectExecutiveReport } = await import('@/lib/project-executive-report')
      const report = await generateProjectExecutiveReport(item.project_id)
      return markWorkItem(item.id, 'done', { output_summary: report.summary ?? report.title })
    }
    if (item.work_type === 'daily_brief') {
      const { getDailyBrief } = await import('@/lib/daily-brief')
      const brief = await getDailyBrief()
      return markWorkItem(item.id, 'done', { output_summary: brief.today_summary })
    }
    if (item.work_type === 'system_improvement_check') {
      const missing = await countMissingCapabilities()
      return markWorkItem(item.id, missing > 0 ? 'blocked' : 'done', {
        output_summary: missing > 0 ? `${missing} missing capability proposal(s) need review.` : 'No active missing capability proposal is blocking work.',
        blocked_reason: missing > 0 ? 'Missing required capability.' : null,
      })
    }
    if (item.work_type === 'web_research' || item.work_type === 'web_operator_action') {
      if (!['browser_research', 'approval_required'].includes(state.level)) {
        return markWorkItem(item.id, 'blocked', { blocked_reason: 'Browser work is not enabled for the current Intensive Work level.' })
      }
      const modeCheck = await canPerformAction('browse_web', { project_id: item.project_id ?? undefined, agent_role: 'web_operator' })
      if (!modeCheck.allowed) return markWorkItem(item.id, 'blocked', { blocked_reason: modeCheck.reason })
      const { delegateSearch } = await import('@/lib/web-operator/delegation')
      const result = await delegateSearch({
        query: String(item.input.query ?? item.input.prompt ?? 'public marketing research'),
        projectId: item.project_id ?? undefined,
        requestedByRole: 'Intensive Work',
        operatorName: String(item.input.operator_name ?? 'Kevin'),
      })
      if (result.status === 'approval_required') return markWorkItem(item.id, 'waiting_approval', { output_summary: result.message, requires_approval: true })
      if (/login|captcha|security|manual/i.test(result.message) || result.status === 'blocked') {
        return markWorkItem(item.id, 'waiting_user', { output_summary: result.message, requires_user_input: true, blocked_reason: result.message })
      }
      return markWorkItem(item.id, result.status === 'completed' ? 'done' : 'blocked', { output_summary: result.message, blocked_reason: result.status === 'completed' ? null : result.message })
    }
    return markWorkItem(item.id, 'blocked', { blocked_reason: 'Unsupported work type for this cycle.', output_summary: `Skipped unsupported work type ${item.work_type}.` })
  } catch (err) {
    return markWorkItem(item.id, 'failed', { blocked_reason: ownerFriendlyWorkError(err) })
  }
}

export async function getActiveWork(): Promise<{ state: IntensiveWorkState; queue: WorkItem[]; active: WorkItem[]; recent: WorkItem[]; counts: Record<string, number> }> {
  await ensureIntensiveWorkTables()
  const [state, queue, active, recent, counts] = await Promise.all([
    getIntensiveWorkState(),
    listWorkItems({ statuses: ['queued'], limit: 20 }),
    listWorkItems({ statuses: ['working', 'waiting_user', 'waiting_approval', 'blocked'], limit: 20 }),
    listWorkItems({ statuses: ['done', 'failed', 'skipped'], limit: 20 }),
    getWorkCounts(),
  ])
  return { state, queue, active, recent, counts }
}

export function summarizeWorkCycle(items: WorkItem[], stoppedReason: string | null): string {
  if (items.length === 0) return 'No queued work was ready.'
  const waiting = items.find(item => item.status === 'waiting_user')
  if (waiting) return 'AÏKO stopped because Kevin needs your help in the browser.'
  const approval = items.find(item => item.status === 'waiting_approval')
  if (approval) return 'AÏKO stopped because approval is needed.'
  const blocked = items.find(item => item.status === 'blocked' || item.status === 'failed')
  if (blocked) return blocked.blocked_reason ?? 'AÏKO stopped at a safe boundary.'
  return `AÏKO completed ${items.length} bounded work item${items.length === 1 ? '' : 's'}${stoppedReason ? ` and stopped at ${stoppedReason}` : ''}.`
}

export function stopAtSafetyBoundary(reason: string): { status: 'blocked'; reason: string } {
  return { status: 'blocked', reason }
}

async function listWorkItems(filters: { project_id?: string | null; statuses?: string[]; limit?: number } = {}): Promise<WorkItem[]> {
  await ensureIntensiveWorkTables()
  const conditions: string[] = []
  const values: unknown[] = []
  let idx = 1
  if (filters.project_id) {
    conditions.push(`project_id=$${idx++}`)
    values.push(filters.project_id)
  }
  if (filters.statuses?.length) {
    conditions.push(`status = ANY($${idx++})`)
    values.push(filters.statuses)
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = Math.max(1, Math.min(filters.limit ?? 50, 100))
  const res = await db.query(
    `SELECT * FROM agent_work_queue
      ${where}
      ORDER BY priority DESC, created_at ASC
      LIMIT ${limit}`,
    values,
  )
  return res.rows.map(mapWorkItem)
}

async function getWorkItem(id: string): Promise<WorkItem | null> {
  await ensureIntensiveWorkTables()
  const res = await db.query(`SELECT * FROM agent_work_queue WHERE id=$1`, [id])
  return res.rows[0] ? mapWorkItem(res.rows[0]) : null
}

async function markWorkItem(id: string, status: WorkStatus, patch: {
  output_summary?: string | null
  output_file_id?: string | null
  blocked_reason?: string | null
  requires_approval?: boolean
  requires_user_input?: boolean
} = {}): Promise<WorkItem> {
  const res = await db.query(
    `UPDATE agent_work_queue
        SET status=$2,
            output_summary=COALESCE($3, output_summary),
            output_file_id=COALESCE($4, output_file_id),
            blocked_reason=$5,
            requires_approval=COALESCE($6, requires_approval),
            requires_user_input=COALESCE($7, requires_user_input),
            started_at=CASE WHEN $2='working' THEN COALESCE(started_at, NOW()) ELSE started_at END,
            completed_at=CASE WHEN $2 IN ('done','failed','blocked','skipped','waiting_user','waiting_approval') THEN NOW() ELSE completed_at END,
            updated_at=NOW()
      WHERE id=$1
      RETURNING *`,
    [id, status, patch.output_summary ?? null, patch.output_file_id ?? null, patch.blocked_reason ?? null, patch.requires_approval ?? null, patch.requires_user_input ?? null],
  )
  if (!res.rows[0]) throw new Error(`Work item not found after update: ${id}`)
  return mapWorkItem(res.rows[0])
}

async function getWorkCounts(): Promise<Record<string, number>> {
  const res = await db.query(`SELECT status, COUNT(*)::int AS n FROM agent_work_queue GROUP BY status`)
  return Object.fromEntries(res.rows.map(row => [String(row.status), Number(row.n)]))
}

async function countMissingCapabilities(): Promise<number> {
  const res = await db.query(
    `SELECT COUNT(*)::int AS n FROM system_improvement_proposals
     WHERE status NOT IN ('validated_available','rejected','archived')`,
  ).catch(() => ({ rows: [{ n: 0 }] }))
  return Number(res.rows[0]?.n ?? 0)
}

function ownerFriendlyWorkError(err: unknown): string {
  const msg = err instanceof Error ? err.message : 'Work item failed.'
  if (/spawn .+ ENOENT/i.test(msg)) return 'AI provider binary not found. Go to Connect AI to verify your provider is installed.'
  if (/No AI provider connected/i.test(msg)) return 'No AI provider connected. Go to Connect AI to add one.'
  if (/ECONNREFUSED|ENOTFOUND|fetch failed/i.test(msg)) return 'AI provider is not reachable. Check your provider connection in Connect AI.'
  return msg
}

function isWorkAllowed(workType: string, level: IntensiveWorkLevel): boolean {
  if (level === 'off') return false
  const internal = ['daily_brief', 'project_next_step', 'ai_skill', 'content_draft', 'strategy_plan', 'task_creation', 'report_generation', 'system_improvement_check', 'repo_audit']
  if (level === 'planning_only') return internal.includes(workType)
  if (level === 'safe_internal') return internal.includes(workType)
  if (level === 'browser_research' || level === 'approval_required') return internal.includes(workType) || ['web_research', 'web_operator_action'].includes(workType)
  return false
}

function mapWorkItem(row: Record<string, unknown>): WorkItem {
  return {
    id: String(row.id),
    project_id: row.project_id ? String(row.project_id) : null,
    task_id: row.task_id ? String(row.task_id) : null,
    assigned_agent_name: String(row.assigned_agent_name ?? 'AÏKO'),
    assigned_role: String(row.assigned_role ?? 'ceo'),
    work_type: String(row.work_type),
    priority: Number(row.priority ?? 50),
    status: String(row.status ?? 'queued') as WorkStatus,
    input: row.input && typeof row.input === 'object' ? row.input as Record<string, unknown> : {},
    output_summary: row.output_summary ? String(row.output_summary) : null,
    output_file_id: row.output_file_id ? String(row.output_file_id) : null,
    blocked_reason: row.blocked_reason ? String(row.blocked_reason) : null,
    requires_approval: Boolean(row.requires_approval),
    requires_user_input: Boolean(row.requires_user_input),
    created_at: String(row.created_at),
    started_at: row.started_at ? String(row.started_at) : null,
    completed_at: row.completed_at ? String(row.completed_at) : null,
    updated_at: String(row.updated_at),
  }
}

async function resetDailyCounterIfNeeded(): Promise<void> {
  await db.query(
    `UPDATE intensive_work_state
        SET cycles_today=0, last_reset_date=CURRENT_DATE
      WHERE id='default' AND (last_reset_date IS NULL OR last_reset_date <> CURRENT_DATE)`,
  )
}

async function ensureIntensiveWorkTables(): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS intensive_work_state (
      id TEXT PRIMARY KEY DEFAULT 'default',
      enabled BOOLEAN NOT NULL DEFAULT false,
      level TEXT NOT NULL DEFAULT 'off',
      work_cycle_interval_seconds INTEGER NOT NULL DEFAULT 300,
      max_actions_per_cycle INTEGER NOT NULL DEFAULT 3,
      max_cycles_per_day INTEGER NOT NULL DEFAULT 24,
      cycles_today INTEGER NOT NULL DEFAULT 0,
      last_cycle_at TIMESTAMPTZ,
      last_reset_date DATE,
      paused_reason TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    INSERT INTO intensive_work_state (id, enabled, level)
    VALUES ('default', false, 'off')
    ON CONFLICT (id) DO NOTHING;
    CREATE TABLE IF NOT EXISTS agent_work_queue (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NULL,
      task_id UUID NULL,
      assigned_agent_name TEXT NOT NULL DEFAULT 'AÏKO',
      assigned_role TEXT NOT NULL DEFAULT 'ceo',
      work_type TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 50,
      status TEXT NOT NULL DEFAULT 'queued',
      input JSONB NOT NULL DEFAULT '{}'::jsonb,
      output_summary TEXT,
      output_file_id UUID NULL,
      blocked_reason TEXT,
      requires_approval BOOLEAN NOT NULL DEFAULT false,
      requires_user_input BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)
}
