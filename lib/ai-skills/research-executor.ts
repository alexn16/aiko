import { callAI } from '@/lib/ai/router'
import { getProjectContext, getProjectExecutiveSummary } from '@/lib/project-context'
import { getAISkillById, recommendAISkillForPrompt, saveAISkillOutputAsFile, type AISkillOutput } from '@/lib/ai-skills'
import { getAISkillOutputTemplate, templatePrompt } from '@/lib/ai-skills/output-templates'

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
    .replace(/```json\s*[\s\S]*?```/gi, '')
    .replace(/```(?:markdown|md|text)?/gi, '')
    .replace(/```/g, '')
    .replace(/\b(chain of thought|hidden reasoning|internal json)\b/gi, '')
    .trim()
}

function parseStructuredOutput(raw: string): Record<string, unknown> {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i)
  const candidate = fenced?.[1] ?? raw.match(/\{[\s\S]*\}\s*$/)?.[0]
  if (!candidate) return {}
  try {
    const parsed = JSON.parse(candidate.trim())
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function boolFromStructured(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    if (/^(true|yes|required|needed)$/i.test(value.trim())) return true
    if (/^(false|no|not needed|none)$/i.test(value.trim())) return false
  }
  return null
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(item => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>
        return String(record.next_action ?? record.action ?? record.title ?? record.description ?? JSON.stringify(item))
      }
      return String(item)
    }).filter(Boolean)
  }
  if (typeof value === 'string') return value.split('\n').map(line => line.replace(/^[-*]\s*/, '').trim()).filter(Boolean)
  return []
}

function fallbackStructuredData(params: {
  skillId: string
  existing: Record<string, unknown>
  summary: string
  recommendations: string[]
  nextActions: string[]
  needsWebResearch: boolean
  webResearchQuestions: string[]
}): Record<string, unknown> {
  const { skillId, existing, summary, recommendations, nextActions, needsWebResearch, webResearchQuestions } = params
  const assumption = 'Assumption: based on saved project context and owner-provided text; verify fresh external facts with Web Operator research.'
  const firstNext = nextActions[0] ?? 'Review this plan and choose the next internal action.'
  const withExisting = (fallback: Record<string, unknown>) => {
    const merged = { ...fallback, ...existing }
    for (const [key, value] of Object.entries(merged)) {
      if (value === null || value === undefined || (Array.isArray(value) && value.length === 0) || value === '') {
        merged[key] = fallback[key] ?? value
      }
    }
    return merged
  }

  if (skillId === 'create_7_day_plan') {
    const actions = nextActions.length ? nextActions : recommendations
    const dayByDay = Array.from({ length: 7 }, (_, index) => {
      const action = actions[index] ?? actions[index % Math.max(actions.length, 1)] ?? `Complete planning action ${index + 1}.`
      return {
        day: `Day ${index + 1}`,
        action,
        owner_role: /copy|draft|write/i.test(action) ? 'copywriting_agent' : /approve|review/i.test(action) ? 'owner' : /research|web operator/i.test(action) ? 'web_operator' : 'marketing_agent',
        deliverable: action,
        success_metric: 'Completed and ready for owner review.',
      }
    })
    return withExisting({
      objective: summary,
      assumptions: [assumption],
      day_by_day_plan: dayByDay,
      owner_roles: ['owner', 'marketing_agent', 'copywriting_agent', needsWebResearch ? 'web_operator' : 'web_operator only if research is approved'],
      deliverables: recommendations.slice(0, 5),
      success_metrics: ['Plan reviewed', 'Priority deliverables created', 'Approval or research gaps identified'],
      risks: webResearchQuestions.length ? webResearchQuestions.map(question => ({ risk: question, mitigation: 'Validate with Web Operator research before execution.' })) : [],
      needs_web_research: needsWebResearch,
      next_actions: nextActions,
    })
  }

  if (skillId === 'create_customer_persona') {
    return withExisting({
      persona_name: 'Primary customer persona',
      segment: summary,
      pains: recommendations.slice(0, 3),
      goals: nextActions.slice(0, 3),
      triggers: ['Clear pain or timing signal from project context'],
      objections: ['Unverified until customer or web research validates it'],
      channels: needsWebResearch ? ['Needs Web Operator validation'] : ['Use project channel context'],
      messaging_angles: recommendations.slice(0, 4),
      assumptions: [assumption],
      needs_web_research: needsWebResearch,
      next_actions: nextActions,
    })
  }

  if (skillId === 'analyze_risks') {
    const risks = (recommendations.length ? recommendations : [summary]).slice(0, 6).map(risk => ({
      risk,
      likelihood: 'medium',
      impact: 'medium',
      mitigation: 'Assign an owner and validate assumptions before execution.',
      owner_role: /approval|owner/i.test(risk) ? 'owner' : 'marketing_agent',
      next_action: firstNext,
    }))
    return withExisting({ risks, needs_web_research: needsWebResearch, next_actions: nextActions })
  }

  if (skillId === 'recommend_next_step') {
    return withExisting({
      current_status: summary,
      best_next_step: firstNext,
      why: recommendations[0] ?? 'This is the clearest next action from the saved project context.',
      owner: /approve|review/i.test(firstNext) ? 'owner' : 'marketing_agent',
      expected_output: firstNext,
      requires_web_operator: needsWebResearch || /web operator|research|browser/i.test(firstNext),
      requires_approval: /approve|send|post|publish|message/i.test(firstNext),
      next_actions: nextActions,
    })
  }

  if (skillId === 'create_campaign_brief') {
    return withExisting({
      campaign_name: 'Draft campaign',
      objective: summary,
      audience: 'Use saved project audience; validate if incomplete.',
      offer: recommendations[0] ?? 'Offer needs owner review.',
      key_message: recommendations[1] ?? summary,
      channels: needsWebResearch ? ['Needs Web Operator research'] : ['Use saved recommended channel'],
      content_assets: recommendations.slice(0, 5),
      approval_gates: ['Sending, posting, messaging, publishing, sharing, or downloading final assets requires approval.'],
      metrics: ['Owner-approved brief', 'Draft assets completed', 'Research gaps resolved'],
      next_actions: nextActions,
    })
  }

  if (skillId === 'create_marketing_strategy') {
    return withExisting({
      positioning: recommendations[0] ?? summary,
      target_audience: 'Use saved project audience; validate externally if needed.',
      channels: needsWebResearch ? ['Needs Web Operator validation'] : ['Use saved project channel'],
      funnel: ['Awareness', 'Consideration', 'Conversion'],
      content_strategy: recommendations.slice(0, 3),
      outreach_strategy: recommendations.slice(3, 6),
      metrics: ['Reach', 'Qualified responses', 'Owner-approved next actions'],
      missing_capabilities: webResearchQuestions,
      needs_web_research: needsWebResearch,
      next_actions: nextActions,
    })
  }

  return withExisting({
    assumptions: [assumption],
    needs_web_research: needsWebResearch,
    next_actions: nextActions,
  })
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
  const template = getAISkillOutputTemplate(skill.skill_id)

  const raw = await callAI({
    role: 'ceo',
    maxTokens: 1800,
    temperature: 0.45,
    messages: [
      {
        role: 'system',
        content: [
          'You are AÏKO’s internal research and strategy skill executor.',
          'Use only saved project context and user-provided text.',
          'Be specific, practical, and ready to act on.',
          'Do not browse websites, open Web Operator, create Web Operator actions, send messages, publish, or claim external facts were checked.',
          'If fresh facts, live competitor data, market statistics, or current web data are needed, say Web Operator research is needed.',
          'Do not include hidden reasoning, chain-of-thought, provider details, tokens, secrets, or JSON outside the final structured block.',
          'Mark assumptions clearly. Do not invent external facts.',
          'Return clean Markdown with these headings exactly: Summary, What data this is based on, Recommendations, Next actions, What still needs Web Operator research.',
          templatePrompt(skill.skill_id),
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

  const structured = parseStructuredOutput(raw)
  const cleaned = cleanText(raw)
  const basedOn = sectionContent(cleaned, 'What data this is based on') || projectContextText(projectContext)
  const webResearch = sectionContent(cleaned, 'What still needs Web Operator research')
  const recommendations = bulletLines(cleaned, 'Recommendations')
  const nextActions = stringArray(structured.next_actions).length
    ? stringArray(structured.next_actions).slice(0, 8)
    : bulletLines(cleaned, 'Next actions')
  const webQuestions = webResearch
    .split('\n')
    .map(line => line.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 6)
  const structuredNeedsWeb = boolFromStructured(structured.needs_web_research ?? structured.requires_web_operator)
  const effectiveNeedsWebResearch = structuredNeedsWeb ?? (needsWebResearch || /web operator research is needed|needs web operator research|fresh external/i.test(webResearch))
  const templateFields = template?.fields ?? []
  const summary = sectionContent(cleaned, 'Summary') || cleaned.split('\n').find(Boolean) || 'Strategy output created.'
  const structuredWithFallbacks = fallbackStructuredData({
    skillId: skill.skill_id,
    existing: {
      ...Object.fromEntries(templateFields.map(field => [field, structured[field] ?? null])),
      ...structured,
    },
    summary,
    recommendations: recommendations.length ? recommendations : ['Review the plan against current project goals.'],
    nextActions: nextActions.length ? nextActions : ['Review this output.', effectiveNeedsWebResearch ? 'Run Web Operator research for the open questions.' : 'Save this as a file if useful.'],
    needsWebResearch: effectiveNeedsWebResearch,
    webResearchQuestions: webQuestions,
  })

  const output: AISkillOutput = {
    skill_id: skill.skill_id,
    title: titleForSkill(skill.skill_id, projectName),
    content: cleaned,
    summary,
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
    needs_web_research: effectiveNeedsWebResearch,
    web_research_questions: webQuestions,
    warning: needsWebResearch ? 'This is an internal planning draft. Fresh external facts still need Web Operator research.' : undefined,
    structured_data: structuredWithFallbacks,
  }

  if (input.saveAsFile) {
    const file = await saveAISkillOutputAsFile(output, { projectId: input.projectId ?? null })
    output.saved_file_id = file.id
  }

  return output
}
