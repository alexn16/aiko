import { runBrowserAgent } from '@/lib/agents/browser-agent'
import { runSalesValidationAgent } from '@/lib/agents/sales-validation-agent'
import { db } from '@/lib/db/client'
import { LLMConfig } from '@/lib/models/provider'

export async function runOutreachAgent(params: {
  projectId: string
  agentId: string
  modelConfig: LLMConfig
  salesModelConfig: LLMConfig
  inboxUrl: string
}) {
  const { projectId, agentId, modelConfig, salesModelConfig, inboxUrl } = params

  await db.query(
    'UPDATE agents SET status=$1, current_task=$2, updated_at=NOW() WHERE id=$3',
    ['active', 'Checking inbox for replies', agentId]
  )

  // Read-only: only navigate and extract — never click compose/reply
  const extractedData = await runBrowserAgent({
    instruction: `Go to ${inboxUrl}. This is a READ-ONLY task.
Look for replies to outreach messages. For each reply found, extract: sender email, sender name, subject line, reply snippet (first 200 chars), and whether the tone seems positive/negative/neutral.
DO NOT click compose, reply, forward, or any button that would create a new message.
Only use navigate, scroll, and extract actions.`,
    agentId,
    projectId,
    modelConfig,
  })

  if (Array.isArray(extractedData)) {
    for (const item of extractedData) {
      const reply = item as Record<string, string>
      if (!reply.sender_email) continue

      // Find the matching lead
      const leadResult = await db.query(
        'SELECT id FROM leads WHERE email=$1 AND project_id=$2 LIMIT 1',
        [reply.sender_email, projectId]
      )
      const lead = leadResult.rows[0]
      if (!lead) continue

      // Update lead status to replied
      await db.query(
        "UPDATE leads SET status='replied' WHERE id=$1",
        [lead.id]
      )

      // Score the reply
      await runSalesValidationAgent({
        leadId: lead.id,
        projectId,
        replyText: reply.snippet ?? '',
        modelConfig: salesModelConfig,
      })
    }
  }

  await db.query(
    'UPDATE agents SET status=$1, progress=$2, updated_at=NOW() WHERE id=$3',
    ['idle', 100, agentId]
  )
}
