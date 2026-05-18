import { callLLM, LLMConfig } from '@/lib/models/provider'
import { db } from '@/lib/db/client'

export async function runProjectManagerAgent(params: {
  projectId: string
  agentId: string
  modelConfig: LLMConfig
}) {
  const { projectId, agentId, modelConfig } = params

  const agentsResult = await db.query(
    `SELECT name, status, current_task, progress FROM agents WHERE project_id=$1`,
    [projectId]
  )

  const stuckAgents = agentsResult.rows.filter(a => a.status === 'error' || a.status === 'waiting')

  const summary = await callLLM(modelConfig, [
    {
      role: 'system',
      content: `You are a project manager agent. Review the team status and write a brief status update.
Return JSON: { "status": "on_track | at_risk | blocked", "summary": "one paragraph", "blockers": ["blocker1"] }`
    },
    {
      role: 'user',
      content: `Agents:\n${JSON.stringify(agentsResult.rows, null, 2)}\n\nStuck/Error agents: ${stuckAgents.length}`
    }
  ], { jsonMode: true, maxTokens: 300 })

  const pmSummary = JSON.parse(summary)

  await db.query(
    'INSERT INTO agent_logs (project_id, action, details) VALUES ($1,$2,$3)',
    [projectId, 'thought', { pm_check: pmSummary }]
  )

  await db.query(
    'UPDATE agents SET latest_output=$1, updated_at=NOW() WHERE id=$2',
    [pmSummary.summary, agentId]
  )

  return pmSummary
}
