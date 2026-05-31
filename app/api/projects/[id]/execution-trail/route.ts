import { NextRequest, NextResponse } from 'next/server'
import { getProjectExecutionTrail } from '@/lib/execution-trail'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10)
    const events = await getProjectExecutionTrail(params.id, limit)
    return NextResponse.json({ events })
  } catch (err) {
    console.error('[api/projects/[id]/execution-trail]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
