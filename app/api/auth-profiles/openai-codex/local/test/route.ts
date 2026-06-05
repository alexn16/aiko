import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { testCodexAuthProfile } from '@/lib/ai/providers/codex-auth'

export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await getServerSession(authOptions)
  const result = await testCodexAuthProfile(session?.user?.id ?? null)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error, profile_id: result.profile_id }, { status: 409 })
  }
  return NextResponse.json({ ok: true, profile_id: result.profile_id })
}
