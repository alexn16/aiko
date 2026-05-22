/**
 * Project Manager Report Agent
 *
 * Each assigned Project Manager reviews their project and prepares a
 * structured status report for the CEO. Read-only analysis — no messages
 * sent, no approvals changed, no secrets exposed.
 */

import { callLLM, LLMConfig } from '@/lib/models/provider'
import { db } from '@/lib/db/client'

export type PMReportStatus = 'healthy' | 'attention' | 'blocked' | 'stale'

export interface PMReportResult {
  id: string
  project_id: string
  project_manager_id: string | null
  pm_name: string
  project_name: string
  status: PMReportStatus
  summary: string
  progress: number
  blockers: string[]
  completed_work: string[]
  current_focus: string
  recommended_next_actions: string[]
  needs_client_approval: boolean
  created_at: string
}

const STALE_HOURS = 48

function buildPMSystemPrompt(pmName: string, projectName: string): string {
  return `You are ${pmName}, Project Manager at AÏKO. You are writing an internal status report for the CEO about the project "${projectName}".

Write in first person as ${pmName}. Be concise, specific, and direct. Use the data you have been given — do not invent information.

The report should feel like a manager speaking upward: factual, professional, no filler.

Return ONLY valid JSON:
{
  "summary": "2–3 sentences. State project readiness, what is happening right now, and one key thing the CEO should know.",
  "status": "healthy|attention|blocked|stale",
  "progress": <integer 0–100 representing overall campaign readiness>,
  "blockers": ["specific blocker if any"],
  "completed_work": ["what has been done so far"],
  "current_focus": "one sentence on what the team is focused on right now",
  "recommended_next_actions": ["action 1", "action 2"],
  "needs_client_approval": <true if outreach drafts or campaign decisions require client sign-off, else false>
}

Status guide:
- healthy: progressing, no blockers, clear next steps
- attention: something needs a decision or is delayed
- blocked: explicit blockers preventing progress
- stale: no meaningful activity in 48+ hours`
}

export async function runProjectManagerReportAgent(
  projectId: string,
  modelConfig: LLMConfig
): Promise<PMReportResult> {
  const now = new Date()

  // ── 1. Load project + assigned PM ─────────────────────────────────────────
  const projectRow = await db.query(`
    SELECT p.*, pm.id AS pm_id, pm.name AS pm_name, pm.specialty AS pm_specialty,
           pm.current_focus AS pm_focus
    FROM projects p
    LEFT JOIN project_managers pm ON pm.id = p.assigned_pm_id
    WHERE p.id = $1
  `, [projectId])

  const project = projectRow.rows[0]
  if (!project) throw new Error(`Project ${projectId} not found`)

  const pmName: string = project.pm_name ?? 'Project Manager'
  const pmId: string | null = project.pm_id ?? null

  // ── 2-3. Load memory + map ────────────────────────────────────────────────
  const [memRow, mapRow] = await Promise.all([
    db.query('SELECT * FROM project_memory WHERE project_id=$1', [projectId]),
    db.query('SELECT * FROM project_map WHERE project_id=$1', [projectId]),
  ])
  const memory = memRow.rows[0] ?? null
  const map = mapRow.rows[0] ?? null

  // ── 4. Load agents + recent activity ─────────────────────────────────────
  const [agentsRow, activityRow, approvalsRow] = await Promise.all([
    db.query('SELECT id, name, role, status, current_task, progress FROM agents WHERE project_id=$1', [projectId]),
    db.query(`
      SELECT al.action, al.details, al.created_at, a.name AS agent_name
      FROM agent_logs al
      JOIN agents a ON a.id = al.agent_id
      WHERE al.project_id=$1
      ORDER BY al.created_at DESC LIMIT 20
    `, [projectId]),
    db.query(`
      SELECT COUNT(*) AS n FROM approvals
      WHERE project_id=$1 AND status IN ('pending','quality_passed')
    `, [projectId]),
  ])

  const agents = agentsRow.rows
  const activity = activityRow.rows
  const pendingApprovals = parseInt(approvalsRow.rows[0]?.n ?? '0', 10)

  // ── 5. Lead stats ─────────────────────────────────────────────────────────
  const leadsRow = await db.query(`
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status='new')       AS new_count,
           COUNT(*) FILTER (WHERE status='contacted') AS contacted,
           COUNT(*) FILTER (WHERE status='qualified') AS qualified
    FROM leads WHERE project_id=$1
  `, [projectId])
  const leads = leadsRow.rows[0]

  // ── 6. Rule-based detection ───────────────────────────────────────────────
  const ruleIssues: string[] = []
  if (!project.pm_id)         ruleIssues.push('No Project Manager assigned to this project')
  if (!memory?.notes)         ruleIssues.push('No project notes in memory')
  if (!(map?.nodes?.length))  ruleIssues.push('No pipeline map defined')

  const memBlockers: string[] = memory?.blockers ?? []
  const memNextSteps: string[] = memory?.next_steps ?? []
  if (memBlockers.length > 0) ruleIssues.push(`Blocker: ${memBlockers[0]}`)
  if (memNextSteps.length === 0 && !memory?.notes) ruleIssues.push('No next actions defined')
  if (pendingApprovals > 0)   ruleIssues.push(`${pendingApprovals} outreach draft${pendingApprovals > 1 ? 's' : ''} awaiting approval`)
  if (parseInt(leads.total, 10) === 0) ruleIssues.push('No leads collected yet')

  const latestActivityAt = activity[0]?.created_at ?? null
  let hoursStale: number | null = null
  if (latestActivityAt) {
    hoursStale = (now.getTime() - new Date(latestActivityAt).getTime()) / 3_600_000
    if (hoursStale >= STALE_HOURS) {
      ruleIssues.push(`No agent activity in ${Math.round(hoursStale)} hours`)
    }
  } else {
    ruleIssues.push('No agent activity recorded')
  }

  const agentsWithoutTasks = agents.filter((a: { status: string; current_task: string | null }) =>
    a.status === 'idle' && !a.current_task
  )
  if (agentsWithoutTasks.length > 2) {
    ruleIssues.push(`${agentsWithoutTasks.length} agents idle with no assigned task`)
  }

  // ── 7. Build LLM context ──────────────────────────────────────────────────
  const ctx = {
    project: {
      name: project.name,
      goal: project.goal ?? null,
      description: project.description ?? null,
    },
    pm: {
      name: pmName,
      specialty: project.pm_specialty ?? '',
      current_focus: project.pm_focus ?? '',
    },
    memory: {
      notes: memory?.notes ?? '',
      next_steps: memNextSteps,
      blockers: memBlockers,
    },
    pipeline_map: map?.nodes ?? [],
    agents: agents.map((a: { name: string; status: string; current_task: string | null; progress: number }) => ({
      name: a.name,
      status: a.status,
      current_task: a.current_task,
      progress: a.progress,
    })),
    recent_activity: activity.slice(0, 8).map((a: { agent_name: string; action: string; details: Record<string, unknown> | null; created_at: string }) => ({
      agent: a.agent_name,
      action: a.action,
      detail: typeof a.details?.message === 'string' ? a.details.message
            : typeof a.details?.summary === 'string' ? a.details.summary
            : null,
      at: a.created_at,
    })),
    leads: {
      total: parseInt(leads.total, 10),
      new: parseInt(leads.new_count, 10),
      contacted: parseInt(leads.contacted, 10),
      qualified: parseInt(leads.qualified, 10),
    },
    pending_approvals: pendingApprovals,
    hours_since_last_activity: hoursStale !== null ? Math.round(hoursStale) : null,
    rule_detected_issues: ruleIssues,
  }

  // ── 8. Call LLM ───────────────────────────────────────────────────────────
  let parsed: {
    summary: string
    status: PMReportStatus
    progress: number
    blockers: string[]
    completed_work: string[]
    current_focus: string
    recommended_next_actions: string[]
    needs_client_approval: boolean
  }

  try {
    const raw = await callLLM(
      modelConfig,
      [
        { role: 'system', content: buildPMSystemPrompt(pmName, project.name) },
        { role: 'user',   content: `Project data:\n${JSON.stringify(ctx, null, 2)}` },
      ],
      { jsonMode: true, maxTokens: 900 }
    )
    parsed = JSON.parse(raw)
  } catch {
    // Fallback to rule-based
    const isBlocked = memBlockers.length > 0
    const isStale   = hoursStale !== null ? hoursStale >= STALE_HOURS : true
    const status: PMReportStatus = isBlocked ? 'blocked' : isStale ? 'stale'
      : ruleIssues.length >= 2 ? 'attention' : 'healthy'

    parsed = {
      summary: `${pmName} reports that ${project.name} is currently ${status}. ${ruleIssues.length > 0 ? ruleIssues[0] + '.' : 'No major issues detected.'}`,
      status,
      progress: Math.min(100, Math.max(0,
        (parseInt(leads.total, 10) > 0 ? 30 : 0) +
        (memNextSteps.length > 0 ? 20 : 0) +
        (map?.nodes?.length > 0 ? 20 : 0) +
        (pendingApprovals > 0 ? 15 : 0)
      )),
      blockers: memBlockers,
      completed_work: memNextSteps.slice(0, 3),
      current_focus: project.pm_focus ?? 'Awaiting direction',
      recommended_next_actions: memNextSteps.slice(0, 3),
      needs_client_approval: pendingApprovals > 0,
    }
  }

  // Clamp progress
  const progress = Math.min(100, Math.max(0, Math.round(Number(parsed.progress) || 0)))

  // ── 9. Save report ────────────────────────────────────────────────────────
  const saved = await db.query(
    `INSERT INTO project_manager_reports
       (project_id, project_manager_id, status, summary, progress,
        blockers, completed_work, current_focus,
        recommended_next_actions, needs_client_approval)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id, created_at`,
    [
      projectId,
      pmId,
      parsed.status,
      parsed.summary,
      progress,
      JSON.stringify(parsed.blockers ?? []),
      JSON.stringify(parsed.completed_work ?? []),
      parsed.current_focus ?? '',
      JSON.stringify(parsed.recommended_next_actions ?? []),
      Boolean(parsed.needs_client_approval),
    ]
  )

  return {
    id: saved.rows[0].id,
    project_id: projectId,
    project_manager_id: pmId,
    pm_name: pmName,
    project_name: project.name,
    status: parsed.status,
    summary: parsed.summary,
    progress,
    blockers: parsed.blockers ?? [],
    completed_work: parsed.completed_work ?? [],
    current_focus: parsed.current_focus ?? '',
    recommended_next_actions: parsed.recommended_next_actions ?? [],
    needs_client_approval: Boolean(parsed.needs_client_approval),
    created_at: saved.rows[0].created_at,
  }
}
