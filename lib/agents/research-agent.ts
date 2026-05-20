import { callLLM, LLMConfig } from '@/lib/models/provider'
import { runBrowserAgent } from '@/lib/agents/browser-agent'
import { db } from '@/lib/db/client'
import { geocodeLeadIfNeeded } from '@/lib/leads/geocode'

const EXTRACTION_INSTRUCTION = (baseInstruction: string) => `
${baseInstruction}

EXTRACTION RULES:
- For every company or business you find, extract using the "extract" action with this JSON shape:
  { "leads": [ { "company_name": "...", "contact_name": "...", "email": "...", "phone": "...", "website": "...", "city": "...", "country": "..." } ] }
- Only include fields you actually see on the page. Never invent or guess data.
- Extract in batches of 5-10 leads per extract action.
- After extracting from one page, scroll down or navigate to the next page and continue.
- Stop and use "done" when you have extracted at least 10 leads OR have covered all visible results.
- If a page requires login, extract what you can from public view and navigate elsewhere.
- Cookie/consent banners: always dismiss them first before doing anything else.
`

export async function runResearchAgent(params: {
  instruction: string
  projectId: string
  agentId: string
  modelConfig: LLMConfig
}) {
  const { instruction, projectId, agentId, modelConfig } = params

  await db.query(
    'UPDATE agents SET status=$1, current_task=$2, progress=$3, updated_at=NOW() WHERE id=$4',
    ['active', `Planning: ${instruction.slice(0, 80)}`, 5, agentId]
  )

  // Fetch project context for smarter planning
  const projectResult = await db.query('SELECT target_market, description FROM projects WHERE id=$1', [projectId])
  const project = projectResult.rows[0]

  let planData: { needsBrowser: boolean; urls: string[]; notes?: string }

  try {
    const plan = await callLLM(modelConfig, [
      {
        role: 'system',
        content: `You are a B2B lead research planner. Given an instruction and project context, decide the best strategy.
Return JSON:
{
  "needsBrowser": true/false,
  "urls": ["url1", "url2"],
  "notes": "brief strategy note"
}

URL guidance by intent:
- Local businesses by city/type → Google Maps: "https://www.google.com/maps/search/{type}+in+{city}"
- Tech/SaaS companies → "https://www.ycombinator.com/companies", "https://wellfound.com/startups"
- LinkedIn company search → "https://www.linkedin.com/search/results/companies/?keywords={query}"
- General directories → "https://www.crunchbase.com/discover/organizations?field_ids=short_description,location_identifiers,num_employees_enum"
- E-commerce/retail → Google Maps or "https://www.yellowpages.com/search?search_terms={type}&geo_location_terms={city}"
- Freelancers/agencies → "https://clutch.co/agencies", "https://www.upwork.com/search/profiles/"
- European businesses → "https://www.europages.com/companies/{type}"
- Specific country/region directories → use the most relevant local directory
- Provide 1-3 URLs to try in order (most promising first).`
      },
      {
        role: 'user',
        content: `Instruction: ${instruction}\nProject target market: ${project?.target_market ?? 'unknown'}\nProject description: ${project?.description ?? ''}`
      }
    ], { jsonMode: true, maxTokens: 400 })

    planData = JSON.parse(plan)
    if (!Array.isArray(planData.urls)) planData.urls = []
  } catch {
    planData = { needsBrowser: true, urls: [] }
  }

  if (planData.needsBrowser && planData.urls.length > 0) {
    // Try each URL in order, stop when we have leads
    for (const startUrl of planData.urls.slice(0, 3)) {
      await db.query(
        'UPDATE agents SET current_task=$1, updated_at=NOW() WHERE id=$2',
        [`Searching: ${startUrl.slice(0, 80)}`, agentId]
      )

      const extractedData = await runBrowserAgent({
        instruction: EXTRACTION_INSTRUCTION(`${instruction}\n\nStart at: ${startUrl}`),
        agentId,
        projectId,
        modelConfig,
      })

      let inserted = 0
      if (Array.isArray(extractedData)) {
        for (const item of extractedData) {
          if (!item || typeof item !== 'object') continue
          const obj = item as Record<string, unknown>
          const leads = Array.isArray(obj.leads) ? obj.leads : [obj]

          for (const rawLead of leads) {
            const l = rawLead as Record<string, string>
            if (!l.company_name) continue

            const result = await db.query(
              `INSERT INTO leads (project_id, company_name, contact_name, email, phone, website, city, country, source, source_url)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
               ON CONFLICT DO NOTHING
               RETURNING id`,
              [
                projectId,
                l.company_name?.trim(),
                l.contact_name?.trim() || null,
                l.email?.trim()?.toLowerCase() || null,
                l.phone?.trim() || null,
                l.website?.trim() || null,
                l.city?.trim() || null,
                l.country?.trim() || null,
                'research_agent',
                startUrl,
              ]
            )

            if (result.rows[0]?.id && l.city) {
              const country = l.country?.trim() || null
              geocodeLeadIfNeeded(result.rows[0].id, l.city, country ?? undefined).catch(() => {})
              inserted++
            }
          }
        }
      }

      if (inserted > 0) {
        await db.query(
          'INSERT INTO agent_logs (agent_id, project_id, action, details) VALUES ($1,$2,$3,$4)',
          [agentId, projectId, 'thought', { source: startUrl, leads_inserted: inserted }]
        )
        // If we got a decent batch from this source, no need to try the next URL
        if (inserted >= 5) break
      }
    }
  }

  await db.query(
    'UPDATE agents SET status=$1, progress=$2, latest_output=$3, updated_at=NOW() WHERE id=$4',
    ['idle', 100, `Research complete for: ${instruction.slice(0, 60)}`, agentId]
  )
}
