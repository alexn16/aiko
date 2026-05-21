import { callLLM, LLMConfig } from '@/lib/models/provider'
import { db } from '@/lib/db/client'

export async function runCustomAgent(params: {
  agentId: string
  projectId: string
  instruction: string
  systemPrompt: string
  modelConfig: LLMConfig
}): Promise<string> {
  const { agentId, projectId, instruction, systemPrompt, modelConfig } = params

  const agentRow = await db.query('SELECT name FROM agents WHERE id=$1', [agentId])
  const agentName = agentRow.rows[0]?.name ?? 'Custom Agent'

  await db.query(
    'UPDATE agents SET status=$1, current_task=$2, progress=$3, updated_at=NOW() WHERE id=$4',
    ['active', instruction.slice(0, 120), 10, agentId]
  )

  // Pull project context
  const projectResult = await db.query('SELECT * FROM projects WHERE id=$1', [projectId])
  const project = projectResult.rows[0]

  const output = await callLLM(modelConfig, [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Project: ${project?.name ?? ''}\nTarget market: ${project?.target_market ?? ''}\nValue prop: ${project?.value_prop ?? ''}\n\nInstruction: ${instruction}`,
    }
  ], { maxTokens: 1500 })

  await db.query(
    'INSERT INTO agent_logs (agent_id, project_id, action, details) VALUES ($1,$2,$3,$4)',
    [agentId, projectId, 'thought', { agent: agentName, output: output.slice(0, 500) }]
  )

  await db.query(
    'UPDATE agents SET status=$1, progress=$2, latest_output=$3, updated_at=NOW() WHERE id=$4',
    ['idle', 100, output.slice(0, 300), agentId]
  )

  return output
}
