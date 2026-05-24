import { db } from '@/lib/db/client'
import { callAI } from '@/lib/ai/router'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface LaunchCheck {
  key: string
  label: string
  passed: boolean
  required: boolean
  note?: string
}

export interface CampaignLaunchCheckResult {
  id: string
  campaign_id: string
  project_id: string | null
  status: string        // not_ready | needs_attention | ready | blocked
  readiness_score: number  // 0-100
  checks: LaunchCheck[]
  blockers: string[]
  warnings: string[]
  recommended_actions: string[]
  summary: string
  created_at: string
}

// ── Core functions ─────────────────────────────────────────────────────────────

export async function runCampaignLaunchCheck(campaign_id: string): Promise<CampaignLaunchCheckResult> {
  // Step 1 — Load data
  const campaignRes = await db.query(`
    SELECT c.*, p.name AS project_name, p.goal AS project_goal,
           pm.name AS pm_name,
           pm_mem.notes AS memory_notes,
           pm_map.nodes AS map_nodes
    FROM campaigns c
    LEFT JOIN projects p ON p.id = c.project_id
    LEFT JOIN project_managers pm ON pm.id = (SELECT assigned_pm_id FROM projects WHERE id = c.project_id LIMIT 1)
    LEFT JOIN project_memory pm_mem ON pm_mem.project_id = c.project_id
    LEFT JOIN project_map pm_map ON pm_map.project_id = c.project_id
    WHERE c.id = $1
  `, [campaign_id])

  const campaign = campaignRes.rows[0]
  if (!campaign) {
    throw new Error(`Campaign not found: ${campaign_id}`)
  }

  const itemsRes = await db.query(
    'SELECT * FROM campaign_items WHERE campaign_id = $1 ORDER BY sequence_order ASC',
    [campaign_id]
  )
  const items = itemsRes

  // Load approval items linked to campaign items (those with approval_item_id)
  const linkedApprovalIds = items.rows
    .filter((i: { approval_item_id: string | null }) => i.approval_item_id)
    .map((i: { approval_item_id: string }) => i.approval_item_id)

  let approvalItems: Array<{ id: string; status: string }> = []
  if (linkedApprovalIds.length > 0) {
    const res = await db.query(
      `SELECT * FROM approval_items WHERE id = ANY($1)`,
      [linkedApprovalIds]
    )
    approvalItems = res.rows
  }

  // Step 2 — Run rule-based checks
  const checks: LaunchCheck[] = [
    {
      key: 'has_objective',
      label: 'Campaign objective',
      passed: !!campaign.objective,
      required: true,
    },
    {
      key: 'has_audience',
      label: 'Target audience',
      passed: !!campaign.audience,
      required: true,
    },
    {
      key: 'has_channel',
      label: 'Channel',
      passed: !!campaign.channel,
      required: true,
      note: campaign.channel === 'mixed' ? 'Channel is set to "mixed" — consider specifying a primary channel' : undefined,
    },
    {
      key: 'has_strategy',
      label: 'Strategy summary',
      passed: !!campaign.strategy_summary,
      required: false,
    },
    {
      key: 'has_success_metric',
      label: 'Success metric',
      passed: !!campaign.success_metric,
      required: false,
    },
    {
      key: 'has_items',
      label: 'Campaign has items',
      passed: items.rows.length > 0,
      required: true,
    },
    {
      key: 'no_rejected_items',
      label: 'No rejected items',
      passed: !items.rows.some((i: { status: string }) => i.status === 'rejected'),
      required: true,
    },
    {
      key: 'external_items_approved',
      label: 'External items approved',
      passed: approvalItems.length === 0 || approvalItems.every(a => a.status === 'approved'),
      required: true,
    },
    {
      key: 'campaign_not_archived',
      label: 'Campaign is not archived',
      passed: campaign.status !== 'archived',
      required: true,
    },
    {
      key: 'has_assigned_pm',
      label: 'Assigned Project Manager',
      passed: !!campaign.pm_name,
      required: false,
    },
    {
      key: 'has_project_memory',
      label: 'Project memory available',
      passed: !!campaign.memory_notes,
      required: false,
    },
    {
      key: 'has_project_map',
      label: 'Project map available',
      passed: !!(campaign.map_nodes && campaign.map_nodes.length > 0),
      required: false,
    },
  ]

  // Step 3 — Compute readiness
  const requiredChecks = checks.filter(c => c.required)
  const passedRequired = requiredChecks.filter(c => c.passed).length
  const totalRequired = requiredChecks.length

  const optionalChecks = checks.filter(c => !c.required)
  const passedOptional = optionalChecks.filter(c => c.passed).length
  const totalOptional = optionalChecks.length

  // Score: required = 70% weight, optional = 30% weight
  const requiredScore = totalRequired > 0 ? (passedRequired / totalRequired) * 70 : 70
  const optionalScore = totalOptional > 0 ? (passedOptional / totalOptional) * 30 : 30
  const readiness_score = Math.round(requiredScore + optionalScore)

  // Status determination
  const failedRequired = requiredChecks.filter(c => !c.passed)
  const blockers: string[] = []
  const warnings: string[] = []

  if (failedRequired.length > 0) {
    failedRequired.forEach(c => blockers.push(c.label + ' is missing or failed'))
  }

  // Warnings for optional
  checks.filter(c => !c.required && !c.passed).forEach(c => {
    warnings.push(c.label + ' is not set — recommended before launch')
  })

  // Channel 'mixed' warning
  if (campaign.channel === 'mixed') {
    warnings.push('Channel is set to "mixed" — specify a primary channel before launch')
  }

  let status: string
  if (campaign.status === 'archived') {
    status = 'blocked'
  } else if (blockers.length > 0) {
    status = readiness_score >= 50 ? 'needs_attention' : 'not_ready'
  } else if (warnings.length > 0) {
    status = 'needs_attention'
  } else {
    status = 'ready'
  }

  // Step 4 — AI summary (optional, wrapped in try/catch)
  let summary = ''
  let recommended_actions: string[] = []

  try {
    const prompt = `Campaign: ${campaign.name}
Objective: ${campaign.objective || 'not set'}
Audience: ${campaign.audience || 'not set'}
Channel: ${campaign.channel}
Status: ${campaign.status}
Readiness score: ${readiness_score}/100
Blockers: ${blockers.join('; ') || 'none'}
Warnings: ${warnings.join('; ') || 'none'}
Items: ${items.rows.length}

Write a 2-sentence executive readiness summary and list 2-3 specific recommended actions. Return ONLY valid JSON:
{
  "summary": "...",
  "recommended_actions": ["...", "..."]
}`

    const raw = await callAI({
      role: 'project_manager',
      messages: [{ role: 'user', content: prompt }],
    })
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(cleaned)
    summary = parsed.summary ?? ''
    recommended_actions = Array.isArray(parsed.recommended_actions) ? parsed.recommended_actions : []
  } catch {
    // Fallback summary
    summary = `Campaign readiness score: ${readiness_score}/100. ${blockers.length > 0 ? `${blockers.length} blocker(s) require attention before launch.` : 'No critical blockers found.'}`
    recommended_actions = blockers.slice(0, 3).map(b => `Resolve: ${b}`)
  }

  // Step 5 — Save to DB
  const result = await db.query(
    `INSERT INTO campaign_launch_checks
       (campaign_id, project_id, status, readiness_score, checks, blockers, warnings, recommended_actions, summary)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      campaign_id,
      campaign.project_id ?? null,
      status,
      readiness_score,
      JSON.stringify(checks),
      JSON.stringify(blockers),
      JSON.stringify(warnings),
      JSON.stringify(recommended_actions),
      summary,
    ]
  )
  return result.rows[0] as CampaignLaunchCheckResult
}

export async function listCampaignLaunchChecks(
  campaign_id: string,
  limit = 5
): Promise<CampaignLaunchCheckResult[]> {
  try {
    const result = await db.query(
      'SELECT * FROM campaign_launch_checks WHERE campaign_id=$1 ORDER BY created_at DESC LIMIT $2',
      [campaign_id, limit]
    )
    return result.rows as CampaignLaunchCheckResult[]
  } catch {
    return []
  }
}

export async function getLatestCampaignLaunchCheck(
  campaign_id: string
): Promise<CampaignLaunchCheckResult | null> {
  try {
    const result = await db.query(
      'SELECT * FROM campaign_launch_checks WHERE campaign_id=$1 ORDER BY created_at DESC LIMIT 1',
      [campaign_id]
    )
    return (result.rows[0] as CampaignLaunchCheckResult) ?? null
  } catch {
    return null
  }
}

export interface LaunchReadinessSummary {
  campaigns_checked: number
  ready: number
  needs_attention: number
  not_ready: number
  blocked: number
  latest_checks: Array<{
    campaign_id: string
    campaign_name: string
    status: string
    readiness_score: number
  }>
}

export async function getLaunchReadinessSummaryForProject(
  project_id: string
): Promise<LaunchReadinessSummary> {
  try {
    const result = await db.query(`
      SELECT c.id AS campaign_id, c.name AS campaign_name,
             lc.status, lc.readiness_score
      FROM campaigns c
      LEFT JOIN LATERAL (
        SELECT status, readiness_score FROM campaign_launch_checks
        WHERE campaign_id = c.id ORDER BY created_at DESC LIMIT 1
      ) lc ON true
      WHERE c.project_id = $1
      ORDER BY c.created_at DESC
    `, [project_id])

    return buildReadinessSummary(result.rows)
  } catch {
    return { campaigns_checked: 0, ready: 0, needs_attention: 0, not_ready: 0, blocked: 0, latest_checks: [] }
  }
}

export async function getLaunchReadinessSummaryForCompany(): Promise<LaunchReadinessSummary> {
  try {
    const result = await db.query(`
      SELECT c.id AS campaign_id, c.name AS campaign_name,
             lc.status, lc.readiness_score
      FROM campaigns c
      LEFT JOIN LATERAL (
        SELECT status, readiness_score FROM campaign_launch_checks
        WHERE campaign_id = c.id ORDER BY created_at DESC LIMIT 1
      ) lc ON true
      ORDER BY c.created_at DESC
    `)

    return buildReadinessSummary(result.rows)
  } catch {
    return { campaigns_checked: 0, ready: 0, needs_attention: 0, not_ready: 0, blocked: 0, latest_checks: [] }
  }
}

function buildReadinessSummary(
  rows: Array<{ campaign_id: string; campaign_name: string; status: string | null; readiness_score: number | null }>
): LaunchReadinessSummary {
  const checked = rows.filter(r => r.status != null)
  const counts = { ready: 0, needs_attention: 0, not_ready: 0, blocked: 0 }
  for (const r of checked) {
    if (r.status === 'ready') counts.ready++
    else if (r.status === 'needs_attention') counts.needs_attention++
    else if (r.status === 'not_ready') counts.not_ready++
    else if (r.status === 'blocked') counts.blocked++
  }

  return {
    campaigns_checked: checked.length,
    ...counts,
    latest_checks: rows.map(r => ({
      campaign_id: r.campaign_id,
      campaign_name: r.campaign_name,
      status: r.status ?? 'not_checked',
      readiness_score: r.readiness_score ?? 0,
    })),
  }
}
