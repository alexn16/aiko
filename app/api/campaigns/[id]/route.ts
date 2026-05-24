import { NextRequest, NextResponse } from 'next/server'
import { getCampaign, updateCampaign, listCampaignItems } from '@/lib/campaigns'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const [campaign, items] = await Promise.all([
      getCampaign(params.id),
      listCampaignItems(params.id),
    ])
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    return NextResponse.json({ campaign, items })
  } catch (err) {
    console.error('[api/campaigns/[id] GET]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const { name, objective, audience, channel, status, strategy_summary, success_metric, owner_role } = body

    const updated = await updateCampaign(params.id, {
      name, objective, audience, channel, status, strategy_summary, success_metric, owner_role,
    })

    if (!updated) {
      return NextResponse.json({ error: 'Campaign not found or no fields to update' }, { status: 404 })
    }
    return NextResponse.json({ campaign: updated })
  } catch (err) {
    console.error('[api/campaigns/[id] PATCH]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
