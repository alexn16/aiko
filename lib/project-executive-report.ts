/**
 * project-executive-report.ts
 *
 * Generate and persist executive project reports.
 *
 * Safety:
 * - Read-only except saving the report record.
 * - No Web Operator actions triggered.
 * - No external sends.
 * - Calls AI brain (role:'ceo') for prose generation.
 * - If AI fails, falls back to a deterministic structured report.
 */

import { db } from '@/lib/db/client'
import { callAI } from '@/lib/ai/router'
import {
  getProjectContext,
  getProjectExecutiveSummary,
  getProjectNextStep,
  type ProjectContext,
} from '@/lib/project-context'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ExecutiveReport {
  id:                  string
  project_id:          string
  title:               string
  summary:             string | null
  strategy_snapshot:   StrategySnapshot
  progress_snapshot:   ProgressSnapshot
  decisions_snapshot:  DecisionSnapshotItem[]
  risks:               string[]
  next_steps:          string[]
  generated_by_role:   string
  created_at:          string
}

export interface StrategySnapshot {
  goal:             string | null
  objective:        string | null
  target_audience:  string | null
  channel:          string | null
  value_prop:       string | null
  operator:         string | null
  pm:               string | null
}

export interface ProgressSnapshot {
  launch_status:    string | null
  launch_done:      number
  launch_total:     number
  launch_next_item: string | null
  lead_total:       number
  lead_approved:    number
  lead_contacted:   number
  lead_replied:     number
  pending_approvals:number
}

export interface DecisionSnapshotItem {
  decision_type: string
  title:         string
  summary:       string | null
  created_at:    string
}

// ── createProjectExecutiveReport ──────────────────────────────────────────────

/**
 * Persist a report record directly (lower-level, accepts pre-built data).
 */
export async function createProjectExecutiveReport(
  projectId: string,
  data: {
    title:              string
    summary?:           string | null
    strategy_snapshot?: StrategySnapshot
    progress_snapshot?: ProgressSnapshot
    decisions_snapshot?: DecisionSnapshotItem[]
    risks?:             string[]
    next_steps?:        string[]
    generated_by_role?: string
  }
): Promise<ExecutiveReport> {
  const res = await db.query(
    `INSERT INTO project_executive_reports
       (project_id, title, summary, strategy_snapshot, progress_snapshot,
        decisions_snapshot, risks, next_steps, generated_by_role)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      projectId,
      data.title,
      data.summary ?? null,
      JSON.stringify(data.strategy_snapshot ?? {}),
      JSON.stringify(data.progress_snapshot ?? {}),
      JSON.stringify(data.decisions_snapshot ?? []),
      JSON.stringify(data.risks ?? []),
      JSON.stringify(data.next_steps ?? []),
      data.generated_by_role ?? 'ceo',
    ]
  )
  return rowToReport(res.rows[0])
}

// ── getLatestProjectExecutiveReport ──────────────────────────────────────────

export async function getLatestProjectExecutiveReport(
  projectId: string
): Promise<ExecutiveReport | null> {
  const res = await db.query(
    `SELECT * FROM project_executive_reports
     WHERE project_id=$1
     ORDER BY created_at DESC LIMIT 1`,
    [projectId]
  )
  return res.rows[0] ? rowToReport(res.rows[0]) : null
}

// ── listProjectExecutiveReports ───────────────────────────────────────────────

export async function listProjectExecutiveReports(
  projectId: string,
  limit = 20
): Promise<ExecutiveReport[]> {
  const res = await db.query(
    `SELECT * FROM project_executive_reports
     WHERE project_id=$1
     ORDER BY created_at DESC LIMIT $2`,
    [projectId, limit]
  )
  return res.rows.map(rowToReport)
}

// ── generateProjectExecutiveReport ───────────────────────────────────────────

/**
 * Generate a fresh executive report for a project using project context + AI.
 *
 * 1. Load project context (read-only).
 * 2. Build snapshots (strategy, progress, decisions).
 * 3. Call AI to produce a concise executive summary paragraph + risks + next steps.
 * 4. If AI fails, use deterministic fallback.
 * 5. Save to DB and return.
 */
export async function generateProjectExecutiveReport(
  projectId: string
): Promise<ExecutiveReport> {
  const ctx = await getProjectContext(projectId)
  if (!ctx) {
    throw new Error(`Project ${projectId} not found`)
  }

  const strategySnapshot = buildStrategySnapshot(ctx)
  const progressSnapshot = buildProgressSnapshot(ctx)
  const decisionsSnapshot = ctx.recent_decisions.map(d => ({
    decision_type: d.decision_type,
    title:         d.title,
    summary:       d.summary,
    created_at:    d.created_at,
  }))

  // Deterministic derived fields
  const risks = deriveRisks(ctx)
  const nextStepSentence = getProjectNextStep(ctx)
  const nextSteps = [nextStepSentence]

  const title = `Executive Report — ${ctx.name}`
  const executiveSummary = getProjectExecutiveSummary(ctx)

  // Try AI generation for the prose summary
  let summary: string | null = null
  try {
    summary = await generateAISummary(ctx, executiveSummary, risks, nextStepSentence)
  } catch {
    // Fallback: deterministic summary built from structured data
    summary = buildFallbackSummary(ctx, strategySnapshot, progressSnapshot, risks, nextStepSentence)
  }

  return createProjectExecutiveReport(projectId, {
    title,
    summary,
    strategy_snapshot:   strategySnapshot,
    progress_snapshot:   progressSnapshot,
    decisions_snapshot:  decisionsSnapshot,
    risks,
    next_steps:          nextSteps,
    generated_by_role:   'ceo',
  })
}

// ── AI generation ─────────────────────────────────────────────────────────────

const REPORT_SYSTEM_PROMPT = `You are the CEO of AÏKO. Write a concise executive report for a project.

Format:
- 3-5 sentences of prose (no bullets in the summary field).
- Cover: what the project is, where we are in the campaign, lead pipeline status, any blockers.
- Tone: direct, clear, executive. First person.
- Do not invent numbers or actions that aren't in the data.
- If something is missing, say "not yet" rather than guessing.

Return ONLY valid JSON:
{
  "summary": "3-5 sentence executive summary prose",
  "risks": ["risk 1", "risk 2"],
  "next_steps": ["most important next action"]
}`

async function generateAISummary(
  ctx: ProjectContext,
  executiveSummary: string,
  risks: string[],
  nextStep: string
): Promise<string> {
  const raw = await callAI({
    role: 'ceo',
    messages: [
      { role: 'system', content: REPORT_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Project data:\n${executiveSummary}\n\nDerived risks: ${risks.join('; ') || 'none'}\nDerived next step: ${nextStep}`,
      },
    ],
    jsonMode: true,
    maxTokens: 600,
  })

  const parsed = JSON.parse(raw) as { summary?: string }
  if (!parsed.summary || parsed.summary.trim().length < 10) {
    throw new Error('AI returned empty summary')
  }
  return parsed.summary.trim()
}

// ── Deterministic helpers ─────────────────────────────────────────────────────

function buildStrategySnapshot(ctx: ProjectContext): StrategySnapshot {
  return {
    goal:            ctx.goal,
    objective:       ctx.brief_objective,
    target_audience: ctx.brief_target_audience,
    channel:         ctx.brief_channel,
    value_prop:      ctx.brief_value_prop,
    operator:        ctx.brief_operator ?? ctx.pm_name ?? null,
    pm:              ctx.pm_name,
  }
}

function buildProgressSnapshot(ctx: ProjectContext): ProgressSnapshot {
  return {
    launch_status:     ctx.launch_status,
    launch_done:       ctx.launch_done,
    launch_total:      ctx.launch_total,
    launch_next_item:  ctx.launch_next_item,
    lead_total:        ctx.lead_total,
    lead_approved:     ctx.lead_approved,
    lead_contacted:    ctx.lead_contacted,
    lead_replied:      ctx.lead_replied,
    pending_approvals: ctx.pending_approvals,
  }
}

function deriveRisks(ctx: ProjectContext): string[] {
  const risks: string[] = []
  if (ctx.memory_blockers.length > 0) {
    risks.push(...ctx.memory_blockers.map(b => `Blocker: ${b}`))
  }
  if (ctx.pending_approvals > 0) {
    risks.push(`${ctx.pending_approvals} approval item${ctx.pending_approvals > 1 ? 's' : ''} awaiting review`)
  }
  if (!ctx.pm_name) {
    risks.push('No Project Manager assigned')
  }
  if (!ctx.brief_operator && !ctx.brief_operator) {
    if (ctx.lead_total === 0) risks.push('No leads researched yet')
  }
  if (ctx.lead_total > 0 && ctx.lead_approved === 0) {
    risks.push(`${ctx.lead_total} discovered lead${ctx.lead_total > 1 ? 's' : ''} not yet approved`)
  }
  if (ctx.lead_contacted > 0 && ctx.lead_replied === 0) {
    risks.push(`${ctx.lead_contacted} contacted lead${ctx.lead_contacted > 1 ? 's' : ''} with no replies tracked`)
  }
  return risks
}

function buildFallbackSummary(
  ctx: ProjectContext,
  strategy: StrategySnapshot,
  progress: ProgressSnapshot,
  risks: string[],
  nextStep: string
): string {
  const parts: string[] = []

  parts.push(`${ctx.name} is an active project${ctx.goal ? ` with the goal: ${ctx.goal}` : ''}.`)

  if (strategy.target_audience) {
    parts.push(`We are targeting ${strategy.target_audience}${strategy.channel ? ` via ${strategy.channel}` : ''}.`)
  }

  if (progress.launch_total > 0) {
    parts.push(`The first-campaign launch plan is ${progress.launch_done}/${progress.launch_total} steps complete (${progress.launch_status ?? 'in progress'}).`)
  }

  if (progress.lead_total > 0) {
    parts.push(`The lead pipeline has ${progress.lead_total} total leads — ${progress.lead_approved} approved, ${progress.lead_contacted} contacted, ${progress.lead_replied} replied.`)
  } else {
    parts.push(`No leads have been researched yet.`)
  }

  if (risks.length > 0) {
    parts.push(`Key risk: ${risks[0]}.`)
  }

  parts.push(`Recommended next step: ${nextStep}`)

  return parts.join(' ')
}

// ── Row mapper ────────────────────────────────────────────────────────────────

function safeJSON<T>(v: unknown, fallback: T): T {
  if (v === null || v === undefined) return fallback
  if (typeof v === 'string') {
    try { return JSON.parse(v) as T } catch { return fallback }
  }
  return v as T
}

function rowToReport(r: Record<string, unknown>): ExecutiveReport {
  return {
    id:                 String(r.id),
    project_id:         String(r.project_id),
    title:              String(r.title),
    summary:            r.summary ? String(r.summary) : null,
    strategy_snapshot:  safeJSON<StrategySnapshot>(r.strategy_snapshot, { goal: null, objective: null, target_audience: null, channel: null, value_prop: null, operator: null, pm: null }),
    progress_snapshot:  safeJSON<ProgressSnapshot>(r.progress_snapshot, { launch_status: null, launch_done: 0, launch_total: 0, launch_next_item: null, lead_total: 0, lead_approved: 0, lead_contacted: 0, lead_replied: 0, pending_approvals: 0 }),
    decisions_snapshot: safeJSON<DecisionSnapshotItem[]>(r.decisions_snapshot, []),
    risks:              safeJSON<string[]>(r.risks, []),
    next_steps:         safeJSON<string[]>(r.next_steps, []),
    generated_by_role:  String(r.generated_by_role ?? 'ceo'),
    created_at:         String(r.created_at),
  }
}
