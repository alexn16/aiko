import { db } from '@/lib/db/client'
import { createGeneratedFile, type GeneratedFile } from '@/lib/generated-files'

export type AISkill = {
  id?: string
  skill_id: string
  name: string
  category: string
  description: string
  input_schema: Record<string, unknown>
  output_schema: Record<string, unknown>
  safety_level: string
  enabled: boolean
  created_at?: string
  updated_at?: string
}

export type AISkillOutput = {
  skill_id: string
  title: string
  content?: string
  format: string
  suggested_next_actions: string[]
  warning?: string
  saved_file_id?: string
  summary?: string
  sections?: Array<{ title: string; content: string }>
  recommendations?: string[]
  next_actions?: string[]
  needs_web_research?: boolean
  web_research_questions?: string[]
  structured_data?: Record<string, unknown>
  tasks_created?: number
}

export const BUILT_IN_AI_SKILLS: AISkill[] = [
  {
    skill_id: 'write_linkedin_post',
    name: 'Write LinkedIn Post',
    category: 'content',
    description: 'Draft a professional LinkedIn post for a project, product, or campaign.',
    input_schema: { type: 'object', required: ['prompt'] },
    output_schema: { type: 'object', properties: { title: { type: 'string' }, content: { type: 'string' }, format: { type: 'string' } } },
    safety_level: 'internal_draft_only',
    enabled: true,
  },
  {
    skill_id: 'write_x_post',
    name: 'Write X/Twitter Post',
    category: 'content',
    description: 'Draft a short X/Twitter post or thread.',
    input_schema: { type: 'object', required: ['prompt'] },
    output_schema: { type: 'object' },
    safety_level: 'internal_draft_only',
    enabled: true,
  },
  {
    skill_id: 'write_reddit_post',
    name: 'Write Reddit Post',
    category: 'content',
    description: 'Draft a Reddit-style post that is useful and non-spammy.',
    input_schema: { type: 'object', required: ['prompt'] },
    output_schema: { type: 'object' },
    safety_level: 'internal_draft_only',
    enabled: true,
  },
  {
    skill_id: 'write_email',
    name: 'Write Email',
    category: 'content',
    description: 'Draft an email without sending it.',
    input_schema: { type: 'object', required: ['prompt'] },
    output_schema: { type: 'object' },
    safety_level: 'internal_draft_only',
    enabled: true,
  },
  {
    skill_id: 'improve_email',
    name: 'Improve Email',
    category: 'content',
    description: 'Improve pasted email copy for clarity, tone, and conversion.',
    input_schema: { type: 'object', required: ['prompt'] },
    output_schema: { type: 'object' },
    safety_level: 'internal_draft_only',
    enabled: true,
  },
  {
    skill_id: 'write_blog_outline',
    name: 'Write Blog Outline',
    category: 'content',
    description: 'Create a blog article outline from a strategy or brief.',
    input_schema: { type: 'object', required: ['prompt'] },
    output_schema: { type: 'object' },
    safety_level: 'internal_draft_only',
    enabled: true,
  },
  {
    skill_id: 'write_landing_page_copy',
    name: 'Write Landing Page Copy',
    category: 'content',
    description: 'Draft landing page hero, value proposition, or section copy.',
    input_schema: { type: 'object', required: ['prompt'] },
    output_schema: { type: 'object' },
    safety_level: 'internal_draft_only',
    enabled: true,
  },
  {
    skill_id: 'create_content_ideas',
    name: 'Create Content Ideas',
    category: 'content',
    description: 'Generate concise campaign or social content ideas.',
    input_schema: { type: 'object', required: ['prompt'] },
    output_schema: { type: 'object' },
    safety_level: 'internal_draft_only',
    enabled: true,
  },
  {
    skill_id: 'summarize_text',
    name: 'Summarize Text',
    category: 'content',
    description: 'Summarize pasted or provided text.',
    input_schema: { type: 'object', required: ['prompt'] },
    output_schema: { type: 'object' },
    safety_level: 'internal_draft_only',
    enabled: true,
  },
  {
    skill_id: 'rewrite_text',
    name: 'Rewrite Text',
    category: 'content',
    description: 'Rewrite text for clarity, tone, brevity, or style.',
    input_schema: { type: 'object', required: ['prompt'] },
    output_schema: { type: 'object' },
    safety_level: 'internal_draft_only',
    enabled: true,
  },
  {
    skill_id: 'create_marketing_strategy',
    name: 'Create Marketing Strategy',
    category: 'research_strategy',
    description: 'Create a marketing strategy from project context and user-provided information.',
    input_schema: { type: 'object', required: ['prompt'] },
    output_schema: { type: 'object' },
    safety_level: 'internal_planning_only',
    enabled: true,
  },
  {
    skill_id: 'create_7_day_plan',
    name: 'Create 7-Day Plan',
    category: 'research_strategy',
    description: 'Turn project context into a practical seven-day marketing work plan.',
    input_schema: { type: 'object', required: ['prompt'] },
    output_schema: { type: 'object' },
    safety_level: 'internal_planning_only',
    enabled: true,
  },
  {
    skill_id: 'create_customer_persona',
    name: 'Create Customer Persona',
    category: 'research_strategy',
    description: 'Create a customer persona from project context or supplied notes.',
    input_schema: { type: 'object', required: ['prompt'] },
    output_schema: { type: 'object' },
    safety_level: 'internal_planning_only',
    enabled: true,
  },
  {
    skill_id: 'create_competitor_research_plan',
    name: 'Create Competitor Research Plan',
    category: 'research_strategy',
    description: 'Create a competitor research framework and browser research questions.',
    input_schema: { type: 'object', required: ['prompt'] },
    output_schema: { type: 'object' },
    safety_level: 'internal_planning_only',
    enabled: true,
  },
  {
    skill_id: 'create_market_research_brief',
    name: 'Create Market Research Brief',
    category: 'research_strategy',
    description: 'Create a market research brief from existing context and assumptions.',
    input_schema: { type: 'object', required: ['prompt'] },
    output_schema: { type: 'object' },
    safety_level: 'internal_planning_only',
    enabled: true,
  },
  {
    skill_id: 'create_positioning_statement',
    name: 'Create Positioning Statement',
    category: 'research_strategy',
    description: 'Create clear positioning and messaging from project context.',
    input_schema: { type: 'object', required: ['prompt'] },
    output_schema: { type: 'object' },
    safety_level: 'internal_planning_only',
    enabled: true,
  },
  {
    skill_id: 'create_offer',
    name: 'Create Offer',
    category: 'research_strategy',
    description: 'Create a campaign offer from audience, value proposition, and constraints.',
    input_schema: { type: 'object', required: ['prompt'] },
    output_schema: { type: 'object' },
    safety_level: 'internal_planning_only',
    enabled: true,
  },
  {
    skill_id: 'create_campaign_brief',
    name: 'Create Campaign Brief',
    category: 'research_strategy',
    description: 'Create a campaign brief for internal execution planning.',
    input_schema: { type: 'object', required: ['prompt'] },
    output_schema: { type: 'object' },
    safety_level: 'internal_planning_only',
    enabled: true,
  },
  {
    skill_id: 'analyze_strategy',
    name: 'Analyze Strategy',
    category: 'research_strategy',
    description: 'Review a strategy for clarity, feasibility, risks, and gaps.',
    input_schema: { type: 'object', required: ['prompt'] },
    output_schema: { type: 'object' },
    safety_level: 'internal_planning_only',
    enabled: true,
  },
  {
    skill_id: 'identify_missing_capabilities',
    name: 'Identify Missing Capabilities',
    category: 'research_strategy',
    description: 'Identify missing agents, skills, playbooks, tools, and approval gates.',
    input_schema: { type: 'object', required: ['prompt'] },
    output_schema: { type: 'object' },
    safety_level: 'internal_planning_only',
    enabled: true,
  },
  {
    skill_id: 'create_task_list',
    name: 'Create Task List',
    category: 'productivity',
    description: 'Convert a plan or request into an internal task list.',
    input_schema: { type: 'object', required: ['prompt'] },
    output_schema: { type: 'object' },
    safety_level: 'internal_planning_only',
    enabled: true,
  },
  {
    skill_id: 'create_project_plan',
    name: 'Create Project Plan',
    category: 'productivity',
    description: 'Create a project plan from objective, constraints, and known context.',
    input_schema: { type: 'object', required: ['prompt'] },
    output_schema: { type: 'object' },
    safety_level: 'internal_planning_only',
    enabled: true,
  },
  {
    skill_id: 'create_checklist',
    name: 'Create Checklist',
    category: 'productivity',
    description: 'Create a concise checklist for a workflow or campaign.',
    input_schema: { type: 'object', required: ['prompt'] },
    output_schema: { type: 'object' },
    safety_level: 'internal_planning_only',
    enabled: true,
  },
  {
    skill_id: 'create_meeting_notes',
    name: 'Create Meeting Notes',
    category: 'productivity',
    description: 'Turn notes or transcript text into concise meeting notes.',
    input_schema: { type: 'object', required: ['prompt'] },
    output_schema: { type: 'object' },
    safety_level: 'internal_planning_only',
    enabled: true,
  },
  {
    skill_id: 'create_decision_summary',
    name: 'Create Decision Summary',
    category: 'productivity',
    description: 'Summarize decisions, rationale, and next actions from provided context.',
    input_schema: { type: 'object', required: ['prompt'] },
    output_schema: { type: 'object' },
    safety_level: 'internal_planning_only',
    enabled: true,
  },
  {
    skill_id: 'summarize_project_status',
    name: 'Summarize Project Status',
    category: 'analysis',
    description: 'Summarize current project status from internal project context.',
    input_schema: { type: 'object', required: ['prompt'] },
    output_schema: { type: 'object' },
    safety_level: 'internal_planning_only',
    enabled: true,
  },
  {
    skill_id: 'analyze_risks',
    name: 'Analyze Risks',
    category: 'analysis',
    description: 'Analyze project, campaign, or execution risks from known context.',
    input_schema: { type: 'object', required: ['prompt'] },
    output_schema: { type: 'object' },
    safety_level: 'internal_planning_only',
    enabled: true,
  },
  {
    skill_id: 'recommend_next_step',
    name: 'Recommend Next Step',
    category: 'analysis',
    description: 'Recommend the next best internal action from project context.',
    input_schema: { type: 'object', required: ['prompt'] },
    output_schema: { type: 'object' },
    safety_level: 'internal_planning_only',
    enabled: true,
  },
  {
    skill_id: 'compare_options',
    name: 'Compare Options',
    category: 'analysis',
    description: 'Compare options and recommend a practical path from available context.',
    input_schema: { type: 'object', required: ['prompt'] },
    output_schema: { type: 'object' },
    safety_level: 'internal_planning_only',
    enabled: true,
  },
]

export async function listAISkills(): Promise<AISkill[]> {
  try {
    const res = await db.query(
      `SELECT id, skill_id, name, category, description, input_schema, output_schema,
              safety_level, enabled, created_at, updated_at
       FROM ai_skills
       ORDER BY category, name`
    )
    if (res.rows.length > 0) return res.rows
  } catch { /* migration may not be applied yet */ }
  return BUILT_IN_AI_SKILLS
}

export async function getAISkillById(skillId: string): Promise<AISkill | null> {
  try {
    const res = await db.query(
      `SELECT id, skill_id, name, category, description, input_schema, output_schema,
              safety_level, enabled, created_at, updated_at
       FROM ai_skills
       WHERE skill_id=$1 AND enabled=true
       LIMIT 1`,
      [skillId],
    )
    if (res.rows[0]) return res.rows[0]
  } catch { /* fallback below */ }
  return BUILT_IN_AI_SKILLS.find(skill => skill.skill_id === skillId && skill.enabled) ?? null
}

export function recommendAISkillForPrompt(prompt: string): string {
  const lower = prompt.toLowerCase()
  if (/\b(plan|create)\b.*\b(next\s+)?7\s+days?\b|\b7[-\s]?day\b/.test(lower)) return 'create_7_day_plan'
  if (/\b(who is our customer|customer persona|buyer persona|persona)\b/.test(lower)) return 'create_customer_persona'
  if (/\bcampaign brief\b/.test(lower)) return 'create_campaign_brief'
  if (/\b(competitor|competitive)\b.*\b(plan|framework|research|analy[sz]e)\b/.test(lower)) return 'create_competitor_research_plan'
  if (/\bmarket research brief\b|\bresearch brief\b/.test(lower)) return 'create_market_research_brief'
  if (/\bpositioning\b|\bpositioning statement\b/.test(lower)) return 'create_positioning_statement'
  if (/\boffer\b|\bpromotion\b/.test(lower)) return 'create_offer'
  if (/\bmissing capabilities\b|\bwhat.+missing\b|\bcapability gaps?\b/.test(lower)) return 'identify_missing_capabilities'
  if (/\b(analy[sz]e|review)\b.*\bstrategy\b/.test(lower)) return 'analyze_strategy'
  if (/\b(marketing strategy|campaign strategy|strategy)\b/.test(lower)) return 'create_marketing_strategy'
  if (/\b(task list|tasks?)\b/.test(lower)) return 'create_task_list'
  if (/\bproject plan\b/.test(lower)) return 'create_project_plan'
  if (/\bchecklist\b/.test(lower)) return 'create_checklist'
  if (/\bmeeting notes\b|\bnotes from\b/.test(lower)) return 'create_meeting_notes'
  if (/\bdecision summary\b|\bsummarize decisions?\b/.test(lower)) return 'create_decision_summary'
  if (/\b(project status|status of|what are we doing)\b/.test(lower)) return 'summarize_project_status'
  if (/\brisks?\b|\bwhat could go wrong\b/.test(lower)) return 'analyze_risks'
  if (/\bwhat should we do next\b|\bnext step\b|\brecommend.+next\b/.test(lower)) return 'recommend_next_step'
  if (/\bcompare\b|\bwhich option\b|\boptions?\b/.test(lower)) return 'compare_options'
  if (/\bimprove\b.*\bemail\b|\bpolish\b.*\bemail\b|\bfix\b.*\bemail\b/.test(lower)) return 'improve_email'
  if (/\breddit\b/.test(lower)) return 'write_reddit_post'
  if (/\blinkedin\b/.test(lower)) return 'write_linkedin_post'
  if (/\b(x|twitter)\b|\bthread\b/.test(lower)) return 'write_x_post'
  if (/\blanding page\b|\bhero\b|\bheadline\b|\bwebsite copy\b/.test(lower)) return 'write_landing_page_copy'
  if (/\bcontent ideas?\b|\bideas?\b/.test(lower)) return 'create_content_ideas'
  if (/\bblog\b|\boutline\b/.test(lower)) return 'write_blog_outline'
  if (/\bsummarize\b|\bsummary\b/.test(lower)) return 'summarize_text'
  if (/\brewrite\b|\brephrase\b|\bturn this\b/.test(lower)) return 'rewrite_text'
  if (/\bemail\b|\bmail\b/.test(lower)) return 'write_email'
  return 'write_linkedin_post'
}

export async function executeAISkill(
  skillId: string | null | undefined,
  input: { prompt: string; project_id?: string | null; save_as_file?: boolean },
  context: Record<string, unknown> = {},
): Promise<AISkillOutput> {
  const resolvedSkillId = skillId ?? recommendAISkillForPrompt(input.prompt)
  const skill = await getAISkillById(resolvedSkillId)
  if (!skill) throw new Error(`AI skill not found: ${resolvedSkillId}`)
  if (['research_strategy', 'productivity', 'analysis'].includes(skill.category)) {
    const { executeResearchSkill } = await import('@/lib/ai-skills/research-executor')
    return executeResearchSkill({
      skillId: resolvedSkillId,
      prompt: input.prompt,
      projectId: input.project_id ?? null,
      context,
      saveAsFile: Boolean(input.save_as_file),
    })
  }
  const { executeContentSkill } = await import('@/lib/ai-skills/content-executor')
  return executeContentSkill({
    skillId: resolvedSkillId,
    prompt: input.prompt,
    projectId: input.project_id ?? null,
    context,
    saveAsFile: Boolean(input.save_as_file),
  })
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'ai-skill-output'
}

export async function saveAISkillOutputAsFile(
  output: AISkillOutput,
  options: { projectId?: string | null; title?: string | null } = {},
): Promise<GeneratedFile> {
  const title = options.title ?? output.title
  const sectionText = output.sections?.length
    ? `\n\n${output.sections.map(section => `## ${section.title}\n\n${section.content}`).join('\n\n')}`
    : ''
  const recommendationText = output.recommendations?.length
    ? `\n\n## Recommendations\n\n${output.recommendations.map(item => `- ${item}`).join('\n')}`
    : ''
  const nextActionText = output.next_actions?.length
    ? `\n\n## Next Actions\n\n${output.next_actions.map(item => `- ${item}`).join('\n')}`
    : ''
  const webResearchText = typeof output.needs_web_research === 'boolean'
    ? `\n\n## Web Research Needed\n\n${output.needs_web_research ? 'Yes' : 'No'}${output.web_research_questions?.length ? `\n\n${output.web_research_questions.map(item => `- ${item}`).join('\n')}` : ''}`
    : ''
  const body = output.content ?? output.summary ?? ''
  const structuredText = output.structured_data && Object.keys(output.structured_data).length
    ? `\n\n## Structured Output\n\n\`\`\`json\n${JSON.stringify(output.structured_data, null, 2)}\n\`\`\``
    : ''
  const content = `# ${title}\n\n${output.warning ? `> ${output.warning}\n\n` : ''}${body}${sectionText}${recommendationText}${nextActionText}${webResearchText}${structuredText}\n`
  return createGeneratedFile({
    project_id: options.projectId ?? null,
    filename: `${slug(title)}.md`,
    content,
    content_type: 'markdown',
    title,
    description: `AI skill output from ${output.skill_id}`,
    generated_by_role: 'copywriting',
    source_entity_type: 'ai_skill_output',
    source_entity_id: output.skill_id,
  })
}
