import { NextRequest, NextResponse } from 'next/server'
import {
  listSystemImprovementProposals,
  createSystemImprovementProposal,
} from '@/lib/system-improvements'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const status = url.searchParams.get('status') ?? undefined
    const risk_level = url.searchParams.get('risk_level') ?? undefined
    const limitParam = url.searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : undefined

    const proposals = await listSystemImprovementProposals({ status, risk_level, limit })
    return NextResponse.json({ proposals })
  } catch (err) {
    console.error('[api/system/improvements GET]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (!body.title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }
    const proposal = await createSystemImprovementProposal(body)
    return NextResponse.json({ proposal }, { status: 201 })
  } catch (err) {
    console.error('[api/system/improvements POST]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
