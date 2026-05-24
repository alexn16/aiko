import { NextRequest, NextResponse } from 'next/server'
import { canPerformAction } from '@/lib/operating-mode'
import { checkToolAvailable, logToolRun, updateToolRunResult } from '@/lib/tools/tool-router'
import { searchWeb } from '@/lib/tools/web-search'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { query, project_id, agent_role } = body as {
      query?: string
      project_id?: string
      agent_role?: string
    }

    if (!query?.trim()) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 })
    }

    // 1. Mode check
    const modeCheck = await canPerformAction('browse_web', { project_id, agent_role })
    if (!modeCheck.allowed) {
      return NextResponse.json(
        { error: modeCheck.reason, mode: modeCheck.mode, paused: modeCheck.paused },
        { status: 403 }
      )
    }

    // 2. Tool availability check
    const toolCheck = await checkToolAvailable('web_search')
    if (!toolCheck.available) {
      return NextResponse.json({ error: toolCheck.reason }, { status: 400 })
    }

    // 3. Log run start
    const run_id = await logToolRun({
      project_id,
      agent_role,
      tool_type: 'web_search',
      action: 'search',
      input: { query, num_results: body.num_results },
      status: 'running',
    })

    // 4. Execute
    try {
      const result = await searchWeb({
        query: query.trim(),
        project_id,
        agent_role,
        num_results: body.num_results,
      })

      await updateToolRunResult(run_id, 'completed', result as unknown as Record<string, unknown>)

      return NextResponse.json({
        results: result.results,
        provider: result.provider,
        query: result.query,
        total: result.total,
        run_id,
      })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      await updateToolRunResult(run_id, 'failed', {}, errMsg)
      return NextResponse.json({ error: errMsg, run_id }, { status: 400 })
    }
  } catch (err) {
    console.error('[api/tools/web-search]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
