/**
 * project-decisions.ts
 *
 * Decision Log — internal read-only memory of important project decisions.
 *
 * This module only RECORDS and READS decisions.
 * It never executes any automation, triggers Web Operator, or sends messages.
 */

import { db } from '@/lib/db/client'

// ── Types ──────────────────────────────────────────────────────────────────────

export type DecisionType =
  | 'project_created'
  | 'pm_assigned'
  | 'strategy_brief_created'
  | 'operator_recommended'
  | 'operator_changed'
  | 'launch_template_created'
  | 'lead_approved'
  | 'lead_rejected'
  | 'approval_approved'
  | 'approval_rejected'
  | 'approval_changes_requested'
  | 'campaign_approved'
  | 'research_prompt_changed'
  | 'next_step_changed'

export interface ProjectDecision {
  id:                  string
  project_id:          string
  decision_type:       DecisionType
  title:               string
  summary:             string | null
  decided_by_role:     string | null   // 'ceo' | 'user' | 'system'
  decided_by_user_id:  string | null
  related_entity_type: string | null
  related_entity_id:   string | null
  metadata:            Record<string, unknown>
  created_at:          string
}

export interface RecordDecisionInput {
  project_id:           string
  decision_type:        DecisionType
  title:                string
  summary?:             string | null
  decided_by_role?:     string | null
  decided_by_user_id?:  string | null
  related_entity_type?: string | null
  related_entity_id?:   string | null
  metadata?:            Record<string, unknown>
}

// ── recordProjectDecision ─────────────────────────────────────────────────────

/**
 * Insert a new decision entry. Always creates a new row — for idempotent
 * creation events, use recordDecisionIfNotExists() instead.
 */
export async function recordProjectDecision(
  input: RecordDecisionInput
): Promise<ProjectDecision> {
  const res = await db.query(
    `INSERT INTO project_decisions
       (project_id, decision_type, title, summary,
        decided_by_role, decided_by_user_id,
        related_entity_type, related_entity_id, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      input.project_id,
      input.decision_type,
      input.title,
      input.summary ?? null,
      input.decided_by_role ?? null,
      input.decided_by_user_id ?? null,
      input.related_entity_type ?? null,
      input.related_entity_id ?? null,
      JSON.stringify(input.metadata ?? {}),
    ]
  )
  return rowToDecision(res.rows[0])
}

// ── recordDecisionIfNotExists ─────────────────────────────────────────────────

/**
 * Idempotent variant: only inserts if no decision of this type exists
 * for the given project_id. Use for automatic creation events
 * (project_created, strategy_brief_created, launch_template_created).
 *
 * Returns the existing row if already recorded, or the new row.
 */
export async function recordDecisionIfNotExists(
  input: RecordDecisionInput
): Promise<ProjectDecision> {
  // Check for existing
  const existing = await db.query(
    `SELECT * FROM project_decisions
     WHERE project_id=$1 AND decision_type=$2
     ORDER BY created_at ASC LIMIT 1`,
    [input.project_id, input.decision_type]
  )
  if (existing.rows[0]) return rowToDecision(existing.rows[0])
  return recordProjectDecision(input)
}

// ── listProjectDecisions ──────────────────────────────────────────────────────

export interface ListDecisionsOptions {
  limit?:  number
  offset?: number
  types?:  DecisionType[]
}

/**
 * Return decisions for a project, newest first.
 */
export async function listProjectDecisions(
  projectId: string,
  opts: ListDecisionsOptions = {}
): Promise<ProjectDecision[]> {
  const limit  = opts.limit  ?? 50
  const offset = opts.offset ?? 0

  let query: string
  let params: unknown[]

  if (opts.types && opts.types.length > 0) {
    const placeholders = opts.types.map((_, i) => `$${i + 4}`).join(',')
    query = `SELECT * FROM project_decisions
             WHERE project_id=$1 AND decision_type IN (${placeholders})
             ORDER BY created_at DESC
             LIMIT $2 OFFSET $3`
    params = [projectId, limit, offset, ...opts.types]
  } else {
    query = `SELECT * FROM project_decisions
             WHERE project_id=$1
             ORDER BY created_at DESC
             LIMIT $2 OFFSET $3`
    params = [projectId, limit, offset]
  }

  const res = await db.query(query, params)
  return res.rows.map(rowToDecision)
}

// ── getDecisionSummaryForProject ──────────────────────────────────────────────

/**
 * Return a compact plain-text summary of the most recent decisions,
 * suitable for injecting into a CEO prompt.
 */
export async function getDecisionSummaryForProject(
  projectId: string,
  limit = 8
): Promise<string> {
  const decisions = await listProjectDecisions(projectId, { limit })
  if (decisions.length === 0) return 'No decisions recorded yet.'
  return decisions
    .map(d => {
      const who  = d.decided_by_role ? ` (${d.decided_by_role})` : ''
      const when = new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      return `[${when}] ${d.title}${who}: ${d.summary ?? d.decision_type}`
    })
    .join('\n')
}

// ── Row mapper ────────────────────────────────────────────────────────────────

function rowToDecision(r: Record<string, unknown>): ProjectDecision {
  let metadata: Record<string, unknown> = {}
  if (r.metadata) {
    if (typeof r.metadata === 'string') {
      try { metadata = JSON.parse(r.metadata) } catch { /* ignore */ }
    } else if (typeof r.metadata === 'object') {
      metadata = r.metadata as Record<string, unknown>
    }
  }
  return {
    id:                  String(r.id),
    project_id:          String(r.project_id),
    decision_type:       String(r.decision_type) as DecisionType,
    title:               String(r.title),
    summary:             r.summary ? String(r.summary) : null,
    decided_by_role:     r.decided_by_role ? String(r.decided_by_role) : null,
    decided_by_user_id:  r.decided_by_user_id ? String(r.decided_by_user_id) : null,
    related_entity_type: r.related_entity_type ? String(r.related_entity_type) : null,
    related_entity_id:   r.related_entity_id ? String(r.related_entity_id) : null,
    metadata,
    created_at:          String(r.created_at),
  }
}
