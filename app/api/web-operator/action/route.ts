import { NextRequest, NextResponse } from 'next/server'
import { runWebOperatorAction } from '@/lib/web-operator/web-operator'
import type { WebOperatorActionType } from '@/lib/web-operator/web-operator'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      session_id,
      project_id,
      agent_role,
      action_type,
      target_url,
      description,
      input,
    } = body as {
      session_id?: string
      project_id?: string
      agent_role?: string
      action_type: WebOperatorActionType
      target_url?: string
      description: string
      input?: Record<string, unknown>
    }

    if (!action_type || !description) {
      return NextResponse.json({ error: 'action_type and description are required' }, { status: 400 })
    }

    const result = await runWebOperatorAction({
      session_id: session_id ?? null,
      project_id: project_id ?? null,
      agent_role: agent_role ?? 'Web Operator',
      action_type,
      target_url: target_url ?? null,
      description,
      input: input ?? {},
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[web-operator/action POST]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
