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
  content: string
  format: string
  suggested_next_actions: string[]
  warning?: string
  saved_file_id?: string
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
  const { executeContentSkill } = await import('@/lib/ai-skills/content-executor')
  return executeContentSkill({
    skillId: skillId ?? recommendAISkillForPrompt(input.prompt),
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
  const content = `# ${title}\n\n${output.warning ? `> ${output.warning}\n\n` : ''}${output.content}\n`
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
