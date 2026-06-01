import { NextRequest, NextResponse } from 'next/server'
import {
  listProjectDecisions,
  recordProjectDecision,
  type DecisionType,
} from '@/lib/project-decisions'

export const dynamic = 'force-dynamic'

/**
 * GET /api/projects/[id]/decisions
 *
 * Returns the decision log for a project (newest first).
 * Query params:
 *   limit   (default 50)
 *   offset  (default 0)
 *   types   comma-separated DecisionType filter
 *
 * Read-only. Never mutates any data.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = params.id
  try {
    const sp     = req.nextUrl.searchParams
    const limit  = sp.get('limit')  ? parseInt(sp.get('limit')!,  10) : 50
    const offset = sp.get('offset') ? parseInt(sp.get('offset')!, 10) : 0
    const typesRaw = sp.get('types')
    const types = typesRaw
      ? (typesRaw.split(',').map(t => t.trim()).filter(Boolean) as DecisionType[])
      : undefined

    const decisions = await listProjectDecisions(projectId, { limit, offset, types })
    return NextResponse.json({ decisions })
  } catch (err) {
    console.error(`[projects/${projectId}/decisions GET]`, err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/**
 * POST /api/projects/[id]/decisions
 *
 * Record a new decision. For idempotent events (project_created, etc.)
 * use the `idempotent: true` body field — the server will skip if one
 * already exists of this type for this project.
 *
 * Body:
 *   decision_type         required
 *   title                 required
 *   summary               optional
 *   decided_by_role       optional
 *   related_entity_type   optional
 *   related_entity_id     optional
 *   metadata              optional object
 *   idempotent            optional bool (default false)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = params.id
  try {
    const body = await req.json()
    const { decision_type, title, idempotent, ...rest } = body

    if (!decision_type || !title) {
      return NextResponse.json(
        { error: 'decision_type and title are required' },
        { status: 400 }
      )
    }

    const input = { project_id: projectId, decision_type, title, ...rest }

    let decision
    if (idempotent) {
      const { recordDecisionIfNotExists } = await import('@/lib/project-decisions')
      decision = await recordDecisionIfNotExists(input)
    } else {
      decision = await recordProjectDecision(input)
    }

    return NextResponse.json({ decision }, { status: 201 })
  } catch (err) {
    console.error(`[projects/${projectId}/decisions POST]`, err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
