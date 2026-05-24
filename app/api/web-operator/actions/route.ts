import { NextRequest, NextResponse } from 'next/server'
import { listWebOperatorActions } from '@/lib/web-operator/web-operator'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const project_id = searchParams.get('project_id') ?? undefined
    const session_id = searchParams.get('session_id') ?? undefined
    const status = searchParams.get('status') ?? undefined
    const agent_role = searchParams.get('agent_role') ?? undefined
    const limitStr = searchParams.get('limit')
    const limit = limitStr ? parseInt(limitStr, 10) : 50

    const actions = await listWebOperatorActions({ project_id, session_id, status, agent_role, limit })
    return NextResponse.json({ actions })
  } catch (err) {
    console.error('[web-operator/actions GET]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
