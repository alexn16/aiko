import { NextRequest, NextResponse } from 'next/server'
import { acknowledgeAgentMessage, resolveAgentMessage } from '@/lib/agents/internal-communication'
import { db } from '@/lib/db/client'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const { status } = body

    if (!status) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 })
    }

    if (status === 'acknowledged') {
      await acknowledgeAgentMessage(params.id)
    } else if (status === 'resolved') {
      await resolveAgentMessage(params.id)
    } else {
      await db.query(
        `UPDATE agent_messages SET status = $1 WHERE id = $2`,
        [status, params.id]
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/agent-messages/[id] PATCH]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
