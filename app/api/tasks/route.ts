import { NextRequest, NextResponse } from 'next/server'
import { listOwnerTasks } from '@/lib/tasks/owner-tasks'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const s = request.nextUrl.searchParams
    const active = s.get('active') === 'true'
    const limitRaw = s.get('limit')
    const tasks = await listOwnerTasks({
      project_id: s.get('project_id'),
      owner_role: s.get('owner_role'),
      status: s.get('status'),
      active,
      limit: limitRaw ? parseInt(limitRaw, 10) : undefined,
    })
    return NextResponse.json({ tasks })
  } catch (err) {
    console.error('[api/tasks GET]', err)
    return NextResponse.json({ error: 'Could not load tasks.' }, { status: 500 })
  }
}
