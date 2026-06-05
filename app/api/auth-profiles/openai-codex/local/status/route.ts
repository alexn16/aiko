import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getCodexAuthStatus } from '@/lib/ai/providers/codex-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  const status = await getCodexAuthStatus(session?.user?.id ?? null)
  return NextResponse.json(status)
}
