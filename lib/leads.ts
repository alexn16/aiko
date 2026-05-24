import { db } from '@/lib/db/client'
import { callAI } from '@/lib/ai/router'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Lead {
  id: string
  project_id: string | null
  source_action_id: string | null
  source_output_id: string | null
  company_name: string | null
  contact_name: string | null
  email: string | null
  phone: string | null
  website: string | null
  linkedin_url: string | null
  location: string | null
  city: string | null
  country: string | null
  category: string | null
  score: number | null
  status: string
  source_url: string | null
  source_text: string | null
  notes: string | null
  created_by_role: string
  created_at: string
  updated_at: string | null
  // joined
  project_name?: string
}

export interface ExtractedLeadCandidate {
  company_name: string
  website: string | null
  location: string | null
  category: string | null
  contact_name: string | null
  email: string | null
  phone: string | null
  linkedin_url: string | null
  source_url: string | null
  reason: string
  confidence: number // 0-100
}

// ── CRUD ───────────────────────────────────────────────────────────────────────

export async function createLead(params: Partial<Lead> & { company_name: string }): Promise<Lead> {
  const result = await db.query(
    `INSERT INTO leads (
      project_id, source_action_id, source_output_id,
      company_name, contact_name, email, phone, website,
      linkedin_url, location, city, country,
      category, score, status, source_url, source_text,
      notes, created_by_role
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
    ) RETURNING *`,
    [
      params.project_id ?? null,
      params.source_action_id ?? null,
      params.source_output_id ?? null,
      params.company_name,
      params.contact_name ?? null,
      params.email ?? null,
      params.phone ?? null,
      params.website ?? null,
      params.linkedin_url ?? null,
      params.location ?? null,
      params.city ?? null,
      params.country ?? '',
      params.category ?? null,
      params.score ?? null,
      params.status ?? 'discovered',
      params.source_url ?? null,
      params.source_text ?? null,
      params.notes ?? null,
      params.created_by_role ?? 'system',
    ]
  )
  return result.rows[0] as Lead
}

export async function listLeads(filters?: {
  project_id?: string
  status?: string
  category?: string
  limit?: number
}): Promise<Lead[]> {
  const conditions: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (filters?.project_id) { conditions.push(`l.project_id=$${idx++}`); values.push(filters.project_id) }
  if (filters?.status) { conditions.push(`l.status=$${idx++}`); values.push(filters.status) }
  if (filters?.category) { conditions.push(`l.category=$${idx++}`); values.push(filters.category) }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = filters?.limit ?? 100

  try {
    const result = await db.query(
      `SELECT l.*, p.name AS project_name
       FROM leads l
       LEFT JOIN projects p ON p.id = l.project_id
       ${where}
       ORDER BY l.created_at DESC
       LIMIT ${limit}`,
      values
    )
    return result.rows as Lead[]
  } catch {
    return []
  }
}

export async function updateLead(id: string, fields: Partial<Lead>): Promise<Lead | null> {
  const sets: string[] = ['updated_at=NOW()']
  const values: unknown[] = []
  let idx = 1

  const updatable: (keyof Lead)[] = [
    'company_name', 'contact_name', 'email', 'phone', 'website',
    'linkedin_url', 'location', 'city', 'country', 'category',
    'score', 'status', 'source_url', 'source_text', 'notes',
    'created_by_role', 'project_id',
  ]

  for (const key of updatable) {
    if (key in fields) {
      sets.push(`${key}=$${idx++}`)
      values.push(fields[key] ?? null)
    }
  }

  if (sets.length === 1) return null // only updated_at, nothing to do
  values.push(id)

  const result = await db.query(
    `UPDATE leads SET ${sets.join(', ')} WHERE id=$${idx} RETURNING *`,
    values
  )
  return result.rows[0] as Lead ?? null
}

// ── Scoring ────────────────────────────────────────────────────────────────────

export function scoreLead(lead: Partial<Lead>): number {
  let score = 50 // base
  if (lead.email) score += 20
  if (lead.website) score += 10
  if (lead.phone) score += 10
  if (lead.location) score += 5
  if (lead.category) score += 5
  return Math.min(100, score)
}

// ── Summaries ──────────────────────────────────────────────────────────────────

export async function getLeadSummaryForProject(project_id: string): Promise<{
  total: number
  by_status: Record<string, number>
  needs_review: number
  approved: number
  recent: Lead[]
}> {
  try {
    const [countRes, recentRes] = await Promise.all([
      db.query(
        `SELECT status, COUNT(*) AS n FROM leads WHERE project_id=$1 GROUP BY status`,
        [project_id]
      ),
      db.query(
        `SELECT * FROM leads WHERE project_id=$1 ORDER BY created_at DESC LIMIT 5`,
        [project_id]
      ),
    ])

    const by_status: Record<string, number> = {}
    let total = 0
    for (const row of countRes.rows) {
      by_status[row.status] = parseInt(row.n, 10)
      total += parseInt(row.n, 10)
    }

    return {
      total,
      by_status,
      needs_review: by_status['needs_review'] ?? 0,
      approved: by_status['approved'] ?? 0,
      recent: recentRes.rows as Lead[],
    }
  } catch {
    return { total: 0, by_status: {}, needs_review: 0, approved: 0, recent: [] }
  }
}

export async function getLeadSummaryForCompany(): Promise<{
  total: number
  by_status: Record<string, number>
  needs_review: number
  approved: number
  recent: Lead[]
}> {
  try {
    const [countRes, recentRes] = await Promise.all([
      db.query(`SELECT status, COUNT(*) AS n FROM leads GROUP BY status`),
      db.query(`SELECT * FROM leads ORDER BY created_at DESC LIMIT 5`),
    ])

    const by_status: Record<string, number> = {}
    let total = 0
    for (const row of countRes.rows) {
      by_status[row.status] = parseInt(row.n, 10)
      total += parseInt(row.n, 10)
    }

    return {
      total,
      by_status,
      needs_review: by_status['needs_review'] ?? 0,
      approved: by_status['approved'] ?? 0,
      recent: recentRes.rows as Lead[],
    }
  } catch {
    return { total: 0, by_status: {}, needs_review: 0, approved: 0, recent: [] }
  }
}

// ── AI Extraction ──────────────────────────────────────────────────────────────

const EXTRACTION_SYSTEM_PROMPT = `You are a lead extraction agent for AÏKO. Extract structured lead candidates from web research results.

Rules:
- Only extract companies or contacts that are clearly relevant to the research context
- Do NOT invent email addresses, phone numbers, or LinkedIn URLs
- Only include contact details if they appear in the source text
- company_name is required; all other fields optional
- confidence: 0-100 based on how clearly the entity matches the research intent
- Return maximum 10 leads per extraction
- category should be a short label like "property management", "parking operator", "facility services", etc.`

function buildExtractionUserPrompt(
  description: string,
  targetUrl: string | null,
  sourceText: string
): string {
  return `Research context: ${description}
Source URL: ${targetUrl ?? 'unknown'}

Content to extract leads from:
${sourceText.slice(0, 3000)}

Return ONLY valid JSON array:
[
  {
    "company_name": "...",
    "website": "https://... or null",
    "location": "city, country or null",
    "category": "short label or null",
    "contact_name": "name or null",
    "email": "email@domain or null",
    "phone": "+34... or null",
    "linkedin_url": "https://linkedin.com/... or null",
    "source_url": "URL where this was found or null",
    "reason": "Why this company is relevant",
    "confidence": 75
  }
]`
}

function parseExtractionResponse(raw: string): ExtractedLeadCandidate[] {
  try {
    // Strip markdown code fences if present
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    // Find array start
    const start = cleaned.indexOf('[')
    const end = cleaned.lastIndexOf(']')
    if (start === -1 || end === -1) return []
    const parsed = JSON.parse(cleaned.slice(start, end + 1))
    if (!Array.isArray(parsed)) return []
    return parsed as ExtractedLeadCandidate[]
  } catch {
    return []
  }
}

export async function extractLeadsFromWebOperatorAction(
  action_id: string,
  project_id?: string
): Promise<Lead[]> {
  // 1. Load action
  let action: Record<string, unknown> | null = null
  try {
    const result = await db.query(
      `SELECT * FROM web_operator_actions WHERE id=$1`,
      [action_id]
    )
    action = result.rows[0] ?? null
  } catch {
    return []
  }
  if (!action) return []

  // 2. Build source text
  const output = typeof action.output === 'object' && action.output !== null
    ? action.output as Record<string, unknown>
    : {}

  let sourceText = ''
  if (Array.isArray(output.results)) {
    sourceText = (output.results as Array<{ title?: string; url?: string; snippet?: string }>)
      .slice(0, 15)
      .map(r => `${r.title ?? ''}\n${r.url ?? ''}\n${r.snippet ?? ''}`)
      .join('\n\n')
  } else if (output.text_preview) {
    sourceText = String(output.text_preview)
  } else if (output.title) {
    sourceText = `${output.title}\n${output.url ?? ''}\n${output.text_preview ?? ''}`
  } else {
    sourceText = JSON.stringify(output).slice(0, 3000)
  }

  if (!sourceText.trim()) return []

  // 3. Call AI
  let raw = ''
  try {
    raw = await callAI({
      role: 'research',
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildExtractionUserPrompt(
            String(action.description ?? 'Web research'),
            action.target_url ? String(action.target_url) : null,
            sourceText
          ),
        },
      ],
      maxTokens: 1500,
      temperature: 0.2,
    })
  } catch {
    return []
  }

  // 4. Parse
  const candidates = parseExtractionResponse(raw)

  // 5. Create leads
  const created: Lead[] = []
  const effectiveProjectId = project_id ?? (action.project_id ? String(action.project_id) : null) ?? null

  for (const candidate of candidates) {
    if (!candidate.company_name) continue
    if ((candidate.confidence ?? 0) < 30) continue

    const score = scoreLead(candidate)
    try {
      const lead = await createLead({
        project_id: effectiveProjectId,
        source_action_id: action_id,
        company_name: candidate.company_name,
        website: candidate.website ?? null,
        location: candidate.location ?? null,
        city: candidate.location?.split(',')[0]?.trim() ?? null,
        country: candidate.location?.split(',').pop()?.trim() ?? null,
        category: candidate.category ?? null,
        contact_name: candidate.contact_name ?? null,
        email: candidate.email ?? null,
        phone: candidate.phone ?? null,
        linkedin_url: candidate.linkedin_url ?? null,
        source_url: candidate.source_url ?? (action.target_url ? String(action.target_url) : null),
        source_text: candidate.reason ?? null,
        score,
        status: 'needs_review',
        notes: `Confidence: ${candidate.confidence ?? 0}%. ${candidate.reason ?? ''}`,
        created_by_role: action.agent_role ? String(action.agent_role) : 'Web Operator',
      })
      created.push(lead)
    } catch {
      // non-fatal: skip this candidate
    }
  }

  return created
}

export async function extractLeadsFromOutput(
  output_id: string,
  project_id?: string
): Promise<Lead[]> {
  // 1. Load output
  let output: Record<string, unknown> | null = null
  try {
    const result = await db.query(
      `SELECT * FROM agent_task_outputs WHERE id=$1`,
      [output_id]
    )
    output = result.rows[0] ?? null
  } catch {
    return []
  }
  if (!output) return []

  const sourceText = String(output.content ?? '')
  if (!sourceText.trim()) return []

  // 2. Call AI
  let raw = ''
  try {
    raw = await callAI({
      role: 'research',
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildExtractionUserPrompt(
            String(output.title ?? 'Agent output'),
            null,
            sourceText
          ),
        },
      ],
      maxTokens: 1500,
      temperature: 0.2,
    })
  } catch {
    return []
  }

  // 3. Parse
  const candidates = parseExtractionResponse(raw)

  // 4. Create leads
  const created: Lead[] = []
  const effectiveProjectId = project_id ?? (output.project_id ? String(output.project_id) : null) ?? null

  for (const candidate of candidates) {
    if (!candidate.company_name) continue
    if ((candidate.confidence ?? 0) < 30) continue

    const score = scoreLead(candidate)
    try {
      const lead = await createLead({
        project_id: effectiveProjectId,
        source_output_id: output_id,
        company_name: candidate.company_name,
        website: candidate.website ?? null,
        location: candidate.location ?? null,
        city: candidate.location?.split(',')[0]?.trim() ?? null,
        country: candidate.location?.split(',').pop()?.trim() ?? null,
        category: candidate.category ?? null,
        contact_name: candidate.contact_name ?? null,
        email: candidate.email ?? null,
        phone: candidate.phone ?? null,
        linkedin_url: candidate.linkedin_url ?? null,
        source_url: candidate.source_url ?? null,
        source_text: candidate.reason ?? null,
        score,
        status: 'needs_review',
        notes: `Confidence: ${candidate.confidence ?? 0}%. ${candidate.reason ?? ''}`,
        created_by_role: output.agent_role ? String(output.agent_role) : 'system',
      })
      created.push(lead)
    } catch {
      // non-fatal: skip this candidate
    }
  }

  return created
}
