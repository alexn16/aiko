import { NextRequest, NextResponse } from 'next/server'
import { getLeadExecutionTrail } from '@/lib/execution-trail'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const events = await getLeadExecutionTrail(params.id)
    return NextResponse.json({ events })
  } catch (err) {
    console.error('[api/leads/[id]/execution-trail]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
