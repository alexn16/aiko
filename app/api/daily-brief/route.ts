import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getDailyBrief } from '@/lib/daily-brief'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const brief = await getDailyBrief(session?.user?.id ?? null)
    return NextResponse.json(brief)
  } catch (err) {
    console.error('[api/daily-brief GET]', err)
    return NextResponse.json({ error: 'Could not load daily brief.' }, { status: 500 })
  }
}
