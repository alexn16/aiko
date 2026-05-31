import { NextRequest, NextResponse } from 'next/server'
import { getCampaignExecutionTrail } from '@/lib/execution-trail'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const events = await getCampaignExecutionTrail(params.id)
    return NextResponse.json({ events })
  } catch (err) {
    console.error('[api/campaigns/[id]/execution-trail]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
