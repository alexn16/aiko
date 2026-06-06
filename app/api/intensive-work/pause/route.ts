import { NextRequest, NextResponse } from 'next/server'
import { setIntensiveWorkState } from '@/lib/intensive-work/engine'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const state = await setIntensiveWorkState({
      enabled: false,
      level: 'off',
      paused_reason: typeof body.reason === 'string' ? body.reason : 'Paused by user.',
    })
    return NextResponse.json({ ok: true, state })
  } catch (err) {
    console.error('[intensive-work/pause POST]', err)
    return NextResponse.json({ error: 'Could not pause intensive work.' }, { status: 500 })
  }
}
