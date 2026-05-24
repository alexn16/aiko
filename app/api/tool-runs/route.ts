import { NextRequest, NextResponse } from 'next/server'
import { listToolRuns } from '@/lib/tools/tool-router'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const filters = {
      project_id: sp.get('project_id') ?? undefined,
      tool_type: sp.get('tool_type') ?? undefined,
      status: sp.get('status') ?? undefined,
      agent_role: sp.get('agent_role') ?? undefined,
      limit: sp.get('limit') ? parseInt(sp.get('limit')!, 10) : undefined,
    }

    const runs = await listToolRuns(filters)
    return NextResponse.json({ runs })
  } catch (err) {
    console.error('[api/tool-runs GET]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
