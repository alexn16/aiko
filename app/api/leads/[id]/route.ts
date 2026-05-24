import { NextRequest, NextResponse } from 'next/server'
import { updateLead } from '@/lib/leads'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const lead = await updateLead(params.id, body)
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found or nothing to update' }, { status: 404 })
    }
    return NextResponse.json({ lead })
  } catch (err) {
    console.error('[api/leads/[id] PATCH]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
