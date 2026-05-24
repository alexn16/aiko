import { NextRequest, NextResponse } from 'next/server'
import { markCapabilityStatusById } from '@/lib/system-capabilities'
import type { SystemCapability } from '@/lib/system-capabilities'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json() as { status?: SystemCapability['status'] }
    if (!body.status) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 })
    }
    await markCapabilityStatusById(params.id, body.status)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/system/capabilities/[id] PATCH]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
