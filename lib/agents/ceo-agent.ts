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

  // Get current team
  const teamResult = await db.query(
    'SELECT name, role, status, created_by FROM agents WHERE project_id=$1',
    [projectId]
  )
  const team = teamResult.rows

  const recommendations = await callLLM(modelConfig, [
    {
      role: 'system',
      content: `You are the CEO of an AI marketing company. You have read the weekly report and must:
1. Update the strategic direction
2. Decide if any new specialist agents should be hired based on workload or skill gaps
3. List concrete priority actions

Current team: ${team.map(a => `${a.name} (${a.status})`).join(', ')}

Return JSON:
{
  "strategic_update": "one paragraph",
  "priority_actions": ["action1", "action2"],
  "hire_recommendations": [
    {
      "name": "Agent Name",
      "role": "What they specialise in",
      "system_prompt": "Detailed instructions for this agent",
      "reason": "Why they are needed now"
    }
  ]
}`
    },
    {
      role: 'user',
      content: `Latest report:\n${JSON.stringify(report, null, 2)}`
    }
  ], { jsonMode: true, maxTokens: 800 })

  let strategic: Record<string, unknown>
  try {
    strategic = JSON.parse(recommendations)
  } catch {
    strategic = { raw: recommendations }
  }

  // Auto-hire agents recommended by CEO (only if not already on team)
  const hireRecs = Array.isArray(strategic.hire_recommendations) ? strategic.hire_recommendations as Array<{
    name: string; role: string; system_prompt?: string; reason?: string
  }> : []

  const hired: string[] = []
  for (const rec of hireRecs.slice(0, 2)) { // max 2 auto-hires per cycle
    if (!rec.name?.trim()) continue
    const exists = team.find(a => a.name === rec.name.trim())
    if (!exists) {
      await db.query(
        `INSERT INTO agents (project_id, name, role, system_prompt, created_by, status)
         VALUES ($1,$2,$3,$4,'ceo','idle')`,
        [projectId, rec.name.trim(), rec.role ?? rec.name, rec.system_prompt ?? null]
      ).catch(() => {}) // ignore conflict
      hired.push(rec.name)
    }
  }

  if (hired.length > 0) {
    await db.query(
      'INSERT INTO agent_logs (agent_id, project_id, action, details) VALUES ($1,$2,$3,$4)',
      [agentId, projectId, 'thought', { ceo_hired: hired, reason: 'CEO auto-hire based on weekly report' }]
    )
  }

  // Merge into existing strategy
  const projectResult = await db.query('SELECT strategy FROM projects WHERE id=$1', [projectId])
  const existing = projectResult.rows[0]?.strategy ?? {}
  const updated = {
    ...existing,
    ceo_update: {
      strategic_update: strategic.strategic_update,
      priority_actions: strategic.priority_actions,
      hire_recommendations: hireRecs,
    },
    updated_at: new Date().toISOString(),
  }

  await db.query('UPDATE projects SET strategy=$1 WHERE id=$2', [JSON.stringify(updated), projectId])
}
