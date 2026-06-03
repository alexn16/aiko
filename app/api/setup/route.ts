import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getSetupState } from '@/lib/setup-state'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  const state = await getSetupState(session?.user?.id ?? null)
  return NextResponse.json({ configured: !state.setup_required, ...state })
}
