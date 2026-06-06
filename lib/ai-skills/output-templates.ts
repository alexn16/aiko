export type AISkillOutputTemplate = {
  skillId: string
  name: string
  fields: string[]
  markdownInstructions: string[]
  taskHintFields: string[]
}

const templates: Record<string, AISkillOutputTemplate> = {
  create_7_day_plan: {
    skillId: 'create_7_day_plan',
    name: '7-Day Plan',
    fields: [
      'objective',
      'assumptions',
      'day_by_day_plan',
      'owner_roles',
      'deliverables',
      'success_metrics',
      'risks',
      'needs_web_research',
      'next_actions',
    ],
    markdownInstructions: [
      'Objective: one concrete outcome for the next 7 days.',
      'Assumptions: bullets marked as assumptions, not facts.',
      'Day-by-day plan: Day 1 through Day 7, each with action, owner_role, deliverable, and success_metric.',
      'Owner roles: assign CEO, marketing_agent, copywriting_agent, web_operator, or owner where appropriate.',
      'Deliverables: list concrete outputs.',
      'Success metrics: list measurable checks.',
      'Risks: list risk and mitigation.',
      'Next actions: 3-5 immediate internal actions.',
    ],
    taskHintFields: ['day_by_day_plan', 'next_actions'],
  },
  create_customer_persona: {
    skillId: 'create_customer_persona',
    name: 'Customer Persona',
    fields: [
      'persona_name',
      'segment',
      'pains',
      'goals',
      'triggers',
      'objections',
      'channels',
      'messaging_angles',
      'assumptions',
      'needs_web_research',
      'next_actions',
    ],
    markdownInstructions: [
      'Persona name and segment: make the persona specific.',
      'Pains, goals, triggers, objections, channels, and messaging angles: use bullets.',
      'Assumptions: clearly mark unverified assumptions.',
      'Next actions: include how to validate the persona.',
    ],
    taskHintFields: ['next_actions'],
  },
  create_campaign_brief: {
    skillId: 'create_campaign_brief',
    name: 'Campaign Brief',
    fields: [
      'campaign_name',
      'objective',
      'audience',
      'offer',
      'key_message',
      'channels',
      'content_assets',
      'approval_gates',
      'metrics',
      'next_actions',
    ],
    markdownInstructions: [
      'Campaign name: short and practical.',
      'Objective, audience, offer, key message, channels, content assets, approval gates, metrics, and next actions.',
      'Approval gates must include any sending, posting, messaging, publishing, sharing, or downloading.',
    ],
    taskHintFields: ['content_assets', 'next_actions'],
  },
  analyze_risks: {
    skillId: 'analyze_risks',
    name: 'Risk Analysis',
    fields: [
      'risks',
      'needs_web_research',
      'next_actions',
    ],
    markdownInstructions: [
      'Risks: each risk must include risk, likelihood, impact, mitigation, owner_role, and next_action.',
      'Next actions: list the most important mitigations to start now.',
    ],
    taskHintFields: ['risks', 'next_actions'],
  },
  recommend_next_step: {
    skillId: 'recommend_next_step',
    name: 'Next Step Recommendation',
    fields: [
      'current_status',
      'best_next_step',
      'why',
      'owner',
      'expected_output',
      'requires_web_operator',
      'requires_approval',
      'next_actions',
    ],
    markdownInstructions: [
      'Current status: summarize from project context.',
      'Best next step: one clear action.',
      'Why: concise rationale.',
      'Owner, expected output, requires_web_operator, and requires_approval: make each explicit.',
      'Next actions: include 2-4 supporting steps.',
    ],
    taskHintFields: ['best_next_step', 'next_actions'],
  },
  create_marketing_strategy: {
    skillId: 'create_marketing_strategy',
    name: 'Marketing Strategy',
    fields: [
      'positioning',
      'target_audience',
      'channels',
      'funnel',
      'content_strategy',
      'outreach_strategy',
      'metrics',
      'missing_capabilities',
      'needs_web_research',
      'next_actions',
    ],
    markdownInstructions: [
      'Positioning, target audience, channels, funnel, content strategy, outreach strategy, metrics, missing capabilities, and next actions.',
      'Mention Web Operator research only for fresh external facts or website work.',
    ],
    taskHintFields: ['content_strategy', 'outreach_strategy', 'next_actions'],
  },
}

export function getAISkillOutputTemplate(skillId: string): AISkillOutputTemplate | null {
  return templates[skillId] ?? null
}

export function templatePrompt(skillId: string): string {
  const template = getAISkillOutputTemplate(skillId)
  if (!template) {
    return [
      'Use the shared output sections.',
      'Be specific, concise, and actionable.',
      'Mark assumptions clearly.',
    ].join('\n')
  }

  return [
    `Use the ${template.name} template.`,
    `Required structured fields: ${template.fields.join(', ')}.`,
    'Write concise Markdown for the owner first, using the important template fields as visible headings.',
    'Do not skip required template fields. If a field is based on an assumption, label it as an assumption.',
    'Then include a final fenced JSON block named STRUCTURED_OUTPUT with the same fields.',
    'The JSON is for AÏKO UI parsing; do not include secrets, provider details, hidden reasoning, or external claims.',
    ...template.markdownInstructions,
  ].join('\n')
}

export function knownTemplateFieldText(): string {
  return Object.values(templates)
    .map(template => `${template.skillId}: ${template.fields.join(', ')}`)
    .join('\n')
}
