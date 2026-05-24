import { NextRequest, NextResponse } from 'next/server'
import { generateCampaignFromApprovedItems } from '@/lib/campaigns'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { project_id } = body

    if (!project_id) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
    }

    const campaign = await generateCampaignFromApprovedItems(project_id)
    return NextResponse.json({ campaign })
  } catch (err) {
    console.error('[api/campaigns/generate POST]', err)
    const msg = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
