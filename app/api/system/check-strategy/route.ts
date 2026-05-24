import { NextRequest, NextResponse } from 'next/server'
import { checkCapabilitiesForStrategy } from '@/lib/system-capabilities'
import { generateCapabilityGapReport } from '@/lib/system-improvements'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      strategy?: string
      project_id?: string
      create_proposal?: boolean
    }

    if (!body.strategy?.trim()) {
      return NextResponse.json({ error: 'strategy is required' }, { status: 400 })
    }

    const strategy = body.strategy.trim()

    if (body.create_proposal) {
      const { check_result, proposal } = await generateCapabilityGapReport(
        strategy,
        body.project_id
      )
      return NextResponse.json({ check_result, proposal })
    }

    const check_result = await checkCapabilitiesForStrategy(strategy)
    return NextResponse.json({ check_result, proposal: null })
  } catch (err) {
    console.error('[api/system/check-strategy POST]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
