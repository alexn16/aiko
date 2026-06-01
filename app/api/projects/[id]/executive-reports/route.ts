import { NextRequest, NextResponse } from 'next/server'
import {
  listProjectExecutiveReports,
  getLatestProjectExecutiveReport,
  generateProjectExecutiveReport,
} from '@/lib/project-executive-report'

export const dynamic = 'force-dynamic'

/**
 * GET /api/projects/[id]/executive-reports
 *
 * Returns { reports: ExecutiveReport[], latest: ExecutiveReport | null }
 * newest first.
 *
 * Read-only — never mutates data.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = params.id
  try {
    const limit = req.nextUrl.searchParams.get('limit')
      ? parseInt(req.nextUrl.searchParams.get('limit')!, 10)
      : 20

    const [reports, latest] = await Promise.all([
      listProjectExecutiveReports(projectId, limit),
      getLatestProjectExecutiveReport(projectId),
    ])
    return NextResponse.json({ reports, latest })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    // Migration not run yet — return empty gracefully
    if (msg.includes('project_executive_reports') && msg.includes('does not exist')) {
      return NextResponse.json({ reports: [], latest: null, migration_pending: true })
    }
    console.error(`[projects/${projectId}/executive-reports GET]`, err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/**
 * POST /api/projects/[id]/executive-reports
 *
 * Generate and save a new executive report for the project.
 * Uses project context + CEO AI role.
 * Falls back to deterministic report if AI is unavailable.
 *
 * Does not trigger any Web Operator action.
 * Does not send anything.
 * The only mutation is saving the report record.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = params.id
  try {
    const report = await generateProjectExecutiveReport(projectId)
    return NextResponse.json({ report }, { status: 201 })
  } catch (err) {
    console.error(`[projects/${projectId}/executive-reports POST]`, err)
    const msg = err instanceof Error ? err.message : 'Internal error'
    if (msg.includes('not found')) {
      return NextResponse.json({ error: msg }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
