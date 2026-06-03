import { db } from '@/lib/db/client'

export interface WebOperatorPlaybook {
  playbook_id: string
  skill_id: string
  name: string
  description: string
  trigger_patterns: string[]
  steps: string[]
  approval_gates: string[]
  forbidden_steps: string[]
  output_schema: Record<string, unknown>
  status: string
  examples?: string[]
}

export interface PlaybookPlanStep {
  step_type: string
  label: string
  status: 'ready' | 'pending' | 'approval_required' | 'blocked'
  requires_approval: boolean
  forbidden: boolean
}

export interface PlaybookExecutionPlan {
  playbook_id: string
  playbook_name: string
  skill_id: string
  instruction: string
  current_step: string | null
  status: 'planned'
  steps: PlaybookPlanStep[]
  approval_gates: string[]
  forbidden_steps: string[]
  output_schema: Record<string, unknown>
  context?: Record<string, unknown>
}

export interface PlaybookStepValidation {
  allowed: boolean
  requires_approval: boolean
  blocked: boolean
  reason: string
}

export const DEFAULT_WEB_OPERATOR_PLAYBOOKS: WebOperatorPlaybook[] = [
  {
    playbook_id: 'canva_instagram_draft',
    skill_id: 'canva_design',
    name: 'Canva Instagram Draft',
    description: 'Open Canva directly and prepare only a safe draft design preview.',
    trigger_patterns: ['canva', 'instagram', 'draft', 'post', 'design'],
    steps: ['open_canva', 'wait_for_manual_login_if_needed', 'create_design_draft', 'add_user_requested_text', 'capture_preview', 'save_draft_result'],
    approval_gates: ['download_final_asset', 'share_design', 'publish_design'],
    forbidden_steps: ['publish_without_approval', 'use_unlicensed_assets_without_review'],
    output_schema: { type: 'object', properties: { draft_url: { type: 'string' }, preview_screenshot: { type: 'string' }, summary: { type: 'string' } } },
    status: 'active',
    examples: ['Kevin, create a Canva Instagram draft for ALB Parking.'],
  },
  {
    playbook_id: 'facebook_group_research',
    skill_id: 'facebook_research',
    name: 'Facebook Group Research',
    description: 'Open Facebook group search directly, pause for login/security, and summarize visible group results only.',
    trigger_patterns: ['facebook', 'group', 'groups', 'research'],
    steps: ['open_facebook_group_search_url', 'wait_for_manual_login_if_needed', 'read_visible_group_results', 'collect_group_names_urls_member_counts_if_visible', 'summarize_findings'],
    approval_gates: ['join_group', 'post', 'comment', 'send_message'],
    forbidden_steps: ['scrape_private_profiles', 'mass_message', 'bypass_login'],
    output_schema: { type: 'object', properties: { groups: { type: 'array' }, summary: { type: 'string' }, limitations: { type: 'string' } } },
    status: 'active',
    examples: ['Kevin, research Facebook groups about parking in A Coruña.'],
  },
  {
    playbook_id: 'linkedin_company_research',
    skill_id: 'linkedin_research',
    name: 'LinkedIn Company Research',
    description: 'Open LinkedIn company search directly and summarize visible public company information.',
    trigger_patterns: ['linkedin', 'company', 'companies', 'research'],
    steps: ['open_linkedin_company_search_url', 'wait_for_manual_login_if_needed', 'read_visible_company_results', 'collect_company_names_urls_descriptions_if_visible', 'summarize_findings'],
    approval_gates: ['send_connection_request', 'send_message', 'post'],
    forbidden_steps: ['mass_automation', 'scrape_private_data', 'bypass_login'],
    output_schema: { type: 'object', properties: { companies: { type: 'array' }, summary: { type: 'string' }, limitations: { type: 'string' } } },
    status: 'active',
    examples: ['Kevin, research LinkedIn companies for parking in A Coruña.'],
  },
  {
    playbook_id: 'gmail_open_and_check',
    skill_id: 'gmail_workflow',
    name: 'Gmail Open and Check',
    description: 'Open Gmail directly, pause for manual login if needed, and read only visible mail context.',
    trigger_patterns: ['gmail', 'open', 'check', 'inbox', 'reply'],
    steps: ['open_gmail', 'wait_for_manual_login_if_needed', 'read_visible_mail_context', 'summarize_visible_status'],
    approval_gates: ['send_email', 'send_gmail_draft', 'delete_email', 'forward_email'],
    forbidden_steps: ['open_attachments_unless_approved', 'store_password', 'bypass_login'],
    output_schema: { type: 'object', properties: { status: { type: 'string' }, summary: { type: 'string' } } },
    status: 'active',
    examples: ['Kevin, open Gmail.'],
  },
  {
    playbook_id: 'gmail_prepare_draft',
    skill_id: 'gmail_workflow',
    name: 'Gmail Prepare Draft',
    description: 'Open Gmail directly, pause for manual login if needed, and prepare a draft without sending it.',
    trigger_patterns: ['gmail', 'draft', 'prepare', 'write', 'email', 'mail'],
    steps: ['open_gmail', 'wait_for_manual_login_if_needed', 'create_email_draft', 'fill_requested_content', 'save_draft_result'],
    approval_gates: ['send_email', 'send_gmail_draft'],
    forbidden_steps: ['send_without_approval', 'store_password', 'bypass_login'],
    output_schema: { type: 'object', properties: { draft_created: { type: 'boolean' }, subject: { type: 'string' }, recipient: { type: 'string' }, summary: { type: 'string' } } },
    status: 'active',
    examples: ['Kevin, prepare a Gmail draft for this lead.'],
  },
  {
    playbook_id: 'general_site_research',
    skill_id: 'general_web_research',
    name: 'General Site Research',
    description: 'Use conservative read-only browser steps and summarize visible public content.',
    trigger_patterns: ['research', 'open', 'read', 'website', 'site'],
    steps: ['open_or_search_public_site', 'wait_for_manual_login_if_needed', 'read_visible_public_content', 'summarize_findings'],
    approval_gates: ['submit_form', 'create_account'],
    forbidden_steps: ['bypass_paywall', 'solve_captcha', 'scrape_private_data', 'post_without_approval'],
    output_schema: { type: 'object', properties: { summary: { type: 'string' }, sources: { type: 'array' }, limitations: { type: 'string' } } },
    status: 'active',
    examples: ['Kevin, research this public website.'],
  },
]

function normalizeArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed.map(String) : []
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

function rowToPlaybook(row: Record<string, unknown>): WebOperatorPlaybook {
  const fallback = DEFAULT_WEB_OPERATOR_PLAYBOOKS.find(p => p.playbook_id === row.playbook_id)
  return {
    playbook_id: String(row.playbook_id),
    skill_id: String(row.skill_id),
    name: String(row.name),
    description: String(row.description ?? ''),
    trigger_patterns: normalizeArray(row.trigger_patterns),
    steps: normalizeArray(row.steps),
    approval_gates: normalizeArray(row.approval_gates),
    forbidden_steps: normalizeArray(row.forbidden_steps),
    output_schema: normalizeObject(row.output_schema),
    status: String(row.status ?? 'active'),
    examples: fallback?.examples ?? [],
  }
}

export async function listPlaybooks(): Promise<WebOperatorPlaybook[]> {
  try {
    const res = await db.query(`SELECT * FROM web_operator_playbooks WHERE status='active' ORDER BY name ASC`)
    if (res.rows.length > 0) return res.rows.map(rowToPlaybook)
  } catch {
    // migration may not have run yet
  }
  return DEFAULT_WEB_OPERATOR_PLAYBOOKS
}

export async function getPlaybookById(playbookId: string): Promise<WebOperatorPlaybook | null> {
  const fallback = DEFAULT_WEB_OPERATOR_PLAYBOOKS.find(p => p.playbook_id === playbookId) ?? null
  try {
    const res = await db.query(`SELECT * FROM web_operator_playbooks WHERE playbook_id=$1 LIMIT 1`, [playbookId])
    return res.rows[0] ? rowToPlaybook(res.rows[0]) : fallback
  } catch {
    return fallback
  }
}

export async function getRecommendedPlaybookForInstruction(text: string, skillId?: string | null): Promise<WebOperatorPlaybook | null> {
  if (!skillId) return null
  if (skillId === 'canva_design' && /\b(canva|instagram|draft|post|design)\b/i.test(text)) {
    return getPlaybookById('canva_instagram_draft')
  }
  if (skillId === 'facebook_research' && /\b(groups?|facebook)\b/i.test(text)) {
    return getPlaybookById('facebook_group_research')
  }
  if (skillId === 'linkedin_research' && /\b(linkedin|compan(y|ies)|research)\b/i.test(text)) {
    return getPlaybookById('linkedin_company_research')
  }
  if (skillId === 'gmail_workflow') {
    if (/\b(draft|prepare|write)\b/i.test(text)) {
      return getPlaybookById('gmail_prepare_draft')
    }
    return getPlaybookById('gmail_open_and_check')
  }
  if ((skillId === 'general_web_research' || skillId === 'website_reader') && /\b(research|read|open|website|site|summarize)\b/i.test(text)) {
    return getPlaybookById('general_site_research')
  }
  return null
}

function labelForStep(step: string): string {
  return step.replace(/_/g, ' ')
}

export async function buildPlaybookPlan(
  playbookId: string,
  instruction: string,
  context: Record<string, unknown> = {}
): Promise<PlaybookExecutionPlan | null> {
  const playbook = await getPlaybookById(playbookId)
  if (!playbook) return null
  const steps = playbook.steps.map((step, index) => {
    const requires = playbook.approval_gates.includes(step)
    const forbidden = playbook.forbidden_steps.includes(step)
    return {
      step_type: step,
      label: labelForStep(step),
      status: forbidden ? 'blocked' : requires ? 'approval_required' : index === 0 ? 'ready' : 'pending',
      requires_approval: requires,
      forbidden,
    } satisfies PlaybookPlanStep
  })
  return {
    playbook_id: playbook.playbook_id,
    playbook_name: playbook.name,
    skill_id: playbook.skill_id,
    instruction,
    current_step: steps.find(s => s.status === 'ready')?.step_type ?? steps[0]?.step_type ?? null,
    status: 'planned',
    steps,
    approval_gates: playbook.approval_gates,
    forbidden_steps: playbook.forbidden_steps,
    output_schema: playbook.output_schema,
    context,
  }
}

export async function validatePlaybookStep(playbookId: string, stepType: string): Promise<PlaybookStepValidation> {
  const playbook = await getPlaybookById(playbookId)
  if (!playbook) {
    return { allowed: false, requires_approval: false, blocked: true, reason: `Unknown playbook: ${playbookId}` }
  }
  if (playbook.forbidden_steps.includes(stepType)) {
    return { allowed: false, requires_approval: false, blocked: true, reason: `Playbook blocked forbidden step: ${stepType}` }
  }
  if (playbook.approval_gates.includes(stepType)) {
    return { allowed: true, requires_approval: true, blocked: false, reason: `Playbook requires approval for step: ${stepType}` }
  }
  if (playbook.steps.includes(stepType)) {
    return { allowed: true, requires_approval: false, blocked: false, reason: `Playbook allows step: ${stepType}` }
  }
  return { allowed: false, requires_approval: false, blocked: true, reason: `Step is not part of playbook: ${stepType}` }
}

export async function requiresApprovalForPlaybookStep(playbookId: string, stepType: string): Promise<boolean> {
  const playbook = await getPlaybookById(playbookId)
  return Boolean(playbook?.approval_gates.includes(stepType))
}

export async function createPlaybookExecutionPlan(opts: {
  playbookId?: string | null
  instruction: string
  skillId?: string | null
  context?: Record<string, unknown>
}): Promise<PlaybookExecutionPlan | null> {
  const playbook = opts.playbookId
    ? await getPlaybookById(opts.playbookId)
    : await getRecommendedPlaybookForInstruction(opts.instruction, opts.skillId)
  if (!playbook) return null
  return buildPlaybookPlan(playbook.playbook_id, opts.instruction, opts.context ?? {})
}
