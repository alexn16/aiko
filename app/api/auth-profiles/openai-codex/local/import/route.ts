import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { importCodexAuthProfile } from '@/lib/ai/providers/codex-auth'

export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await getServerSession(authOptions)
  const result = await importCodexAuthProfile(session?.user?.id ?? null)
  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        instructions: result.status.instructions,
        status: result.status,
      },
      { status: 409 },
    )
  }
  return NextResponse.json(result)
}
