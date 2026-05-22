/**
 * CEO Review Agent
 *
 * Inspects all active projects, PMs, memories, agent activity, and pending
 * approvals, then produces a structured company-level review.
 *
 * Safe read-only analysis — no emails sent, no approvals changed, no secrets
 * exposed, no model routing altered.
 */

import { callLLM, LLMConfig } from '@/lib/models/provider'
import { db } from '@/lib/db/client'

export interface CeoReviewFinding {
  project_id: string
  project_name: string
  status: 'healthy' | 'attention' | 'blocked' | 'stale'
  issues: string[]
  positive: string[]
}

export interface CeoReviewResult {
  id: string
  summary: string
  project_count: number
  active_project_count: number
  pending_approval_count: number
  blocked_project_count: number
  priority_project_id: string | null
  priority_project_name: string | null
  findings: CeoReviewFinding[]
  recommended_actions: string[]
  created_at: string
}

const STALE_HOURS = 48

const CEO_REVIEW_SYSTEM = `You are the CEO of AÏKO, an AI marketing company. You have just completed a systematic review of all active projects and teams.

Write a structured executive review. Be direct and specific. Sound like a founder reviewing weekly ops — calm, decisive, no filler.

Return ONLY valid JSON:
{
  "summary": "2–4 sentence company-level overview",
  "priority_project_name": "name of the single most important project right now, or null",
  "findings": [
    {
      "project_name": "...",
      "status": "healthy|attention|blocked|stale",
      "issues": ["specific issue"],
      "positive": ["specific strength"]
    }
  ],
  "recommended_actions": [
    "Concrete action 1",
    "Concrete action 2"
  ]
}

Rules:
- findings must cover every active project
- recommended_actions: 3–6 items, ordered by priority, each actionable
- Do not invent data — only use what is in the context
- status "stale" means no activity in 48+ hours; "blocked" means explicit blockers exist; "attention" means something needs a decision; "healthy" means progressing normally`

interface RawProject {
  id: string
  name: string
  goal: string | null
  description: string | null
  created_at: string
  pm_name: string | null
  pm_status: string | null
  pm_focus: string | null
  memory_notes: string | null
  memory_next_steps: string[] | null
  memory_blockers: string[] | null
  map_nodes: Array<{ id: string; label: string; type: string }> | null
  latest_activity_at: string | null
  lead_count: number
  pending_approvals: number
  active_agent_count: number
}

async function loadProjectData(): Promise<RawProject[]> {
  const result = await db.query(`
    SELECT
      p.id,
      p.name,
      p.goal,
      p.description,
      p.created_at,
      pm.name           AS pm_name,
      pm.status         AS pm_status,
      pm.current_focus  AS pm_focus,
      mem.notes         AS memory_notes,
      mem.next_steps    AS memory_next_steps,
      mem.blockers      AS memory_blockers,
      pmap.nodes        AS map_nodes,
      (
        SELECT MAX(al.created_at)
        FROM agent_logs al
        JOIN agents ag ON ag.id = al.agent_id
        WHERE ag.project_id = p.id
      )                 AS latest_activity_at,
      (SELECT COUNT(*) FROM leads l WHERE l.project_id = p.id)::int
                        AS lead_count,
      (SELECT COUNT(*) FROM approvals a
       WHERE a.project_id = p.id
         AND a.status IN ('pending','quality_passed'))::int
                        AS pending_approvals,
      (SELECT COUNT(*) FROM agents ag
       WHERE ag.project_id = p.id
         AND ag.status NOT IN ('idle','paused'))::int
                        AS active_agent_count
    FROM projects p
    LEFT JOIN project_managers pm   ON pm.id   = p.assigned_pm_id
    LEFT JOIN project_memory   mem  ON mem.project_id = p.id
    LEFT JOIN project_map      pmap ON pmap.project_id = p.id
    WHERE p.active = true
    ORDER BY p.created_at DESC
  `)
  return result.rows
}

function detectConditions(p: RawProject, now: Date): string[] {
  const issues: string[] = []

  if (!p.pm_name) issues.push('No Project Manager assigned')

  const blockers = p.memory_blockers ?? []
  if (blockers.length > 0) {
    issues.push(`${blockers.length} blocker${blockers.length > 1 ? 's' : ''}: ${blockers.slice(0, 2).join('; ')}`)
  }

  if (p.pending_approvals > 0) {
    issues.push(`${p.pending_approvals} outreach draft${p.pending_approvals > 1 ? 's' : ''} waiting for approval`)
  }

  const nextSteps = p.memory_next_steps ?? []
  if (nextSteps.length === 0 && !p.memory_notes) {
    issues.push('No next actions or project notes recorded')
  }

  if (!p.map_nodes || (p.map_nodes as unknown[]).length === 0) {
    issues.push('No pipeline map defined')
  }

  if (p.lead_count === 0) issues.push('No leads collected yet')

  if (p.latest_activity_at) {
    const hoursAgo = (now.getTime() - new Date(p.latest_activity_at).getTime()) / 3_600_000
    if (hoursAgo >= STALE_HOURS) {
      issues.push(`No agent activity in ${Math.round(hoursAgo)} hours`)
    }
  } else {
    issues.push('No agent activity recorded')
  }

  return issues
}

function classifyStatus(p: RawProject, issues: string[]): CeoReviewFinding['status'] {
  const blockers = p.memory_blockers ?? []
  if (blockers.length > 0) return 'blocked'

  if (p.latest_activity_at) {
    const hoursAgo = (Date.now() - new Date(p.latest_activity_at).getTime()) / 3_600_000
    if (hoursAgo >= STALE_HOURS) return 'stale'
  } else {
    return 'stale'
  }

  if (issues.length >= 2) return 'attention'
  return 'healthy'
}

function buildPositives(p: RawProject): string[] {
  const positives: string[] = []
  if (p.pm_name) positives.push(`${p.pm_name} assigned as Project Manager`)
  if (p.lead_count > 0) positives.push(`${p.lead_count} leads in pipeline`)
  if (p.active_agent_count > 0) positives.push(`${p.active_agent_count} agent${p.active_agent_count > 1 ? 's' : ''} currently active`)
  const nextSteps = p.memory_next_steps ?? []
  if (nextSteps.length > 0) positives.push('Next steps defined')
  const nodes = p.map_nodes ?? []
  if ((nodes as unknown[]).length > 0) positives.push('Pipeline map configured')
  return positives
}

export async function runCeoReviewAgent(modelConfig: LLMConfig): Promise<CeoReviewResult> {
  const now = new Date()

  // 1. Load all project data in one query
  const projects = await loadProjectData()

  // 2. Load company memory
  const memRow = await db.query('SELECT * FROM company_memory LIMIT 1')
  const companyMemory = memRow.rows[0] ?? {}

  // 3. Rule-based detection per project
  const localFindings: CeoReviewFinding[] = projects.map(p => {
    const issues = detectConditions(p, now)
    const status = classifyStatus(p, issues)
    return {
      project_id: p.id,
      project_name: p.name,
      status,
      issues,
      positive: buildPositives(p),
    }
  })

  // 4. Build totals
  const pendingApprovals = projects.reduce((s, p) => s + (p.pending_approvals ?? 0), 0)
  const blockedCount = localFindings.filter(f => f.status === 'blocked').length
  const staleCount = localFindings.filter(f => f.status === 'stale').length

  // 5. Build LLM context
  const ctx = {
    company_memory: {
      summary: companyMemory.summary ?? '',
      global_priorities: companyMemory.global_priorities ?? [],
    },
    review_date: now.toISOString().slice(0, 10),
    projects: projects.map(p => ({
      id: p.id,
      name: p.name,
      goal: p.goal,
      pm: p.pm_name ?? 'none',
      pm_focus: p.pm_focus ?? '',
      leads: p.lead_count,
      pending_approvals: p.pending_approvals,
      active_agents: p.active_agent_count,
      memory_notes: p.memory_notes ?? '',
      next_steps: p.memory_next_steps ?? [],
      blockers: p.memory_blockers ?? [],
      has_map: (p.map_nodes && (p.map_nodes as unknown[]).length > 0),
      hours_since_activity: p.latest_activity_at
        ? Math.round((now.getTime() - new Date(p.latest_activity_at).getTime()) / 3_600_000)
        : null,
      local_issues: localFindings.find(f => f.project_id === p.id)?.issues ?? [],
    })),
    summary_stats: {
      total_projects: projects.length,
      blocked: blockedCount,
      stale: staleCount,
      total_pending_approvals: pendingApprovals,
    },
  }

  // 6. Call LLM for narrative review
  let parsed: {
    summary: string
    priority_project_name: string | null
    findings: Array<{
      project_name: string
      status: string
      issues: string[]
      positive: string[]
    }>
    recommended_actions: string[]
  }

  try {
    const raw = await callLLM(
      modelConfig,
      [
        { role: 'system', content: CEO_REVIEW_SYSTEM },
        { role: 'user', content: `Company state:\n${JSON.stringify(ctx, null, 2)}` },
      ],
      { jsonMode: true, maxTokens: 1400 }
    )
    parsed = JSON.parse(raw)
  } catch {
    // Fallback: use rule-based data if LLM fails
    parsed = {
      summary: `AÏKO is managing ${projects.length} active project${projects.length !== 1 ? 's' : ''}. ${blockedCount > 0 ? `${blockedCount} project${blockedCount > 1 ? 's are' : ' is'} blocked. ` : ''}${pendingApprovals > 0 ? `${pendingApprovals} outreach draft${pendingApprovals > 1 ? 's' : ''} need review.` : ''}`.trim(),
      priority_project_name: null,
      findings: localFindings.map(f => ({
        project_name: f.project_name,
        status: f.status,
        issues: f.issues,
        positive: f.positive,
      })),
      recommended_actions: [
        ...(pendingApprovals > 0 ? [`Review and approve ${pendingApprovals} pending outreach draft${pendingApprovals > 1 ? 's' : ''}`] : []),
        ...(blockedCount > 0 ? ['Resolve blockers in flagged projects'] : []),
        ...(staleCount > 0 ? ['Restart activity on stale projects'] : []),
        'Review project maps and next steps for all active projects',
      ],
    }
  }

  // 7. Resolve priority project ID
  let priorityProjectId: string | null = null
  if (parsed.priority_project_name) {
    const match = projects.find(
      p => p.name.toLowerCase() === String(parsed.priority_project_name).toLowerCase()
    )
    priorityProjectId = match?.id ?? null
  }

  // 8. Merge LLM findings with local rule-based data
  const mergedFindings: CeoReviewFinding[] = localFindings.map(local => {
    const llm = parsed.findings?.find(
      f => f.project_name?.toLowerCase() === local.project_name.toLowerCase()
    )
    return {
      project_id: local.project_id,
      project_name: local.project_name,
      status: (llm?.status as CeoReviewFinding['status']) ?? local.status,
      issues: llm?.issues?.length ? llm.issues : local.issues,
      positive: llm?.positive?.length ? llm.positive : local.positive,
    }
  })

  // 9. Save review
  const reviewResult = await db.query(
    `INSERT INTO ceo_reviews
       (summary, project_count, active_project_count, pending_approval_count,
        blocked_project_count, priority_project_id, findings, recommended_actions)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, created_at`,
    [
      parsed.summary,
      projects.length,
      projects.length,
      pendingApprovals,
      blockedCount,
      priorityProjectId,
      JSON.stringify(mergedFindings),
      JSON.stringify(parsed.recommended_actions ?? []),
    ]
  )

  const saved = reviewResult.rows[0]

  // 10. Update company memory with review summary + priorities
  const memId = companyMemory.id
  const newPriorities = (parsed.recommended_actions ?? []).slice(0, 4)

  if (memId) {
    await db.query(
      `UPDATE company_memory
       SET summary=$1, global_priorities=$2, last_review_at=NOW(), updated_at=NOW()
       WHERE id=$3`,
      [parsed.summary, JSON.stringify(newPriorities), memId]
    )
  } else {
    await db.query(
      `INSERT INTO company_memory (summary, global_priorities, last_review_at)
       VALUES ($1,$2,NOW())`,
      [parsed.summary, JSON.stringify(newPriorities)]
    )
  }

  return {
    id: saved.id,
    summary: parsed.summary,
    project_count: projects.length,
    active_project_count: projects.length,
    pending_approval_count: pendingApprovals,
    blocked_project_count: blockedCount,
    priority_project_id: priorityProjectId,
    priority_project_name: parsed.priority_project_name ?? null,
    findings: mergedFindings,
    recommended_actions: parsed.recommended_actions ?? [],
    created_at: saved.created_at,
  }
}
