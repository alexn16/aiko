/**
 * POST /api/projects/[id]/executive-reports/[reportId]/export
 *
 * Export an executive report to a downloadable generated file.
 *
 * Body: { format: "markdown" | "json", overwrite?: boolean }
 * Returns: { file, download_url, already_existed }
 *
 * Safety:
 * - Report must belong to the given project (returns 404 otherwise).
 * - Never exposes secrets or API keys.
 * - Never writes outside generated-files storage.
 * - Idempotent by default: returns existing export if one exists.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { exportExecutiveReport, type ExportFormat } from '@/lib/report-file-export'
import { type ExecutiveReport } from '@/lib/project-executive-report'

function rowToReport(r: Record<string, unknown>): ExecutiveReport {
  function safeJSON<T>(v: unknown, fallback: T): T {
    if (v === null || v === undefined) return fallback
    if (typeof v === 'string') { try { return JSON.parse(v) as T } catch { return fallback } }
    return v as T
  }
  return {
    id:                 String(r.id),
    project_id:         String(r.project_id),
    title:              String(r.title),
    summary:            r.summary ? String(r.summary) : null,
    strategy_snapshot:  safeJSON(r.strategy_snapshot, { goal: null, objective: null, target_audience: null, channel: null, value_prop: null, operator: null, pm: null }),
    progress_snapshot:  safeJSON(r.progress_snapshot, { launch_status: null, launch_done: 0, launch_total: 0, launch_next_item: null, lead_total: 0, lead_approved: 0, lead_contacted: 0, lead_replied: 0, pending_approvals: 0 }),
    decisions_snapshot: safeJSON(r.decisions_snapshot, []),
    risks:              safeJSON(r.risks, []),
    next_steps:         safeJSON(r.next_steps, []),
    generated_by_role:  String(r.generated_by_role ?? 'ceo'),
    created_at:         String(r.created_at),
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; reportId: string } }
) {
  const projectId = params.id
  const reportId  = params.reportId

  // Parse body
  let format: ExportFormat = 'markdown'
  let overwrite = false
  try {
    const body = await req.json()
    if (body.format === 'json') format = 'json'
    if (body.overwrite === true) overwrite = true
  } catch {
    // Defaults are fine
  }

  // Load report and verify it belongs to this project
  let reportRow: Record<string, unknown> | null = null
  try {
    const res = await db.query(
      `SELECT * FROM project_executive_reports WHERE id = $1`,
      [reportId]
    )
    reportRow = res.rows[0] ?? null
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('does not exist')) {
      return NextResponse.json({ error: 'Reports table not ready' }, { status: 503 })
    }
    console.error('[executive-reports export]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  if (!reportRow) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }

  const report = rowToReport(reportRow)

  if (report.project_id !== projectId) {
    return NextResponse.json({ error: 'Report does not belong to this project' }, { status: 404 })
  }

  try {
    const result = await exportExecutiveReport(projectId, report, format, overwrite)
    return NextResponse.json(result, { status: result.already_existed ? 200 : 201 })
  } catch (err) {
    console.error('[executive-reports export]', err)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
