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
    const { status, project_id, current_task } = body as {
      status?: string
      project_id?: string
      current_task?: string
    }

    if (project_id) {
      await assignOperatorToProject(params.id, project_id)
    }

    if (status) {
      await updateOperatorStatus(params.id, status, { current_task: current_task ?? undefined })
    } else if (current_task !== undefined) {
      // Update current_task without changing status
      await db.query(
        `UPDATE web_operators SET current_task=$1, updated_at=NOW() WHERE id=$2`,
        [current_task, params.id]
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[web-operators/[id] PATCH]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
