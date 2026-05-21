import { callLLM, LLMConfig } from '@/lib/models/provider'
import { db } from '@/lib/db/client'

export interface AgentNeeded {
  name: string
  role: 'existing' | 'new'
  specialty?: string        // for new agents
  system_prompt?: string    // for new agents
  estimated_tokens: number
  tasks: string[]
}

export interface JobEvaluation {
  complexity: 'simple' | 'medium' | 'complex'
  plan: string
  agents_needed: AgentNeeded[]
  estimated_tokens: number
  cost_range: string
  new_agents_proposed: boolean
  reasoning: string
}

const EXISTING_AGENTS = [
  'Research Agent',
  'Lead Gen Agent',
  'Copywriting Agent',
  'Quality Agent',
  'Outreach Agent',
  'Sales Validation Agent',
  'Strategy Agent',
  'Social Media Agent',
  'Reporting Agent',
  'CEO Agent',
  'Project Manager Agent',
]

export async function evaluateJob(params: {
  instruction: string
  projectId: string
  modelConfig: LLMConfig
}): Promise<JobEvaluation> {
  const { instruction, projectId, modelConfig } = params

  // Get project context and current team
  const [projectResult, agentsResult] = await Promise.all([
    db.query('SELECT name, description, target_market, value_prop, strategy FROM projects WHERE id=$1', [projectId]),
    db.query('SELECT name, role, status, created_by FROM agents WHERE project_id=$1 ORDER BY name', [projectId]),
  ])

  const project = projectResult.rows[0]
  const currentAgents = agentsResult.rows

  const customAgents = currentAgents.filter(a => a.created_by !== 'system').map(a => a.name)
  const allAgentNames = Array.from(new Set([...EXISTING_AGENTS, ...customAgents]))

  const raw = await callLLM(modelConfig, [
    {
      role: 'system',
      content: `You are AÏKO's job evaluator. Given a marketing instruction, produce a detailed execution plan.

Available agents: ${allAgentNames.join(', ')}

For each task:
1. Decide which existing agents are needed
2. Decide if new specialist agents should be hired (only when no existing agent fits)
3. Estimate token usage honestly (each browser step ~400 tokens, each LLM call ~800 tokens)
4. Give a step-by-step plan

Token cost guidance:
- Simple (1-2 LLM calls): ~1,000-3,000 tokens
- Medium (browser + LLM pipeline): ~5,000-20,000 tokens
- Complex (multi-source research + outreach campaign): ~20,000-80,000 tokens

Return JSON:
{
  "complexity": "simple|medium|complex",
  "plan": "numbered step-by-step plan",
  "reasoning": "why this approach",
  "agents_needed": [
    {
      "name": "Research Agent",
      "role": "existing",
      "estimated_tokens": 8000,
      "tasks": ["Find 20 leads on Google Maps"]
    },
    {
      "name": "Spanish Outreach Specialist",
      "role": "new",
      "specialty": "Writes warm outreach in Spanish for SMBs",
      "system_prompt": "You are a Spanish-language B2B copywriter...",
      "estimated_tokens": 3000,
      "tasks": ["Write personalised emails in Spanish"]
    }
  ],
  "estimated_tokens": 11000,
  "cost_range": "$0.01–$0.15",
  "new_agents_proposed": false
}`
    },
    {
      role: 'user',
      content: `Project: ${project?.name ?? 'Unknown'}
Target market: ${project?.target_market ?? ''}
Description: ${project?.description ?? ''}

Job instruction: ${instruction}

Current team: ${currentAgents.map(a => `${a.name} (${a.status})`).join(', ')}`
    }
  ], { jsonMode: true, maxTokens: 1000 })

  try {
    const parsed = JSON.parse(raw) as JobEvaluation
    if (!Array.isArray(parsed.agents_needed)) parsed.agents_needed = []
    parsed.new_agents_proposed = parsed.agents_needed.some(a => a.role === 'new')
    return parsed
  } catch {
    return {
      complexity: 'medium',
      plan: 'Run the best available agent for this instruction.',
      reasoning: 'Evaluation could not be parsed — using safe defaults.',
      agents_needed: [{ name: 'Research Agent', role: 'existing', estimated_tokens: 5000, tasks: [instruction] }],
      estimated_tokens: 5000,
      cost_range: 'unknown',
      new_agents_proposed: false,
    }
  }
}
