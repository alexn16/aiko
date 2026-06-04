import { db } from '@/lib/db/client'
import { callAI } from '@/lib/ai/router'
import {
  checkCapabilitiesForStrategy,
  type SystemCapability,
  type CapabilityCheckResult,
} from '@/lib/system-capabilities'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ProposedChange {
  capability_key: string
  capability_name: string
  change_type: 'add' | 'extend' | 'fix'
  description: string
  estimated_complexity: 'simple' | 'moderate' | 'complex'
}

export interface SystemImprovementProposal {
  id: string
  title: string
  summary: string
  reason: string
  requested_by_role: string
  related_project_id: string | null
  related_strategy: string | null
  missing_capabilities: string[]
  proposed_changes: ProposedChange[]
  risk_level: 'low' | 'medium' | 'high'
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'implemented' | 'archived'
  implementation_prompt: string
  proposal_metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  approved_at: string | null
  // joined
  project_name?: string
}

export interface CreateProposalParams {
  title: string
  summary?: string
  reason?: string
  requested_by_role?: string
  related_project_id?: string | null
  related_strategy?: string | null
  missing_capabilities?: string[]
  proposed_changes?: ProposedChange[]
  risk_level?: 'low' | 'medium' | 'high'
  status?: SystemImprovementProposal['status']
  implementation_prompt?: string
  proposal_metadata?: Record<string, unknown>
}

export interface ListProposalFilters {
  status?: string
  risk_level?: string
  limit?: number
}

export interface GenerateImplementationPromptResult {
  implementation_prompt: string
  proposed_changes: ProposedChange[]
  risk_level: 'low' | 'medium' | 'high'
  summary: string
}

// ── CRUD ───────────────────────────────────────────────────────────────────────

export async function createSystemImprovementProposal(
  params: CreateProposalParams
): Promise<SystemImprovementProposal> {
  const result = await db.query(
    `INSERT INTO system_improvement_proposals
       (title, summary, reason, requested_by_role, related_project_id, related_strategy,
        missing_capabilities, proposed_changes, risk_level, status, implementation_prompt,
        proposal_metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      params.title,
      params.summary ?? '',
      params.reason ?? '',
      params.requested_by_role ?? 'CEO',
      params.related_project_id ?? null,
      params.related_strategy ?? null,
      JSON.stringify(params.missing_capabilities ?? []),
      JSON.stringify(params.proposed_changes ?? []),
      params.risk_level ?? 'medium',
      params.status ?? 'draft',
      params.implementation_prompt ?? '',
      JSON.stringify(params.proposal_metadata ?? {}),
    ]
  )
  return rowToProposal(result.rows[0])
}

export async function listSystemImprovementProposals(
  filters?: ListProposalFilters
): Promise<SystemImprovementProposal[]> {
  const conditions: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (filters?.status) {
    conditions.push(`sip.status = $${idx++}`)
    values.push(filters.status)
  }
  if (filters?.risk_level) {
    conditions.push(`sip.risk_level = $${idx++}`)
    values.push(filters.risk_level)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = filters?.limit ?? 50

  const result = await db.query(
    `SELECT sip.*, p.name AS project_name
     FROM system_improvement_proposals sip
     LEFT JOIN projects p ON p.id = sip.related_project_id
     ${where}
     ORDER BY sip.created_at DESC
     LIMIT $${idx}`,
    [...values, limit]
  )
  return dedupeActiveSystemImprovementProposals(result.rows.map(rowToProposal))
}

export async function findReusableSystemImprovementProposal(params: {
  related_project_id?: string | null
  missing_capability: string
  title?: string
}): Promise<SystemImprovementProposal | null> {
  const conditions = [
    `sip.status NOT IN ('rejected', 'implemented', 'archived')`,
    `sip.missing_capabilities @> $1::jsonb`,
  ]
  const values: unknown[] = [JSON.stringify([params.missing_capability])]
  let idx = 2

  if (params.related_project_id) {
    conditions.push(`sip.related_project_id = $${idx++}`)
    values.push(params.related_project_id)
  }
  if (params.title) {
    conditions.push(`lower(sip.title) = lower($${idx++})`)
    values.push(params.title)
  }

  const result = await db.query(
    `SELECT sip.*, p.name AS project_name
     FROM system_improvement_proposals sip
     LEFT JOIN projects p ON p.id = sip.related_project_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY sip.created_at DESC
     LIMIT 1`,
    values
  )
  return result.rows[0] ? rowToProposal(result.rows[0]) : null
}

export function dedupeActiveSystemImprovementProposals(
  proposals: SystemImprovementProposal[]
): SystemImprovementProposal[] {
  const seen = new Set<string>()
  const deduped: SystemImprovementProposal[] = []

  for (const proposal of proposals) {
    const active = !['rejected', 'implemented', 'archived'].includes(proposal.status)
    if (!active) {
      deduped.push(proposal)
      continue
    }

    const primaryMissingCapability = proposal.missing_capabilities[0] ?? ''
    const key = [
      proposal.related_project_id ?? 'global',
      proposal.title.trim().toLowerCase(),
      primaryMissingCapability,
    ].join('::')

    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(proposal)
  }

  return deduped
}

export async function approveSystemImprovementProposal(id: string): Promise<void> {
  await db.query(
    `UPDATE system_improvement_proposals
     SET status='approved', approved_at=NOW(), updated_at=NOW()
     WHERE id=$1`,
    [id]
  )
}

export async function rejectSystemImprovementProposal(id: string, reason?: string): Promise<void> {
  await db.query(
    `UPDATE system_improvement_proposals
     SET status='rejected', updated_at=NOW()
     ${reason ? ", reason=reason || ' [rejected: ' || $2 || ']'" : ''}
     WHERE id=$1`,
    reason ? [id, reason] : [id]
  )
}

// ── AI generation ──────────────────────────────────────────────────────────────

export async function generateImplementationPrompt(
  missing_capabilities: SystemCapability[]
): Promise<GenerateImplementationPromptResult> {
  const fallback: GenerateImplementationPromptResult = {
    implementation_prompt: `The following capabilities need to be built for AÏKO:\n\n${missing_capabilities.map(c => `- ${c.key}: ${c.name} — ${c.description}`).join('\n')}\n\nEach capability requires database schema, backend logic, API routes, and UI integration following existing AÏKO patterns. Review the current codebase architecture before implementation.`,
    proposed_changes: missing_capabilities.map(c => ({
      capability_key: c.key,
      capability_name: c.name,
      change_type: 'add' as const,
      description: `Implement ${c.name}: ${c.description}`,
      estimated_complexity: 'moderate' as const,
    })),
    risk_level: 'medium',
    summary: `Add ${missing_capabilities.length} missing capability${missing_capabilities.length !== 1 ? 'ies' : 'y'}: ${missing_capabilities.map(c => c.name).join(', ')}`,
  }

  try {
    const raw = await callAI({
      role: 'ceo',
      messages: [
        {
          role: 'system',
          content: 'You are a software architect for AÏKO, an AI marketing platform. Generate a clear, specific implementation prompt for adding missing capabilities.',
        },
        {
          role: 'user',
          content: `Missing capabilities:\n${missing_capabilities.map(c => `- ${c.key}: ${c.name} — ${c.description}`).join('\n')}\n\nWrite a detailed implementation prompt that explains:\n1. What needs to be built (database, backend, API, UI)\n2. How it integrates with existing AÏKO systems\n3. Safety requirements\n4. Suggested commit message\n\nReturn ONLY valid JSON:\n{\n  "implementation_prompt": "Full implementation prompt text (2-5 paragraphs, specific and technical)",\n  "proposed_changes": [\n    { "capability_key": "...", "capability_name": "...", "change_type": "add|extend|fix", "description": "...", "estimated_complexity": "simple|moderate|complex" }\n  ],\n  "risk_level": "low|medium|high",\n  "summary": "One sentence summary of what will be built"\n}`,
        },
      ],
      maxTokens: 1200,
      jsonMode: true,
    })

    const parsed = JSON.parse(raw) as GenerateImplementationPromptResult
    return {
      implementation_prompt: String(parsed.implementation_prompt ?? fallback.implementation_prompt),
      proposed_changes: Array.isArray(parsed.proposed_changes) ? parsed.proposed_changes : fallback.proposed_changes,
      risk_level: (['low', 'medium', 'high'].includes(parsed.risk_level) ? parsed.risk_level : 'medium') as 'low' | 'medium' | 'high',
      summary: String(parsed.summary ?? fallback.summary),
    }
  } catch {
    return fallback
  }
}

// ── Full pipeline ──────────────────────────────────────────────────────────────

export async function generateCapabilityGapReport(
  strategy_text: string,
  project_id?: string
): Promise<{ check_result: CapabilityCheckResult; proposal: SystemImprovementProposal | null }> {
  const check_result = await checkCapabilitiesForStrategy(strategy_text)

  if (check_result.missing.length === 0) {
    return { check_result, proposal: null }
  }

  const generated = await generateImplementationPrompt(check_result.missing)

  const proposal = await createSystemImprovementProposal({
    title: generated.summary,
    summary: generated.summary,
    reason: `Strategy requires capabilities that are not yet available: ${check_result.missing.map(c => c.name).join(', ')}`,
    requested_by_role: 'CEO',
    related_project_id: project_id ?? null,
    related_strategy: strategy_text.slice(0, 500),
    missing_capabilities: check_result.missing.map(c => c.key),
    proposed_changes: generated.proposed_changes,
    risk_level: generated.risk_level,
    status: 'draft',
    implementation_prompt: generated.implementation_prompt,
  })

  return { check_result, proposal }
}

// ── Internal helpers ───────────────────────────────────────────────────────────

function rowToProposal(row: Record<string, unknown>): SystemImprovementProposal {
  return {
    id: String(row.id),
    title: String(row.title),
    summary: String(row.summary ?? ''),
    reason: String(row.reason ?? ''),
    requested_by_role: String(row.requested_by_role ?? 'CEO'),
    related_project_id: row.related_project_id ? String(row.related_project_id) : null,
    related_strategy: row.related_strategy ? String(row.related_strategy) : null,
    missing_capabilities: Array.isArray(row.missing_capabilities) ? row.missing_capabilities : [],
    proposed_changes: Array.isArray(row.proposed_changes) ? row.proposed_changes as ProposedChange[] : [],
    risk_level: row.risk_level as SystemImprovementProposal['risk_level'],
    status: row.status as SystemImprovementProposal['status'],
    implementation_prompt: String(row.implementation_prompt ?? ''),
    proposal_metadata: normalizeObject(row.proposal_metadata),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    approved_at: row.approved_at ? String(row.approved_at) : null,
    project_name: row.project_name ? String(row.project_name) : undefined,
  }
}

function normalizeObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {}
    } catch {
      return {}
    }
  }
  return {}
}
