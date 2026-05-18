import { callLLM, LLMConfig } from '@/lib/models/provider'
import { db } from '@/lib/db/client'

export async function runSalesValidationAgent(params: {
  leadId: string
  projectId: string
  replyText: string
  modelConfig: LLMConfig
}): Promise<{ score: number; status: string }> {
  const { leadId, projectId, replyText, modelConfig } = params

  const result = await callLLM(modelConfig, [
    {
      role: 'system',
      content: `You are a B2B sales qualification agent. Score the intent of the reply 1-10.
1-3=cold (disinterest, unsubscribe, wrong person), 4-6=warm (curious, wants more info), 7-10=hot (ready to meet, interested in pricing).
Return JSON: { "score": number, "reasoning": "one sentence" }`
    },
    { role: 'user', content: `Reply text:\n${replyText}` }
  ], { jsonMode: true, maxTokens: 150 })

  const { score } = JSON.parse(result)

  let status = 'new'
  if (score <= 3) status = 'rejected'
  else if (score <= 6) status = 'replied'
  else status = 'qualified'

  await db.query('UPDATE leads SET status=$1 WHERE id=$2', [status, leadId])

  await db.query(
    'INSERT INTO agent_logs (project_id, action, details) VALUES ($1,$2,$3)',
    [projectId, 'thought', { sales_score: score, lead_id: leadId, new_status: status }]
  )

  return { score, status }
}
