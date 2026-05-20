import { callLLM, LLMConfig } from '@/lib/models/provider'
import { runReportingAgent } from '@/lib/agents/reporting-agent'
import { db } from '@/lib/db/client'

export async function runCeoAgent(params: {
  projectId: string
  agentId: string
  modelConfig: LLMConfig
}) {
  const { projectId, agentId, modelConfig } = params

  const report = await runReportingAgent({ projectId, agentId, modelConfig })

  const recommendations = await callLLM(modelConfig, [
    {
      role: 'system',
      content: `You are the CEO agent of an AI marketing operating system. Read the weekly report and update the project strategy with high-level recommendations.
Return JSON: { "strategic_update": "one paragraph", "priority_actions": ["action1", "action2"] }`
    },
    {
      role: 'user',
      content: `Latest report:\n${JSON.stringify(report, null, 2)}`
    }
  ], { jsonMode: true, maxTokens: 400 })

  let strategic: Record<string, unknown>
  try {
    strategic = JSON.parse(recommendations)
  } catch {
    strategic = { raw: recommendations }
  }

  // Merge into existing strategy
  const projectResult = await db.query('SELECT strategy FROM projects WHERE id=$1', [projectId])
  const existing = projectResult.rows[0]?.strategy ?? {}
  const updated = { ...existing, ceo_update: strategic, updated_at: new Date().toISOString() }

  await db.query('UPDATE projects SET strategy=$1 WHERE id=$2', [JSON.stringify(updated), projectId])
}
