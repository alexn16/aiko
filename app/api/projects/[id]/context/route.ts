import { NextRequest, NextResponse } from 'next/server'
import {
  getProjectContext,
  getProjectExecutiveSummary,
  getProjectNextStep,
} from '@/lib/project-context'

export const dynamic = 'force-dynamic'

/**
 * GET /api/projects/[id]/context
 *
 * Read-only project context aggregation: project details, PM, strategy brief,
 * launch template progress, lead counts, approvals, recent operator actions.
 *
 * Used by the CEO recall flow and project workspace "CEO Summary" card.
 * Never mutates any data.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = params.id
  try {
    const ctx = await getProjectContext(projectId)
    if (!ctx) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    return NextResponse.json({
      context:      ctx,
      summary_text: getProjectExecutiveSummary(ctx),
      next_step:    getProjectNextStep(ctx),
    })
  } catch (err) {
    console.error(`[projects/${projectId}/context GET]`, err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
