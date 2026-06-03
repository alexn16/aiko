/**
 * POST /api/projects/[id]/lead-discovery
 *
 * Run a multi-query browser-based lead discovery workflow for a project.
 *
 * Safety:
 *   - Public pages only. No login/CAPTCHA bypass.
 *   - Never invents emails or contacts.
 *   - No outreach, posting, or messaging.
 *   - All source URLs saved as evidence.
 *   - Duplicates skipped.
 *   - Small page limits (max 5 queries × 3 pages).
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { runLeadDiscoveryWorkflow } from '@/lib/leads/discovery-workflow'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = params.id

  // Verify project exists
  try {
    const check = await db.query(
      `SELECT id, name FROM projects WHERE id=$1 LIMIT 1`,
      [projectId]
    )
    if (!check.rows[0]) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  let body: {
    prompt?: string
    operator_id?: string
    operator_name?: string
    max_queries?: number
    max_pages_per_query?: number
  } = {}

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.prompt || typeof body.prompt !== 'string' || !body.prompt.trim()) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
  }

  const maxQueries = typeof body.max_queries === 'number'
    ? Math.min(Math.max(1, body.max_queries), 5)
    : 5
  const maxPagesPerQuery = typeof body.max_pages_per_query === 'number'
    ? Math.min(Math.max(1, body.max_pages_per_query), 3)
    : 3

  try {
    const result = await runLeadDiscoveryWorkflow({
      projectId,
      operatorId:  body.operator_id,
      operatorName: body.operator_name,
      prompt: body.prompt.trim(),
      maxQueries,
      maxPagesPerQuery,
    })

    const httpStatus = result.status === 'blocked' ? 200 : 200
    return NextResponse.json(
      {
        status:            result.status,
        queries_run:       result.queries_run,
        pages_checked:     result.pages_checked,
        candidates_found:  result.candidates_found,
        leads_created:     result.leads_created,
        duplicates_skipped: result.duplicates_skipped,
        failures:          result.failures,
        summary:           result.summary,
        query_results:     result.query_results.map(q => ({
          query:          q.query,
          status:         q.status,
          results_count:  q.results_count,
          candidates:     q.candidates.length,
          error:          q.error,
        })),
      },
      { status: httpStatus }
    )
  } catch (err) {
    console.error('[lead-discovery] error:', err)
    return NextResponse.json(
      { error: 'Lead discovery workflow failed' },
      { status: 500 }
    )
  }
}
