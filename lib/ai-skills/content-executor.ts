import { callAI } from '@/lib/ai/router'
import { getProjectContext } from '@/lib/project-context'
import { getAISkillById, recommendAISkillForPrompt, saveAISkillOutputAsFile, type AISkillOutput } from '@/lib/ai-skills'

export type ExecuteContentSkillInput = {
  skillId?: string | null
  prompt: string
  projectId?: string | null
  context?: Record<string, unknown>
  saveAsFile?: boolean
}

function platformFormat(skillId: string): string {
  switch (skillId) {
    case 'write_linkedin_post': return 'linkedin_post'
    case 'write_x_post': return 'x_thread'
    case 'write_reddit_post': return 'reddit_post'
    case 'write_email':
    case 'improve_email': return 'email'
    case 'write_blog_outline': return 'blog_outline'
    case 'write_landing_page_copy': return 'landing_page_copy'
    case 'create_content_ideas': return 'content_ideas'
    case 'summarize_text': return 'summary'
    case 'rewrite_text': return 'rewrite'
    default: return 'draft'
  }
}

function titleForSkill(skillId: string, projectName?: string | null): string {
  const base = projectName ? `${projectName} ` : ''
  switch (skillId) {
    case 'write_linkedin_post': return `${base}LinkedIn Post Draft`.trim()
    case 'write_x_post': return `${base}X Thread Draft`.trim()
    case 'write_reddit_post': return `${base}Reddit Post Draft`.trim()
    case 'write_email': return `${base}Email Draft`.trim()
    case 'improve_email': return `${base}Improved Email Draft`.trim()
    case 'write_blog_outline': return `${base}Blog Outline`.trim()
    case 'write_landing_page_copy': return `${base}Landing Page Copy`.trim()
    case 'create_content_ideas': return `${base}Content Ideas`.trim()
    case 'summarize_text': return `${base}Summary`.trim()
    case 'rewrite_text': return `${base}Rewrite`.trim()
    default: return `${base}Content Draft`.trim()
  }
}

function asksToPublish(prompt: string): boolean {
  return /\b(post|publish|send|message|share|submit|upload)\b/i.test(prompt)
}

function projectContextText(ctx: Awaited<ReturnType<typeof getProjectContext>>): string {
  if (!ctx) return 'No project context was found.'
  const parts = [
    `Project: ${ctx.name}`,
    ctx.goal ? `Goal: ${ctx.goal}` : null,
    ctx.brief_target_audience ? `Target audience: ${ctx.brief_target_audience}` : null,
    ctx.brief_channel ? `Recommended channel: ${ctx.brief_channel}` : null,
    ctx.brief_value_prop ? `Value proposition: ${ctx.brief_value_prop}` : null,
    ctx.latest_execution_plan ? `Latest execution plan: ${ctx.latest_execution_plan.title} (${ctx.latest_execution_plan.status})` : null,
    ctx.recent_decisions.length
      ? `Recent decisions: ${ctx.recent_decisions.slice(0, 4).map(d => d.title).join('; ')}`
      : null,
  ].filter(Boolean)
  return parts.join('\n')
}

function cleanDraft(raw: string): string {
  return raw
    .replace(/```(?:markdown|md|text)?/gi, '')
    .replace(/```/g, '')
    .replace(/\b(chain of thought|hidden reasoning|internal json)\b/gi, '')
    .trim()
}

export async function executeContentSkill(input: ExecuteContentSkillInput): Promise<AISkillOutput> {
  const skillId = input.skillId ?? recommendAISkillForPrompt(input.prompt)
  const skill = await getAISkillById(skillId)
  if (!skill) throw new Error(`AI skill not found: ${skillId}`)

  const projectContext = input.projectId ? await getProjectContext(input.projectId) : null
  const projectName = projectContext?.name ?? null
  const warning = asksToPublish(input.prompt)
    ? 'Draft created only. Publishing or sending requires approval.'
    : undefined

  const raw = await callAI({
    role: 'copywriting',
    maxTokens: 1200,
    temperature: 0.7,
    messages: [
      {
        role: 'system',
        content: [
          'You are AÏKO’s internal copywriting skill executor.',
          'Create useful marketing drafts directly from the request and project context.',
          'Do not browse, post, send, message, publish, upload, or claim that anything external was executed.',
          'If the user asks to publish/send/post, write the draft only.',
          'Do not include hidden reasoning, chain-of-thought, provider details, tokens, secrets, or raw JSON.',
          'Return only the final draft content in clean Markdown or plain text.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `AI skill: ${skill.name} (${skill.skill_id})`,
          `Requested format: ${platformFormat(skill.skill_id)}`,
          '',
          'Project context:',
          projectContextText(projectContext),
          '',
          'Owner request:',
          input.prompt,
          '',
          warning ? `Safety note to respect: ${warning}` : 'Safety note: keep this as an internal draft.',
        ].join('\n'),
      },
    ],
  })

  const output: AISkillOutput = {
    skill_id: skill.skill_id,
    title: titleForSkill(skill.skill_id, projectName),
    content: cleanDraft(raw),
    format: platformFormat(skill.skill_id),
    suggested_next_actions: [
      'Review the draft.',
      'Save it as a file if useful.',
      warning ? 'Approve separately before sending or publishing.' : 'Ask for another version if needed.',
    ],
    warning,
  }

  if (input.saveAsFile) {
    const file = await saveAISkillOutputAsFile(output, { projectId: input.projectId ?? null })
    output.saved_file_id = file.id
  }

  return output
}
