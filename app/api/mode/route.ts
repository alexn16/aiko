import { NextRequest, NextResponse } from 'next/server'
import {
  getModeState,
  setMode,
  pauseAgents,
  resumeAgents,
  type OperatingMode,
} from '@/lib/operating-mode'
import { db } from '@/lib/db/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const state = await getModeState()
    return NextResponse.json(state)
  } catch (err) {
    console.error('[api/mode GET]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { mode, paused, paused_reason, daily_send_limit, notes, confirmation_token } = body

    if (paused === true) {
      await pauseAgents(paused_reason)
    } else if (paused === false) {
      await resumeAgents()
    }

    if (mode) {
      await setMode(mode as OperatingMode, { confirmation_token, notes })
    }

    if (typeof daily_send_limit === 'number') {
      await db.query(
        `UPDATE operating_mode SET daily_send_limit=$1, updated_at=NOW()`,
        [daily_send_limit]
      )
    }

    const state = await getModeState()
    return NextResponse.json(state)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal error'
    const status = msg.includes('confirmation token') ? 400 : 500
    console.error('[api/mode PATCH]', err)
    return NextResponse.json({ error: msg }, { status })
  }
}
