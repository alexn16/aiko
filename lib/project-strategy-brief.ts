/**
 * project-strategy-brief.ts
 *
 * Manages first-campaign strategy briefs for projects.
 * Briefs are guidance only — they do not trigger automation, external
 * actions, or any Web Operator activity.
 *
 * Generated automatically when the CEO creates a new project via AI
 * (callAI role:'ceo'). Falls back to a safe template-based brief if
 * AI generation fails.
 *
 * Idempotent: only one brief per project_id. Additional calls return
 * the existing brief rather than creating duplicates.
 */

import { db } from '@/lib/db/client'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ProjectStrategyBrief {
  id:                  string
  project_id:          string
  title:               string
  objective:           string
  target_audience:     string
  research_prompt:     string
  recommended_channel: string
  value_proposition:   string
  risks:               string[]
  assumptions:         string[]
  next_actions:        string[]
  created_by_role:     string
  created_at:          string
  updated_at:          string
}

export interface CreateBriefOptions {
  project_id:          string
  title?:              string
  objective?:          string
  target_audience?:    string
  research_prompt?:    string
  recommended_channel?: string
  value_proposition?:  string
  risks?:              string[]
  assumptions?:        string[]
  next_actions?:       string[]
  created_by_role?:    string
}

export interface UpdateBriefFields {
  title?:              string
  objective?:          string
  target_audience?:    string
  research_prompt?:    string
  recommended_channel?: string
  value_proposition?:  string
  risks?:              string[]
  assumptions?:        string[]
  next_actions?:       string[]
}

// ── Row mapper ─────────────────────────────────────────────────────────────────

function rowToBrief(row: Record<string, unknown>): ProjectStrategyBrief {
  return {
    id:                  String(row.id),
    project_id:          String(row.project_id),
    title:               String(row.title ?? ''),
    objective:           String(row.objective ?? ''),
    target_audience:     String(row.target_audience ?? ''),
    research_prompt:     String(row.research_prompt ?? ''),
    recommended_channel: String(row.recommended_channel ?? 'email'),
    value_proposition:   String(row.value_proposition ?? ''),
    risks:               Array.isArray(row.risks)       ? row.risks as string[]       : [],
    assumptions:         Array.isArray(row.assumptions) ? row.assumptions as string[] : [],
    next_actions:        Array.isArray(row.next_actions)? row.next_actions as string[] : [],
    created_by_role:     String(row.created_by_role ?? 'CEO'),
    created_at:          String(row.created_at),
    updated_at:          String(row.updated_at),
  }
}

// ── Create (idempotent) ────────────────────────────────────────────────────────

/**
 * Create a strategy brief for the given project.
 * If one already exists, return it without modification.
 */
export async function createProjectStrategyBrief(
  opts: CreateBriefOptions
): Promise<ProjectStrategyBrief> {
  // Idempotency: return existing brief if present
  const existing = await getProjectStrategyBrief(opts.project_id)
  if (existing) return existing

  const res = await db.query(
    `INSERT INTO project_strategy_briefs
       (project_id, title, objective, target_audience, research_prompt,
        recommended_channel, value_proposition, risks, assumptions, next_actions,
        created_by_role)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      opts.project_id,
      opts.title               ?? '',
      opts.objective           ?? '',
      opts.target_audience     ?? '',
      opts.research_prompt     ?? '',
      opts.recommended_channel ?? 'email',
      opts.value_proposition   ?? '',
      JSON.stringify(opts.risks        ?? []),
      JSON.stringify(opts.assumptions  ?? []),
      JSON.stringify(opts.next_actions ?? ['Open First Campaign Flow']),
      opts.created_by_role     ?? 'CEO',
    ]
  )

  return rowToBrief(res.rows[0])
}

// ── Get ────────────────────────────────────────────────────────────────────────

export async function getProjectStrategyBrief(
  project_id: string
): Promise<ProjectStrategyBrief | null> {
  const res = await db.query(
    `SELECT * FROM project_strategy_briefs WHERE project_id=$1 LIMIT 1`,
    [project_id]
  )
  if (!res.rows[0]) return null
  return rowToBrief(res.rows[0])
}

// ── Update (partial) ───────────────────────────────────────────────────────────

export async function updateProjectStrategyBrief(
  brief_id: string,
  fields:   UpdateBriefFields
): Promise<ProjectStrategyBrief | null> {
  const sets: string[] = ['updated_at=NOW()']
  const params: unknown[] = []
  let idx = 1

  function add(col: string, val: unknown) {
    sets.push(`${col}=$${idx++}`)
    params.push(val)
  }

  if (fields.title               !== undefined) add('title',               fields.title)
  if (fields.objective           !== undefined) add('objective',           fields.objective)
  if (fields.target_audience     !== undefined) add('target_audience',     fields.target_audience)
  if (fields.research_prompt     !== undefined) add('research_prompt',     fields.research_prompt)
  if (fields.recommended_channel !== undefined) add('recommended_channel', fields.recommended_channel)
  if (fields.value_proposition   !== undefined) add('value_proposition',   fields.value_proposition)
  if (fields.risks               !== undefined) add('risks',               JSON.stringify(fields.risks))
  if (fields.assumptions         !== undefined) add('assumptions',         JSON.stringify(fields.assumptions))
  if (fields.next_actions        !== undefined) add('next_actions',        JSON.stringify(fields.next_actions))

  if (sets.length === 1) return null // nothing to update

  params.push(brief_id)
  const res = await db.query(
    `UPDATE project_strategy_briefs SET ${sets.join(',')} WHERE id=$${idx} RETURNING *`,
    params
  )
  if (!res.rows[0]) return null
  return rowToBrief(res.rows[0])
}

// ── AI generation ──────────────────────────────────────────────────────────────

/**
 * Generate a strategy brief using the CEO AI role.
 * If AI generation fails for any reason, returns a safe fallback brief.
 * This function never throws — it always returns a valid brief.
 */
export async function generateStrategyBriefFromProject(opts: {
  project_id:    string
  project_name:  string
  goal?:         string | null
  description?:  string | null
  target_market?: string | null
}): Promise<ProjectStrategyBrief> {
  // Idempotency check first
  const existing = await getProjectStrategyBrief(opts.project_id)
  if (existing) return existing

  let brief: CreateBriefOptions | null = null

  try {
    const { callAI } = await import('@/lib/ai/router')

    const prompt = `You are AÏKO's CEO AI. A new marketing project has been created.
Generate a concise first-campaign strategy brief. Respond ONLY with valid JSON, no markdown.

Project name: ${opts.project_name}
Goal: ${opts.goal ?? 'Not specified'}
Description: ${opts.description ?? 'Not specified'}
Target market: ${opts.target_market ?? 'Not specified'}

Respond with this exact JSON structure (all fields required, use empty string if unknown):
{
  "title": "Brief title (e.g. '${opts.project_name} — First Campaign Brief')",
  "objective": "One sentence campaign objective",
  "target_audience": "Who to target first (job title, company size, industry)",
  "research_prompt": "A concrete web research prompt the operator should use to find leads",
  "recommended_channel": "email",
  "value_proposition": "Core value prop in one sentence",
  "risks": ["Risk 1", "Risk 2"],
  "assumptions": ["Assumption 1", "Assumption 2"],
  "next_actions": ["Open First Campaign Flow", "Research leads via Web Operator", "Review and approve leads"]
}`

    const raw = await callAI({
      role: 'ceo',
      messages: [
        { role: 'user', content: prompt },
      ],
      jsonMode: true,
      maxTokens: 600,
    })

    const parsed = JSON.parse(raw)

    brief = {
      project_id:          opts.project_id,
      title:               String(parsed.title               ?? ''),
      objective:           String(parsed.objective           ?? ''),
      target_audience:     String(parsed.target_audience     ?? ''),
      research_prompt:     String(parsed.research_prompt     ?? ''),
      recommended_channel: String(parsed.recommended_channel ?? 'email'),
      value_proposition:   String(parsed.value_proposition   ?? ''),
      risks:               Array.isArray(parsed.risks)        ? parsed.risks.map(String)       : [],
      assumptions:         Array.isArray(parsed.assumptions)  ? parsed.assumptions.map(String) : [],
      next_actions:        Array.isArray(parsed.next_actions) ? parsed.next_actions.map(String): ['Open First Campaign Flow'],
      created_by_role:     'CEO',
    }
  } catch {
    // AI failed — fall through to safe fallback
  }

  // Safe fallback if AI generation failed or returned invalid data
  if (!brief || !brief.objective) {
    brief = buildFallbackBrief(opts)
  }

  return createProjectStrategyBrief(brief)
}

// ── Fallback brief ─────────────────────────────────────────────────────────────

function buildFallbackBrief(opts: {
  project_id:   string
  project_name: string
  goal?:        string | null
}): CreateBriefOptions {
  return {
    project_id:          opts.project_id,
    title:               `${opts.project_name} — First Campaign Brief`,
    objective:           opts.goal
                           ? `Drive initial outreach for: ${opts.goal}`
                           : `Launch first outbound campaign for ${opts.project_name}`,
    target_audience:     'To be defined — use First Campaign Flow to refine',
    research_prompt:     `Find potential leads and companies for ${opts.project_name}`,
    recommended_channel: 'email',
    value_proposition:   'To be defined — describe your core offer in one sentence',
    risks:               [
      'Target audience not yet validated',
      'Messaging may need iteration',
    ],
    assumptions:         [
      'Email is an appropriate first channel',
      'Leads can be found via web research',
    ],
    next_actions:        [
      'Open First Campaign Flow',
      'Define target audience in step 1',
      'Research leads via Web Operator',
    ],
    created_by_role: 'CEO',
  }
}
