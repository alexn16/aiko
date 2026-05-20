import { callLLM, LLMConfig } from '@/lib/models/provider'
import { db } from '@/lib/db/client'

export async function runSalesValidationAgent(params: {
  leadId: string
  projectId: string
  replyText: string
  modelConfig: LLMConfig
}): Promise<{ score: number; status: string; reasoning: string }> {
  const { leadId, projectId, replyText, modelConfig } = params

  const raw = await callLLM(modelConfig, [
    {
      role: 'system',
      content: `You are a B2B sales qualification agent. Score the intent of the reply 1-10.
1-3 = cold (disinterest, unsubscribe request, wrong person, out of office).
4-6 = warm (curious, wants more info, forward to colleague).
7-10 = hot (wants to meet, interested in pricing, asks for demo).
Return JSON: { "score": number, "reasoning": "one sentence explaining the score" }`
    },
    { role: 'user', content: `Reply:\n${replyText.slice(0, 2000)}` }
  ], { jsonMode: true, maxTokens: 200 })

  let score = 3
  let reasoning = 'Could not parse reply'
  try {
    const parsed = JSON.parse(raw)
    score = Math.max(1, Math.min(10, Number(parsed.score) || 3))
    reasoning = String(parsed.reasoning ?? '')
  } catch {
    // keep defaults
  }

  const status = score <= 3 ? 'rejected' : score <= 6 ? 'replied' : 'qualified'

  await db.query('UPDATE leads SET status=$1 WHERE id=$2', [status, leadId])

  await db.query(
    'INSERT INTO agent_logs (project_id, action, details) VALUES ($1,$2,$3)',
    [projectId, 'thought', { sales_score: score, reasoning, lead_id: leadId, new_status: status }]
  ).catch(() => {})

  return { score, status, reasoning }
}
