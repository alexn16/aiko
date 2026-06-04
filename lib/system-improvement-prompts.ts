import { db } from '@/lib/db/client'
import { type SystemImprovementProposal } from '@/lib/system-improvements'

export interface CapabilityImplementationSpec {
  missing_capability_id: string
  capability_name: string
  platform: string
  why_needed: string
  skill_spec: SkillImplementationSpec
  playbook_spec: PlaybookImplementationSpec
  safety_rules: string[]
  database_changes: string[]
  api_routes: string[]
  ui_changes: string[]
  test_plan: string[]
  runtime_validation_plan: string[]
}

export interface SkillImplementationSpec {
  skill_id: string
  name: string
  website_pattern: string
  description: string
  allowed_actions: string[]
  approval_required_actions: string[]
  forbidden_actions: string[]
  login_policy: string
  output_types: string[]
}

export interface PlaybookImplementationSpec {
  playbook_id: string
  skill_id: string
  name: string
  description: string
  trigger_patterns: string[]
  steps: string[]
  approval_gates: string[]
  forbidden_steps: string[]
  output_schema: Record<string, unknown>
}

export interface CapabilityImplementationPrompt {
  missing_capability_id: string
  platform: string
  capability_name: string
  skill_spec: SkillImplementationSpec
  playbook_spec: PlaybookImplementationSpec
  safety_rules: string[]
  database_changes: string[]
  api_routes: string[]
  ui_changes: string[]
  test_plan: string[]
  runtime_validation_plan: string[]
  implementation_prompt: string
}

function lines(title: string, items: string[]): string {
  return `${title}\n${items.map(item => `- ${item}`).join('\n')}`
}

function jsonBlock(label: string, value: unknown): string {
  return `${label}\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``
}

export function generateSkillImplementationPrompt(skillSpec: SkillImplementationSpec): string {
  return [
    `Add Web Operator Skill: ${skillSpec.skill_id}`,
    `Name: ${skillSpec.name}`,
    `Website pattern: ${skillSpec.website_pattern}`,
    `Description: ${skillSpec.description}`,
    lines('Allowed actions:', skillSpec.allowed_actions),
    lines('Approval-required actions:', skillSpec.approval_required_actions),
    lines('Forbidden actions:', skillSpec.forbidden_actions),
    `Login policy: ${skillSpec.login_policy}`,
    lines('Output types:', skillSpec.output_types),
  ].join('\n\n')
}

export function generatePlaybookImplementationPrompt(playbookSpec: PlaybookImplementationSpec): string {
  return [
    `Add Web Operator Playbook: ${playbookSpec.playbook_id}`,
    `Skill: ${playbookSpec.skill_id}`,
    `Name: ${playbookSpec.name}`,
    `Description: ${playbookSpec.description}`,
    lines('Trigger patterns:', playbookSpec.trigger_patterns),
    lines('Steps:', playbookSpec.steps),
    lines('Approval gates:', playbookSpec.approval_gates),
    lines('Forbidden steps:', playbookSpec.forbidden_steps),
    jsonBlock('Output schema:', playbookSpec.output_schema),
  ].join('\n\n')
}

export function generateCapabilityImplementationPrompt(
  capability: CapabilityImplementationSpec
): CapabilityImplementationPrompt {
  const prompt = [
    `You are Codex working locally on AÏKO. Implement this missing capability only after user approval: ${capability.capability_name}.`,
    `Context: AÏKO needs this capability because ${capability.why_needed}`,
    `This is a browser-only Web Operator capability for ${capability.platform}. Do not add native platform APIs unless the user explicitly asks for that in a separate approved task.`,
    generateSkillImplementationPrompt(capability.skill_spec),
    generatePlaybookImplementationPrompt(capability.playbook_spec),
    lines('Database changes if needed:', capability.database_changes),
    lines('API routes if needed:', capability.api_routes),
    lines('UI pages/panels if needed:', capability.ui_changes),
    lines('Tests to add:', capability.test_plan),
    lines('Runtime validation checklist:', capability.runtime_validation_plan),
    lines('Safety constraints:', capability.safety_rules),
    [
      'Hard requirements:',
      '- Do not bypass login, QR, CAPTCHA, or security checkpoints.',
      '- Do not send, post, publish, comment, join, attach, broadcast, or message automatically.',
      '- Risky actions must create/require Approval Center items before execution.',
      '- User manual takeover is required for QR/login/security checkpoints.',
      '- Do not scrape contacts, private profiles, private messages, or private data.',
      '- Do not fake success or mark work complete if the browser is blocked.',
      '- Do not auto-approve proposals or execute Web Operator actions as part of this implementation.',
      '- Add documentation and smoke tests, then run npm test, npm run build, and git diff --check.',
    ].join('\n'),
    `Suggested commit message: Add ${capability.platform} Web Operator skill and playbook`,
  ].join('\n\n')

  return {
    missing_capability_id: capability.missing_capability_id,
    platform: capability.platform,
    capability_name: capability.capability_name,
    skill_spec: capability.skill_spec,
    playbook_spec: capability.playbook_spec,
    safety_rules: capability.safety_rules,
    database_changes: capability.database_changes,
    api_routes: capability.api_routes,
    ui_changes: capability.ui_changes,
    test_plan: capability.test_plan,
    runtime_validation_plan: capability.runtime_validation_plan,
    implementation_prompt: prompt,
  }
}

function safeArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : []
}

function normalizePromptMetadata(value: unknown): Partial<CapabilityImplementationPrompt> {
  if (!value) return {}
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' ? parsed as Partial<CapabilityImplementationPrompt> : {}
    } catch {
      return {}
    }
  }
  return typeof value === 'object' ? value as Partial<CapabilityImplementationPrompt> : {}
}

function promptFromProposal(proposal: SystemImprovementProposal): CapabilityImplementationSpec {
  const metadata = normalizePromptMetadata(proposal.proposal_metadata)
  const missingKey = proposal.missing_capabilities[0] ?? 'missing_capability'
  const platform = typeof metadata.platform === 'string'
    ? metadata.platform
    : proposal.title.replace(/^Add\s+/i, '').replace(/\s+(Operator\s+)?(Skill|Playbook).*$/i, '').trim() || 'Unknown platform'
  const skillId = typeof metadata.skill_spec?.skill_id === 'string'
    ? metadata.skill_spec.skill_id
    : missingKey.replace(/^web_operator_skill:/, '').replace(/^web_operator_playbook:/, '')
  const playbookId = typeof metadata.playbook_spec?.playbook_id === 'string'
    ? metadata.playbook_spec.playbook_id
    : skillId.endsWith('_web') ? `${skillId.replace(/_web$/, '')}_outreach` : `${skillId}_workflow`

  return {
    missing_capability_id: missingKey,
    capability_name: proposal.title,
    platform,
    why_needed: proposal.reason || proposal.summary || 'the current strategy requires a missing governed browser workflow.',
    skill_spec: {
      skill_id: skillId,
      name: metadata.skill_spec?.name ?? proposal.title,
      website_pattern: metadata.skill_spec?.website_pattern ?? '*',
      description: metadata.skill_spec?.description ?? proposal.summary,
      allowed_actions: safeArray(metadata.skill_spec?.allowed_actions).length > 0
        ? safeArray(metadata.skill_spec?.allowed_actions)
        : ['open_url', 'read_visible_page', 'prepare_draft', 'summarize'],
      approval_required_actions: safeArray(metadata.skill_spec?.approval_required_actions).length > 0
        ? safeArray(metadata.skill_spec?.approval_required_actions)
        : ['send_message', 'post', 'publish', 'submit_form'],
      forbidden_actions: safeArray(metadata.skill_spec?.forbidden_actions).length > 0
        ? safeArray(metadata.skill_spec?.forbidden_actions)
        : ['bypass_login', 'bypass_captcha', 'scrape_private_data', 'send_without_approval'],
      login_policy: metadata.skill_spec?.login_policy ?? 'manual_login_only_no_bypass',
      output_types: safeArray(metadata.skill_spec?.output_types).length > 0
        ? safeArray(metadata.skill_spec?.output_types)
        : ['research_brief', 'draft', 'approval_item'],
    },
    playbook_spec: {
      playbook_id: playbookId,
      skill_id: skillId,
      name: metadata.playbook_spec?.name ?? `${platform} Workflow`,
      description: metadata.playbook_spec?.description ?? `Safe browser workflow for ${platform}.`,
      trigger_patterns: safeArray(metadata.playbook_spec?.trigger_patterns).length > 0
        ? safeArray(metadata.playbook_spec?.trigger_patterns)
        : [platform.toLowerCase()],
      steps: safeArray(metadata.playbook_spec?.steps).length > 0
        ? safeArray(metadata.playbook_spec?.steps)
        : ['open_site_directly', 'wait_for_manual_login_if_needed', 'prepare_draft', 'request_approval'],
      approval_gates: safeArray(metadata.playbook_spec?.approval_gates).length > 0
        ? safeArray(metadata.playbook_spec?.approval_gates)
        : ['send_message', 'post', 'publish', 'submit_form'],
      forbidden_steps: safeArray(metadata.playbook_spec?.forbidden_steps).length > 0
        ? safeArray(metadata.playbook_spec?.forbidden_steps)
        : ['bypass_login', 'bypass_captcha', 'send_without_approval'],
      output_schema: metadata.playbook_spec?.output_schema && typeof metadata.playbook_spec.output_schema === 'object'
        ? metadata.playbook_spec.output_schema
        : { type: 'object', properties: { summary: { type: 'string' }, limitations: { type: 'string' } } },
    },
    safety_rules: safeArray(metadata.safety_rules).length > 0
      ? safeArray(metadata.safety_rules)
      : ['manual_login_only', 'no_captcha_bypass', 'approval_required_for_risky_actions', 'no_fake_success'],
    database_changes: safeArray(metadata.database_changes).length > 0
      ? safeArray(metadata.database_changes)
      : ['Seed or add web_operator_skills row if not covered by defaults.', 'Seed or add web_operator_playbooks row if not covered by defaults.'],
    api_routes: safeArray(metadata.api_routes).length > 0
      ? safeArray(metadata.api_routes)
      : ['Update Web Operator skill/playbook API smoke coverage if new defaults are added.'],
    ui_changes: safeArray(metadata.ui_changes).length > 0
      ? safeArray(metadata.ui_changes)
      : ['Ensure /operator-skills and /operator-playbooks show the new capability.', 'Ensure /operators/[id] displays skill/playbook metadata during actions.'],
    test_plan: safeArray(metadata.test_plan).length > 0
      ? safeArray(metadata.test_plan)
      : ['Capability maps to expected skill/playbook.', 'Approval-required actions do not execute automatically.', 'Forbidden actions are blocked.'],
    runtime_validation_plan: safeArray(metadata.runtime_validation_plan).length > 0
      ? safeArray(metadata.runtime_validation_plan)
      : ['Run headed mode.', 'Confirm direct site opens.', 'Confirm login/security pauses.', 'Confirm no risky action executes without approval.'],
  }
}

export async function attachImplementationPromptToProposal(
  proposalId: string,
  prompt: CapabilityImplementationPrompt
): Promise<SystemImprovementProposal | null> {
  const result = await db.query(
    `UPDATE system_improvement_proposals
     SET implementation_prompt=$1, proposal_metadata=$2, updated_at=NOW()
     WHERE id=$3
     RETURNING *`,
    [prompt.implementation_prompt, JSON.stringify(prompt), proposalId]
  )
  return result.rows[0] ? rowToProposalWithMetadata(result.rows[0]) : null
}

export async function getImplementationPromptForProposal(
  proposalId: string
): Promise<CapabilityImplementationPrompt | null> {
  const result = await db.query(
    `SELECT * FROM system_improvement_proposals WHERE id=$1 LIMIT 1`,
    [proposalId]
  )
  if (!result.rows[0]) return null
  const proposal = rowToProposalWithMetadata(result.rows[0])
  const existing = normalizePromptMetadata(proposal.proposal_metadata)
  if (existing.implementation_prompt && existing.skill_spec && existing.playbook_spec) {
    return existing as CapabilityImplementationPrompt
  }
  return generateCapabilityImplementationPrompt(promptFromProposal(proposal))
}

function rowToProposalWithMetadata(row: Record<string, unknown>): SystemImprovementProposal {
  return {
    id: String(row.id),
    title: String(row.title),
    summary: String(row.summary ?? ''),
    reason: String(row.reason ?? ''),
    requested_by_role: String(row.requested_by_role ?? 'CEO'),
    related_project_id: row.related_project_id ? String(row.related_project_id) : null,
    related_strategy: row.related_strategy ? String(row.related_strategy) : null,
    missing_capabilities: Array.isArray(row.missing_capabilities) ? row.missing_capabilities.map(String) : [],
    proposed_changes: Array.isArray(row.proposed_changes) ? row.proposed_changes as SystemImprovementProposal['proposed_changes'] : [],
    risk_level: row.risk_level as SystemImprovementProposal['risk_level'],
    status: row.status as SystemImprovementProposal['status'],
    implementation_prompt: String(row.implementation_prompt ?? ''),
    proposal_metadata: normalizePromptMetadata(row.proposal_metadata),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    approved_at: row.approved_at ? String(row.approved_at) : null,
    project_name: row.project_name ? String(row.project_name) : undefined,
  }
}
