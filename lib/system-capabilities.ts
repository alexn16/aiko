import { db } from '@/lib/db/client'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SystemCapability {
  id: string
  key: string
  name: string
  description: string
  status: 'available' | 'partial' | 'missing' | 'planned' | 'blocked'
  category: string
  required_for: string[]
  created_at: string
  updated_at: string
}

export interface CapabilityCheckResult {
  strategy_text: string
  required_capabilities: string[]
  available: SystemCapability[]
  partial: SystemCapability[]
  missing: SystemCapability[]
  planned: SystemCapability[]
  score: number
  gap_summary: string
}

// ── Keyword map ────────────────────────────────────────────────────────────────

const STRATEGY_KEYWORD_MAP: Record<string, string[]> = {
  email_sending:       ['email', 'send email', 'outreach email', 'inbox', 'gmail', 'smtp', 'sendgrid'],
  reply_tracking:      ['reply', 'response', 'follow up', 'followup', 'inbox monitor'],
  linkedin_operator:   ['linkedin', 'connect on linkedin', 'linkedin message'],
  crm_sync:            ['crm', 'salesforce', 'hubspot', 'pipedrive', 'sync contacts'],
  calendar_booking:    ['book meeting', 'schedule', 'calendar', 'appointment'],
  web_research:        ['research', 'search online', 'find companies', 'web search'],
  lead_capture:        ['leads', 'lead list', 'prospects', 'lead generation'],
  lead_enrichment:     ['enrich', 'contact data', 'email addresses', 'phone numbers'],
  campaign_builder:    ['campaign', 'email campaign', 'outbound campaign', 'sequence'],
  web_operator:        ['browser', 'automate', 'web operator', 'fill form', 'open website'],
}

// ── Core functions ─────────────────────────────────────────────────────────────

export async function listCapabilities(): Promise<SystemCapability[]> {
  try {
    const result = await db.query(
      `SELECT * FROM system_capabilities ORDER BY category ASC, name ASC`
    )
    return result.rows.map(rowToCapability)
  } catch {
    return []
  }
}

export async function getCapabilityMap(): Promise<Record<string, SystemCapability>> {
  const caps = await listCapabilities()
  const map: Record<string, SystemCapability> = {}
  for (const cap of caps) {
    map[cap.key] = cap
  }
  return map
}

export async function markCapabilityStatus(
  key: string,
  status: SystemCapability['status']
): Promise<void> {
  await db.query(
    `UPDATE system_capabilities SET status=$1, updated_at=NOW() WHERE key=$2`,
    [status, key]
  )
}

export async function markCapabilityStatusById(
  id: string,
  status: SystemCapability['status']
): Promise<void> {
  await db.query(
    `UPDATE system_capabilities SET status=$1, updated_at=NOW() WHERE id=$2`,
    [status, id]
  )
}

export async function getMissingCapabilities(): Promise<SystemCapability[]> {
  try {
    const result = await db.query(
      `SELECT * FROM system_capabilities WHERE status = 'missing' ORDER BY category ASC`
    )
    return result.rows.map(rowToCapability)
  } catch {
    return []
  }
}

export async function checkCapabilitiesForStrategy(
  strategy_text: string
): Promise<CapabilityCheckResult> {
  const lower = strategy_text.toLowerCase()

  // Infer required capability keys from keyword matching
  const required_capabilities: string[] = []
  for (const [capKey, keywords] of Object.entries(STRATEGY_KEYWORD_MAP)) {
    if (keywords.some(kw => lower.includes(kw))) {
      required_capabilities.push(capKey)
    }
  }

  // Load all capabilities
  const capMap = await getCapabilityMap()

  const available: SystemCapability[] = []
  const partial: SystemCapability[]   = []
  const missing: SystemCapability[]   = []
  const planned: SystemCapability[]   = []

  for (const key of required_capabilities) {
    const cap = capMap[key]
    if (!cap) continue
    if (cap.status === 'available') available.push(cap)
    else if (cap.status === 'partial') partial.push(cap)
    else if (cap.status === 'missing' || cap.status === 'blocked') missing.push(cap)
    else if (cap.status === 'planned') planned.push(cap)
  }

  // Score: available=1, partial=0.5, out of required count
  const total = required_capabilities.length
  const score = total === 0
    ? 100
    : Math.round(((available.length * 1 + partial.length * 0.5) / total) * 100)

  // Gap summary
  let gap_summary = 'All required capabilities are available.'
  if (missing.length > 0) {
    gap_summary = `Missing: ${missing.map(c => c.name).join(', ')}. These capabilities need to be built before this strategy can be fully executed.`
  } else if (partial.length > 0) {
    gap_summary = `Partial gaps: ${partial.map(c => c.name).join(', ')}. These capabilities exist but may require configuration or API keys.`
  }

  return {
    strategy_text,
    required_capabilities,
    available,
    partial,
    missing,
    planned,
    score,
    gap_summary,
  }
}

// ── Internal helpers ───────────────────────────────────────────────────────────

function rowToCapability(row: Record<string, unknown>): SystemCapability {
  return {
    id: String(row.id),
    key: String(row.key),
    name: String(row.name),
    description: String(row.description ?? ''),
    status: row.status as SystemCapability['status'],
    category: String(row.category ?? ''),
    required_for: Array.isArray(row.required_for) ? row.required_for : [],
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}
