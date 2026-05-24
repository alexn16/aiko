import { NextRequest, NextResponse } from 'next/server'
import { getActionLog } from '@/lib/operating-mode'
import { db } from '@/lib/db/client'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const limitParam = searchParams.get('limit')
    const allowedParam = searchParams.get('allowed')
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 500) : 50

    if (allowedParam !== null) {
      const allowedBool = allowedParam === 'true'
      const result = await db.query(
        `SELECT * FROM mode_action_log WHERE allowed=$1 ORDER BY created_at DESC LIMIT $2`,
        [allowedBool, limit]
      )
      return NextResponse.json({ log: result.rows })
    }

    const log = await getActionLog(limit)
    return NextResponse.json({ log })
  } catch (err) {
    console.error('[api/mode/log GET]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
