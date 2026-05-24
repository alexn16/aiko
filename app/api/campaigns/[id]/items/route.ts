import { NextRequest, NextResponse } from 'next/server'
import { addApprovedOutputToCampaign, addApprovalItemToCampaign } from '@/lib/campaigns'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const { output_id, approval_item_id } = body

    if (!output_id && !approval_item_id) {
      return NextResponse.json({ error: 'output_id or approval_item_id is required' }, { status: 400 })
    }

    let item = null
    if (output_id) {
      item = await addApprovedOutputToCampaign(params.id, output_id)
    } else if (approval_item_id) {
      item = await addApprovalItemToCampaign(params.id, approval_item_id)
    }

    if (!item) {
      return NextResponse.json({ error: 'Failed to add item — source not found' }, { status: 404 })
    }

    return NextResponse.json({ item })
  } catch (err) {
    console.error('[api/campaigns/[id]/items POST]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
