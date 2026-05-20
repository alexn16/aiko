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
    'UPDATE agents SET status=$1, current_task=$2, progress=$3, updated_at=NOW() WHERE id=$4',
    ['active', `Enriching: ${lead.company_name}`, 5, agentId]
  )

  // Build a prioritized list of pages to try
  const companyQuery = encodeURIComponent(`${lead.company_name} ${lead.city ?? ''}`.trim())
  const urls: string[] = []
  if (lead.website) {
    urls.push(lead.website)
    // Common contact/team pages on their own website
    const base = lead.website.replace(/\/$/, '')
    urls.push(`${base}/contact`, `${base}/about`, `${base}/team`, `${base}/contact-us`)
  }
  urls.push(
    `https://www.google.com/search?q=${companyQuery}+contact+email+CEO`,
    `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(lead.company_name ?? '')}`,
  )

  const instruction = `
You are enriching an existing B2B lead record. The company is: "${lead.company_name}"${lead.city ? ` in ${lead.city}` : ''}.

Your goal: find the REAL contact details for this specific company.
Start with: ${urls[0]}
If that page doesn't have contact info, also try the /contact, /about, and /team sub-pages.
Then try LinkedIn or Google if needed.

Extract ONE "extract" action with this JSON:
{
  "email": "decision_maker@company.com",
  "phone": "+1 555 000 0000",
  "contact_name": "First Last",
  "contact_title": "CEO / Founder / ...",
  "linkedin_url": "https://linkedin.com/in/..."
}

Only extract fields you actually find. Skip fields you cannot verify.
Do NOT invent or guess any data. If you find nothing after 10 steps, use "done".
Cookie banners: dismiss them immediately before doing anything else.
`.trim()

  const extractedData = await runBrowserAgent({
    instruction,
    agentId,
    projectId,
    modelConfig,
  })

  if (Array.isArray(extractedData) && extractedData.length > 0) {
    const data = extractedData[0] as Record<string, string>

    // Store LinkedIn in notes (no dedicated column yet), everything else in proper columns
    const notes = [
      data.linkedin_url ? `LinkedIn: ${data.linkedin_url}` : null,
      data.contact_title ? `Title: ${data.contact_title}` : null,
      lead.notes,
    ].filter(Boolean).join(' | ') || null

    await db.query(
      `UPDATE leads SET
         email        = COALESCE(NULLIF($1,''), email),
         phone        = COALESCE(NULLIF($2,''), phone),
         contact_name = COALESCE(NULLIF($3,''), contact_name),
         notes        = $4,
         updated_at   = NOW()
       WHERE id=$5`,
      [
        data.email?.trim()?.toLowerCase() || '',
        data.phone?.trim() || '',
        (data.contact_name ?? data.decision_maker ?? '').trim() || '',
        notes,
        leadId,
      ]
    )
  }

  await db.query(
    'UPDATE agents SET status=$1, progress=$2, latest_output=$3, updated_at=NOW() WHERE id=$4',
    ['idle', 100, `Enriched: ${lead.company_name}`, agentId]
  )
}
