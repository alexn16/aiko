/**
 * POST /api/leads/export
 *
 * Export leads to a downloadable CSV generated file.
 *
 * Body: {
 *   project_id?:       string   — scope to a project
 *   status?:           string   — filter by status
 *   include_rejected?: boolean  — default false
 *   title?:            string   — optional custom title
 * }
 *
 * Returns: { file, download_url, lead_count }
 *
 * Safety:
 * - Never contacts leads or triggers outreach.
 * - Never uses Web Operator.
 * - Never exposes secrets or API keys.
 * - Writes only to generated-files storage.
 */

import { NextRequest, NextResponse } from 'next/server'
import { exportLeadsToCsv } from '@/lib/lead-file-export'

export async function POST(req: NextRequest) {
  let project_id:       string | null  = null
  let status:           string | null  = null
  let include_rejected: boolean        = false
  let title:            string | null  = null

  try {
    const body = await req.json()
    if (typeof body.project_id === 'string' && body.project_id) project_id = body.project_id
    if (typeof body.status     === 'string' && body.status)     status     = body.status
    if (body.include_rejected === true)                         include_rejected = true
    if (typeof body.title      === 'string' && body.title)      title      = body.title
  } catch {
    // All fields optional — defaults are fine
  }

  try {
    const result = await exportLeadsToCsv({ project_id, status, include_rejected, title })
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    console.error('[api/leads/export POST]', err)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
