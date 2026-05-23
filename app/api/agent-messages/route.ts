import { NextRequest, NextResponse } from 'next/server'
import { listAgentMessages, sendAgentMessage } from '@/lib/agents/internal-communication'
import type { MessageType } from '@/lib/agents/internal-communication'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const project_id   = searchParams.get('project_id')   ?? undefined
    const from_role    = searchParams.get('from_role')    ?? undefined
    const to_role      = searchParams.get('to_role')      ?? undefined
    const message_type = searchParams.get('message_type') as MessageType | undefined
    const status       = searchParams.get('status')       as 'sent' | 'read' | 'acknowledged' | 'resolved' | undefined
    const limit        = parseInt(searchParams.get('limit') ?? '50', 10)

    const messages = await listAgentMessages({
      project_id,
      from_role,
      to_role,
      message_type,
      status,
      limit: isNaN(limit) ? 50 : limit,
    })

    return NextResponse.json({ messages })
  } catch (err) {
    console.error('[api/agent-messages GET]', err)
    // Return empty gracefully if table doesn't exist yet
    return NextResponse.json({ messages: [] })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { project_id, from_role, to_role, message_type, subject, content, metadata,
            from_agent_id, to_agent_id } = body

    if (!from_role || !to_role || !subject || !content) {
      return NextResponse.json(
        { error: 'from_role, to_role, subject, and content are required' },
        { status: 400 }
      )
    }

    const id = await sendAgentMessage({
      project_id,
      from_role,
      to_role,
      message_type,
      subject,
      content,
      from_agent_id,
      to_agent_id,
      metadata,
    })

    return NextResponse.json({ id })
  } catch (err) {
    console.error('[api/agent-messages POST]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
