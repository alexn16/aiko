import { NextRequest, NextResponse } from 'next/server'
import { getWebOperatorSession, stopWebOperatorSession } from '@/lib/web-operator/web-operator'
import { db } from '@/lib/db/client'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getWebOperatorSession(params.id)
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ session })
  } catch (err) {
    console.error('[web-operator/session GET]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json().catch(() => ({}))
    const { status } = body as { status?: string }

    if (status === 'stopped') {
      await stopWebOperatorSession(params.id)
    } else if (status) {
      await db.query(
        `UPDATE web_operator_sessions SET status=$1 WHERE id=$2`,
        [status, params.id]
      )
    }

    const session = await getWebOperatorSession(params.id)
    return NextResponse.json({ session })
  } catch (err) {
    console.error('[web-operator/session PATCH]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
