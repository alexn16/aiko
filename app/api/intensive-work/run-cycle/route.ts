import { NextResponse } from 'next/server'
import { runWorkCycle } from '@/lib/intensive-work/engine'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const result = await runWorkCycle()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[intensive-work/run-cycle POST]', err)
    return NextResponse.json({ error: 'Could not run intensive work cycle.' }, { status: 500 })
  }
}
