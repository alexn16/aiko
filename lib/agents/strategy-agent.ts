import { callLLM, LLMConfig } from '@/lib/models/provider'
import { db } from '@/lib/db/client'

export async function runStrategyAgent(params: {
  projectId: string
  agentId: string
  modelConfig: LLMConfig
}) {
  const { projectId, agentId, modelConfig } = params

  const projectResult = await db.query('SELECT * FROM projects WHERE id=$1', [projectId])
  const project = projectResult.rows[0]
  if (!project) throw new Error(`Project ${projectId} not found`)

  await db.query(
    'UPDATE agents SET status=$1, current_task=$2, updated_at=NOW() WHERE id=$3',
    ['active', 'Generating strategy', agentId]
  )

  const result = await callLLM(modelConfig, [
    {
      role: 'system',
      content: `You are a B2B marketing strategy agent. Given a project brief, produce a structured marketing strategy.
Return JSON with: {
  "icp": { "company_size": "", "industry": "", "geography": "", "pain_points": [] },
  "channels": [{ "name": "email|linkedin|whatsapp", "priority": 1-5, "rationale": "" }],
  "messaging": { "headline": "", "value_prop": "", "cta": "" },
  "sprint_goals": ["goal1", "goal2", "goal3"]
}`
    },
    {
      role: 'user',
      content: `Project: ${project.name}
Description: ${project.description}
Target market: ${project.target_market}
Value proposition: ${project.value_prop}`
    }
  ], { jsonMode: true, maxTokens: 800 })

  let strategy: Record<string, unknown>
  try {
    strategy = JSON.parse(result)
  } catch {
    strategy = { raw: result }
  }

  // Merge with existing strategy (preserve ceo_update and prior fields)
  const existing = await db.query('SELECT strategy FROM projects WHERE id=$1', [projectId])
  const prior = existing.rows[0]?.strategy ?? {}
  const merged = { ...prior, ...strategy, updated_at: new Date().toISOString() }

  await db.query(
    'UPDATE projects SET strategy=$1 WHERE id=$2',
    [JSON.stringify(merged), projectId]
  )

  await db.query(
    'UPDATE agents SET status=$1, latest_output=$2, progress=$3, updated_at=NOW() WHERE id=$4',
    ['idle', 'Strategy generated', 100, agentId]
  )

  return strategy
}
