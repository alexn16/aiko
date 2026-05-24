import { NextRequest, NextResponse } from 'next/server'
import { startWebOperatorSession } from '@/lib/web-operator/web-operator'
import { getModeState } from '@/lib/operating-mode'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { project_id, agent_role } = body as { project_id?: string; agent_role?: string }

    const mode = await getModeState()
    const session = await startWebOperatorSession({
      project_id: project_id ?? null,
      agent_role: agent_role ?? 'Web Operator',
      permission_mode: mode.mode,
    })

    return NextResponse.json({ session })
  } catch (err) {
    console.error('[web-operator/session POST]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
