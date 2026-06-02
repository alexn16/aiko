/**
 * lead-file-export.ts
 *
 * Export leads to a downloadable CSV generated file.
 *
 * Safety:
 * - Read-only on leads data.
 * - Never exposes secrets, API keys, or tokens.
 * - Never contacts leads or triggers outreach.
 * - Never uses Web Operator.
 * - Writes only to storage/generated-files/.
 * - Rejected leads excluded by default.
 * - source_text (raw scraped HTML) excluded from CSV — internal only.
 */

import { db } from '@/lib/db/client'
import { createGeneratedFile, type GeneratedFile } from '@/lib/generated-files'
import type { Lead } from '@/lib/leads'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LeadsExportOptions {
  project_id?:       string | null
  status?:           string | null          // filter by specific status
  include_rejected?: boolean                // default false
  title?:            string | null
}

export interface LeadsExportResult {
  file:         GeneratedFile
  download_url: string
  lead_count:   number
}

// ── Statuses excluded when include_rejected = false ───────────────────────────

const REJECTED_STATUSES = new Set(['rejected', 'archived'])

// ── CSV columns (in order) ────────────────────────────────────────────────────

const CSV_COLUMNS = [
  'company_name',
  'contact_name',
  'email',
  'phone',
  'website',
  'linkedin_url',
  'location',
  'category',
  'score',
  'status',
  'source_url',
  'notes',
  'created_at',
  'updated_at',
] as const

type CsvColumn = typeof CSV_COLUMNS[number]

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Export leads to a CSV generated file.
 * Never triggers outreach. Never contacts leads. Read-only on lead data.
 */
export async function exportLeadsToCsv(
  options: LeadsExportOptions = {}
): Promise<LeadsExportResult> {
  const leads = await fetchLeadsForExport(options)

  const content  = formatLeadsCsv(leads)
  const now      = new Date().toISOString().slice(0, 10)
  const title    = options.title?.trim() || buildTitle(options, now)
  const filename = buildFilename(options, now)

  const file = await createGeneratedFile({
    project_id:         options.project_id ?? null,
    filename,
    content,
    content_type:       'csv',
    title,
    description:        buildDescription(options, leads.length),
    generated_by_role:  'system',
    source_entity_type: 'leads_export',
    source_entity_id:   options.project_id ?? null,
  })

  return {
    file,
    download_url: `/api/files/${file.id}/download`,
    lead_count:   leads.length,
  }
}

// ── CSV formatter ─────────────────────────────────────────────────────────────

/**
 * Format an array of leads as a CSV string.
 * Correctly escapes commas, double-quotes, and newlines.
 * Empty values are blank cells (not null/undefined strings).
 * source_text (raw scraped HTML) is intentionally excluded.
 */
export function formatLeadsCsv(leads: Lead[]): string {
  const header = CSV_COLUMNS.join(',')
  const rows   = leads.map(lead => CSV_COLUMNS.map(col => escapeCell(getField(lead, col))).join(','))
  return [header, ...rows].join('\n')
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  // Must quote if contains comma, double-quote, newline, or carriage return
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function getField(lead: Lead, col: CsvColumn): string | number | null {
  switch (col) {
    case 'company_name':  return lead.company_name
    case 'contact_name':  return lead.contact_name
    case 'email':         return lead.email
    case 'phone':         return lead.phone
    case 'website':       return lead.website
    case 'linkedin_url':  return lead.linkedin_url
    case 'location':      return lead.location
    case 'category':      return lead.category
    case 'score':         return lead.score
    case 'status':        return lead.status
    case 'source_url':    return lead.source_url
    case 'notes':         return lead.notes
    case 'created_at':    return (lead.created_at as unknown) instanceof Date
                            ? (lead.created_at as unknown as Date).toISOString()
                            : (lead.created_at ?? null)
    case 'updated_at':    return (lead.updated_at as unknown) instanceof Date
                            ? (lead.updated_at as unknown as Date).toISOString()
                            : (lead.updated_at ?? null)
    default:              return null
  }
}

async function fetchLeadsForExport(options: LeadsExportOptions): Promise<Lead[]> {
  const conditions: string[] = []
  const values: unknown[]   = []
  let idx = 1

  if (options.project_id) {
    conditions.push(`l.project_id = $${idx++}`)
    values.push(options.project_id)
  }

  if (options.status) {
    conditions.push(`l.status = $${idx++}`)
    values.push(options.status)
  } else if (!options.include_rejected) {
    // Default: exclude rejected and archived
    conditions.push(`l.status NOT IN ('rejected', 'archived')`)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  try {
    const res = await db.query(
      `SELECT l.* FROM leads l ${where} ORDER BY l.created_at DESC LIMIT 5000`,
      values
    )
    return res.rows as Lead[]
  } catch {
    return []
  }
}

function buildTitle(options: LeadsExportOptions, date: string): string {
  const parts: string[] = ['Leads Export']
  if (options.status) parts.push(`— ${options.status}`)
  parts.push(`(${date})`)
  return parts.join(' ')
}

function buildFilename(options: LeadsExportOptions, date: string): string {
  const parts = ['leads']
  if (options.status) parts.push(options.status.replace(/[^a-z0-9]/gi, '-'))
  if (options.project_id) parts.push('project')
  parts.push(date)
  return parts.join('-') + '.csv'
}

function buildDescription(options: LeadsExportOptions, count: number): string {
  const parts: string[] = [`${count} lead${count !== 1 ? 's' : ''} exported`]
  if (options.status)    parts.push(`status: ${options.status}`)
  if (!options.status && !options.include_rejected) parts.push('rejected excluded')
  if (options.project_id) parts.push('project-scoped')
  return parts.join(' · ')
}
