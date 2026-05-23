import { NextRequest, NextResponse } from 'next/server'
import { testProvider } from '@/lib/ai/router'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const result = await testProvider(params.id)
  if (result.ok) {
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
}
