import { NextRequest, NextResponse } from 'next/server'
import { getCustomAgent, updateCustomAgent, archiveCustomAgent } from '@/lib/custom-agents'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const agent = await getCustomAgent(params.id)
  if (!agent) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ agent })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body   = await request.json()
    const agent  = await updateCustomAgent(params.id, body)
    if (!agent) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ agent })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const agent = await getCustomAgent(params.id)
  if (!agent) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await archiveCustomAgent(params.id)
  return NextResponse.json({ ok: true })
}
