import { runBrowserAgent } from '@/lib/agents/browser-agent'
import { db } from '@/lib/db/client'
import { LLMConfig } from '@/lib/models/provider'

export async function runLeadGenAgent(params: {
  leadId: string
  projectId: string
  agentId: string
  modelConfig: LLMConfig
}) {
  const { leadId, projectId, agentId, modelConfig } = params

  const leadResult = await db.query('SELECT * FROM leads WHERE id=$1', [leadId])
  const lead = leadResult.rows[0]
  if (!lead) throw new Error(`Lead ${leadId} not found`)

  await db.query(
    'UPDATE agents SET status=$1, current_task=$2, updated_at=NOW() WHERE id=$3',
    ['active', `Enriching: ${lead.company_name}`, agentId]
  )

  const startUrl = lead.website || `https://www.google.com/search?q=${encodeURIComponent((lead.company_name ?? '') + ' contact email')}`

  const extractedData = await runBrowserAgent({
    instruction: `Visit ${startUrl} and find: email address, phone number, LinkedIn profile URL, and the name of the decision maker. Extract only what you find — do not invent data.`,
    agentId,
    projectId,
    modelConfig,
  })

  if (Array.isArray(extractedData) && extractedData.length > 0) {
    const data = extractedData[0] as Record<string, string>
    await db.query(
      `UPDATE leads SET
        email      = COALESCE(NULLIF($1,''), email),
        phone      = COALESCE(NULLIF($2,''), phone),
        contact_name = COALESCE(NULLIF($3,''), contact_name),
        notes      = COALESCE(NULLIF($4,''), notes)
       WHERE id=$5`,
      [data.email, data.phone, data.contact_name ?? data.decision_maker, data.linkedin, leadId]
    )
  }

  await db.query(
    'UPDATE agents SET status=$1, progress=$2, latest_output=$3, updated_at=NOW() WHERE id=$4',
    ['idle', 100, `Enriched: ${lead.company_name}`, agentId]
  )
}
