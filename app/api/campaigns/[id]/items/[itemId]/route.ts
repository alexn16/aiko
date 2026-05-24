import { NextRequest, NextResponse } from 'next/server'
import { updateCampaignItem } from '@/lib/campaigns'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const body = await req.json()
    const { status, sequence_order, content } = body

    const updated = await updateCampaignItem(params.itemId, { status, sequence_order, content })

    if (!updated) {
      return NextResponse.json({ error: 'Item not found or no fields to update' }, { status: 404 })
    }
    return NextResponse.json({ item: updated })
  } catch (err) {
    console.error('[api/campaigns/[id]/items/[itemId] PATCH]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
