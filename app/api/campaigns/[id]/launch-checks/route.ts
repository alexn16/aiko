import { NextRequest, NextResponse } from 'next/server'
import {
  listCampaignLaunchChecks,
  runCampaignLaunchCheck,
} from '@/lib/campaign-launch-readiness'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const checks = await listCampaignLaunchChecks(params.id)
    return NextResponse.json({ checks })
  } catch (err) {
    console.error('[api/campaigns/[id]/launch-checks GET]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await runCampaignLaunchCheck(params.id)
    return NextResponse.json({ check: result })
  } catch (err) {
    console.error('[api/campaigns/[id]/launch-checks POST]', err)
    const msg = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
