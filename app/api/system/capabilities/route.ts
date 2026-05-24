import { NextResponse } from 'next/server'
import { listCapabilities } from '@/lib/system-capabilities'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const capabilities = await listCapabilities()
    return NextResponse.json({ capabilities })
  } catch (err) {
    console.error('[api/system/capabilities GET]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
