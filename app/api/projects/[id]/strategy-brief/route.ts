import { NextRequest, NextResponse } from 'next/server'
import {
  getProjectStrategyBrief,
  generateStrategyBriefFromProject,
  updateProjectStrategyBrief,
  recommendOperatorForStrategyBrief,
  type UpdateBriefFields,
} from '@/lib/project-strategy-brief'
import { db } from '@/lib/db/client'

export const dynamic = 'force-dynamic'

/**
 * GET /api/projects/[id]/strategy-brief
 *
 * Returns the strategy brief for a project, including operator recommendation.
 * Creates a fallback brief on first access if none exists yet.
 *
 * Response shape:
 *   { brief, operator_available: boolean }
 *
 * If a recommendation has not been saved yet, computes it on-demand
 * and saves it (non-fatal). If no operators exist, returns
 * operator_available=false without creating any operator.
 *
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
      // Fetch project for fallback generation
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
        goal:          p.goal        ? String(p.goal)        : null,
        description:   p.description ? String(p.description) : null,
        target_market: p.target_market ? String(p.target_market) : null,
      })
    }

    // If recommendation not yet saved, compute and persist it now (non-fatal)
    let operator_available = !!brief.recommended_operator_id
    if (!brief.recommended_operator_id) {
      try {
        const rec = await recommendOperatorForStrategyBrief(projectId)
        operator_available = rec.available
        if (rec.available) {
          const updated = await updateProjectStrategyBrief(brief.id, {
            recommended_operator_id:   rec.operator_id,
            recommended_operator_name: rec.operator_name,
            operator_reason:           rec.reason,
          })
          if (updated) brief = updated
          // Record operator recommendation decision (idempotent)
          try {
            const { recordDecisionIfNotExists } = await import('@/lib/project-decisions')
            await recordDecisionIfNotExists({
              project_id:      projectId,
              decision_type:   'operator_recommended',
              title:           `${rec.operator_name} recommended as first Web Operator`,
              summary:         rec.reason,
              decided_by_role: 'system',
              metadata:        { operator_id: rec.operator_id, operator_name: rec.operator_name },
            })
          } catch { /* non-fatal */ }
        } else {
          // Surface the reason even without persisting
          brief = {
            ...brief,
            operator_reason: rec.reason,
          }
        }
      } catch { /* non-fatal */ }
    }

    return NextResponse.json({ brief, operator_available })
  } catch (err) {
    console.error(`[projects/${projectId}/strategy-brief GET]`, err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/**
 * PATCH /api/projects/[id]/strategy-brief
 *
 * Partial update for any editable field.
 * Accepts recommended_operator_id — updates name and reason automatically.
 * Editing research_prompt does NOT auto-trigger research.
 * Setting recommended_operator_id does NOT trigger any Web Operator action.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = params.id
  try {
    const body = await req.json() as Partial<UpdateBriefFields> & { recommended_operator_id?: string | null }

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
        goal:          p.goal        ? String(p.goal)        : null,
        description:   p.description ? String(p.description) : null,
        target_market: p.target_market ? String(p.target_market) : null,
      })
    }

    // If caller is setting a new recommended_operator_id, resolve name + reason
    let operatorName = body.recommended_operator_name
    let operatorReason = body.operator_reason
    if (body.recommended_operator_id !== undefined && body.recommended_operator_id !== null) {
      if (!operatorName || !operatorReason) {
        try {
          const opRes = await db.query(
            'SELECT name, status FROM web_operators WHERE id=$1',
            [body.recommended_operator_id]
          )
          if (opRes.rows[0]) {
            operatorName  = operatorName  ?? String(opRes.rows[0].name)
            operatorReason = operatorReason ?? `${opRes.rows[0].name} selected manually.`
          }
        } catch { /* non-fatal */ }
      }
    }

    const prevResearchPrompt = brief.research_prompt
    const prevOperatorId     = brief.recommended_operator_id

    const updated = await updateProjectStrategyBrief(brief.id, {
      title:                     body.title,
      objective:                 body.objective,
      target_audience:           body.target_audience,
      research_prompt:           body.research_prompt,
      recommended_channel:       body.recommended_channel,
      value_proposition:         body.value_proposition,
      risks:                     body.risks,
      assumptions:               body.assumptions,
      next_actions:              body.next_actions,
      recommended_operator_id:   body.recommended_operator_id,
      recommended_operator_name: operatorName,
      operator_reason:           operatorReason,
    })

    // Record decisions for meaningful field changes (non-fatal)
    try {
      const { recordProjectDecision } = await import('@/lib/project-decisions')
      // Operator changed manually
      if (
        body.recommended_operator_id !== undefined &&
        body.recommended_operator_id !== prevOperatorId
      ) {
        await recordProjectDecision({
          project_id:      projectId,
          decision_type:   'operator_changed',
          title:           `Recommended operator changed to ${operatorName ?? 'none'}`,
          summary:         operatorReason ?? `Operator manually updated.`,
          decided_by_role: 'user',
          metadata:        { prev_operator_id: prevOperatorId, new_operator_id: body.recommended_operator_id, operator_name: operatorName },
        })
      }
      // Research prompt saved/changed
      if (
        body.research_prompt !== undefined &&
        body.research_prompt !== prevResearchPrompt
      ) {
        await recordProjectDecision({
          project_id:      projectId,
          decision_type:   'research_prompt_changed',
          title:           'Research prompt updated',
          summary:         `New prompt: ${String(body.research_prompt ?? '').slice(0, 120)}`,
          decided_by_role: 'user',
          metadata:        { prev: prevResearchPrompt, next: body.research_prompt },
        })
      }
    } catch { /* non-fatal */ }

    return NextResponse.json({ brief: updated })
  } catch (err) {
    console.error(`[projects/${projectId}/strategy-brief PATCH]`, err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
