import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { markSetupCompleteIfReady } from '@/lib/setup-state'

export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await getServerSession(authOptions)
  const state = await markSetupCompleteIfReady(session?.user?.id ?? null)
  if (state.setup_required) {
    return NextResponse.json({ ok: false, ...state }, { status: 409 })
  }
  return NextResponse.json({ ok: true, ...state })
}
