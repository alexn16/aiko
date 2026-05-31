/**
 * project-launch-template.ts
 *
 * Manages the first-campaign launch checklist for a project.
 * Templates are guidance only — they do not trigger automation or execution.
 *
 * Created automatically when the CEO creates a new project.
 */

import { db } from '@/lib/db/client'

// ── Types ──────────────────────────────────────────────────────────────────────

export type LaunchTemplateStatus = 'draft' | 'ready' | 'in_progress' | 'completed' | 'archived'

export interface ChecklistItem {
  key:       string     // stable machine key
  label:     string     // human label
  completed: boolean
  note?:     string     // optional context
}

export interface ProjectLaunchTemplate {
  id:                      string
  project_id:              string
  status:                  LaunchTemplateStatus
  target_audience_hint:    string | null
  campaign_goal:           string | null
  recommended_operator_id: string | null
  checklist:               ChecklistItem[]
  created_by_role:         string
  created_at:              string
  updated_at:              string
}

// ── Default checklist ──────────────────────────────────────────────────────────

export const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { key: 'define_audience',    label: 'Define target audience',                         completed: false },
  { key: 'choose_operator',    label: 'Choose a Web Operator',                          completed: false },
  { key: 'research_leads',     label: 'Research leads via Web Operator',                completed: false },
  { key: 'review_leads',       label: 'Review and approve leads',                       completed: false },
  { key: 'prepare_draft',      label: 'Prepare Gmail draft for approved lead',          completed: false },
  { key: 'approve_actions',    label: 'Approve risky actions in Approval Center',       completed: false },
  { key: 'resume_send',        label: 'Resume / send if allowed by Operating Mode',     completed: false },
  { key: 'check_replies',      label: 'Check inbox for replies via Web Operator',       completed: false },
  { key: 'review_trail',       label: 'Review execution trail',                         completed: false },
]

// ── Row mapper ─────────────────────────────────────────────────────────────────

function rowToTemplate(row: Record<string, unknown>): ProjectLaunchTemplate {
  return {
    id:                      String(row.id),
    project_id:              String(row.project_id),
    status:                  String(row.status) as LaunchTemplateStatus,
    target_audience_hint:    row.target_audience_hint ? String(row.target_audience_hint) : null,
    campaign_goal:           row.campaign_goal ? String(row.campaign_goal) : null,
    recommended_operator_id: row.recommended_operator_id ? String(row.recommended_operator_id) : null,
    checklist:               Array.isArray(row.checklist) ? row.checklist as ChecklistItem[] : DEFAULT_CHECKLIST,
    created_by_role:         String(row.created_by_role ?? 'CEO'),
    created_at:              String(row.created_at),
    updated_at:              String(row.updated_at),
  }
}

// ── CRUD ───────────────────────────────────────────────────────────────────────

/**
 * createProjectLaunchTemplate
 *
 * Creates a new launch template for a project.
 * Idempotent: if an active (non-completed/archived) template already exists,
 * returns it without creating a duplicate.
 */
export async function createProjectLaunchTemplate(opts: {
  project_id:           string
  target_audience_hint?: string | null
  campaign_goal?:        string | null
  created_by_role?:      string
}): Promise<ProjectLaunchTemplate> {
  // Check for existing active template first
  const existing = await getProjectLaunchTemplate(opts.project_id)
  if (existing) return existing

  const res = await db.query(
    `INSERT INTO project_launch_templates
       (project_id, status, target_audience_hint, campaign_goal, checklist, created_by_role)
     VALUES ($1, 'draft', $2, $3, $4, $5)
     RETURNING *`,
    [
      opts.project_id,
      opts.target_audience_hint ?? null,
      opts.campaign_goal ?? null,
      JSON.stringify(DEFAULT_CHECKLIST),
      opts.created_by_role ?? 'CEO',
    ]
  )
  return rowToTemplate(res.rows[0])
}

/**
 * getProjectLaunchTemplate
 *
 * Returns the active (non-completed/archived) launch template for a project,
 * or null if none exists.
 */
export async function getProjectLaunchTemplate(
  project_id: string
): Promise<ProjectLaunchTemplate | null> {
  const res = await db.query(
    `SELECT * FROM project_launch_templates
     WHERE project_id = $1
       AND status NOT IN ('completed', 'archived')
     ORDER BY created_at DESC
     LIMIT 1`,
    [project_id]
  )
  if (!res.rows[0]) return null
  return rowToTemplate(res.rows[0])
}

/**
 * updateProjectLaunchTemplate
 *
 * Partial update for status, hints, goal, operator, and checklist items.
 */
export async function updateProjectLaunchTemplate(
  template_id: string,
  fields: {
    status?:                  LaunchTemplateStatus
    target_audience_hint?:    string | null
    campaign_goal?:           string | null
    recommended_operator_id?: string | null
    checklist?:               ChecklistItem[]
  }
): Promise<ProjectLaunchTemplate | null> {
  const sets: string[] = ['updated_at=NOW()']
  const vals: unknown[] = []
  let i = 1

  if (fields.status                  !== undefined) { sets.push(`status=$${i++}`);                  vals.push(fields.status) }
  if (fields.target_audience_hint    !== undefined) { sets.push(`target_audience_hint=$${i++}`);    vals.push(fields.target_audience_hint) }
  if (fields.campaign_goal           !== undefined) { sets.push(`campaign_goal=$${i++}`);           vals.push(fields.campaign_goal) }
  if (fields.recommended_operator_id !== undefined) { sets.push(`recommended_operator_id=$${i++}`); vals.push(fields.recommended_operator_id) }
  if (fields.checklist               !== undefined) { sets.push(`checklist=$${i++}`);               vals.push(JSON.stringify(fields.checklist)) }

  vals.push(template_id)
  const res = await db.query(
    `UPDATE project_launch_templates SET ${sets.join(', ')} WHERE id=$${i} RETURNING *`,
    vals
  )
  if (!res.rows[0]) return null
  return rowToTemplate(res.rows[0])
}

/**
 * getLaunchTemplateSummaryForProject
 *
 * Returns the template plus completion stats derived from live summary data.
 * Call this from API routes — it does not re-query the summary tables itself;
 * the caller provides the derived booleans from the existing summary endpoint.
 */
export function computeChecklistCompletion(
  template: ProjectLaunchTemplate,
  signals: {
    has_operator:       boolean   // operator selected
    has_leads:          boolean   // any leads in project
    has_approved_leads: boolean   // approved leads exist
    has_draft_action:   boolean   // completed create_email_draft action exists
    has_send_action:    boolean   // completed send action exists
    has_reply_check:    boolean   // any check_gmail_reply action exists
    has_trail:          boolean   // any trail events
  }
): ChecklistItem[] {
  return template.checklist.map(item => {
    switch (item.key) {
      case 'define_audience': return item  // manual — not auto-derivable
      case 'choose_operator': return { ...item, completed: signals.has_operator }
      case 'research_leads':  return { ...item, completed: signals.has_leads }
      case 'review_leads':    return { ...item, completed: signals.has_approved_leads }
      case 'prepare_draft':   return { ...item, completed: signals.has_draft_action }
      case 'approve_actions': return item  // manual — depends on user judgment
      case 'resume_send':     return { ...item, completed: signals.has_send_action }
      case 'check_replies':   return { ...item, completed: signals.has_reply_check }
      case 'review_trail':    return { ...item, completed: signals.has_trail }
      default:                return item
    }
  })
}
