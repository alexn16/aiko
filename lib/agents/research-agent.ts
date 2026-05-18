import { callLLM, LLMConfig } from '@/lib/models/provider'
import { runBrowserAgent } from '@/lib/agents/browser-agent'
import { db } from '@/lib/db/client'
import { geocodeLeadIfNeeded } from '@/lib/leads/geocode'

export async function runResearchAgent(params: {
  instruction: string
  projectId: string
  agentId: string
  modelConfig: LLMConfig
}) {
  const { instruction, projectId, agentId, modelConfig } = params

  await db.query(
    'UPDATE agents SET status=$1, current_task=$2, progress=$3, updated_at=NOW() WHERE id=$4',
    ['active', `Planning: ${instruction}`, 5, agentId]
  )

  const plan = await callLLM(modelConfig, [
    {
      role: 'system',
      content: `You are a B2B marketing research agent. Your job is to find leads and market information.
Given an instruction, decide if it requires browser navigation or can be answered from knowledge.
Return JSON: { "needsBrowser": true/false, "url": "starting URL if needsBrowser", "searchQuery": "if not browser" }`
    },
    { role: 'user', content: instruction }
  ], { jsonMode: true, maxTokens: 300 })

  const planData = JSON.parse(plan)

  if (planData.needsBrowser) {
    const extractedData = await runBrowserAgent({
      instruction: `${instruction}\n\nFor each result found, extract: company name, contact name, email, phone, website, city. Return all findings using the "extract" action.`,
      agentId,
      projectId,
      modelConfig,
    })

    if (Array.isArray(extractedData)) {
      for (const item of extractedData) {
        if (item && typeof item === 'object') {
          const leads = Array.isArray((item as Record<string, unknown>).leads)
            ? (item as Record<string, unknown[]>).leads
            : [item]
          for (const lead of leads) {
            const l = lead as Record<string, string>
            const result = await db.query(
              `INSERT INTO leads (project_id, company_name, contact_name, email, phone, website, city, source)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
               ON CONFLICT DO NOTHING
               RETURNING id`,
              [projectId, l.company_name, l.contact_name, l.email, l.phone, l.website, l.city, 'browser_agent']
            )
            if (result.rows[0]?.id && l.city) {
              geocodeLeadIfNeeded(result.rows[0].id, l.city, 'ES').catch(() => {})
            }
          }
        }
      }
    }
  }

  await db.query(
    'UPDATE agents SET status=$1, progress=$2, latest_output=$3, updated_at=NOW() WHERE id=$4',
    ['idle', 100, 'Research complete', agentId]
  )
}
