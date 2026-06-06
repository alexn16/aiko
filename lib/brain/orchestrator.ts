export type OwnerIntent =
  | 'chat'
  | 'create_project'
  | 'project_recall'
  | 'project_autopilot_marketing'
  | 'marketing_strategy'
  | 'lead_research'
  | 'content_creation'
  | 'competitor_research'
  | 'web_operator_task'
  | 'report_generation'
  | 'file_generation'
  | 'approval_review'
  | 'operator_status'
  | 'self_improvement_status'
  | 'create_custom_agent'
  | 'unknown'

export type OwnerSafetyLevel = 'read_only' | 'internal' | 'browser_safe' | 'approval_required'

export type OwnerProject = {
  id: string
  name: string
  active?: boolean | null
}

export type OwnerCommandContext = {
  selected_project_id?: string | null
  selected_project_name?: string | null
  latest_project_id?: string | null
  latest_project_name?: string | null
  projects?: OwnerProject[]
}

export type OwnerProjectReference = {
  id: string | null
  name: string | null
  source: 'explicit' | 'selected' | 'latest' | 'none'
  ambiguous?: boolean
  candidates?: Array<{ id: string; name: string }>
}

export type SuggestedChip = {
  label: string
  command?: string
  href?: string
}

export type OwnerCommandClassification = {
  intent: OwnerIntent
  confidence: number
  project_reference: OwnerProjectReference
  recommended_flow: string | null
  recommended_agent: string | null
  recommended_skill: string | null
  recommended_playbook: string | null
  safety_level: OwnerSafetyLevel
  needs_approval: boolean
  should_delegate: boolean
  should_create_plan: boolean
  should_create_file: boolean
  short_plan: string[]
  suggested_chips: SuggestedChip[]
}

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
}

function compactName(name: string): string {
  return normalize(name).replace(/[^a-z0-9]+/g, ' ').trim()
}

function extractExplicitProjectName(input: string): string | null {
  if (/\bpromote\s+a[ïi]ko\b/i.test(input)) return 'AÏKO'
  const forMatch = input.match(/\bfor\s+([^,.!?]+?)(?:[,.!?]|\s+the best\b|\s+use\b|\s+can\b|\s+create\b|\s+please\b|$)/i)
  if (forMatch) return forMatch[1].trim().replace(/\s+/g, ' ')
  const marketingMatch = input.match(/\bstart marketing\s+(.+?)(?:[,.!?]|$)/i)
  if (marketingMatch) return marketingMatch[1].trim().replace(/\s+/g, ' ')
  const promoteMatch = input.match(/\bpromote\s+([^,.!?]+?)(?:[,.!?]|$)/i)
  if (promoteMatch && !/^this project$/i.test(promoteMatch[1].trim())) {
    return promoteMatch[1].trim().replace(/\s+/g, ' ')
  }
  return null
}

function resolveProjectReference(input: string, context: OwnerCommandContext): OwnerProjectReference {
  const explicit = extractExplicitProjectName(input)
  const projects = context.projects ?? []

  if (explicit) {
    const wanted = compactName(explicit)
    const exact = projects.find(project => compactName(project.name) === wanted)
    if (exact) return { id: exact.id, name: exact.name, source: 'explicit' }

    const partial = projects.filter(project => {
      const candidate = compactName(project.name)
      return candidate.includes(wanted) || wanted.includes(candidate)
    })
    if (partial.length === 1) return { id: partial[0].id, name: partial[0].name, source: 'explicit' }
    if (partial.length > 1) {
      return {
        id: null,
        name: explicit,
        source: 'explicit',
        ambiguous: true,
        candidates: partial.map(project => ({ id: project.id, name: project.name })),
      }
    }
    return { id: null, name: explicit, source: 'explicit' }
  }

  if (context.selected_project_id || context.selected_project_name) {
    return {
      id: context.selected_project_id ?? null,
      name: context.selected_project_name ?? null,
      source: 'selected',
    }
  }

  if (context.latest_project_id || context.latest_project_name) {
    return {
      id: context.latest_project_id ?? null,
      name: context.latest_project_name ?? null,
      source: 'latest',
    }
  }

  return { id: null, name: null, source: 'none' }
}

function platformSkill(input: string): { skill: string | null; playbook: string | null; platform: string | null } {
  const lower = normalize(input)
  if (/\bcanva\b/.test(lower)) return { skill: 'canva_design', playbook: 'canva_instagram_draft', platform: 'Canva' }
  if (/\bfacebook|fb\b/.test(lower)) return { skill: 'facebook_research', playbook: 'facebook_group_research', platform: 'Facebook' }
  if (/\blinkedin\b/.test(lower)) return { skill: 'linkedin_research', playbook: 'linkedin_company_research', platform: 'LinkedIn' }
  if (/\bgmail\b|\bemail\b|\binbox\b/.test(lower)) {
    const draft = /\bdraft|prepare|write|compose\b/.test(lower)
    return { skill: 'gmail_workflow', playbook: draft ? 'gmail_prepare_draft' : 'gmail_open_and_check', platform: 'Gmail' }
  }
  if (/\binstagram\b/.test(lower)) return { skill: 'instagram_research', playbook: null, platform: 'Instagram' }
  if (/\breddit\b/.test(lower)) return { skill: 'reddit_research', playbook: 'reddit_market_research', platform: 'Reddit' }
  if (/https?:\/\/\S+/i.test(input)) return { skill: 'website_reader', playbook: 'general_site_research', platform: 'Website' }
  return { skill: null, playbook: null, platform: null }
}

function chipsForIntent(intent: OwnerIntent, projectName: string | null): SuggestedChip[] {
  const suffix = projectName ? ` for ${projectName}` : ''
  const common: SuggestedChip[] = [
    { label: 'Start marketing', command: `Start marketing${suffix}.` },
    { label: 'Research customers', command: `Find customers${suffix}.` },
    { label: 'Create content', command: `Create a LinkedIn post${suffix}.` },
    { label: 'Generate report', command: `Generate an executive report${suffix}.` },
  ]

  if (intent === 'web_operator_task') {
    return [
      { label: 'Open operator', href: '/operators' },
      { label: 'View approvals', href: '/approvals' },
      { label: 'Generate report', command: `Generate an executive report${suffix}.` },
      { label: 'Export results', href: '/files' },
    ]
  }
  if (intent === 'report_generation' || intent === 'file_generation') {
    return [
      { label: 'Export results', href: '/files' },
      { label: 'Open project', href: projectName ? '/projects' : '/projects' },
      { label: 'Start marketing', command: `Start marketing${suffix}.` },
    ]
  }
  if (intent === 'approval_review') {
    return [
      { label: 'View approvals', href: '/approvals' },
      { label: 'Open operator', href: '/operators' },
      { label: 'Generate report', command: `Generate an executive report${suffix}.` },
    ]
  }
  return common
}

function planForIntent(intent: OwnerIntent, projectName: string | null, platform: string | null): string[] {
  const project = projectName ?? 'the project'
  switch (intent) {
    case 'project_autopilot_marketing':
      return [
        'Identify the project.',
        'Research where to promote it.',
        'Ask Kevin to open useful websites.',
        'Return a short summary.',
        'I won’t post or message without approval.',
      ]
    case 'lead_research':
      return [
        `Use ${project} as the context.`,
        'Look for likely customer sources.',
        'Ask Kevin to read public pages when useful.',
        'Summarize leads or next research targets.',
        'I won’t message anyone without approval.',
      ]
    case 'content_creation':
      return [
        `Use ${project} as the context.`,
        `Draft the ${platform ?? 'content'} idea internally.`,
        'Keep it as a draft or file.',
        'Ask approval before posting or publishing.',
      ]
    case 'competitor_research':
      return [
        `Use ${project} as the context.`,
        'Identify likely competitors.',
        'Research public pages only.',
        'Summarize positioning and next steps.',
      ]
    case 'web_operator_task':
      return [
        `Open ${platform ?? 'the requested website'} in Kevin’s browser.`,
        'Pause if login, CAPTCHA, or a security check appears.',
        'Continue only safe visible-browser work.',
        'Ask approval before posting, messaging, publishing, sharing, or downloading.',
      ]
    case 'report_generation':
      return [
        `Find the relevant ${project} context.`,
        'Summarize recent work and decisions.',
        'Generate a concise executive report.',
        'Save it for review or export.',
      ]
    case 'file_generation':
      return [
        `Find the relevant ${project} context.`,
        'Prepare the requested file or bundle.',
        'Save it in generated files.',
      ]
    case 'project_recall':
      return [
        `Find the current ${project} context.`,
        'Summarize what is happening.',
        'Recommend the next useful step.',
      ]
    case 'self_improvement_status':
      return [
        'Read current improvement proposals.',
        'Summarize status and blockers.',
        'Do not approve, validate, or run code automatically.',
      ]
    case 'create_project':
      return [
        'Create the project record.',
        'Prepare the first campaign setup.',
        'Suggest the first safe next action.',
      ]
    case 'marketing_strategy':
      return [
        `Use ${project} as the context.`,
        'Create a short marketing strategy.',
        'Check required capabilities before execution.',
      ]
    case 'operator_status':
      return [
        'Check Kevin’s current browser state.',
        'Summarize whether help or approval is needed.',
      ]
    case 'approval_review':
      return [
        'Find pending approvals.',
        'Show the action and reason plainly.',
        'Do not execute anything automatically.',
      ]
    default:
      return ['Answer directly and keep the next step clear.']
  }
}

export function classifyOwnerCommand(input: string, context: OwnerCommandContext = {}): OwnerCommandClassification {
  const text = input.trim()
  const lower = normalize(text)
  const project = resolveProjectReference(text, context)
  const projectName = project.name
  const platform = platformSkill(text)

  let intent: OwnerIntent = 'chat'
  let confidence = 0.65
  let recommendedFlow: string | null = 'chat'
  let recommendedAgent: string | null = 'CEO'
  let safetyLevel: OwnerSafetyLevel = 'internal'
  let needsApproval = false
  let shouldDelegate = false
  let shouldCreatePlan = false
  let shouldCreateFile = false

  if (/\b(what improvements has aiko proposed|status of (?:aiko )?self improvement|self improvement status|which capabilities are missing|what was implemented recently|missing capabilities)\b/.test(lower)) {
    intent = 'self_improvement_status'
    confidence = 0.92
    recommendedFlow = 'self_improvement_timeline'
    safetyLevel = 'read_only'
  } else if (/\b(approval|approve|reject|pending approval)\b/.test(lower)) {
    intent = 'approval_review'
    confidence = 0.86
    recommendedFlow = 'approval_center'
    safetyLevel = 'read_only'
  } else if (/\b(operator status|what is kevin doing|is kevin working|browser status)\b/.test(lower)) {
    intent = 'operator_status'
    confidence = 0.86
    recommendedFlow = 'operator_status'
    safetyLevel = 'read_only'
  } else if (/\b(create|start|new)\b.*\b(project|campaign project)\b/.test(lower)) {
    intent = 'create_project'
    confidence = 0.86
    recommendedFlow = 'create_project'
    shouldCreatePlan = true
  } else if (/\b(what are we doing|what should we do next|what is next|next step|status for)\b/.test(lower)) {
    intent = 'project_recall'
    confidence = 0.88
    recommendedFlow = 'next_step'
    safetyLevel = 'read_only'
  } else if (/\b(start marketing|promote|start promotion|get this project moving|research where to promote)\b/.test(lower)) {
    intent = 'project_autopilot_marketing'
    confidence = 0.94
    recommendedFlow = 'project_autopilot_marketing'
    recommendedAgent = 'Kevin'
    safetyLevel = 'browser_safe'
    shouldDelegate = true
    shouldCreatePlan = true
  } else if (/\b(find customers|find leads|lead research|prospects?)\b/.test(lower)) {
    intent = 'lead_research'
    confidence = 0.9
    recommendedFlow = 'lead_research'
    recommendedAgent = 'Kevin'
    safetyLevel = 'browser_safe'
    shouldDelegate = true
    shouldCreatePlan = true
  } else if (/\b(competitor|competitors|competitive)\b/.test(lower) && /\b(research|find|analyze|analyse)\b/.test(lower)) {
    intent = 'competitor_research'
    confidence = 0.9
    recommendedFlow = 'competitor_research'
    recommendedAgent = 'Kevin'
    safetyLevel = 'browser_safe'
    shouldDelegate = true
    shouldCreatePlan = true
  } else if (/\b(create|write|draft|prepare)\b.*\b(post|content|copy|email|caption|newsletter)\b/.test(lower)) {
    intent = 'content_creation'
    confidence = 0.88
    recommendedFlow = 'content_draft'
    recommendedAgent = 'Content Agent'
    safetyLevel = /\b(post|publish|send|message)\b/.test(lower) ? 'approval_required' : 'internal'
    needsApproval = /\b(post|publish|send|message)\b/.test(lower)
    shouldCreatePlan = true
    shouldCreateFile = true
  } else if (/\b(open|browse|use)\b/.test(lower) && (platform.skill || /https?:\/\//i.test(text))) {
    intent = 'web_operator_task'
    confidence = 0.9
    recommendedFlow = 'web_operator'
    recommendedAgent = 'Kevin'
    safetyLevel = 'browser_safe'
    shouldDelegate = true
    shouldCreatePlan = true
  } else if (/\b(generate|create|write)\b.*\b(report|executive report|summary)\b/.test(lower)) {
    intent = 'report_generation'
    confidence = 0.9
    recommendedFlow = 'executive_report'
    recommendedAgent = 'CEO'
    shouldCreateFile = true
  } else if (/\b(bundle|export|csv|file)\b/.test(lower)) {
    intent = 'file_generation'
    confidence = 0.84
    recommendedFlow = 'file_generation'
    recommendedAgent = 'CEO'
    shouldCreateFile = true
  } else if (/\b(strategy|marketing plan|campaign plan)\b/.test(lower)) {
    intent = 'marketing_strategy'
    confidence = 0.82
    recommendedFlow = 'marketing_strategy'
    recommendedAgent = 'Marketing Strategy Agent'
    shouldCreatePlan = true
  } else if (/\b(create|add)\b.*\b(agent)\b/.test(lower)) {
    intent = 'create_custom_agent'
    confidence = 0.82
    recommendedFlow = 'create_custom_agent'
    recommendedAgent = 'CEO'
  } else if (text.length < 4) {
    intent = 'unknown'
    confidence = 0.3
    recommendedFlow = null
    recommendedAgent = null
  }

  return {
    intent,
    confidence,
    project_reference: project,
    recommended_flow: recommendedFlow,
    recommended_agent: recommendedAgent,
    recommended_skill: platform.skill,
    recommended_playbook: platform.playbook,
    safety_level: safetyLevel,
    needs_approval: needsApproval,
    should_delegate: shouldDelegate,
    should_create_plan: shouldCreatePlan,
    should_create_file: shouldCreateFile,
    short_plan: planForIntent(intent, projectName, platform.platform),
    suggested_chips: chipsForIntent(intent, projectName),
  }
}
