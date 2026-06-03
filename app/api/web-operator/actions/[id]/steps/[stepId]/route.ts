import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { updateActionStepStatus } from '@/lib/web-operator/action-steps'
import type { WebOperatorActionStepStatus } from '@/lib/web-operator/action-steps'

export const dynamic = 'force-dynamic'

const ALLOWED_STATUSES: WebOperatorActionStepStatus[] = [
  'planned',
  'running',
  'waiting_user',
  'waiting_approval',
  'completed',
  'failed',
  'skipped',
  'blocked',
]

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; stepId: string } }
) {
  try {
    const body = await req.json().catch(() => ({}))
    const status = body.status as WebOperatorActionStepStatus | undefined
    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Valid status is required.' }, { status: 400 })
    }
    const ownership = await db.query(
      `SELECT action_id FROM web_operator_action_steps WHERE id=$1`,
      [params.stepId]
    )
    if (!ownership.rows[0] || String(ownership.rows[0].action_id) !== params.id) {
      return NextResponse.json({ error: 'Step not found.' }, { status: 404 })
    }
    const step = await updateActionStepStatus(params.stepId, status, {
      message: typeof body.message === 'string' ? body.message : undefined,
      url: typeof body.url === 'string' ? body.url : undefined,
      screenshot_url: typeof body.screenshot_url === 'string' ? body.screenshot_url : undefined,
      result: body.result && typeof body.result === 'object' ? body.result as Record<string, unknown> : undefined,
    })
    if (!step) {
      return NextResponse.json({ error: 'Step not found.' }, { status: 404 })
    }
    return NextResponse.json({ step })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    const status = /cannot be marked completed|cannot be completed/i.test(message) ? 409 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
