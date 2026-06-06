import { NextRequest, NextResponse } from 'next/server'
import { enqueueProjectWork } from '@/lib/intensive-work/engine'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const projectId = typeof body.project_id === 'string' ? body.project_id : null
    if (!projectId) return NextResponse.json({ error: 'project_id is required.' }, { status: 400 })
    const includeBrowserResearch = Boolean(body.include_browser_research)
    const items = await enqueueProjectWork(projectId, { includeBrowserResearch })
    return NextResponse.json({ ok: true, items })
  } catch (err) {
    console.error('[intensive-work/enqueue-project POST]', err)
    return NextResponse.json({ error: 'Could not enqueue project work.' }, { status: 500 })
  }
}
