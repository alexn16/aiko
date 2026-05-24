import { db } from '@/lib/db/client'
import { callAI } from '@/lib/ai/router'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Campaign {
  id: string
  project_id: string | null
  name: string
  objective: string | null
  audience: string | null
  channel: string
  status: string
  owner_role: string
  strategy_summary: string | null
  success_metric: string | null
  created_at: string
  updated_at: string
  // joined
  project_name?: string
  item_count?: number
  latest_check_status?: string
  latest_check_score?: number
}

export interface CampaignItem {
  id: string
  campaign_id: string
  approval_item_id: string | null
  output_id: string | null
  task_id: string | null
  item_type: string
  title: string
  content: string
  sequence_order: number
  status: string
  created_at: string
}

// ── Core CRUD ──────────────────────────────────────────────────────────────────

export async function createCampaign(params: {
  project_id?: string | null
  name: string
  objective?: string | null
  audience?: string | null
  channel?: string
  owner_role?: string
  strategy_summary?: string | null
  success_metric?: string | null
  status?: string
}): Promise<Campaign> {
  const result = await db.query(
    `INSERT INTO campaigns
       (project_id, name, objective, audience, channel, owner_role, strategy_summary, success_metric, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      params.project_id ?? null,
      params.name,
      params.objective ?? null,
      params.audience ?? null,
      params.channel ?? 'mixed',
      params.owner_role ?? 'Project Manager',
      params.strategy_summary ?? null,
      params.success_metric ?? null,
      params.status ?? 'draft',
    ]
  )
  return result.rows[0] as Campaign
}

export async function listCampaigns(filters: {
  project_id?: string
  status?: string
  channel?: string
  limit?: number
} = {}): Promise<Campaign[]> {
  const conditions: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (filters.project_id) {
    conditions.push(`c.project_id = $${idx++}`)
    values.push(filters.project_id)
  }
  if (filters.status) {
    conditions.push(`c.status = $${idx++}`)
    values.push(filters.status)
  }
  if (filters.channel) {
    conditions.push(`c.channel = $${idx++}`)
    values.push(filters.channel)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = filters.limit ?? 100

  try {
    const result = await db.query(
      `SELECT c.*, p.name AS project_name, COALESCE(ci.item_count, 0) AS item_count,
              lc.check_status AS latest_check_status, lc.check_score AS latest_check_score
       FROM campaigns c
       LEFT JOIN projects p ON p.id = c.project_id
       LEFT JOIN (
         SELECT campaign_id, COUNT(*) AS item_count
         FROM campaign_items
         GROUP BY campaign_id
       ) ci ON ci.campaign_id = c.id
       LEFT JOIN LATERAL (
         SELECT status AS check_status, readiness_score AS check_score
         FROM campaign_launch_checks
         WHERE campaign_id = c.id
         ORDER BY created_at DESC LIMIT 1
       ) lc ON true
       ${where}
       ORDER BY c.created_at DESC
       LIMIT ${limit}`,
      values
    )
    return result.rows as Campaign[]
  } catch {
    return []
  }
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  try {
    const result = await db.query(
      `SELECT c.*, p.name AS project_name, COALESCE(ci.item_count, 0) AS item_count
       FROM campaigns c
       LEFT JOIN projects p ON p.id = c.project_id
       LEFT JOIN (
         SELECT campaign_id, COUNT(*) AS item_count
         FROM campaign_items
         GROUP BY campaign_id
       ) ci ON ci.campaign_id = c.id
       WHERE c.id = $1`,
      [id]
    )
    return (result.rows[0] as Campaign) ?? null
  } catch {
    return null
  }
}

export async function updateCampaign(id: string, fields: {
  name?: string
  objective?: string | null
  audience?: string | null
  channel?: string
  status?: string
  strategy_summary?: string | null
  success_metric?: string | null
  owner_role?: string
}): Promise<Campaign | null> {
  const sets: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (fields.name !== undefined)             { sets.push(`name=$${idx++}`);             values.push(fields.name) }
  if (fields.objective !== undefined)        { sets.push(`objective=$${idx++}`);        values.push(fields.objective) }
  if (fields.audience !== undefined)         { sets.push(`audience=$${idx++}`);         values.push(fields.audience) }
  if (fields.channel !== undefined)          { sets.push(`channel=$${idx++}`);          values.push(fields.channel) }
  if (fields.status !== undefined)           { sets.push(`status=$${idx++}`);           values.push(fields.status) }
  if (fields.strategy_summary !== undefined) { sets.push(`strategy_summary=$${idx++}`); values.push(fields.strategy_summary) }
  if (fields.success_metric !== undefined)   { sets.push(`success_metric=$${idx++}`);   values.push(fields.success_metric) }
  if (fields.owner_role !== undefined)       { sets.push(`owner_role=$${idx++}`);       values.push(fields.owner_role) }

  if (sets.length === 0) return null

  sets.push(`updated_at=NOW()`)
  values.push(id)

  try {
    const result = await db.query(
      `UPDATE campaigns SET ${sets.join(', ')} WHERE id=$${idx} RETURNING *`,
      values
    )
    return (result.rows[0] as Campaign) ?? null
  } catch {
    return null
  }
}

// ── Campaign items ─────────────────────────────────────────────────────────────

export async function addApprovedOutputToCampaign(
  campaign_id: string,
  output_id: string
): Promise<CampaignItem | null> {
  try {
    const outputRes = await db.query(
      `SELECT * FROM agent_task_outputs WHERE id=$1`,
      [output_id]
    )
    const output = outputRes.rows[0]
    if (!output) return null

    const seqRes = await db.query(
      `SELECT COALESCE(MAX(sequence_order), 0) + 1 AS next_seq FROM campaign_items WHERE campaign_id=$1`,
      [campaign_id]
    )
    const nextSeq = parseInt(seqRes.rows[0]?.next_seq ?? '1', 10)

    const result = await db.query(
      `INSERT INTO campaign_items
         (campaign_id, output_id, item_type, title, content, sequence_order, status)
       VALUES ($1,$2,$3,$4,$5,$6,'approved')
       RETURNING *`,
      [campaign_id, output_id, output.output_type, output.title, output.content, nextSeq]
    )
    return result.rows[0] as CampaignItem
  } catch {
    return null
  }
}

export async function addApprovalItemToCampaign(
  campaign_id: string,
  approval_item_id: string
): Promise<CampaignItem | null> {
  try {
    const itemRes = await db.query(
      `SELECT * FROM approval_items WHERE id=$1`,
      [approval_item_id]
    )
    const item = itemRes.rows[0]
    if (!item) return null

    const seqRes = await db.query(
      `SELECT COALESCE(MAX(sequence_order), 0) + 1 AS next_seq FROM campaign_items WHERE campaign_id=$1`,
      [campaign_id]
    )
    const nextSeq = parseInt(seqRes.rows[0]?.next_seq ?? '1', 10)

    const result = await db.query(
      `INSERT INTO campaign_items
         (campaign_id, approval_item_id, item_type, title, content, sequence_order, status)
       VALUES ($1,$2,$3,$4,$5,$6,'approved')
       RETURNING *`,
      [campaign_id, approval_item_id, item.item_type, item.title, item.content, nextSeq]
    )
    return result.rows[0] as CampaignItem
  } catch {
    return null
  }
}

export async function listCampaignItems(campaign_id: string): Promise<CampaignItem[]> {
  try {
    const result = await db.query(
      `SELECT * FROM campaign_items WHERE campaign_id=$1 ORDER BY sequence_order ASC, created_at ASC`,
      [campaign_id]
    )
    return result.rows as CampaignItem[]
  } catch {
    return []
  }
}

export async function updateCampaignItem(id: string, fields: {
  status?: string
  sequence_order?: number
  content?: string
}): Promise<CampaignItem | null> {
  const sets: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (fields.status !== undefined)         { sets.push(`status=$${idx++}`);         values.push(fields.status) }
  if (fields.sequence_order !== undefined) { sets.push(`sequence_order=$${idx++}`); values.push(fields.sequence_order) }
  if (fields.content !== undefined)        { sets.push(`content=$${idx++}`);        values.push(fields.content) }

  if (sets.length === 0) return null

  sets.push(`updated_at=NOW()`)
  values.push(id)

  try {
    const result = await db.query(
      `UPDATE campaign_items SET ${sets.join(', ')} WHERE id=$${idx} RETURNING *`,
      values
    )
    return (result.rows[0] as CampaignItem) ?? null
  } catch {
    return null
  }
}

// ── Summary helpers ────────────────────────────────────────────────────────────

interface CampaignSummary {
  total: number
  by_status: Record<string, number>
  draft: Campaign[]
  ready: Campaign[]
  active: Campaign[]
}

export async function getCampaignSummaryForProject(project_id: string): Promise<CampaignSummary> {
  try {
    const all = await listCampaigns({ project_id, limit: 500 })
    return buildSummary(all)
  } catch {
    return { total: 0, by_status: {}, draft: [], ready: [], active: [] }
  }
}

export async function getCampaignSummaryForCompany(): Promise<CampaignSummary> {
  try {
    const all = await listCampaigns({ limit: 1000 })
    return buildSummary(all)
  } catch {
    return { total: 0, by_status: {}, draft: [], ready: [], active: [] }
  }
}

function buildSummary(campaigns: Campaign[]): CampaignSummary {
  const by_status: Record<string, number> = {}
  for (const c of campaigns) {
    by_status[c.status] = (by_status[c.status] ?? 0) + 1
  }
  return {
    total: campaigns.length,
    by_status,
    draft:  campaigns.filter(c => c.status === 'draft').slice(0, 3),
    ready:  campaigns.filter(c => c.status === 'ready_for_review').slice(0, 3),
    active: campaigns.filter(c => c.status === 'active').slice(0, 3),
  }
}

// ── AI generation ──────────────────────────────────────────────────────────────

export async function generateCampaignFromApprovedItems(
  project_id: string,
  opts?: { owner_role?: string }
): Promise<Campaign> {
  // 1. Load project
  let projectName = ''
  let projectGoal = ''
  let memoryNotes = ''

  try {
    const [projRes, memRes] = await Promise.all([
      db.query(`SELECT name, goal FROM projects WHERE id=$1`, [project_id]),
      db.query(`SELECT notes FROM project_memory WHERE project_id=$1`, [project_id]),
    ])
    if (projRes.rows[0]) {
      projectName = projRes.rows[0].name ?? ''
      projectGoal = projRes.rows[0].goal ?? ''
    }
    if (memRes.rows[0]?.notes) {
      memoryNotes = String(memRes.rows[0].notes)
    }
  } catch {
    // non-fatal
  }

  // 2. Load approved approval_items
  let approvedItems: Array<{ title: string; item_type: string }> = []
  try {
    const res = await db.query(
      `SELECT title, item_type FROM approval_items WHERE project_id=$1 AND status='approved' LIMIT 10`,
      [project_id]
    )
    approvedItems = res.rows
  } catch {
    // non-fatal
  }

  // 3. Load approved outputs
  let approvedOutputs: Array<{ title: string; output_type: string }> = []
  try {
    const res = await db.query(
      `SELECT title, output_type FROM agent_task_outputs WHERE project_id=$1 AND status='approved' LIMIT 10`,
      [project_id]
    )
    approvedOutputs = res.rows
  } catch {
    // non-fatal
  }

  // 4. Build prompts
  const outputList = approvedOutputs.map(o => `- ${o.title} (${o.output_type})`).join('\n') || '(none)'
  const itemList = approvedItems.map(i => `- ${i.title} (${i.item_type})`).join('\n') || '(none)'

  const systemPrompt = `You are a Project Manager AI for AÏKO, an AI marketing company. Build a structured campaign plan.

Project: ${projectName}${projectGoal ? ` — ${projectGoal}` : ''}
Memory: ${memoryNotes || '(none)'}

Approved outputs available:
${outputList}

Approved items:
${itemList}

Generate a campaign plan using these approved assets. Return ONLY valid JSON:
{
  "name": "Campaign name",
  "objective": "What this campaign achieves",
  "audience": "Target audience description",
  "channel": "email|linkedin|instagram|content|mixed|manual",
  "strategy_summary": "2-3 sentences on the campaign approach",
  "success_metric": "How success will be measured",
  "items": [
    { "title": "...", "content": "Brief description of this step", "item_type": "outreach_draft|note|campaign_proposal|report", "sequence_order": 1 }
  ]
}

Rules:
- items should reference the approved assets listed above
- sequence_order starts at 1
- Do not invent contacts, emails, or external sends
- This is a planning document only`

  // 5. Call AI
  const raw = await callAI({
    role: 'project_manager',
    messages: [{ role: 'user', content: systemPrompt }],
    maxTokens: 1200,
    temperature: 0.6,
  })

  // 6. Parse JSON
  let parsed: {
    name?: string
    objective?: string
    audience?: string
    channel?: string
    strategy_summary?: string
    success_metric?: string
    items?: Array<{ title: string; content: string; item_type: string; sequence_order: number }>
  } = {}

  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    // Fallback: create minimal campaign with raw text
    parsed = {
      name: `Campaign for ${projectName || 'project'}`,
      strategy_summary: raw.slice(0, 2000),
      items: [],
    }
  }

  // 7. Create campaign
  const campaign = await createCampaign({
    project_id,
    name: parsed.name ?? `Campaign for ${projectName || 'project'}`,
    objective: parsed.objective ?? null,
    audience: parsed.audience ?? null,
    channel: parsed.channel ?? 'mixed',
    strategy_summary: parsed.strategy_summary ?? null,
    success_metric: parsed.success_metric ?? null,
    owner_role: opts?.owner_role ?? 'Project Manager',
    status: 'draft',
  })

  // 8. Insert items
  if (Array.isArray(parsed.items) && parsed.items.length > 0) {
    for (const item of parsed.items) {
      try {
        await db.query(
          `INSERT INTO campaign_items
             (campaign_id, item_type, title, content, sequence_order, status)
           VALUES ($1,$2,$3,$4,$5,'draft')`,
          [
            campaign.id,
            item.item_type ?? 'note',
            item.title ?? 'Untitled step',
            item.content ?? '',
            item.sequence_order ?? 1,
          ]
        )
      } catch {
        // non-fatal — skip bad items
      }
    }
  }

  return campaign
}
