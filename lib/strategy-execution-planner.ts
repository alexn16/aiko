import { db } from '@/lib/db/client'
import { createAgentTask, type AgentTask } from '@/lib/agents/tasks'
import { createCustomAgent, listCustomAgents, type CustomAgent } from '@/lib/custom-agents'
import { getProjectStrategyBrief, type ProjectStrategyBrief } from '@/lib/project-strategy-brief'
import {
  createSystemImprovementProposal,
  findReusableSystemImprovementProposal,
  type SystemImprovementProposal,
} from '@/lib/system-improvements'
import {
  attachImplementationPromptToProposal,
  generateCapabilityImplementationPrompt,
  type CapabilityImplementationSpec,
  type PlaybookImplementationSpec,
  type SkillImplementationSpec,
} from '@/lib/system-improvement-prompts'
import { getSkillById } from '@/lib/web-operator/skills'
import { getPlaybookById } from '@/lib/web-operator/playbooks'

export type StrategyExecutionPlanStatus =
  | 'draft'
  | 'needs_capabilities'
  | 'ready_for_tasks'
  | 'active'
  | 'paused'
  | 'completed'
  | 'archived'

export interface RequiredCapability {
  capability_key: string
  channel: string
  name: string
  skill_id: string
  playbook_id: string
  tool_id: string | null
  detected: boolean
  requires_approval: boolean
  requires_user_login: boolean
  special_workflow_required?: boolean
  source?: string
}

export interface RequiredSkill {
  skill_id: string
  name: string
  available: boolean
  reason: string
}

export interface RequiredPlaybook {
  playbook_id: string
  name: string
  skill_id: string
  available: boolean
  reason: string
}

export interface MissingCapability {
  capability_key: string
  capability_type: 'web_operator_skill' | 'web_operator_playbook'
  channel: string
  name: string
  required_skill: string
  required_playbook: string
  reason: string
  safety_rules: string[]
  approval_gates: string[]
  forbidden_actions: string[]
  implementation_prompt: string
  skill_spec?: SkillImplementationSpec
  playbook_spec?: PlaybookImplementationSpec
  database_changes?: string[]
  api_routes?: string[]
  ui_changes?: string[]
  test_plan?: string[]
  runtime_validation_plan?: string[]
}

export interface ExecutionStep {
  step_id: string
  owner_role: string
  description: string
  skill_id?: string
  playbook_id?: string
  requires_user_login?: boolean
  requires_approval: boolean
  missing_capability?: boolean
}

export interface StrategyExecutionPlan {
  id: string
  project_id: string
  strategy_brief_id: string | null
  campaign_id: string | null
  title: string
  objective: string
  recommended_channel: string
  target_audience: string
  strategy_summary: string
  required_agents: Array<Record<string, unknown>>
  required_skills: RequiredSkill[]
  required_playbooks: RequiredPlaybook[]
  required_tools: Array<Record<string, unknown>>
  execution_steps: ExecutionStep[]
  approval_gates: Array<Record<string, unknown>>
  missing_capabilities: MissingCapability[]
  system_improvement_ids: string[]
  status: StrategyExecutionPlanStatus
  created_by_role: string
  created_at: string
  updated_at: string
}

export interface CapabilityMatchResult {
  required_skills: RequiredSkill[]
  required_playbooks: RequiredPlaybook[]
  required_tools: Array<Record<string, unknown>>
  missing_capabilities: MissingCapability[]
}

const CHANNELS: RequiredCapability[] = [
  {
    capability_key: 'whatsapp_web',
    channel: 'WhatsApp Web',
    name: 'WhatsApp Web outreach',
    skill_id: 'whatsapp_web',
    playbook_id: 'whatsapp_outreach',
    tool_id: 'web_operator',
    detected: false,
    requires_approval: true,
    requires_user_login: true,
  },
  {
    capability_key: 'reddit_research',
    channel: 'Reddit',
    name: 'Reddit market research',
    skill_id: 'reddit_research',
    playbook_id: 'reddit_market_research',
    tool_id: 'web_operator',
    detected: false,
    requires_approval: false,
    requires_user_login: true,
  },
  {
    capability_key: 'facebook_research',
    channel: 'Facebook',
    name: 'Facebook research',
    skill_id: 'facebook_research',
    playbook_id: 'facebook_group_research',
    tool_id: 'web_operator',
    detected: false,
    requires_approval: true,
    requires_user_login: true,
  },
  {
    capability_key: 'instagram_research',
    channel: 'Instagram',
    name: 'Instagram research',
    skill_id: 'instagram_research',
    playbook_id: 'instagram_market_research',
    tool_id: 'web_operator',
    detected: false,
    requires_approval: true,
    requires_user_login: true,
  },
  {
    capability_key: 'linkedin_research',
    channel: 'LinkedIn',
    name: 'LinkedIn company research',
    skill_id: 'linkedin_research',
    playbook_id: 'linkedin_company_research',
    tool_id: 'web_operator',
    detected: false,
    requires_approval: true,
    requires_user_login: true,
  },
  {
    capability_key: 'gmail_workflow',
    channel: 'Gmail',
    name: 'Gmail draft workflow',
    skill_id: 'gmail_workflow',
    playbook_id: 'gmail_prepare_draft',
    tool_id: 'web_operator',
    detected: false,
    requires_approval: true,
    requires_user_login: true,
  },
  {
    capability_key: 'canva_design',
    channel: 'Canva',
    name: 'Canva design draft',
    skill_id: 'canva_design',
    playbook_id: 'canva_instagram_draft',
    tool_id: 'web_operator',
    detected: false,
    requires_approval: true,
    requires_user_login: true,
  },
  {
    capability_key: 'google_maps_research',
    channel: 'Google Maps',
    name: 'Google Maps research',
    skill_id: 'google_maps_research',
    playbook_id: 'google_maps_business_research',
    tool_id: 'web_operator',
    detected: false,
    requires_approval: false,
    requires_user_login: false,
  },
  {
    capability_key: 'google_sheets_workflow',
    channel: 'Google Sheets',
    name: 'Google Sheets workflow',
    skill_id: 'google_sheets_workflow',
    playbook_id: 'google_sheets_update',
    tool_id: 'web_operator',
    detected: false,
    requires_approval: true,
    requires_user_login: true,
  },
  {
    capability_key: 'notion_workflow',
    channel: 'Notion',
    name: 'Notion workflow',
    skill_id: 'notion_workflow',
    playbook_id: 'notion_content_update',
    tool_id: 'web_operator',
    detected: false,
    requires_approval: true,
    requires_user_login: true,
  },
  {
    capability_key: 'meta_business_suite',
    channel: 'Meta Business Suite',
    name: 'Meta Business Suite workflow',
    skill_id: 'meta_business_suite',
    playbook_id: 'meta_business_content_review',
    tool_id: 'web_operator',
    detected: false,
    requires_approval: true,
    requires_user_login: true,
  },
  {
    capability_key: 'tiktok_research',
    channel: 'TikTok',
    name: 'TikTok research',
    skill_id: 'tiktok_research',
    playbook_id: 'tiktok_market_research',
    tool_id: 'web_operator',
    detected: false,
    requires_approval: true,
    requires_user_login: true,
  },
  {
    capability_key: 'youtube_research',
    channel: 'YouTube',
    name: 'YouTube research',
    skill_id: 'youtube_research',
    playbook_id: 'youtube_market_research',
    tool_id: 'web_operator',
    detected: false,
    requires_approval: true,
    requires_user_login: false,
  },
  {
    capability_key: 'site_publishing',
    channel: 'WordPress/Webflow',
    name: 'Website publishing workflow',
    skill_id: 'site_publishing',
    playbook_id: 'site_content_draft',
    tool_id: 'web_operator',
    detected: false,
    requires_approval: true,
    requires_user_login: true,
  },
]

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>()
  return items.filter(item => {
    const k = key(item)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

function normalizeJsonArray<T>(value: unknown): T[] {
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

function textHas(text: string, pattern: RegExp): boolean {
  return pattern.test(text.toLowerCase())
}

function detectDirectSites(text: string): RequiredCapability[] {
  const matches = text.match(/https?:\/\/[^\s"'<>]+|(?:[a-z0-9-]+\.)+[a-z]{2,}/gi) ?? []
  return matches
    .map(raw => raw.replace(/[),.!?;:]+$/, ''))
    .filter(site => !/facebook|instagram|linkedin|canva|gmail|google|reddit|whatsapp|youtube|tiktok|notion/i.test(site))
    .map(site => {
      const special = /\b(contact|message|submit|login|account|post|publish|upload|book|register)\b/i.test(text)
      return {
        capability_key: special ? `custom_site:${site}` : 'website_reader',
        channel: site,
        name: special ? `Custom workflow for ${site}` : `Read ${site}`,
        skill_id: special ? `custom_site_${site.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}` : 'website_reader',
        playbook_id: special ? `custom_site_${site.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_workflow` : 'general_site_research',
        tool_id: 'web_operator',
        detected: true,
        requires_approval: special,
        requires_user_login: special,
        special_workflow_required: special,
        source: site,
      } satisfies RequiredCapability
    })
}

export function analyzeRequiredCapabilities(strategyText: string): RequiredCapability[] {
  const text = strategyText.toLowerCase()
  const found: RequiredCapability[] = []

  const checks: Array<[RegExp, string]> = [
    [/\bwhatsapp(?:\s+web)?\b/, 'whatsapp_web'],
    [/\breddit\b/, 'reddit_research'],
    [/\bfacebook\b|\bfb\b/, 'facebook_research'],
    [/\binstagram\b/, 'instagram_research'],
    [/\blinkedin\b/, 'linkedin_research'],
    [/\bgmail\b|\bemail\b|\bmail\b/, 'gmail_workflow'],
    [/\bcanva\b/, 'canva_design'],
    [/\bgoogle\s+maps\b|\bmaps\.google\b/, 'google_maps_research'],
    [/\bgoogle\s+sheets\b|\bspreadsheet\b/, 'google_sheets_workflow'],
    [/\bnotion\b/, 'notion_workflow'],
    [/\bmeta\s+business\s+suite\b/, 'meta_business_suite'],
    [/\btiktok\b/, 'tiktok_research'],
    [/\byoutube\b/, 'youtube_research'],
    [/\bwordpress\b|\bwebflow\b/, 'site_publishing'],
  ]

  for (const [pattern, key] of checks) {
    if (textHas(text, pattern)) {
      const cap = CHANNELS.find(c => c.capability_key === key)
      if (cap) found.push({ ...cap, detected: true })
    }
  }

  if (/\bforums?\b|\bcommunity\b/.test(text) && !found.some(c => c.capability_key === 'reddit_research')) {
    found.push({
      capability_key: 'forum_research',
      channel: 'Forums',
      name: 'Public forum research',
      skill_id: 'general_web_research',
      playbook_id: 'general_site_research',
      tool_id: 'web_operator',
      detected: true,
      requires_approval: false,
      requires_user_login: false,
    })
  }

  if (/\bdirector(y|ies)\b|\blocal business directories\b|\bbusiness listings\b/.test(text)) {
    found.push({
      capability_key: 'directory_research',
      channel: 'Directory websites',
      name: 'Directory website research',
      skill_id: 'general_web_research',
      playbook_id: 'general_site_research',
      tool_id: 'web_operator',
      detected: true,
      requires_approval: false,
      requires_user_login: false,
    })
  }

  found.push(...detectDirectSites(strategyText))

  if (found.length === 0) {
    found.push({
      capability_key: 'general_site_research',
      channel: 'General web',
      name: 'General site research',
      skill_id: 'general_web_research',
      playbook_id: 'general_site_research',
      tool_id: 'web_operator',
      detected: true,
      requires_approval: false,
      requires_user_login: false,
    })
  }

  return uniqueBy(found, c => `${c.capability_key}:${c.source ?? ''}`)
}

function approvalGatesFor(capability: RequiredCapability): string[] {
  const lower = capability.channel.toLowerCase()
  if (lower.includes('whatsapp')) return ['send_message', 'attach_file', 'create_group', 'broadcast_message']
  if (lower.includes('facebook')) return ['join_group', 'post', 'comment', 'send_message']
  if (lower.includes('instagram')) return ['send_message', 'post_comment', 'follow_account', 'create_post']
  if (lower.includes('linkedin')) return ['send_connection_request', 'send_message', 'post']
  if (lower.includes('gmail') || lower.includes('email')) return ['send_email', 'send_gmail_draft']
  if (lower.includes('canva')) return ['download_final_asset', 'share_design', 'publish_design']
  if (lower.includes('reddit')) return ['post', 'comment', 'send_message', 'join_private_community']
  if (lower.includes('meta') || lower.includes('tiktok') || lower.includes('youtube')) return ['post', 'publish', 'comment', 'send_message']
  if (lower.includes('sheets') || lower.includes('notion') || lower.includes('wordpress') || lower.includes('webflow')) return ['publish', 'share', 'modify_external_record']
  return ['submit_form', 'create_account', 'send_message', 'publish']
}

function forbiddenActionsFor(capability: RequiredCapability): string[] {
  const lower = capability.channel.toLowerCase()
  const base = ['bypass_login', 'bypass_captcha', 'scrape_private_data', 'send_without_approval']
  if (lower.includes('whatsapp')) return [...base, 'mass_messaging', 'spam', 'scrape_contacts', 'bypass_qr_login']
  if (lower.includes('facebook')) return [...base, 'scrape_private_profiles', 'mass_message']
  if (lower.includes('linkedin')) return [...base, 'mass_automation', 'scrape_private_profiles']
  if (lower.includes('instagram')) return [...base, 'mass_messaging', 'scrape_private_profiles']
  if (lower.includes('reddit')) return [...base, 'vote_manipulation', 'spam', 'scrape_private_profiles']
  if (lower.includes('canva')) return [...base, 'publish_without_approval', 'use_unlicensed_assets_without_review']
  return base
}

function implementationPromptFor(capability: RequiredCapability): string {
  const gates = approvalGatesFor(capability)
  const forbidden = forbiddenActionsFor(capability)

  if (capability.skill_id === 'whatsapp_web') {
    return `Add a browser-only WhatsApp Web Operator Skill and Playbook.\n\nSkill: whatsapp_web\nAllowed:\n- open WhatsApp Web\n- wait for manual login/QR scan\n- search existing contact\n- prepare draft message\n- read visible reply snippets\n\nApproval required:\n- send_message\n- attach_file\n- create_group\n- broadcast_message\n\nForbidden:\n- mass messaging\n- spam\n- scraping contacts\n- bypass QR/login\n- sending without approval\n\nPlaybook: whatsapp_outreach\nSteps:\n- open WhatsApp Web\n- wait for QR/manual login\n- prepare message draft\n- preview recipient\n- request approval\n- send only after explicit resume/approval\n\nDo not add native WhatsApp APIs, do not bypass login or CAPTCHA/security, and do not send messages automatically.`
  }

  return `Add a browser-only Web Operator capability for ${capability.channel}.\n\nRequired skill: ${capability.skill_id}\nRequired playbook: ${capability.playbook_id}\n\nSafety rules:\n- manual login/security/CAPTCHA takeover only\n- no native platform APIs\n- no automatic posting, publishing, sending, joining, or messaging\n- public/visible data only\n\nApproval gates:\n${gates.map(g => `- ${g}`).join('\n')}\n\nForbidden actions:\n${forbidden.map(f => `- ${f}`).join('\n')}\n\nImplement the skill/playbook, tests, and UI metadata before AÏKO tries to execute this channel.`
}

function websitePatternFor(capability: RequiredCapability): string {
  const lower = capability.channel.toLowerCase()
  if (lower.includes('whatsapp')) return 'web.whatsapp.com'
  if (lower.includes('reddit')) return 'reddit.com'
  if (lower.includes('google maps')) return 'google.com/maps|maps.google.com'
  if (lower.includes('google sheets')) return 'docs.google.com/spreadsheets'
  if (lower.includes('notion')) return 'notion.so'
  if (lower.includes('meta')) return 'business.facebook.com|business.meta.com'
  if (lower.includes('tiktok')) return 'tiktok.com'
  if (lower.includes('youtube')) return 'youtube.com'
  if (lower.includes('wordpress')) return 'wordpress.com|wp-admin'
  if (lower.includes('webflow')) return 'webflow.com'
  return capability.source ?? '*'
}

function allowedActionsFor(capability: RequiredCapability): string[] {
  const lower = capability.channel.toLowerCase()
  if (lower.includes('whatsapp')) return ['open_whatsapp_web', 'open_url', 'wait_for_manual_login', 'search_existing_contact', 'prepare_draft_message', 'preview_recipient', 'read_visible_reply_snippets']
  if (lower.includes('reddit')) return ['open_url', 'search_subreddits', 'read_public_threads', 'collect_public_posts', 'summarize_findings']
  if (lower.includes('google maps')) return ['open_url', 'search_public_businesses', 'read_visible_business_results', 'collect_public_business_info', 'summarize_findings']
  if (lower.includes('sheets')) return ['open_url', 'read_visible_sheet_context', 'prepare_update_plan']
  if (lower.includes('notion')) return ['open_url', 'read_visible_page_context', 'prepare_page_draft']
  if (lower.includes('meta') || lower.includes('tiktok') || lower.includes('youtube')) return ['open_url', 'read_visible_public_content', 'prepare_content_draft', 'capture_preview']
  if (lower.includes('wordpress') || lower.includes('webflow')) return ['open_url', 'read_visible_admin_context', 'prepare_content_draft', 'capture_preview']
  return ['open_url', 'read_visible_public_content', 'prepare_draft', 'summarize_findings']
}

function outputTypesFor(capability: RequiredCapability): string[] {
  const lower = capability.channel.toLowerCase()
  if (lower.includes('whatsapp')) return ['message_draft', 'approval_item', 'conversation_summary']
  if (lower.includes('reddit')) return ['research_brief', 'pain_point_summary', 'source_list']
  if (lower.includes('sheets') || lower.includes('notion')) return ['draft_update', 'approval_item']
  return ['research_brief', 'draft', 'approval_item']
}

function skillSpecFor(capability: RequiredCapability): SkillImplementationSpec {
  return {
    skill_id: capability.skill_id,
    name: capability.name,
    website_pattern: websitePatternFor(capability),
    description: `${capability.channel} browser-only workflow. User login/security takeover is required when needed; risky actions require approval.`,
    allowed_actions: allowedActionsFor(capability),
    approval_required_actions: approvalGatesFor(capability),
    forbidden_actions: forbiddenActionsFor(capability),
    login_policy: capability.requires_user_login ? 'manual_login_or_qr_only_no_bypass' : 'manual_login_if_needed_no_bypass',
    output_types: outputTypesFor(capability),
  }
}

function playbookSpecFor(capability: RequiredCapability): PlaybookImplementationSpec {
  const lower = capability.channel.toLowerCase()
  if (lower.includes('whatsapp')) {
    return {
      playbook_id: capability.playbook_id,
      skill_id: capability.skill_id,
      name: 'WhatsApp Outreach',
      description: 'Open WhatsApp Web directly, pause for QR/manual login, prepare a draft message, and request approval before sending.',
      trigger_patterns: ['whatsapp', 'whatsapp web', 'outreach', 'draft message'],
      steps: ['open_whatsapp_web', 'wait_for_qr_or_manual_login_if_needed', 'search_existing_contact', 'prepare_message_draft', 'preview_recipient_and_message', 'request_send_approval', 'send_only_after_approval_and_resume'],
      approval_gates: approvalGatesFor(capability),
      forbidden_steps: ['mass_messaging', 'broadcast_without_approval', 'scrape_contacts', 'bypass_qr_or_login', 'send_without_approval'],
      output_schema: { type: 'object', properties: { recipient: { type: 'string' }, draft_message: { type: 'string' }, approval_item_id: { type: 'string' }, limitations: { type: 'string' } } },
    }
  }
  return {
    playbook_id: capability.playbook_id,
    skill_id: capability.skill_id,
    name: capability.name,
    description: `Safe ${capability.channel} browser workflow with manual takeover and approval gates.`,
    trigger_patterns: [capability.channel.toLowerCase(), capability.skill_id.replace(/_/g, ' ')],
    steps: ['open_site_directly', 'wait_for_manual_login_if_needed', 'read_visible_public_context', 'prepare_safe_draft_or_summary', 'request_approval_before_risky_action'],
    approval_gates: approvalGatesFor(capability),
    forbidden_steps: forbiddenActionsFor(capability),
    output_schema: { type: 'object', properties: { summary: { type: 'string' }, sources: { type: 'array' }, limitations: { type: 'string' } } },
  }
}

function testPlanFor(capability: RequiredCapability): string[] {
  return [
    `${capability.channel} strategy maps to ${capability.skill_id}.`,
    `${capability.channel} strategy maps to ${capability.playbook_id}.`,
    `Approval-required actions include ${approvalGatesFor(capability).join(', ')}.`,
    `Forbidden actions include ${forbiddenActionsFor(capability).slice(0, 4).join(', ')}.`,
    'Login/CAPTCHA/security checkpoints set waiting_user and never claim bypass.',
    'Risky send/post/message/publish actions create approval items and do not execute silently.',
  ]
}

function runtimePlanFor(capability: RequiredCapability): string[] {
  const openTarget = capability.skill_id === 'whatsapp_web' ? 'https://web.whatsapp.com/' : capability.channel
  return [
    'Run WEB_OPERATOR_HEADLESS=false AIKO_AUTH_MODE=optional PORT=3001 npm run dev.',
    `Ask CEO for a ${capability.channel} strategy and confirm the skill/playbook are selected.`,
    `Confirm the operator opens ${openTarget} directly only after the approved implementation path is invoked.`,
    'Confirm QR/login/CAPTCHA/security pauses for manual takeover.',
    'Confirm approval is required before any send/post/message/publish/join/attach action.',
    'Confirm no fake success is reported when login/security blocks the workflow.',
  ]
}

function missingFor(capability: RequiredCapability, kind: MissingCapability['capability_type']): MissingCapability {
  const capabilityLabel = capability.channel.endsWith(' Web')
    ? `${capability.channel} Operator`
    : `${capability.channel} Web Operator`
  const skillSpec = skillSpecFor(capability)
  const playbookSpec = playbookSpecFor(capability)
  return {
    capability_key: `${kind}:${kind === 'web_operator_skill' ? capability.skill_id : capability.playbook_id}`,
    capability_type: kind,
    channel: capability.channel,
    name: kind === 'web_operator_skill'
      ? `Add ${capabilityLabel} Skill`
      : `Add ${capabilityLabel} Playbook`,
    required_skill: capability.skill_id,
    required_playbook: capability.playbook_id,
    reason: `${capability.channel} strategy requires ${kind === 'web_operator_skill' ? 'a governed browser skill' : 'a safe step-by-step playbook'} before task execution.`,
    safety_rules: ['manual_login_only', 'no_captcha_bypass', 'approval_center_for_risky_actions', 'internal_planning_only_until_approved'],
    approval_gates: approvalGatesFor(capability),
    forbidden_actions: forbiddenActionsFor(capability),
    implementation_prompt: implementationPromptFor(capability),
    skill_spec: skillSpec,
    playbook_spec: playbookSpec,
    database_changes: ['Add or seed web_operator_skills entry.', 'Add or seed web_operator_playbooks entry.', 'Use existing web_operator_actions approval metadata; add columns only if the current schema cannot store skill/playbook metadata.'],
    api_routes: ['Expose capability through existing /api/web-operator/skills and /api/web-operator/playbooks responses.', 'Use existing Web Operator delegation/resume routes; add no native platform API routes.'],
    ui_changes: ['Show the skill on /operator-skills.', 'Show the playbook on /operator-playbooks.', 'Ensure /operators/[id] shows waiting_user, approval gates, current URL, and playbook steps.'],
    test_plan: testPlanFor(capability),
    runtime_validation_plan: runtimePlanFor(capability),
  }
}

export async function matchRequiredSkillsAndPlaybooks(
  requiredCapabilities: RequiredCapability[]
): Promise<CapabilityMatchResult> {
  const required_skills: RequiredSkill[] = []
  const required_playbooks: RequiredPlaybook[] = []
  const missing_capabilities: MissingCapability[] = []
  const required_tools: Array<Record<string, unknown>> = []

  for (const cap of requiredCapabilities) {
    const skill = await getSkillById(cap.skill_id)
    const playbook = await getPlaybookById(cap.playbook_id)

    const skillAvailable = Boolean(skill?.status === 'active')
    const playbookAvailable = Boolean(playbook?.status === 'active')

    required_skills.push({
      skill_id: cap.skill_id,
      name: skill?.name ?? cap.name,
      available: skillAvailable,
      reason: skillAvailable ? 'Available Web Operator skill' : `Missing skill for ${cap.channel}`,
    })
    required_playbooks.push({
      playbook_id: cap.playbook_id,
      name: playbook?.name ?? cap.name,
      skill_id: cap.skill_id,
      available: playbookAvailable,
      reason: playbookAvailable ? 'Available Web Operator playbook' : `Missing playbook for ${cap.channel}`,
    })
    required_tools.push({
      tool_id: cap.tool_id ?? 'web_operator',
      channel: cap.channel,
      internal_planning_only: true,
    })

    if (!skillAvailable) missing_capabilities.push(missingFor(cap, 'web_operator_skill'))
    if (!playbookAvailable) missing_capabilities.push(missingFor(cap, 'web_operator_playbook'))
  }

  return {
    required_skills: uniqueBy(required_skills, s => s.skill_id),
    required_playbooks: uniqueBy(required_playbooks, p => p.playbook_id),
    required_tools: uniqueBy(required_tools, t => String(t.tool_id) + String(t.channel)),
    missing_capabilities: uniqueBy(missing_capabilities, m => m.capability_key),
  }
}

function recommendedChannel(capabilities: RequiredCapability[]): string {
  return capabilities.map(c => c.channel).join(', ') || 'General web'
}

function summarizeStrategy(text: string, brief?: ProjectStrategyBrief | null): string {
  const parts = [
    brief?.value_proposition,
    brief?.research_prompt,
    text,
  ].filter(Boolean).join(' ')
  return parts.trim().slice(0, 1000)
}

function buildAgents(capabilities: RequiredCapability[]): Array<Record<string, unknown>> {
  const agents = [
    {
      role: 'project_manager',
      name: 'Project Manager',
      responsibility: 'Coordinate strategy execution tasks and blockers.',
    },
    {
      role: 'marketing_agent',
      name: 'Marketing Strategy Agent',
      responsibility: 'Define campaign strategy and channel plan.',
    },
    {
      role: 'copywriting_agent',
      name: 'Copywriting Agent',
      responsibility: 'Prepare draft copy for approval.',
    },
  ]
  if (capabilities.some(c => c.tool_id === 'web_operator')) {
    agents.push({
      role: 'web_operator',
      name: 'Web Operator',
      responsibility: 'Use browser-only workflows after approvals and manual takeover gates.',
    })
  }
  return agents
}

function buildExecutionSteps(
  capabilities: RequiredCapability[],
  matches: CapabilityMatchResult
): ExecutionStep[] {
  const missingKeys = new Set(matches.missing_capabilities.map(m => `${m.required_skill}:${m.required_playbook}`))
  const steps: ExecutionStep[] = [
    {
      step_id: 'define_offer',
      owner_role: 'marketing_agent',
      description: 'Define the campaign offer, audience, and success criteria.',
      requires_approval: false,
    },
    {
      step_id: 'prepare_campaign_draft',
      owner_role: 'copywriting_agent',
      description: 'Prepare campaign copy and visible research brief for review.',
      requires_approval: true,
    },
  ]

  for (const cap of capabilities) {
    steps.push({
      step_id: `prepare_${cap.skill_id}`,
      owner_role: cap.requires_approval ? 'copywriting_agent' : 'research_agent',
      description: `Prepare ${cap.channel} strategy inputs and draft materials internally.`,
      skill_id: cap.skill_id,
      playbook_id: cap.playbook_id,
      requires_user_login: cap.requires_user_login,
      requires_approval: cap.requires_approval,
      missing_capability: missingKeys.has(`${cap.skill_id}:${cap.playbook_id}`),
    })
    steps.push({
      step_id: `review_${cap.playbook_id}`,
      owner_role: 'project_manager',
      description: `Review ${cap.channel} capability gates before any external execution.`,
      skill_id: cap.skill_id,
      playbook_id: cap.playbook_id,
      requires_user_login: cap.requires_user_login,
      requires_approval: cap.requires_approval,
      missing_capability: missingKeys.has(`${cap.skill_id}:${cap.playbook_id}`),
    })
  }

  return uniqueBy(steps, s => s.step_id)
}

function buildApprovalGates(capabilities: RequiredCapability[]): Array<Record<string, unknown>> {
  return uniqueBy(capabilities.flatMap(cap => approvalGatesFor(cap).map(action => ({
    action,
    channel: cap.channel,
    skill_id: cap.skill_id,
    reason: `${cap.channel} ${action.replace(/_/g, ' ')} requires explicit approval before execution.`,
  }))), gate => `${gate.channel}:${gate.action}`)
}

async function ensureMarketingStrategyAgent(projectId: string): Promise<CustomAgent | null> {
  try {
    const existing = (await listCustomAgents({ project_id: projectId, limit: 100 }))
      .find(a => a.metadata?.role === 'marketing_agent' || /marketing strategy/i.test(a.name))
    if (existing) return existing
    return createCustomAgent({
      name: 'Marketing Strategy Agent',
      description: 'Defines campaign strategy and channel execution plans.',
      purpose: 'Create project-specific marketing strategy recommendations and delegate external work through governed plans.',
      capabilities: ['campaign_strategy', 'channel_planning', 'capability_gap_detection'],
      project_id: projectId,
      created_by_role: 'Strategy Execution Planner',
      metadata: { role: 'marketing_agent', source: 'strategy_execution_planner' },
    })
  } catch {
    return null
  }
}

function rowToPlan(row: Record<string, unknown>): StrategyExecutionPlan {
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    strategy_brief_id: row.strategy_brief_id ? String(row.strategy_brief_id) : null,
    campaign_id: row.campaign_id ? String(row.campaign_id) : null,
    title: String(row.title ?? ''),
    objective: String(row.objective ?? ''),
    recommended_channel: String(row.recommended_channel ?? ''),
    target_audience: String(row.target_audience ?? ''),
    strategy_summary: String(row.strategy_summary ?? ''),
    required_agents: normalizeJsonArray(row.required_agents),
    required_skills: normalizeJsonArray<RequiredSkill>(row.required_skills),
    required_playbooks: normalizeJsonArray<RequiredPlaybook>(row.required_playbooks),
    required_tools: normalizeJsonArray(row.required_tools),
    execution_steps: normalizeJsonArray<ExecutionStep>(row.execution_steps),
    approval_gates: normalizeJsonArray(row.approval_gates),
    missing_capabilities: normalizeJsonArray<MissingCapability>(row.missing_capabilities),
    system_improvement_ids: normalizeJsonArray<string>(row.system_improvement_ids),
    status: String(row.status ?? 'draft') as StrategyExecutionPlanStatus,
    created_by_role: String(row.created_by_role ?? 'CEO'),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

async function insertPlan(params: {
  projectId: string
  strategyText: string
  brief?: ProjectStrategyBrief | null
  campaignId?: string | null
  createdByRole?: string
  createMissingCapabilityProposals?: boolean
}): Promise<{ plan: StrategyExecutionPlan; proposals: SystemImprovementProposal[] }> {
  await ensureMarketingStrategyAgent(params.projectId)

  const capabilities = analyzeRequiredCapabilities(params.strategyText)
  const matches = await matchRequiredSkillsAndPlaybooks(capabilities)
  const proposals = params.createMissingCapabilityProposals === false
    ? []
    : await createMissingCapabilityProposals(params.projectId, matches.missing_capabilities, params.strategyText)

  const systemImprovementIds = proposals.map(p => p.id)
  const status: StrategyExecutionPlanStatus = matches.missing_capabilities.length > 0
    ? 'needs_capabilities'
    : 'ready_for_tasks'
  const title = `Execution Plan: ${recommendedChannel(capabilities)}`

  const res = await db.query(
    `INSERT INTO project_strategy_execution_plans
       (project_id, strategy_brief_id, campaign_id, title, objective, recommended_channel,
        target_audience, strategy_summary, required_agents, required_skills, required_playbooks,
        required_tools, execution_steps, approval_gates, missing_capabilities,
        system_improvement_ids, status, created_by_role)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     RETURNING *`,
    [
      params.projectId,
      params.brief?.id ?? null,
      params.campaignId ?? null,
      title,
      params.brief?.objective ?? params.strategyText.slice(0, 240),
      recommendedChannel(capabilities),
      params.brief?.target_audience ?? '',
      summarizeStrategy(params.strategyText, params.brief),
      JSON.stringify(buildAgents(capabilities)),
      JSON.stringify(matches.required_skills),
      JSON.stringify(matches.required_playbooks),
      JSON.stringify(matches.required_tools),
      JSON.stringify(buildExecutionSteps(capabilities, matches)),
      JSON.stringify(buildApprovalGates(capabilities)),
      JSON.stringify(matches.missing_capabilities),
      JSON.stringify(systemImprovementIds),
      status,
      params.createdByRole ?? 'CEO',
    ]
  )

  return { plan: rowToPlan(res.rows[0]), proposals }
}

export async function generateStrategyExecutionPlan(projectId: string): Promise<StrategyExecutionPlan> {
  const brief = await getProjectStrategyBrief(projectId)
  const projectRes = await db.query(`SELECT name, description, target_market, value_prop FROM projects WHERE id=$1`, [projectId])
  const project = projectRes.rows[0] ?? {}
  const strategyText = [
    brief?.recommended_channel,
    brief?.objective,
    brief?.target_audience,
    brief?.research_prompt,
    brief?.value_proposition,
    project.name,
    project.description,
    project.target_market,
    project.value_prop,
  ].filter(Boolean).join('\n')
  const { plan } = await insertPlan({ projectId, strategyText: strategyText || 'Create a general campaign execution plan.', brief })
  return plan
}

export async function generateStrategyExecutionPlanFromBrief(
  projectId: string,
  strategyBriefId: string
): Promise<StrategyExecutionPlan> {
  const res = await db.query(
    `SELECT * FROM project_strategy_briefs WHERE id=$1 AND project_id=$2 LIMIT 1`,
    [strategyBriefId, projectId]
  )
  const brief = res.rows[0] ? {
    ...res.rows[0],
    risks: normalizeJsonArray<string>(res.rows[0].risks),
    assumptions: normalizeJsonArray<string>(res.rows[0].assumptions),
    next_actions: normalizeJsonArray<string>(res.rows[0].next_actions),
  } as ProjectStrategyBrief : await getProjectStrategyBrief(projectId)
  const strategyText = [
    brief?.recommended_channel,
    brief?.objective,
    brief?.target_audience,
    brief?.research_prompt,
    brief?.value_proposition,
  ].filter(Boolean).join('\n')
  const { plan } = await insertPlan({ projectId, strategyText, brief })
  return plan
}

export async function generateStrategyExecutionPlanFromText(params: {
  projectId: string
  strategyText: string
  strategyBriefId?: string | null
  campaignId?: string | null
  createdByRole?: string
  createMissingCapabilityProposals?: boolean
}): Promise<{ plan: StrategyExecutionPlan; proposals: SystemImprovementProposal[] }> {
  let brief: ProjectStrategyBrief | null = null
  if (params.strategyBriefId) {
    const res = await db.query(
      `SELECT * FROM project_strategy_briefs WHERE id=$1 AND project_id=$2 LIMIT 1`,
      [params.strategyBriefId, params.projectId]
    )
    brief = res.rows[0] ? rowToBriefLike(res.rows[0]) : null
  }
  if (!brief) brief = await getProjectStrategyBrief(params.projectId)
  return insertPlan({
    projectId: params.projectId,
    strategyText: params.strategyText,
    brief,
    campaignId: params.campaignId,
    createdByRole: params.createdByRole,
    createMissingCapabilityProposals: params.createMissingCapabilityProposals,
  })
}

function rowToBriefLike(row: Record<string, unknown>): ProjectStrategyBrief {
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    title: String(row.title ?? ''),
    objective: String(row.objective ?? ''),
    target_audience: String(row.target_audience ?? ''),
    research_prompt: String(row.research_prompt ?? ''),
    recommended_channel: String(row.recommended_channel ?? ''),
    value_proposition: String(row.value_proposition ?? ''),
    risks: normalizeJsonArray<string>(row.risks),
    assumptions: normalizeJsonArray<string>(row.assumptions),
    next_actions: normalizeJsonArray<string>(row.next_actions),
    created_by_role: String(row.created_by_role ?? 'CEO'),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    recommended_operator_id: row.recommended_operator_id ? String(row.recommended_operator_id) : null,
    recommended_operator_name: row.recommended_operator_name ? String(row.recommended_operator_name) : null,
    operator_reason: row.operator_reason ? String(row.operator_reason) : null,
  }
}

export async function createMissingCapabilityProposals(
  projectId: string,
  missingCapabilities: MissingCapability[],
  strategyText = ''
): Promise<SystemImprovementProposal[]> {
  const grouped = uniqueBy(missingCapabilities, m => `${m.required_skill}:${m.required_playbook}`)
  const proposals: SystemImprovementProposal[] = []

  for (const missing of grouped) {
    const title = missing.required_skill === 'whatsapp_web'
      ? 'Add WhatsApp Web Operator Skill and Playbook'
      : `${missing.name}`
    const implementationSpec: CapabilityImplementationSpec = {
      missing_capability_id: missing.capability_key,
      capability_name: title,
      platform: missing.channel,
      why_needed: missing.reason,
      skill_spec: missing.skill_spec ?? {
        skill_id: missing.required_skill,
        name: title,
        website_pattern: '*',
        description: missing.reason,
        allowed_actions: ['open_url', 'read_visible_page', 'prepare_draft'],
        approval_required_actions: missing.approval_gates,
        forbidden_actions: missing.forbidden_actions,
        login_policy: 'manual_login_only_no_bypass',
        output_types: ['research_brief', 'draft', 'approval_item'],
      },
      playbook_spec: missing.playbook_spec ?? {
        playbook_id: missing.required_playbook,
        skill_id: missing.required_skill,
        name: title,
        description: missing.reason,
        trigger_patterns: [missing.channel.toLowerCase()],
        steps: ['open_site_directly', 'wait_for_manual_login_if_needed', 'prepare_draft', 'request_approval'],
        approval_gates: missing.approval_gates,
        forbidden_steps: missing.forbidden_actions,
        output_schema: { type: 'object', properties: { summary: { type: 'string' } } },
      },
      safety_rules: missing.safety_rules,
      database_changes: missing.database_changes ?? [],
      api_routes: missing.api_routes ?? [],
      ui_changes: missing.ui_changes ?? [],
      test_plan: missing.test_plan ?? [],
      runtime_validation_plan: missing.runtime_validation_plan ?? [],
    }
    const generatedPrompt = generateCapabilityImplementationPrompt(implementationSpec)
    const existing = await findReusableSystemImprovementProposal({
      related_project_id: projectId,
      missing_capability: missing.capability_key,
      title,
    })
    if (existing) {
      const refreshed = await attachImplementationPromptToProposal(existing.id, generatedPrompt)
      proposals.push(refreshed ?? existing)
      continue
    }

    const proposal = await createSystemImprovementProposal({
      title,
      summary: `${missing.channel} needs a governed Web Operator skill/playbook before this strategy can be executed.`,
      reason: missing.reason,
      requested_by_role: 'Strategy Execution Planner',
      related_project_id: projectId,
      related_strategy: strategyText.slice(0, 500),
      missing_capabilities: [missing.capability_key],
      proposed_changes: [{
        capability_key: missing.capability_key,
        capability_name: title,
        change_type: 'add',
        description: `Add ${missing.required_skill} and ${missing.required_playbook} with approval gates and forbidden actions.`,
        estimated_complexity: 'moderate',
      }],
      risk_level: 'medium',
      status: 'draft',
      implementation_prompt: generatedPrompt.implementation_prompt,
      proposal_metadata: generatedPrompt as unknown as Record<string, unknown>,
    })
    proposals.push(proposal)
  }

  return proposals
}

export async function createExecutionTasksFromPlan(planId: string): Promise<{
  plan: StrategyExecutionPlan
  tasks: AgentTask[]
}> {
  const res = await db.query(`SELECT * FROM project_strategy_execution_plans WHERE id=$1 LIMIT 1`, [planId])
  if (!res.rows[0]) throw new Error('Strategy execution plan not found')
  const plan = rowToPlan(res.rows[0])
  const tasks: AgentTask[] = []

  for (const step of plan.execution_steps) {
    const status = step.missing_capability ? 'blocked' : 'planned'
    const task = await createAgentTask({
      project_id: plan.project_id,
      owner_role: step.owner_role,
      assigned_by_role: 'Strategy Execution Planner',
      title: step.description,
      description: JSON.stringify({
        plan_id: plan.id,
        step_id: step.step_id,
        recommended_channel: plan.recommended_channel,
        skill_id: step.skill_id ?? null,
        playbook_id: step.playbook_id ?? null,
        requires_user_login: Boolean(step.requires_user_login),
        requires_approval: Boolean(step.requires_approval),
        internal_only: true,
      }),
      status,
      priority: step.requires_approval ? 'high' : 'normal',
      task_type: step.owner_role === 'web_operator' ? 'outreach_preparation' : 'strategy',
    })
    tasks.push(task)
  }

  const nextStatus: StrategyExecutionPlanStatus = plan.missing_capabilities.length > 0 ? 'needs_capabilities' : 'active'
  const updated = await updateStrategyExecutionPlanStatus(planId, nextStatus)
  return { plan: updated ?? plan, tasks }
}

export async function getLatestStrategyExecutionPlan(projectId: string): Promise<StrategyExecutionPlan | null> {
  const res = await db.query(
    `SELECT * FROM project_strategy_execution_plans WHERE project_id=$1 ORDER BY created_at DESC LIMIT 1`,
    [projectId]
  )
  return res.rows[0] ? rowToPlan(res.rows[0]) : null
}

export async function listStrategyExecutionPlans(projectId: string): Promise<StrategyExecutionPlan[]> {
  const res = await db.query(
    `SELECT * FROM project_strategy_execution_plans WHERE project_id=$1 ORDER BY created_at DESC LIMIT 50`,
    [projectId]
  )
  return res.rows.map(rowToPlan)
}

export async function updateStrategyExecutionPlanStatus(
  planId: string,
  status: StrategyExecutionPlanStatus
): Promise<StrategyExecutionPlan | null> {
  const res = await db.query(
    `UPDATE project_strategy_execution_plans SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
    [status, planId]
  )
  return res.rows[0] ? rowToPlan(res.rows[0]) : null
}

export async function findLatestStrategyExecutionPlanByHint(hint: string): Promise<StrategyExecutionPlan | null> {
  const needle = `%${hint}%`
  const res = await db.query(
    `SELECT * FROM project_strategy_execution_plans
     WHERE lower(recommended_channel) LIKE lower($1)
        OR lower(strategy_summary) LIKE lower($1)
        OR lower(title) LIKE lower($1)
     ORDER BY created_at DESC
     LIMIT 1`,
    [needle]
  )
  return res.rows[0] ? rowToPlan(res.rows[0]) : null
}
