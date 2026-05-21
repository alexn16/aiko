import { callLLM } from '@/lib/models/provider'
import { getAllModelConfigs } from '@/lib/models/config'
import { runResearchAgent } from '@/lib/agents/research-agent'
import { runLeadGenAgent } from '@/lib/agents/leadgen-agent'
import { generateOutreachMessage } from '@/lib/agents/copywriting-agent'
import { runStrategyAgent } from '@/lib/agents/strategy-agent'
import { runReportingAgent } from '@/lib/agents/reporting-agent'
import { runCeoAgent } from '@/lib/agents/ceo-agent'
import { runProjectManagerAgent } from '@/lib/agents/project-manager-agent'
import { runSocialMediaAgent } from '@/lib/agents/social-media-agent'
import { runBrowserAgent } from '@/lib/agents/browser-agent'
import { runCustomAgent } from '@/lib/agents/custom-agent'
import { db } from '@/lib/db/client'

export async function orchestrate(params: {
  agentId: string
  projectId: string
  instruction: string
  onProgress?: (event: { type: string; data: unknown }) => void
}) {
  const { agentId, projectId, instruction, onProgress } = params

  const configs = await getAllModelConfigs()
  const fallbackConfig = configs['researchAgent'] ?? Object.values(configs)[0]

  if (!fallbackConfig) {
    throw new Error('No model configured. Please configure at least one model in Settings.')
  }

  // Fetch custom agents for this project so the router knows about them
  const customAgentsResult = await db.query(
    "SELECT name, role FROM agents WHERE project_id=$1 AND created_by NOT IN ('system') ORDER BY name",
    [projectId]
  )
  const customAgentNames = customAgentsResult.rows.map((a: { name: string }) => a.name)

  const allAgents = [
    'research', 'leadgen', 'copywriting', 'strategy', 'reporting',
    'ceo', 'pm', 'social', 'browser',
    ...customAgentNames,
  ]

  const intentResponse = await callLLM(fallbackConfig, [
    {
      role: 'system',
      content: `You are an AI task router. Given a user instruction, decide which agent should handle it.
Core agents: research, leadgen, copywriting, strategy, reporting, ceo, pm, social, browser.
Custom agents also available: ${customAgentNames.length > 0 ? customAgentNames.join(', ') : 'none'}.
Return JSON: { "agent": "agent_name", "leadId": "uuid or null", "channel": "email|linkedin|whatsapp|form or null", "platform": "linkedin or null" }
For custom agents, use their exact name as the "agent" value.`
    },
    { role: 'user', content: instruction }
  ], { jsonMode: true, maxTokens: 150 })

  let intent: { agent?: string; leadId?: string | null; channel?: string | null; platform?: string | null }
  try {
    intent = JSON.parse(intentResponse)
  } catch {
    intent = { agent: 'browser' }
  }
  if (!intent.agent) intent.agent = 'browser'

  const agentName = intent.agent as string
  const cfg = (slot: string) => configs[slot] ?? fallbackConfig

  // Check if this is a custom agent
  const customAgent = customAgentsResult.rows.find(
    (a: { name: string }) => a.name.toLowerCase() === agentName.toLowerCase()
  )
  if (customAgent) {
    const customAgentRow = await db.query(
      'SELECT id, system_prompt FROM agents WHERE project_id=$1 AND name=$2 LIMIT 1',
      [projectId, customAgent.name]
    )
    const row = customAgentRow.rows[0]
    if (row) {
      return runCustomAgent({
        agentId: row.id,
        projectId,
        instruction,
        systemPrompt: row.system_prompt ?? `You are ${customAgent.name}. ${customAgent.role}. Complete the given task thoroughly.`,
        modelConfig: fallbackConfig,
      })
    }
  }

  switch (agentName) {
    case 'research':
      return runResearchAgent({ instruction, projectId, agentId, modelConfig: cfg('researchAgent') })

    case 'leadgen':
      if (!intent.leadId) throw new Error('leadgen requires a leadId')
      return runLeadGenAgent({ leadId: intent.leadId, projectId, agentId, modelConfig: cfg('leadGenAgent') })

    case 'copywriting':
      if (!intent.leadId) throw new Error('copywriting requires a leadId')
      return generateOutreachMessage({
        leadId: intent.leadId,
        projectId,
        channel: (intent.channel ?? 'email') as 'email' | 'linkedin' | 'whatsapp' | 'form',
        modelConfig: cfg('copywritingAgent'),
        agentId,
        qualityModelConfig: cfg('qualityAgent'),
      })

    case 'strategy':
      return runStrategyAgent({ projectId, agentId, modelConfig: cfg('strategyAgent') })

    case 'reporting':
      return runReportingAgent({ projectId, agentId, modelConfig: cfg('reportingAgent') })

    case 'ceo':
      return runCeoAgent({ projectId, agentId, modelConfig: cfg('ceoAgent') })

    case 'pm':
      return runProjectManagerAgent({ projectId, agentId, modelConfig: cfg('projectManagerAgent') })

    case 'social':
      return runSocialMediaAgent({ projectId, agentId, platform: intent.platform ?? 'linkedin', modelConfig: cfg('socialMediaAgent') })

    case 'browser':
    default:
      return runBrowserAgent({
        instruction,
        agentId,
        projectId,
        modelConfig: cfg('browserAgent'),
        onProgress,
      })
  }
}
