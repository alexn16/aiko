import { NextResponse } from 'next/server'
import { getWebOperatorStatus } from '@/lib/web-operator/web-operator'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const status = await getWebOperatorStatus()
    return NextResponse.json(status)
  } catch (err) {
    console.error('[web-operator/status GET]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
