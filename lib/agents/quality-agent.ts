import { callLLM, LLMConfig } from '@/lib/models/provider'
import { db } from '@/lib/db/client'

export async function runQualityAgent(params: {
  approvalId: string
  modelConfig: LLMConfig
}): Promise<{ passed: boolean; reason: string }> {
  const { approvalId, modelConfig } = params

  const result = await db.query('SELECT * FROM approvals WHERE id=$1', [approvalId])
  const approval = result.rows[0]
  if (!approval) throw new Error(`Approval ${approvalId} not found`)

  const review = await callLLM(modelConfig, [
    {
      role: 'system',
      content: `You are a quality control agent for B2B outreach messages.
Review the message for: spam trigger words, inappropriate tone, GDPR-sensitive language (promises of data removal etc.),
and obvious factual errors. Be lenient — only reject truly problematic messages.
Return JSON: { "passed": true/false, "reason": "brief explanation" }`
    },
    {
      role: 'user',
      content: `Channel: ${approval.channel}\nSubject: ${approval.subject ?? ''}\n\nBody:\n${approval.body}`
    }
  ], { jsonMode: true, maxTokens: 200 })

  const { passed, reason } = JSON.parse(review)

  const newStatus = passed ? 'quality_passed' : 'quality_rejected'
  await db.query(
    'UPDATE approvals SET status=$1 WHERE id=$2',
    [newStatus, approvalId]
  )

  await db.query(
    'INSERT INTO agent_logs (agent_id, project_id, action, details) SELECT a.id, a.project_id, $1, $2 FROM approvals ap JOIN agents a ON a.project_id=ap.project_id WHERE ap.id=$3 LIMIT 1',
    ['thought', { quality_check: passed ? 'passed' : 'rejected', reason }, approvalId]
  ).catch(() => {})

  return { passed, reason }
}
