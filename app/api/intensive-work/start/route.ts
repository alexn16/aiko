import { NextRequest, NextResponse } from 'next/server'
import { enqueueProjectWork, getIntensiveWorkState, runWorkCycle, setIntensiveWorkState, type IntensiveWorkLevel } from '@/lib/intensive-work/engine'

export const dynamic = 'force-dynamic'

const INTENSIVE_WORK_LEVELS: IntensiveWorkLevel[] = ['off', 'planning_only', 'safe_internal', 'browser_research', 'approval_required']

function normalizeLevel(value: unknown): IntensiveWorkLevel {
  if (typeof value === 'string' && INTENSIVE_WORK_LEVELS.includes(value as IntensiveWorkLevel)) {
    return value as IntensiveWorkLevel
  }
  return 'safe_internal'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const level = normalizeLevel(body.level)
    const projectId = typeof body.project_id === 'string' ? body.project_id : null
    await setIntensiveWorkState({
      enabled: level !== 'off',
      level,
      paused_reason: null,
      max_actions_per_cycle: typeof body.max_actions_per_cycle === 'number' ? body.max_actions_per_cycle : undefined,
    })
    const queued = projectId
      ? await enqueueProjectWork(projectId, { includeBrowserResearch: level === 'browser_research' || level === 'approval_required' })
      : []
    const cycle = body.run_immediately === false ? null : await runWorkCycle()
    return NextResponse.json({ ok: true, state: await getIntensiveWorkState(), queued, cycle })
  } catch (err) {
    console.error('[intensive-work/start POST]', err)
    return NextResponse.json({ error: 'Could not start intensive work.' }, { status: 500 })
  }
}
