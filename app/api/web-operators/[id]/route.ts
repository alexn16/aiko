import { NextRequest, NextResponse } from 'next/server'
import { getOperatorStatus, updateOperatorStatus, assignOperatorToProject } from '@/lib/web-operator/operators'
import { db } from '@/lib/db/client'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const status = await getOperatorStatus(params.id)
    return NextResponse.json(status)
  } catch (err) {
    console.error('[web-operators/[id] GET]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const id = params.id

    // New action-based handlers
    if (body.action === 'mark_login_completed') {
      const { markLoginCompleted } = await import('@/lib/web-operator/operators')
      const result = await markLoginCompleted(id)
      return NextResponse.json(result)
    }
    if (body.action === 'resume_workflow') {
      const { resumeOperatorWorkflow } = await import('@/lib/web-operator/operators')
      const result = await resumeOperatorWorkflow(id)
      return NextResponse.json(result)
    }
    if (body.action === 'pause') {
      const { pauseOperator } = await import('@/lib/web-operator/operators')
      await pauseOperator(id, body.reason)
      return NextResponse.json({ success: true })
    }
    if (body.action === 'clear_workflow') {
      const { clearOperatorWorkflow } = await import('@/lib/web-operator/operators')
      await clearOperatorWorkflow(id)
      return NextResponse.json({ success: true })
    }
    if (body.action === 'mark_user_controlling') {
      const { markUserControlling } = await import('@/lib/web-operator/operators')
      await markUserControlling(id)
      return NextResponse.json({ success: true })
    }

    const { status, project_id, current_task } = body as {
      status?: string
      project_id?: string
      current_task?: string
    }

    if (project_id) {
      await assignOperatorToProject(id, project_id)
    }

    if (status) {
      await updateOperatorStatus(id, status, { current_task: current_task ?? undefined })
    } else if (current_task !== undefined) {
      // Update current_task without changing status
      await db.query(
        `UPDATE web_operators SET current_task=$1, updated_at=NOW() WHERE id=$2`,
        [current_task, id]
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[web-operators/[id] PATCH]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
