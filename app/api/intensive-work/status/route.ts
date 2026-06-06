import { NextResponse } from 'next/server'
import { getActiveWork } from '@/lib/intensive-work/engine'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const status = await getActiveWork()
    return NextResponse.json(status)
  } catch (err) {
    console.error('[intensive-work/status GET]', err)
    return NextResponse.json({ error: 'Could not load intensive work status.' }, { status: 500 })
  }
}
