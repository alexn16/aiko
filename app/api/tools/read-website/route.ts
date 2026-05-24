import { NextRequest, NextResponse } from 'next/server'
import { canPerformAction } from '@/lib/operating-mode'
import { checkToolAvailable, logToolRun, updateToolRunResult } from '@/lib/tools/tool-router'
import { readWebsite } from '@/lib/tools/website-reader'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { url, project_id, agent_role } = body as {
      url?: string
      project_id?: string
      agent_role?: string
    }

    if (!url?.trim()) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 })
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
    const toolCheck = await checkToolAvailable('website_reader')
    if (!toolCheck.available) {
      return NextResponse.json({ error: toolCheck.reason }, { status: 400 })
    }

    // 3. Log run start
    const run_id = await logToolRun({
      project_id,
      agent_role,
      tool_type: 'website_reader',
      action: 'read',
      input: { url },
      status: 'running',
    })

    // 4. Execute
    try {
      const result = await readWebsite({ url: url.trim(), project_id, agent_role })

      await updateToolRunResult(run_id, result.error ? 'failed' : 'completed',
        result as unknown as Record<string, unknown>,
        result.error)

      return NextResponse.json({ ...result, run_id })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      await updateToolRunResult(run_id, 'failed', {}, errMsg)
      return NextResponse.json({ error: errMsg, run_id }, { status: 400 })
    }
  } catch (err) {
    console.error('[api/tools/read-website]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
