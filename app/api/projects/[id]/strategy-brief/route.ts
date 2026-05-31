import { NextRequest, NextResponse } from 'next/server'
import {
  getProjectStrategyBrief,
  generateStrategyBriefFromProject,
  updateProjectStrategyBrief,
  type UpdateBriefFields,
} from '@/lib/project-strategy-brief'
import { db } from '@/lib/db/client'

export const dynamic = 'force-dynamic'

/**
 * GET /api/projects/[id]/strategy-brief
 *
 * Returns the strategy brief for a project.
 * Creates a fallback brief on first access if none exists yet.
 * Brief is guidance only — does not trigger any automation.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = params.id
  try {
    let brief = await getProjectStrategyBrief(projectId)
    if (!brief) {
      // Fetch project name for fallback generation
      const projRes = await db.query(
        'SELECT name, goal, description, target_market FROM projects WHERE id=$1',
        [projectId]
      )
      if (!projRes.rows[0]) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }
      const p = projRes.rows[0]
      brief = await generateStrategyBriefFromProject({
        project_id:    projectId,
        project_name:  String(p.name),
        goal:          p.goal   ? String(p.goal)        : null,
        description:   p.description ? String(p.description) : null,
        target_market: p.target_market ? String(p.target_market) : null,
      })
    }
    return NextResponse.json({ brief })
  } catch (err) {
    console.error(`[projects/${projectId}/strategy-brief GET]`, err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/**
 * PATCH /api/projects/[id]/strategy-brief
 *
 * Partial update for any editable field.
 * Editing the research_prompt here does NOT auto-trigger research.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = params.id
  try {
    const body = await req.json() as Partial<UpdateBriefFields>

    let brief = await getProjectStrategyBrief(projectId)
    if (!brief) {
      const projRes = await db.query(
        'SELECT name, goal, description, target_market FROM projects WHERE id=$1',
        [projectId]
      )
      if (!projRes.rows[0]) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }
      const p = projRes.rows[0]
      brief = await generateStrategyBriefFromProject({
        project_id:    projectId,
        project_name:  String(p.name),
        goal:          p.goal   ? String(p.goal)        : null,
        description:   p.description ? String(p.description) : null,
        target_market: p.target_market ? String(p.target_market) : null,
      })
    }

    const updated = await updateProjectStrategyBrief(brief.id, {
      title:               body.title,
      objective:           body.objective,
      target_audience:     body.target_audience,
      research_prompt:     body.research_prompt,
      recommended_channel: body.recommended_channel,
      value_proposition:   body.value_proposition,
      risks:               body.risks,
      assumptions:         body.assumptions,
      next_actions:        body.next_actions,
    })
    return NextResponse.json({ brief: updated })
  } catch (err) {
    console.error(`[projects/${projectId}/strategy-brief PATCH]`, err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
