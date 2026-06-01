/**
 * project-context.ts
 *
 * Read-only project context aggregation for the CEO recall flow.
 *
 * Functions here only READ data — they never create, update, or trigger
 * any external action. Safe to call from any read path.
 */

import { db } from '@/lib/db/client'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ProjectContext {
  // Core
  id:          string
  name:        string
  goal:        string | null
  description: string | null
  status:      string
  created_at:  string
  // PM
  pm_name:     string | null
  pm_focus:    string | null
  // Memory
  memory_notes:      string | null
  memory_next_steps: string[]
  memory_blockers:   string[]
  // Strategy brief
  brief_title:             string | null
  brief_objective:         string | null
  brief_target_audience:   string | null
  brief_research_prompt:   string | null
  brief_channel:           string | null
  brief_value_prop:        string | null
  brief_operator:          string | null
  brief_operator_reason:   string | null
  // Launch template
  launch_status:       string | null
  launch_done:         number
  launch_total:        number
  launch_next_item:    string | null   // first incomplete checklist item label
  // Leads
  lead_total:    number
  lead_approved: number
  lead_contacted: number
  lead_replied:  number
  // Approvals
  pending_approvals: number
  // Web operator activity (last 5)
  recent_actions: Array<{
    action_type: string
    status: string
    description: string
    completed_at: string | null
    operator_name: string | null
  }>
  // Execution trail (last 5)
  recent_trail: Array<{
    action_type: string
    status: string
    description: string
    created_at: string
    operator_name: string | null
  }>
}

export interface ProjectSummaryRow {
  id:   string
  name: string
  goal: string | null
}

// ── findProjectByNameOrAlias ───────────────────────────────────────────────────

/**
 * Find a project by name substring, case-insensitively.
 * Returns the best match (exact first, then partial), or null.
 */
export async function findProjectByNameOrAlias(
  query: string
): Promise<ProjectSummaryRow | null> {
  if (!query?.trim()) return null

  const q = query.trim()

  // Try exact match first
  const exact = await db.query(
    `SELECT id, name, goal FROM projects
     WHERE active=true AND lower(name)=lower($1)
     LIMIT 1`,
    [q]
  )
  if (exact.rows[0]) return exact.rows[0] as ProjectSummaryRow

  // Partial match
  const partial = await db.query(
    `SELECT id, name, goal FROM projects
     WHERE active=true AND lower(name) LIKE lower($1)
     ORDER BY created_at DESC LIMIT 1`,
    [`%${q}%`]
  )
  if (partial.rows[0]) return partial.rows[0] as ProjectSummaryRow

  return null
}

/**
 * List all active project names (for "no project found" fallback).
 */
export async function listActiveProjectNames(): Promise<string[]> {
  const res = await db.query(
    `SELECT name FROM projects WHERE active=true ORDER BY created_at DESC LIMIT 20`
  )
  return res.rows.map((r: { name: string }) => String(r.name))
}

// ── getProjectContext ──────────────────────────────────────────────────────────

/**
 * Load the full project context for a given project ID.
 * Read-only — no mutations.
 */
export async function getProjectContext(projectId: string): Promise<ProjectContext | null> {
  // Core project + PM
  const projRes = await db.query(
    `SELECT p.id, p.name, p.goal, p.description, p.status, p.created_at,
            pm.name AS pm_name, pm.current_focus AS pm_focus
     FROM projects p
     LEFT JOIN project_managers pm ON pm.id = p.assigned_pm_id
     WHERE p.id = $1`,
    [projectId]
  )
  if (!projRes.rows[0]) return null
  const p = projRes.rows[0]

  // Memory
  const memRes = await db.query(
    `SELECT notes, next_steps, blockers FROM project_memory WHERE project_id=$1 LIMIT 1`,
    [projectId]
  )
  const mem = memRes.rows[0] ?? {}

  // Strategy brief
  const briefRes = await db.query(
    `SELECT title, objective, target_audience, research_prompt,
            recommended_channel, value_proposition,
            recommended_operator_name, operator_reason
     FROM project_strategy_briefs WHERE project_id=$1 LIMIT 1`,
    [projectId]
  )
  const brief = briefRes.rows[0] ?? {}

  // Launch template — derive progress
  const tplRes = await db.query(
    `SELECT status, checklist FROM project_launch_templates WHERE project_id=$1 LIMIT 1`,
    [projectId]
  )
  const tpl = tplRes.rows[0]
  let launchDone = 0, launchTotal = 0, launchNextItem: string | null = null, launchStatus: string | null = null
  if (tpl) {
    const checklist: Array<{ label: string; completed: boolean }> =
      Array.isArray(tpl.checklist) ? tpl.checklist : []
    launchTotal  = checklist.length
    launchDone   = checklist.filter(i => i.completed).length
    launchStatus = String(tpl.status ?? 'draft')
    const nextItem = checklist.find(i => !i.completed)
    launchNextItem = nextItem ? String(nextItem.label) : null
  }

  // Lead counts
  const leadRes = await db.query(
    `SELECT status, COUNT(*)::int AS n FROM leads WHERE project_id=$1 GROUP BY status`,
    [projectId]
  )
  const leadCounts: Record<string, number> = {}
  for (const row of leadRes.rows) leadCounts[String(row.status)] = Number(row.n)

  // Pending approvals
  const approvalRes = await db.query(
    `SELECT COUNT(*)::int AS n
     FROM approval_items ai
     LEFT JOIN web_operator_actions woa ON woa.approval_item_id = ai.id
     WHERE ai.status='pending' AND woa.project_id=$1`,
    [projectId]
  )
  const pendingApprovals = Number(approvalRes.rows[0]?.n ?? 0)

  // Recent Web Operator actions (joined with operator name for "what has X done?" queries)
  const actionsRes = await db.query(
    `SELECT woa.action_type, woa.status, woa.description, woa.completed_at,
            wo.name AS operator_name
     FROM web_operator_actions woa
     LEFT JOIN web_operators wo ON wo.id = woa.operator_id
     WHERE woa.project_id=$1
     ORDER BY COALESCE(woa.completed_at, woa.created_at) DESC
     LIMIT 8`,
    [projectId]
  )

  // Recent execution trail (same join, deduplicated from actions above)
  const trailRes = await db.query(
    `SELECT woa.action_type, woa.status, woa.description, woa.created_at,
            wo.name AS operator_name
     FROM web_operator_actions woa
     LEFT JOIN web_operators wo ON wo.id = woa.operator_id
     WHERE woa.project_id=$1
     ORDER BY COALESCE(woa.completed_at, woa.created_at) DESC
     LIMIT 5`,
    [projectId]
  )

  const safeArray = (v: unknown): string[] => {
    if (Array.isArray(v)) return v.map(String)
    if (typeof v === 'string') {
      try { const p = JSON.parse(v); return Array.isArray(p) ? p.map(String) : [] }
      catch { return [] }
    }
    return []
  }

  return {
    id:          String(p.id),
    name:        String(p.name),
    goal:        p.goal        ? String(p.goal)        : null,
    description: p.description ? String(p.description) : null,
    status:      String(p.status ?? 'active'),
    created_at:  String(p.created_at),
    pm_name:     p.pm_name  ? String(p.pm_name)  : null,
    pm_focus:    p.pm_focus ? String(p.pm_focus) : null,
    memory_notes:      mem.notes      ? String(mem.notes) : null,
    memory_next_steps: safeArray(mem.next_steps),
    memory_blockers:   safeArray(mem.blockers),
    brief_title:           brief.title           ? String(brief.title)           : null,
    brief_objective:       brief.objective       ? String(brief.objective)       : null,
    brief_target_audience: brief.target_audience ? String(brief.target_audience) : null,
    brief_research_prompt: brief.research_prompt ? String(brief.research_prompt) : null,
    brief_channel:         brief.recommended_channel ? String(brief.recommended_channel) : null,
    brief_value_prop:      brief.value_proposition  ? String(brief.value_proposition)  : null,
    brief_operator:        brief.recommended_operator_name ? String(brief.recommended_operator_name) : null,
    brief_operator_reason: brief.operator_reason ? String(brief.operator_reason) : null,
    launch_status:    launchStatus,
    launch_done:      launchDone,
    launch_total:     launchTotal,
    launch_next_item: launchNextItem,
    lead_total:     Object.values(leadCounts).reduce((a, b) => a + b, 0),
    lead_approved:  leadCounts['approved']  ?? 0,
    lead_contacted: leadCounts['contacted'] ?? 0,
    lead_replied:   leadCounts['replied']   ?? 0,
    pending_approvals: pendingApprovals,
    recent_actions: actionsRes.rows.map(r => ({
      action_type:   String(r.action_type),
      status:        String(r.status),
      description:   String(r.description ?? ''),
      completed_at:  r.completed_at ? String(r.completed_at) : null,
      operator_name: r.operator_name ? String(r.operator_name) : null,
    })),
    recent_trail: trailRes.rows.map(r => ({
      action_type:   String(r.action_type),
      status:        String(r.status),
      description:   String(r.description ?? ''),
      created_at:    String(r.created_at),
      operator_name: r.operator_name ? String(r.operator_name) : null,
    })),
  }
}

// ── getProjectExecutiveSummary ────────────────────────────────────────────────

/**
 * Build a compact plain-text summary for a project, suitable for injecting
 * into a CEO prompt. Read-only.
 */
export function getProjectExecutiveSummary(ctx: ProjectContext): string {
  const lines: string[] = []
  lines.push(`Project: ${ctx.name}`)
  if (ctx.goal)         lines.push(`Goal: ${ctx.goal}`)
  if (ctx.pm_name)      lines.push(`Assigned PM: ${ctx.pm_name}${ctx.pm_focus ? ` (focus: ${ctx.pm_focus})` : ''}`)
  else                  lines.push(`Assigned PM: none`)
  if (ctx.brief_objective)       lines.push(`Campaign objective: ${ctx.brief_objective}`)
  if (ctx.brief_target_audience) lines.push(`Target audience: ${ctx.brief_target_audience}`)
  if (ctx.brief_channel)         lines.push(`Channel: ${ctx.brief_channel}`)
  if (ctx.brief_value_prop)      lines.push(`Value prop: ${ctx.brief_value_prop}`)
  if (ctx.brief_operator)        lines.push(`Recommended operator: ${ctx.brief_operator}${ctx.brief_operator_reason ? ` — ${ctx.brief_operator_reason}` : ''}`)
  if (ctx.launch_total > 0) {
    lines.push(`Launch progress: ${ctx.launch_done}/${ctx.launch_total} steps (${ctx.launch_status})`)
    if (ctx.launch_next_item) lines.push(`Next checklist step: ${ctx.launch_next_item}`)
  }
  lines.push(`Leads: ${ctx.lead_total} total, ${ctx.lead_approved} approved, ${ctx.lead_contacted} contacted, ${ctx.lead_replied} replied`)
  if (ctx.pending_approvals > 0) lines.push(`Pending approvals: ${ctx.pending_approvals}`)
  if (ctx.memory_notes)          lines.push(`Memory notes: ${ctx.memory_notes}`)
  if (ctx.memory_blockers.length > 0) lines.push(`Blockers: ${ctx.memory_blockers.join('; ')}`)
  if (ctx.memory_next_steps.length > 0) lines.push(`Memory next steps: ${ctx.memory_next_steps.join('; ')}`)
  if (ctx.recent_actions.length > 0) {
    lines.push(`Recent operator actions (${ctx.recent_actions.length}):`)
    for (const a of ctx.recent_actions.slice(0, 3)) {
      const by = a.operator_name ? ` (${a.operator_name})` : ''
      lines.push(`  - [${a.status}] ${a.action_type}${by}: ${a.description.slice(0, 80)}`)
    }
  }
  return lines.join('\n')
}

// ── getProjectNextStep ────────────────────────────────────────────────────────

/**
 * Derive the most actionable next step from project context.
 * Returns a short human-readable sentence.
 */
export function getProjectNextStep(ctx: ProjectContext): string {
  // Blockers take priority
  if (ctx.memory_blockers.length > 0) {
    return `Resolve blocker: ${ctx.memory_blockers[0]}`
  }
  // Pending approvals
  if (ctx.pending_approvals > 0) {
    return `Review and approve ${ctx.pending_approvals} pending action${ctx.pending_approvals > 1 ? 's' : ''} in the Approval Center.`
  }
  // Next checklist item
  if (ctx.launch_next_item) {
    return `Complete the next launch step: "${ctx.launch_next_item}".`
  }
  // No leads yet
  if (ctx.lead_total === 0) {
    return ctx.brief_research_prompt
      ? `Research leads using the Web Operator: "${ctx.brief_research_prompt}"`
      : `Research leads using the Web Operator.`
  }
  // Leads discovered but none approved
  if (ctx.lead_approved === 0) {
    return `Review and approve ${ctx.lead_total} discovered lead${ctx.lead_total !== 1 ? 's' : ''}.`
  }
  // Approved but not contacted
  if (ctx.lead_contacted === 0) {
    return `Prepare outreach drafts for ${ctx.lead_approved} approved lead${ctx.lead_approved !== 1 ? 's' : ''}.`
  }
  // Contacted — check for replies
  if (ctx.lead_replied === 0 && ctx.lead_contacted > 0) {
    return `Check for replies from ${ctx.lead_contacted} contacted lead${ctx.lead_contacted !== 1 ? 's' : ''} via Web Operator.`
  }
  // Memory next steps
  if (ctx.memory_next_steps.length > 0) {
    return ctx.memory_next_steps[0]
  }
  return 'Review the execution trail and plan the next campaign phase.'
}
