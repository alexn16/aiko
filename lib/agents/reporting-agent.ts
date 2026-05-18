import { callLLM, LLMConfig } from '@/lib/models/provider'
import { db } from '@/lib/db/client'

export async function runReportingAgent(params: {
  projectId: string
  agentId: string
  modelConfig: LLMConfig
}) {
  const { projectId, agentId, modelConfig } = params

  await db.query(
    'UPDATE agents SET status=$1, current_task=$2, updated_at=NOW() WHERE id=$3',
    ['active', 'Generating report', agentId]
  )

  const [leadsResult, approvalsResult, logsResult, campaignsResult] = await Promise.all([
    db.query(
      `SELECT status, COUNT(*) as count FROM leads WHERE project_id=$1 GROUP BY status`,
      [projectId]
    ),
    db.query(
      `SELECT status, COUNT(*) as count FROM approvals WHERE project_id=$1 GROUP BY status`,
      [projectId]
    ),
    db.query(
      `SELECT action, COUNT(*) as count FROM agent_logs WHERE project_id=$1
       AND created_at > NOW() - INTERVAL '7 days' GROUP BY action`,
      [projectId]
    ),
    db.query(
      `SELECT name, stats FROM campaigns WHERE project_id=$1 AND status='active'`,
      [projectId]
    ),
  ])

  const metrics = {
    leads: leadsResult.rows,
    approvals: approvalsResult.rows,
    activity: logsResult.rows,
    campaigns: campaignsResult.rows,
  }

  const synthesis = await callLLM(modelConfig, [
    {
      role: 'system',
      content: `You are a marketing reporting agent. Analyse the provided metrics and produce a structured report.
Return JSON: {
  "summary": "2-3 sentence executive summary",
  "metrics": { "total_leads": 0, "contacted": 0, "replied": 0, "qualified": 0, "pending_approval": 0 },
  "agentPerformance": [{ "name": "", "highlight": "" }],
  "recommendations": ["action1", "action2", "action3"]
}`
    },
    {
      role: 'user',
      content: `Weekly metrics:\n${JSON.stringify(metrics, null, 2)}`
    }
  ], { jsonMode: true, maxTokens: 800 })

  const report = JSON.parse(synthesis)

  await db.query(
    'INSERT INTO agent_logs (project_id, action, details) VALUES ($1,$2,$3)',
    [projectId, 'message_generated', { report_type: 'weekly', report }]
  )

  await db.query(
    'UPDATE agents SET status=$1, progress=$2, latest_output=$3, updated_at=NOW() WHERE id=$4',
    ['idle', 100, report.summary, agentId]
  )

  return report
}
