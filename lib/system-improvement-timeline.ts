import { db } from '@/lib/db/client'

export type ImprovementTimelineEventType =
  | 'proposal_created'
  | 'approved_for_implementation'
  | 'implementation_started'
  | 'implemented_pending_validation'
  | 'validated_available'
  | 'rejected'
  | 'archived'

export interface ImprovementTimelineSummary {
  proposed: number
  approved: number
  in_progress: number
  pending_validation: number
  validated: number
  rejected: number
}

export interface ImprovementTimelineItem {
  id: string
  proposal_id: string
  title: string
  status: string
  project_id: string | null
  project_name: string | null
  platform: string | null
  capability: string | null
  event_type: ImprovementTimelineEventType
  event_label: string
  created_at: string
  actor: string
  implementation_commit: string | null
  implementation_pr_url: string | null
  validation_summary: string | null
}

export interface ImprovementHealth {
  blocked_by_validation: number
  waiting_for_implementation: number
  duplicate_collapsed: number
  capabilities_validated_this_week: number
}

export interface ImprovementTimelineResult {
  summary: ImprovementTimelineSummary
  timeline: ImprovementTimelineItem[]
  health: ImprovementHealth
}

export async function getSystemImprovementTimeline(): Promise<ImprovementTimelineResult> {
  const result = await db.query(
    `SELECT sip.*, p.name AS project_name
     FROM system_improvement_proposals sip
     LEFT JOIN projects p ON p.id = sip.related_project_id
     ORDER BY sip.created_at DESC`
  )

  const proposals = result.rows.map(rowToProposalSnapshot)
  const summary = summarizeProposals(proposals)
  const health = await buildHealth(proposals)
  const timeline = (await Promise.all(proposals.flatMap(eventsForProposal)))
    .flat()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return { summary, timeline, health }
}

interface ProposalSnapshot {
  id: string
  title: string
  status: string
  related_project_id: string | null
  project_name: string | null
  requested_by_role: string
  missing_capabilities: string[]
  proposed_changes: Array<{ capability_key?: string; capability_name?: string }>
  proposal_metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

function rowToProposalSnapshot(row: Record<string, unknown>): ProposalSnapshot {
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    status: String(row.status ?? 'proposed'),
    related_project_id: row.related_project_id ? String(row.related_project_id) : null,
    project_name: row.project_name ? String(row.project_name) : null,
    requested_by_role: String(row.requested_by_role ?? 'CEO'),
    missing_capabilities: normalizeArray(row.missing_capabilities),
    proposed_changes: normalizeArray<Record<string, unknown>>(row.proposed_changes).map(c => ({
      capability_key: c.capability_key ? String(c.capability_key) : undefined,
      capability_name: c.capability_name ? String(c.capability_name) : undefined,
    })),
    proposal_metadata: normalizeObject(row.proposal_metadata),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

function summarizeProposals(proposals: ProposalSnapshot[]): ImprovementTimelineSummary {
  const summary: ImprovementTimelineSummary = {
    proposed: 0,
    approved: 0,
    in_progress: 0,
    pending_validation: 0,
    validated: 0,
    rejected: 0,
  }
  for (const proposal of proposals) {
    if (['proposed', 'draft', 'pending_approval'].includes(proposal.status)) summary.proposed++
    else if (['approved_for_implementation', 'approved'].includes(proposal.status)) summary.approved++
    else if (proposal.status === 'implementation_in_progress') summary.in_progress++
    else if (['implemented_pending_validation', 'implemented'].includes(proposal.status)) summary.pending_validation++
    else if (proposal.status === 'validated_available') summary.validated++
    else if (proposal.status === 'rejected') summary.rejected++
  }
  return summary
}

async function buildHealth(proposals: ProposalSnapshot[]): Promise<ImprovementHealth> {
  const blockedFlags = await Promise.all(proposals.map(async proposal => (
    ['implemented_pending_validation', 'implemented'].includes(proposal.status)
      ? await isBlockedByValidationGuard(proposal)
      : false
  )))
  const duplicateKeys = new Set<string>()
  let duplicateCollapsed = 0
  for (const proposal of proposals) {
    if (['rejected', 'implemented', 'archived', 'validated_available'].includes(proposal.status)) continue
    const key = [
      proposal.related_project_id ?? 'global',
      proposal.title.trim().toLowerCase(),
      proposal.missing_capabilities[0] ?? '',
    ].join('::')
    if (duplicateKeys.has(key)) duplicateCollapsed++
    else duplicateKeys.add(key)
  }

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  return {
    blocked_by_validation: blockedFlags.filter(Boolean).length,
    waiting_for_implementation: proposals.filter(p => ['approved_for_implementation', 'approved'].includes(p.status)).length,
    duplicate_collapsed: duplicateCollapsed,
    capabilities_validated_this_week: proposals.filter(p => {
      const lifecycle = normalizeObject(p.proposal_metadata.lifecycle)
      const validatedAt = typeof lifecycle.validated_at === 'string' ? lifecycle.validated_at : null
      return p.status === 'validated_available' && validatedAt && new Date(validatedAt).getTime() >= weekAgo
    }).length,
  }
}

function eventsForProposal(proposal: ProposalSnapshot): ImprovementTimelineItem[] {
  const lifecycle = normalizeObject(proposal.proposal_metadata.lifecycle)
  const items: ImprovementTimelineItem[] = [
    makeItem(proposal, 'proposal_created', 'Proposal created', proposal.created_at, proposal.requested_by_role),
  ]

  const addLifecycleEvent = (
    key: string,
    type: ImprovementTimelineEventType,
    label: string,
    actor = 'User'
  ) => {
    const value = lifecycle[key]
    if (typeof value === 'string' && value) {
      items.push(makeItem(proposal, type, label, value, actor))
    }
  }

  addLifecycleEvent('approved_at', 'approved_for_implementation', 'Approved for implementation')
  addLifecycleEvent('implementation_started_at', 'implementation_started', 'Implementation started')
  addLifecycleEvent('implemented_at', 'implemented_pending_validation', 'Implemented, pending validation')
  addLifecycleEvent('validated_at', 'validated_available', 'Validated and available')
  addLifecycleEvent('rejected_at', 'rejected', 'Rejected')

  if (proposal.status === 'rejected' && !items.some(i => i.event_type === 'rejected')) {
    items.push(makeItem(proposal, 'rejected', 'Rejected', proposal.updated_at, 'User'))
  }
  if (proposal.status === 'archived' && !items.some(i => i.event_type === 'archived')) {
    items.push(makeItem(proposal, 'archived', 'Archived', proposal.updated_at, 'User'))
  }
  if (['implemented_pending_validation', 'implemented'].includes(proposal.status)) {
    const implemented = items.find(i => i.event_type === 'implemented_pending_validation')
    if (!implemented) {
      items.push(makeItem(proposal, 'implemented_pending_validation', 'Implemented, pending validation', proposal.updated_at, 'User'))
    }
  }

  return items
}

async function isBlockedByValidationGuard(proposal: ProposalSnapshot): Promise<boolean> {
  const skillSpec = normalizeObject(proposal.proposal_metadata.skill_spec)
  const playbookSpec = normalizeObject(proposal.proposal_metadata.playbook_spec)
  const skillId = typeof skillSpec.skill_id === 'string' ? skillSpec.skill_id : null
  const playbookId = typeof playbookSpec.playbook_id === 'string' ? playbookSpec.playbook_id : null
  if (!skillId && !playbookId && !proposal.missing_capabilities.some(c => c.startsWith('web_operator_'))) return false

  if (skillId) {
    const skill = await db.query(`SELECT id FROM web_operator_skills WHERE skill_id=$1 AND status='active' LIMIT 1`, [skillId])
    if (!skill.rows[0]) return true
  }
  if (playbookId) {
    const playbook = await db.query(`SELECT id FROM web_operator_playbooks WHERE playbook_id=$1 AND status='active' LIMIT 1`, [playbookId])
    if (!playbook.rows[0]) return true
  }
  return false
}

function makeItem(
  proposal: ProposalSnapshot,
  eventType: ImprovementTimelineEventType,
  eventLabel: string,
  createdAt: string,
  actor: string
): ImprovementTimelineItem {
  const metadata = proposal.proposal_metadata
  const lifecycle = normalizeObject(metadata.lifecycle)
  const platform = typeof metadata.platform === 'string' ? metadata.platform : null
  const capability = typeof metadata.capability_name === 'string'
    ? metadata.capability_name
    : proposal.proposed_changes[0]?.capability_name ?? proposal.missing_capabilities[0] ?? null

  return {
    id: `${proposal.id}:${eventType}:${createdAt}`,
    proposal_id: proposal.id,
    title: proposal.title,
    status: proposal.status,
    project_id: proposal.related_project_id,
    project_name: proposal.project_name,
    platform,
    capability,
    event_type: eventType,
    event_label: eventLabel,
    created_at: createdAt,
    actor,
    implementation_commit: typeof lifecycle.implementation_commit === 'string' ? lifecycle.implementation_commit : null,
    implementation_pr_url: typeof lifecycle.implementation_pr_url === 'string' ? lifecycle.implementation_pr_url : null,
    validation_summary: typeof lifecycle.validation_summary === 'string' ? lifecycle.validation_summary : null,
  }
}

function normalizeArray<T = string>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed as T[] : []
    } catch {
      return []
    }
  }
  return []
}

function normalizeObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
    } catch {
      return {}
    }
  }
  return {}
}
