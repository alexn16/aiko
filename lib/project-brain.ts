/**
 * lib/project-brain.ts
 *
 * Project Brain / Project Memory — rich owner-editable context document.
 *
 * Every project can have one brain document. When a project_id is present,
 * the brain is injected into AI Skill prompts, CEO responses, reports, and
 * strategy planning so outputs are specific to this project, not generic.
 *
 * Safety:
 * - Brain content is owner-provided. We do not auto-populate from web data.
 * - Assumptions are marked when auto-generated from existing project context.
 * - forbidden_claims are included in every prompt to prevent AI overreach.
 */

import { db } from '@/lib/db/client'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ProjectBrain {
  id: string
  project_id: string
  one_liner: string | null
  positioning: string | null
  target_audience: string | null
  problem: string | null
  solution: string | null
  key_features: string[]
  differentiators: string[]
  tone_of_voice: string | null
  proof_points: string[]
  forbidden_claims: string[]
  current_goal: string | null
  preferred_channels: string[]
  owner_notes: string | null
  source_summary: string | null
  completeness_score: number
  created_at: string
  updated_at: string
}

export type ProjectBrainInput = Partial<Omit<ProjectBrain, 'id' | 'project_id' | 'completeness_score' | 'created_at' | 'updated_at'>>

// ── Table ensure ───────────────────────────────────────────────────────────────

async function ensureBrainTable(): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS project_brain_documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL UNIQUE,
      one_liner TEXT,
      positioning TEXT,
      target_audience TEXT,
      problem TEXT,
      solution TEXT,
      key_features JSONB NOT NULL DEFAULT '[]'::jsonb,
      differentiators JSONB NOT NULL DEFAULT '[]'::jsonb,
      tone_of_voice TEXT,
      proof_points JSONB NOT NULL DEFAULT '[]'::jsonb,
      forbidden_claims JSONB NOT NULL DEFAULT '[]'::jsonb,
      current_goal TEXT,
      preferred_channels JSONB NOT NULL DEFAULT '[]'::jsonb,
      owner_notes TEXT,
      source_summary TEXT,
      completeness_score INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): ProjectBrain {
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    one_liner: row.one_liner ? String(row.one_liner) : null,
    positioning: row.positioning ? String(row.positioning) : null,
    target_audience: row.target_audience ? String(row.target_audience) : null,
    problem: row.problem ? String(row.problem) : null,
    solution: row.solution ? String(row.solution) : null,
    key_features: Array.isArray(row.key_features) ? row.key_features.map(String) : [],
    differentiators: Array.isArray(row.differentiators) ? row.differentiators.map(String) : [],
    tone_of_voice: row.tone_of_voice ? String(row.tone_of_voice) : null,
    proof_points: Array.isArray(row.proof_points) ? row.proof_points.map(String) : [],
    forbidden_claims: Array.isArray(row.forbidden_claims) ? row.forbidden_claims.map(String) : [],
    current_goal: row.current_goal ? String(row.current_goal) : null,
    preferred_channels: Array.isArray(row.preferred_channels) ? row.preferred_channels.map(String) : [],
    owner_notes: row.owner_notes ? String(row.owner_notes) : null,
    source_summary: row.source_summary ? String(row.source_summary) : null,
    completeness_score: Number(row.completeness_score ?? 0),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

function computeCompleteness(input: ProjectBrainInput): number {
  const fields: (keyof ProjectBrainInput)[] = [
    'one_liner', 'positioning', 'target_audience', 'problem', 'solution',
    'key_features', 'differentiators', 'tone_of_voice', 'forbidden_claims',
    'current_goal', 'preferred_channels',
  ]
  const filled = fields.filter(f => {
    const v = input[f]
    if (Array.isArray(v)) return v.length > 0
    return !!v
  })
  return Math.round((filled.length / fields.length) * 100)
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function getProjectBrain(projectId: string): Promise<ProjectBrain | null> {
  await ensureBrainTable()
  const res = await db.query(
    `SELECT * FROM project_brain_documents WHERE project_id=$1`,
    [projectId]
  )
  return res.rows[0] ? mapRow(res.rows[0]) : null
}

export async function createOrUpdateProjectBrain(projectId: string, input: ProjectBrainInput): Promise<ProjectBrain> {
  await ensureBrainTable()
  const completeness = computeCompleteness(input)

  // Fetch existing to merge arrays (keep existing if new value is empty array)
  const existing = await getProjectBrain(projectId)

  const mergeArr = (newVal: string[] | undefined, old: string[]): string[] =>
    (newVal && newVal.length > 0) ? newVal : old

  const merged: ProjectBrainInput = {
    one_liner: input.one_liner ?? existing?.one_liner ?? null,
    positioning: input.positioning ?? existing?.positioning ?? null,
    target_audience: input.target_audience ?? existing?.target_audience ?? null,
    problem: input.problem ?? existing?.problem ?? null,
    solution: input.solution ?? existing?.solution ?? null,
    key_features: mergeArr(input.key_features, existing?.key_features ?? []),
    differentiators: mergeArr(input.differentiators, existing?.differentiators ?? []),
    tone_of_voice: input.tone_of_voice ?? existing?.tone_of_voice ?? null,
    proof_points: mergeArr(input.proof_points, existing?.proof_points ?? []),
    forbidden_claims: mergeArr(input.forbidden_claims, existing?.forbidden_claims ?? []),
    current_goal: input.current_goal ?? existing?.current_goal ?? null,
    preferred_channels: mergeArr(input.preferred_channels, existing?.preferred_channels ?? []),
    owner_notes: input.owner_notes ?? existing?.owner_notes ?? null,
    source_summary: input.source_summary ?? existing?.source_summary ?? null,
  }
  const finalScore = computeCompleteness(merged)

  const res = await db.query(
    `INSERT INTO project_brain_documents
       (project_id, one_liner, positioning, target_audience, problem, solution,
        key_features, differentiators, tone_of_voice, proof_points, forbidden_claims,
        current_goal, preferred_channels, owner_notes, source_summary, completeness_score)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10::jsonb,$11::jsonb,$12,$13::jsonb,$14,$15,$16)
     ON CONFLICT (project_id) DO UPDATE SET
       one_liner=$2, positioning=$3, target_audience=$4, problem=$5, solution=$6,
       key_features=$7::jsonb, differentiators=$8::jsonb, tone_of_voice=$9,
       proof_points=$10::jsonb, forbidden_claims=$11::jsonb, current_goal=$12,
       preferred_channels=$13::jsonb, owner_notes=$14, source_summary=$15,
       completeness_score=$16, updated_at=NOW()
     RETURNING *`,
    [
      projectId,
      merged.one_liner, merged.positioning, merged.target_audience,
      merged.problem, merged.solution,
      JSON.stringify(merged.key_features),
      JSON.stringify(merged.differentiators),
      merged.tone_of_voice,
      JSON.stringify(merged.proof_points),
      JSON.stringify(merged.forbidden_claims),
      merged.current_goal,
      JSON.stringify(merged.preferred_channels),
      merged.owner_notes, merged.source_summary,
      finalScore,
    ]
  )
  if (!res.rows[0]) throw new Error('Project brain insert did not return a row')
  return mapRow(res.rows[0])
}

/**
 * Auto-generate a project brain from existing project context.
 * Marks generated content clearly so the owner knows to review it.
 */
export async function generateProjectBrainFromExistingContext(projectId: string): Promise<ProjectBrain> {
  await ensureBrainTable()
  const project = await db.query(
    `SELECT id, name, goal, description, target_market, value_prop FROM projects WHERE id=$1`,
    [projectId]
  )
  const p = project.rows[0]
  if (!p) throw new Error('Project not found')

  const brief = await db.query(
    `SELECT objective, target_audience, value_proposition, recommended_channel
     FROM project_strategy_briefs WHERE project_id=$1 ORDER BY created_at DESC LIMIT 1`,
    [projectId]
  ).catch(() => ({ rows: [] }))
  const b = brief.rows[0] ?? {}

  const decisions = await db.query(
    `SELECT title, summary FROM project_decisions WHERE project_id=$1 ORDER BY created_at DESC LIMIT 5`,
    [projectId]
  ).catch(() => ({ rows: [] }))

  const channels: string[] = []
  if (b.recommended_channel) channels.push(String(b.recommended_channel))

  const proofPoints: string[] = decisions.rows
    .filter((d: Record<string, unknown>) => d.summary)
    .map((d: Record<string, unknown>) => String(d.summary).slice(0, 120))
    .slice(0, 3)

  return createOrUpdateProjectBrain(projectId, {
    one_liner: p.goal ? `${p.name}: ${String(p.goal).slice(0, 120)}` : null,
    positioning: b.objective ? String(b.objective) : (p.description ? String(p.description) : null),
    target_audience: b.target_audience ? String(b.target_audience) : (p.target_market ? String(p.target_market) : null),
    problem: null,
    solution: b.value_proposition ? String(b.value_proposition) : (p.value_prop ? String(p.value_prop) : null),
    key_features: [],
    differentiators: [],
    tone_of_voice: null,
    proof_points: proofPoints,
    forbidden_claims: [],
    current_goal: p.goal ? String(p.goal) : null,
    preferred_channels: channels,
    owner_notes: null,
    source_summary: 'Auto-generated from existing project context. Review and edit to improve AI output quality.',
  })
}

/**
 * Format project brain as a concise prompt block (max ~600 tokens).
 */
export async function formatProjectBrainForPrompt(projectId: string): Promise<string> {
  const brain = await getProjectBrain(projectId)
  if (!brain) return ''

  const lines: string[] = ['=== Project Brain ===']
  if (brain.one_liner) lines.push(`What it is: ${brain.one_liner}`)
  if (brain.positioning) lines.push(`Positioning: ${brain.positioning}`)
  if (brain.target_audience) lines.push(`Who it serves: ${brain.target_audience}`)
  if (brain.problem) lines.push(`Problem: ${brain.problem}`)
  if (brain.solution) lines.push(`Solution: ${brain.solution}`)
  if (brain.key_features?.length) lines.push(`Key features: ${brain.key_features.join(', ')}`)
  if (brain.differentiators?.length) lines.push(`Differentiators: ${brain.differentiators.join(', ')}`)
  if (brain.tone_of_voice) lines.push(`Tone: ${brain.tone_of_voice}`)
  if (brain.current_goal) lines.push(`Current goal: ${brain.current_goal}`)
  if (brain.preferred_channels?.length) lines.push(`Preferred channels: ${brain.preferred_channels.join(', ')}`)
  if (brain.forbidden_claims?.length) lines.push(`Do NOT claim: ${brain.forbidden_claims.join('; ')}`)
  if (brain.proof_points?.length) lines.push(`Proof points: ${brain.proof_points.join(' | ')}`)
  if (brain.owner_notes) lines.push(`Owner notes: ${brain.owner_notes}`)
  lines.push('=== End Project Brain ===')

  return lines.join('\n')
}

export async function getProjectBrainCompleteness(projectId: string): Promise<{ score: number; missing: string[] }> {
  const brain = await getProjectBrain(projectId)
  if (!brain) return { score: 0, missing: ['one_liner','positioning','target_audience','problem','solution','differentiators','tone_of_voice','current_goal','preferred_channels','forbidden_claims'] }

  const checks: Array<{ field: keyof ProjectBrain; label: string }> = [
    { field: 'one_liner', label: 'one_liner' },
    { field: 'positioning', label: 'positioning' },
    { field: 'target_audience', label: 'target_audience' },
    { field: 'problem', label: 'problem' },
    { field: 'solution', label: 'solution' },
    { field: 'differentiators', label: 'differentiators' },
    { field: 'tone_of_voice', label: 'tone_of_voice' },
    { field: 'current_goal', label: 'current_goal' },
    { field: 'preferred_channels', label: 'preferred_channels' },
    { field: 'forbidden_claims', label: 'forbidden_claims' },
  ]
  const missing = checks
    .filter(c => {
      const v = brain[c.field]
      if (Array.isArray(v)) return v.length === 0
      return !v
    })
    .map(c => c.label)

  return { score: brain.completeness_score, missing }
}

export async function updateProjectBrainSection(
  projectId: string,
  section: keyof ProjectBrainInput,
  value: string | string[]
): Promise<ProjectBrain> {
  return createOrUpdateProjectBrain(projectId, { [section]: value })
}
