import { db } from '@/lib/db/client'

export interface WebOperatorSkill {
  id?: string
  skill_id: string
  name: string
  website_pattern: string | null
  description: string
  allowed_actions: string[]
  approval_required_actions: string[]
  forbidden_actions: string[]
  login_policy: string
  output_types: string[]
  status: string
  created_at?: string
  updated_at?: string
  examples?: string[]
}

export interface SkillDecision {
  skill_id: string
  skill_name: string
  action_type: string
  allowed: boolean
  requires_approval: boolean
  blocked: boolean
  reason: string
}

export const DEFAULT_WEB_OPERATOR_SKILLS: WebOperatorSkill[] = [
  {
    skill_id: 'general_web_research',
    name: 'General web research',
    website_pattern: '*',
    description: 'Manual, human-like public web research through browser actions.',
    allowed_actions: ['search', 'open_url', 'read_page', 'collect_public_info', 'summarize'],
    approval_required_actions: ['submit_form', 'create_account'],
    forbidden_actions: ['bypass_paywall', 'solve_captcha', 'scrape_private_data'],
    login_policy: 'manual_login_if_needed_no_bypass',
    output_types: ['research_brief', 'lead_list', 'note'],
    status: 'active',
    examples: ['Kevin, do manual research like a human', 'Research this market online'],
  },
  {
    skill_id: 'gmail_workflow',
    name: 'Gmail workflow',
    website_pattern: 'mail.google.com|gmail.com',
    description: 'Browser-only Gmail workflow. User login/takeover is expected; sends require approval.',
    allowed_actions: ['open_gmail', 'create_draft', 'create_email_draft', 'search_mail', 'search_gmail', 'check_reply', 'check_gmail_reply'],
    approval_required_actions: ['send_email', 'send_gmail_draft'],
    forbidden_actions: ['delete_email', 'forward_without_approval', 'open_attachments_unless_approved'],
    login_policy: 'manual_login_only_no_password_storage',
    output_types: ['outreach_draft', 'reply_check', 'approval_item'],
    status: 'active',
    examples: ['Kevin, open Gmail', 'Kevin, check for replies'],
  },
  {
    skill_id: 'canva_design',
    name: 'Canva design',
    website_pattern: 'canva.com',
    description: 'Canva browser workflow for safe design drafts. Publishing/sharing/downloading final assets require approval.',
    allowed_actions: ['open_canva', 'open_url', 'create_design_draft', 'edit_text', 'upload_user_approved_assets', 'export_design'],
    approval_required_actions: ['publish_design', 'share_design', 'download_final_asset'],
    forbidden_actions: ['use_unlicensed_assets_without_review', 'publish_without_approval'],
    login_policy: 'manual_login_only_no_bypass',
    output_types: ['design_draft', 'approval_item', 'generated_file'],
    status: 'active',
    examples: ['Kevin, work on Canva', 'Create a Canva draft for this campaign'],
  },
  {
    skill_id: 'facebook_research',
    name: 'Facebook research',
    website_pattern: 'facebook.com',
    description: 'Public Facebook research via browser. Messaging, comments, group joins, and posts require approval.',
    allowed_actions: ['search_pages', 'search_groups', 'read_public_posts', 'collect_public_leads', 'search', 'open_url'],
    approval_required_actions: ['send_message', 'post_comment', 'join_group', 'create_post', 'post'],
    forbidden_actions: ['mass_messaging', 'scraping_private_profiles', 'bypass_login'],
    login_policy: 'manual_login_only_no_bypass',
    output_types: ['research_brief', 'lead_list', 'approval_item'],
    status: 'active',
    examples: ['Kevin, research on Facebook', 'Kevin, post on Facebook after approval'],
  },
  {
    skill_id: 'linkedin_research',
    name: 'LinkedIn research',
    website_pattern: 'linkedin.com',
    description: 'Public LinkedIn company/profile research via browser. Outreach and posts require approval.',
    allowed_actions: ['search_companies', 'read_public_profiles', 'collect_company_info', 'search', 'open_url'],
    approval_required_actions: ['send_connection_request', 'send_message', 'post'],
    forbidden_actions: ['mass_automation', 'scraping_private_data'],
    login_policy: 'manual_login_only_no_bypass',
    output_types: ['research_brief', 'lead_list', 'approval_item'],
    status: 'active',
    examples: ['Kevin, research companies on LinkedIn'],
  },
  {
    skill_id: 'instagram_research',
    name: 'Instagram research',
    website_pattern: 'instagram.com',
    description: 'Public Instagram research via browser with manual login as needed.',
    allowed_actions: ['search_profiles', 'read_public_posts', 'collect_public_info', 'search', 'open_url'],
    approval_required_actions: ['send_message', 'post_comment', 'follow_account', 'create_post'],
    forbidden_actions: ['mass_messaging', 'scraping_private_profiles', 'bypass_login'],
    login_policy: 'manual_login_only_no_bypass',
    output_types: ['research_brief', 'lead_list', 'approval_item'],
    status: 'active',
    examples: ['Kevin, research on Instagram'],
  },
  {
    skill_id: 'website_reader',
    name: 'Website reader',
    website_pattern: '*',
    description: 'Read a specific website page and summarize public content.',
    allowed_actions: ['open_url', 'read_page', 'summarize', 'collect_public_info'],
    approval_required_actions: ['submit_form'],
    forbidden_actions: ['bypass_paywall', 'solve_captcha', 'scrape_private_data'],
    login_policy: 'manual_login_if_needed_no_bypass',
    output_types: ['research_brief', 'note'],
    status: 'active',
    examples: ['Kevin, read this website'],
  },
]

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed.map(String) : []
    } catch { return [] }
  }
  return []
}

function rowToSkill(row: Record<string, unknown>): WebOperatorSkill {
  return {
    id: row.id ? String(row.id) : undefined,
    skill_id: String(row.skill_id),
    name: String(row.name),
    website_pattern: row.website_pattern ? String(row.website_pattern) : null,
    description: String(row.description ?? ''),
    allowed_actions: parseJsonArray(row.allowed_actions),
    approval_required_actions: parseJsonArray(row.approval_required_actions),
    forbidden_actions: parseJsonArray(row.forbidden_actions),
    login_policy: String(row.login_policy ?? 'manual_login_only'),
    output_types: parseJsonArray(row.output_types),
    status: String(row.status ?? 'active'),
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
    examples: DEFAULT_WEB_OPERATOR_SKILLS.find(s => s.skill_id === row.skill_id)?.examples ?? [],
  }
}

export async function listWebOperatorSkills(): Promise<WebOperatorSkill[]> {
  try {
    const res = await db.query(`SELECT * FROM web_operator_skills WHERE status='active' ORDER BY name`)
    if (res.rows.length > 0) return res.rows.map(rowToSkill)
  } catch { /* migration may not be applied yet */ }
  return DEFAULT_WEB_OPERATOR_SKILLS
}

export async function getSkillById(skillId: string): Promise<WebOperatorSkill | null> {
  const fallback = DEFAULT_WEB_OPERATOR_SKILLS.find(s => s.skill_id === skillId) ?? null
  try {
    const res = await db.query(`SELECT * FROM web_operator_skills WHERE skill_id=$1 LIMIT 1`, [skillId])
    return res.rows[0] ? rowToSkill(res.rows[0]) : fallback
  } catch { return fallback }
}

export async function getSkillForUrl(url: string): Promise<WebOperatorSkill | null> {
  const lower = url.toLowerCase()
  if (lower.includes('mail.google.com') || lower.includes('gmail.com')) return getSkillById('gmail_workflow')
  if (lower.includes('canva.com')) return getSkillById('canva_design')
  if (lower.includes('facebook.com')) return getSkillById('facebook_research')
  if (lower.includes('linkedin.com')) return getSkillById('linkedin_research')
  if (lower.includes('instagram.com')) return getSkillById('instagram_research')
  if (/^https?:\/\//i.test(url)) return getSkillById('website_reader')
  return null
}

export function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s"'<>]+/i)
  return match ? match[0].replace(/[),.!?;:]+$/, '') : null
}

function aliases(actionType: string): string[] {
  const map: Record<string, string[]> = {
    send_gmail_draft: ['send_email'],
    create_email_draft: ['create_draft'],
    search_gmail: ['search_mail'],
    check_gmail_reply: ['check_reply'],
    open_canva: ['open_url'],
    create_post: ['post'],
    fill_form: ['submit_form'],
    download_file: ['download_final_asset'],
  }
  return [actionType, ...(map[actionType] ?? [])]
}

function includesAction(list: string[], actionType: string): boolean {
  return aliases(actionType).some(a => list.includes(a))
}

export async function canSkillPerformAction(skillId: string, actionType: string): Promise<boolean> {
  const skill = await getSkillById(skillId)
  if (!skill) return false
  if (includesAction(skill.forbidden_actions, actionType)) return false
  return includesAction(skill.allowed_actions, actionType) || includesAction(skill.approval_required_actions, actionType)
}

export async function requiresApprovalForSkillAction(skillId: string, actionType: string): Promise<boolean> {
  const skill = await getSkillById(skillId)
  if (!skill) return false
  return includesAction(skill.approval_required_actions, actionType)
}

export async function validateSkillAction(
  skillId: string,
  actionType: string,
  _payload?: Record<string, unknown>
): Promise<SkillDecision> {
  const skill = await getSkillById(skillId)
  if (!skill) {
    return { skill_id: skillId, skill_name: skillId, action_type: actionType, allowed: false, requires_approval: false, blocked: true, reason: `Unknown Web Operator skill: ${skillId}` }
  }
  const forbidden = includesAction(skill.forbidden_actions, actionType)
  const requiresApproval = includesAction(skill.approval_required_actions, actionType)
  const allowed = !forbidden && (includesAction(skill.allowed_actions, actionType) || requiresApproval)
  const reason = forbidden
    ? `Skill blocked this action: ${actionType} is forbidden for ${skill.name}.`
    : requiresApproval
      ? `${skill.name} requires approval before ${actionType}.`
      : allowed
        ? `${skill.name} allows ${actionType}.`
        : `Skill blocked this action: ${actionType} is not allowed for ${skill.name}.`
  return { skill_id: skill.skill_id, skill_name: skill.name, action_type: actionType, allowed, requires_approval: requiresApproval, blocked: !allowed || forbidden, reason }
}

export async function getRecommendedSkillForInstruction(text: string): Promise<WebOperatorSkill | null> {
  const lower = text.toLowerCase()
  if (/\bcanva\b/.test(lower)) return getSkillById('canva_design')
  if (/\bfacebook\b|\bfb\b/.test(lower)) return getSkillById('facebook_research')
  if (/\blinkedin\b/.test(lower)) return getSkillById('linkedin_research')
  if (/\bgmail\b|\bemail\b|\binbox\b/.test(lower)) return getSkillById('gmail_workflow')
  if (/\binstagram\b/.test(lower)) return getSkillById('instagram_research')
  const url = extractFirstUrl(text)
  if (url) return getSkillForUrl(url)
  if (/\b(research|search|look up|browse|manual research|like a human|web)\b/.test(lower)) return getSkillById('general_web_research')
  return null
}

export function inferUnknownWebsiteFromInstruction(text: string): string | null {
  const withoutUrls = text.replace(/https?:\/\/[^\s"'<>]+/gi, '')
  if (!withoutUrls.trim()) return null
  const lower = withoutUrls.toLowerCase()
  if (!/\b(work on|research on|use|open|browse)\b/.test(lower)) return null
  const match = withoutUrls.match(/(?:work on|research on|use|open|browse)\s+([A-Z][\w.-]{2,}|[a-z][\w.-]+\.[a-z]{2,})/i)
  if (!match) return null
  const candidate = match[1].replace(/[.,!?;:]$/, '')
  const known = ['canva', 'facebook', 'linkedin', 'gmail', 'instagram', 'google', 'web', 'and', 'or', 'the', 'a', 'an',
    'relevant', 'useful', 'popular', 'good', 'best', 'top', 'some', 'any', 'multiple', 'various', 'different', 'new']
  if (known.includes(candidate.toLowerCase())) return null
  return candidate
}
