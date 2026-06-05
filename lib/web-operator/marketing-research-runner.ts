import { delegateOpenUrl, delegateSearch } from '@/lib/web-operator/delegation'
import type { DelegationResult } from '@/lib/web-operator/delegation'

export type AutopilotStatus =
  | 'thinking'
  | 'opening_browser'
  | 'searching_web'
  | 'reading_website'
  | 'found_opportunity'
  | 'needs_your_help'
  | 'done'

export interface MarketingResearchAutopilotInput {
  projectId?: string | null
  operatorId?: string | null
  operatorName?: string | null
  projectName: string
  goal: string
  targetAudience?: string | null
}

export interface MarketingOpportunity {
  title: string
  url: string
  snippet: string
  source: string
}

export interface MarketingResearchAutopilotResult {
  status: AutopilotStatus
  plan: string[]
  summary: string
  websites_checked: string[]
  opportunities: MarketingOpportunity[]
  recommended_next_action: string
  actions: Array<{
    label: string
    status: string
    message: string
    actionId?: string
    operatorId?: string
    url?: string
  }>
  delegation?: DelegationResult | null
}

const AikoTargets = [
  { label: 'Product Hunt AI search', url: 'https://www.producthunt.com/search?q=ai%20agents' },
  { label: 'Hacker News AI agents search', url: 'https://hn.algolia.com/?q=ai%20agents' },
  { label: 'Reddit AI agents search', url: 'https://www.reddit.com/search/?q=AI%20agents%20marketing' },
]

function isAikoProject(projectName: string, goal: string): boolean {
  return /\ba[ïi]ko\b/i.test(`${projectName} ${goal}`)
}

export function buildMarketingResearchQueries(input: MarketingResearchAutopilotInput): string[] {
  const name = input.projectName.trim()
  const audience = input.targetAudience?.trim()
  const goal = input.goal.trim()

  if (isAikoProject(name, goal)) {
    return [
      'AI agents marketing automation communities',
      'AI marketing operating system startup directories',
      'where to promote AI agent products',
      'indie hackers AI automation marketing',
    ]
  }

  const base = [name, audience].filter(Boolean).join(' ')
  return [
    `${base} customers marketing opportunities`,
    `${name} competitors alternatives directories`,
    `${audience || name} communities forums business directory`,
    `${name} property managers parking leads`,
  ].map(q => q.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 4)
}

export function buildMarketingResearchPlan(input: MarketingResearchAutopilotInput): string[] {
  if (isAikoProject(input.projectName, input.goal)) {
    return [
      'Check where AI agent and marketing automation buyers already gather.',
      'Open public communities and directories that do not require login first.',
      'Collect visible opportunities only and recommend the first promotion move.',
    ]
  }
  return [
    `Find where ${input.projectName} can reach likely customers.`,
    'Search the web for directories, communities, competitors, and buyer signals.',
    'Open safe public result pages when possible and summarize real opportunities.',
  ]
}

function resultOpportunities(result: DelegationResult, source: string): MarketingOpportunity[] {
  const output = result.output ?? {}
  const rows = Array.isArray(output.results) ? output.results : []
  return rows.slice(0, 5).flatMap(row => {
    if (!row || typeof row !== 'object') return []
    const item = row as Record<string, unknown>
    const title = typeof item.title === 'string' ? item.title.trim() : ''
    const url = typeof item.url === 'string' ? item.url.trim() : ''
    const snippet = typeof item.snippet === 'string' ? item.snippet.trim() : ''
    if (!title || !url) return []
    return [{ title, url, snippet, source }]
  })
}

function uniqueDomains(items: MarketingOpportunity[]): string[] {
  const domains: string[] = []
  for (const item of items) {
    try {
      const domain = new URL(item.url).hostname.replace(/^www\./, '')
      if (!domains.includes(domain)) domains.push(domain)
    } catch {
      // ignore malformed result URL
    }
  }
  return domains
}

function simplifyDelegationMessage(result: DelegationResult): string {
  if (result.status === 'approval_required') return 'Kevin needs approval before doing this.'
  if (result.message.includes('needs your help') || result.message.toLowerCase().includes('captcha') || result.message.toLowerCase().includes('login')) {
    return 'Kevin needs your help. Complete this in the browser, then click Resume.'
  }
  return result.message
}

export async function runMarketingResearchAutopilot(input: MarketingResearchAutopilotInput): Promise<MarketingResearchAutopilotResult> {
  const operatorName = input.operatorName?.trim() || 'Kevin'
  const queries = buildMarketingResearchQueries(input)
  const plan = buildMarketingResearchPlan(input)
  const actions: MarketingResearchAutopilotResult['actions'] = []
  const opportunities: MarketingOpportunity[] = []
  const websitesChecked: string[] = []
  let lastDelegation: DelegationResult | null = null
  let needsHelp = false

  for (const query of queries.slice(0, 3)) {
    const result: DelegationResult = await delegateSearch({
      query,
      projectId: input.projectId ?? undefined,
      requestedByRole: 'CEO',
      operatorName,
    }).catch(err => ({
      status: 'failed' as const,
      message: err instanceof Error ? err.message : 'Search failed.',
    }))
    lastDelegation = result
    const found = resultOpportunities(result, query)
    opportunities.push(...found)
    websitesChecked.push(...uniqueDomains(found))
    if (result.status === 'blocked' && simplifyDelegationMessage(result).includes('needs your help')) needsHelp = true
    actions.push({
      label: `Search: ${query}`,
      status: result.status,
      message: simplifyDelegationMessage(result),
      actionId: result.actionId,
      operatorId: result.operatorId,
    })
    if (opportunities.length >= 5 || needsHelp) break
  }

  const directTargets = isAikoProject(input.projectName, input.goal)
    ? AikoTargets
    : [
      { label: 'Reddit public search', url: `https://www.reddit.com/search/?q=${encodeURIComponent(input.projectName + ' marketing')}` },
      { label: 'LinkedIn company search', url: `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(input.projectName)}` },
    ]

  for (const target of directTargets.slice(0, needsHelp ? 2 : 1)) {
    const result: DelegationResult = await delegateOpenUrl({
      url: target.url,
      projectId: input.projectId ?? undefined,
      requestedByRole: 'CEO',
      operatorName,
    }).catch(err => ({
      status: 'failed' as const,
      message: err instanceof Error ? err.message : 'Website open failed.',
    } as DelegationResult))
    lastDelegation = result
    try {
      websitesChecked.push(new URL(target.url).hostname.replace(/^www\./, ''))
    } catch {
      websitesChecked.push(target.label)
    }
    actions.push({
      label: `Open: ${target.label}`,
      status: result.status,
      message: simplifyDelegationMessage(result),
      actionId: result.actionId,
      operatorId: result.operatorId,
      url: target.url,
    })
    if (result.status === 'blocked' && simplifyDelegationMessage(result).includes('needs your help')) {
      needsHelp = true
      break
    }
  }

  const uniqueSites = websitesChecked.filter((site, index, list) => site && list.indexOf(site) === index).slice(0, 8)
  const uniqueOpps = opportunities.filter((item, index, list) =>
    list.findIndex(other => other.url === item.url) === index
  ).slice(0, 8)

  const status: AutopilotStatus = needsHelp
    ? 'needs_your_help'
    : uniqueOpps.length > 0
      ? 'found_opportunity'
      : 'done'
  const summary = uniqueOpps.length > 0
    ? `Kevin checked ${uniqueSites.length || 'several'} public web source${uniqueSites.length === 1 ? '' : 's'} and found ${uniqueOpps.length} visible marketing opportunit${uniqueOpps.length === 1 ? 'y' : 'ies'}.`
    : 'Research finished, but no useful results were extracted. Try a more specific target or let Kevin open websites directly.'
  const recommended_next_action = uniqueOpps.length > 0
    ? `Review the strongest result, then ask Kevin to open it and prepare a draft outreach or content idea. Needs approval before posting or sending.`
    : `Try a more specific audience or channel, such as property managers, local business directories, Reddit communities, or competitor websites.`

  return {
    status,
    plan,
    summary,
    websites_checked: uniqueSites,
    opportunities: uniqueOpps,
    recommended_next_action,
    actions,
    delegation: lastDelegation,
  }
}
