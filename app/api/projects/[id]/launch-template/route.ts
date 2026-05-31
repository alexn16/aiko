import { NextRequest, NextResponse } from 'next/server'
import {
  getProjectLaunchTemplate,
  createProjectLaunchTemplate,
  updateProjectLaunchTemplate,
  type LaunchTemplateStatus,
  type ChecklistItem,
} from '@/lib/project-launch-template'

export const dynamic = 'force-dynamic'

/**
 * GET /api/projects/[id]/launch-template
 *
 * Returns the active launch template for a project, or creates one on-demand
 * if none exists yet.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = params.id
  try {
    let template = await getProjectLaunchTemplate(projectId)
    if (!template) {
      // Create on first access for projects that predate this feature
      template = await createProjectLaunchTemplate({ project_id: projectId })
    }
    return NextResponse.json({ template })
  } catch (err) {
    console.error(`[projects/${projectId}/launch-template GET]`, err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/**
 * PATCH /api/projects/[id]/launch-template
 *
 * Partial update: status, target_audience_hint, campaign_goal,
 * recommended_operator_id, checklist.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = params.id
  try {
    const body = await req.json()

    // Ensure a template exists
    let template = await getProjectLaunchTemplate(projectId)
    if (!template) {
      template = await createProjectLaunchTemplate({ project_id: projectId })
    }

    const updated = await updateProjectLaunchTemplate(template.id, {
      status:                  body.status                  as LaunchTemplateStatus | undefined,
      target_audience_hint:    body.target_audience_hint    as string | null | undefined,
      campaign_goal:           body.campaign_goal           as string | null | undefined,
      recommended_operator_id: body.recommended_operator_id as string | null | undefined,
      checklist:               body.checklist               as ChecklistItem[] | undefined,
    })
    return NextResponse.json({ template: updated })
  } catch (err) {
    console.error(`[projects/${projectId}/launch-template PATCH]`, err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
