import { NextResponse } from 'next/server'
import { getSystemImprovementTimeline } from '@/lib/system-improvement-timeline'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const timeline = await getSystemImprovementTimeline()
    return NextResponse.json(timeline)
  } catch (err) {
    console.error('[api/system/improvement-timeline GET]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
