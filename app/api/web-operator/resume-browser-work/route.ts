import { NextResponse } from 'next/server'
import { resumeAllSafeBrowserWork } from '@/lib/web-operator/resume-controller'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const summary = await resumeAllSafeBrowserWork()
    return NextResponse.json(summary)
  } catch (err) {
    console.error('[web-operator/resume-browser-work POST]', err)
    return NextResponse.json({
      ok: false,
      message: 'Kevin could not resume browser work right now.',
    }, { status: 500 })
  }
}
