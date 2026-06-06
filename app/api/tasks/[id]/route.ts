import { NextRequest, NextResponse } from 'next/server'
import { updateOwnerTaskStatus, type OwnerTaskStatus } from '@/lib/tasks/owner-tasks'

export const dynamic = 'force-dynamic'

const allowedStatuses = new Set<OwnerTaskStatus>(['todo', 'in_progress', 'blocked', 'done', 'archived'])

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await request.json()
    const status = String(body.status ?? '') as OwnerTaskStatus
    if (!allowedStatuses.has(status)) {
      return NextResponse.json({ error: 'Unsupported task status.' }, { status: 400 })
    }

    const task = await updateOwnerTaskStatus(
      params.id,
      status,
      typeof body.note === 'string' ? body.note : null,
    )
    if (!task) return NextResponse.json({ error: 'Task not found.' }, { status: 404 })

    return NextResponse.json({
      task,
      created_web_operator_action: false,
      approval_item_created: false,
      external_action_executed: false,
    })
  } catch (err) {
    console.error('[api/tasks/[id] PATCH]', err)
    return NextResponse.json({ error: 'Could not update task.' }, { status: 500 })
  }
}
