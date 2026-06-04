import { NextRequest, NextResponse } from 'next/server'
import {
  attachImplementationPromptToProposal,
  getImplementationPromptForProposal,
  type CapabilityImplementationPrompt,
} from '@/lib/system-improvement-prompts'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const prompt = await getImplementationPromptForProposal(params.id)
    if (!prompt) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    return NextResponse.json({ prompt })
  } catch (err) {
    console.error('[api/system/improvements/[id]/implementation-prompt GET]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json().catch(() => ({})) as { prompt?: CapabilityImplementationPrompt }
    const prompt = body.prompt ?? await getImplementationPromptForProposal(params.id)
    if (!prompt) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })

    const proposal = await attachImplementationPromptToProposal(params.id, prompt)
    if (!proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })

    return NextResponse.json({ prompt, proposal })
  } catch (err) {
    console.error('[api/system/improvements/[id]/implementation-prompt POST]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
