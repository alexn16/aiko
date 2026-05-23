import { NextRequest, NextResponse } from 'next/server'
import { updateTaskOutputStatus, updateTaskOutput } from '@/lib/agents/task-outputs'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const { id } = params

    const fields: { status?: string; content?: string; title?: string } = {}
    if (body.status !== undefined) fields.status = body.status
    if (body.content !== undefined) fields.content = body.content
    if (body.title !== undefined) fields.title = body.title

    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const updated = await updateTaskOutput(id, fields)
    if (!updated) {
      return NextResponse.json({ error: 'Output not found' }, { status: 404 })
    }
    return NextResponse.json({ output: updated })
  } catch (err) {
    console.error('[api/task-outputs/[id] PATCH]', err)
    const msg = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
