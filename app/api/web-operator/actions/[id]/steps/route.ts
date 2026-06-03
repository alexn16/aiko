import { NextRequest, NextResponse } from 'next/server'
import { listStepsForAction } from '@/lib/web-operator/action-steps'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const steps = await listStepsForAction(params.id)
    return NextResponse.json({ steps })
  } catch (err) {
    console.error(`[web-operator/actions/${params.id}/steps GET]`, err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
