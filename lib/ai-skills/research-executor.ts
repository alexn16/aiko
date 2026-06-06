import { callAI } from '@/lib/ai/router'
import { getProjectContext, getProjectExecutiveSummary } from '@/lib/project-context'
import { getAISkillById, recommendAISkillForPrompt, saveAISkillOutputAsFile, type AISkillOutput } from '@/lib/ai-skills'

export type ExecuteResearchSkillInput = {
  skillId?: string | null
  prompt: string
  projectId?: string | null
  context?: Record<string, unknown>
  saveAsFile?: boolean
}

function formatForSkill(skillId: string): string {
  switch (skillId) {
    case 'create_marketing_strategy': return 'marketing_strategy'
    case 'create_7_day_plan': return 'seven_day_plan'
    case 'create_customer_persona': return 'customer_persona'
    case 'create_competitor_research_plan': return 'competitor_research_plan'
    case 'create_market_research_brief': return 'market_research_brief'
    case 'create_positioning_statement': return 'positioning_statement'
    case 'create_offer': return 'offer'
    case 'create_campaign_brief': return 'campaign_brief'
    case 'analyze_strategy': return 'strategy_analysis'
    case 'identify_missing_capabilities': return 'capability_gap_analysis'
    case 'create_task_list': return 'task_list'
    case 'create_project_plan': return 'project_plan'
    case 'create_checklist': return 'checklist'
    case 'create_meeting_notes': return 'meeting_notes'
    case 'create_decision_summary': return 'decision_summary'
    case 'summarize_project_status': return 'project_status'
    case 'analyze_risks': return 'risk_analysis'
    case 'recommend_next_step': return 'next_step_recommendation'
    case 'compare_options': return 'option_comparison'
    default: return 'strategy_output'
  }
}

function titleForSkill(skillId: string, projectName?: string | null): string {
  const base = projectName ? `${projectName} ` : ''
  switch (skillId) {
    case 'create_marketing_strategy': return `${base}Marketing Strategy`.trim()
    case 'create_7_day_plan': return `${base}7-Day Marketing Plan`.trim()
    case 'create_customer_persona': return `${base}Customer Persona`.trim()
    case 'create_competitor_research_plan': return `${base}Competitor Research Plan`.trim()
    case 'create_market_research_brief': return `${base}Market Research Brief`.trim()
    case 'create_positioning_statement': return `${base}Positioning Statement`.trim()
    case 'create_offer': return `${base}Offer`.trim()
    case 'create_campaign_brief': return `${base}Campaign Brief`.trim()
    case 'analyze_strategy': return `${base}Strategy Analysis`.trim()
    case 'identify_missing_capabilities': return `${base}Missing Capabilities`.trim()
    case 'create_task_list': return `${base}Task List`.trim()
    case 'create_project_plan': return `${base}Project Plan`.trim()
    case 'create_checklist': return `${base}Checklist`.trim()
    case 'create_meeting_notes': return `${base}Meeting Notes`.trim()
    case 'create_decision_summary': return `${base}Decision Summary`.trim()
    case 'summarize_project_status': return `${base}Project Status`.trim()
    case 'analyze_risks': return `${base}Risk Analysis`.trim()
    case 'recommend_next_step': return `${base}Next Step Recommendation`.trim()
    case 'compare_options': return `${base}Option Comparison`.trim()
    default: return `${base}Strategy Output`.trim()
  }
}

function externalFactsRequested(prompt: string): boolean {
  return /\b(latest|current|today|real[-\s]?time|fresh|live|online|web|internet|google|browse|search|competitor prices?|market size|statistics|recent news)\b/i.test(prompt)
}

function cleanText(raw: string): string {
  return raw
    .replace(/```(?:markdown|md|text)?/gi, '')
    .replace(/```/g, '')
    .replace(/\b(chain of thought|hidden reasoning|internal json)\b/gi, '')
    .trim()
}

function bulletLines(text: string, heading: string): string[] {
  const pattern = new RegExp(`(?:^|\\n)#{1,3}\\s*${heading}\\s*\\n([\\s\\S]*?)(?=\\n#{1,3}\\s|$)`, 'i')
  const match = text.match(pattern)
  if (!match) return []
  return match[1]
    .split('\n')
    .map(line => line.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 8)
}

function sectionContent(text: string, heading: string): string {
  const pattern = new RegExp(`(?:^|\\n)#{1,3}\\s*${heading}\\s*\\n([\\s\\S]*?)(?=\\n#{1,3}\\s|$)`, 'i')
  const match = text.match(pattern)
  return match?.[1]?.trim() ?? ''
}

function projectContextText(ctx: Awaited<ReturnType<typeof getProjectContext>>): string {
  if (!ctx) return 'No saved project context was found. Use only the owner request and clearly label assumptions.'
  return getProjectExecutiveSummary(ctx)
}

export async function executeResearchSkill(input: ExecuteResearchSkillInput): Promise<AISkillOutput> {
  const skillId = input.skillId ?? recommendAISkillForPrompt(input.prompt)
  const skill = await getAISkillById(skillId)
  if (!skill) throw new Error(`AI skill not found: ${skillId}`)

  const projectContext = input.projectId ? await getProjectContext(input.projectId) : null
  const projectName = projectContext?.name ?? null
  const needsWebResearch = externalFactsRequested(input.prompt)

  const raw = await callAI({
    role: 'ceo',
    maxTokens: 1400,
    temperature: 0.45,
    messages: [
      {
        role: 'system',
        content: [
          'You are AÏKO’s internal research and strategy skill executor.',
          'Use only saved project context and user-provided text.',
          'Do not browse websites, open Web Operator, create Web Operator actions, send messages, publish, or claim external facts were checked.',
          'If fresh facts, live competitor data, market statistics, or current web data are needed, say Web Operator research is needed.',
          'Do not include hidden reasoning, chain-of-thought, provider details, tokens, secrets, or raw JSON.',
          'Return clean Markdown with these headings exactly: Summary, What data this is based on, Recommendations, Next actions, What still needs Web Operator research.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `AI skill: ${skill.name} (${skill.skill_id})`,
          `Requested format: ${formatForSkill(skill.skill_id)}`,
          '',
          'Project context:',
          projectContextText(projectContext),
          '',
          'Owner request:',
          input.prompt,
          '',
          needsWebResearch
            ? 'Important: The request appears to need fresh or external facts. Do not invent them. State the Web Operator research needed.'
            : 'Important: If your answer relies on assumptions, label them. Do not invent external facts.',
        ].join('\n'),
      },
    ],
  })

  const cleaned = cleanText(raw)
  const basedOn = sectionContent(cleaned, 'What data this is based on') || projectContextText(projectContext)
  const webResearch = sectionContent(cleaned, 'What still needs Web Operator research')
  const recommendations = bulletLines(cleaned, 'Recommendations')
  const nextActions = bulletLines(cleaned, 'Next actions')
  const webQuestions = webResearch
    .split('\n')
    .map(line => line.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 6)

  const output: AISkillOutput = {
    skill_id: skill.skill_id,
    title: titleForSkill(skill.skill_id, projectName),
    content: cleaned,
    summary: sectionContent(cleaned, 'Summary') || cleaned.split('\n').find(Boolean) || 'Strategy output created.',
    sections: [
      { title: 'What data this is based on', content: basedOn },
      { title: 'What still needs Web Operator research', content: webResearch || (needsWebResearch ? 'Fresh external facts should be checked with Web Operator research before execution.' : 'No live web research is required for this internal planning draft.') },
    ],
    recommendations: recommendations.length ? recommendations : ['Review the plan against current project goals.'],
    next_actions: nextActions.length ? nextActions : ['Review this output.', needsWebResearch ? 'Run Web Operator research for the open questions.' : 'Save this as a file if useful.'],
    format: formatForSkill(skill.skill_id),
    suggested_next_actions: [
      'Review the recommendations.',
      needsWebResearch ? 'Run Web Operator research before relying on fresh external facts.' : 'Save the plan as a file if useful.',
      'Create tasks only after owner review.',
    ],
    needs_web_research: needsWebResearch || /web operator research is needed|needs web operator research|fresh external/i.test(webResearch),
    web_research_questions: webQuestions,
    warning: needsWebResearch ? 'This is an internal planning draft. Fresh external facts still need Web Operator research.' : undefined,
  }

  if (input.saveAsFile) {
    const file = await saveAISkillOutputAsFile(output, { projectId: input.projectId ?? null })
    output.saved_file_id = file.id
  }

  return output
}
