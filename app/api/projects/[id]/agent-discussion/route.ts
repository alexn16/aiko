import { NextRequest, NextResponse } from 'next/server'
import { sendAgentMessage } from '@/lib/agents/internal-communication'
import type { MessageType } from '@/lib/agents/internal-communication'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const { from_role, to_role, message_type, subject, content } = body

    if (!from_role || !to_role || !subject || !content) {
      return NextResponse.json(
        { error: 'from_role, to_role, subject, and content are required' },
        { status: 400 }
      )
    }

    const id = await sendAgentMessage({
      project_id: params.id,
      from_role,
      to_role,
      message_type: message_type as MessageType | undefined,
      subject,
      content,
    })

    return NextResponse.json({ id })
  } catch (err) {
    console.error('[api/projects/[id]/agent-discussion POST]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
