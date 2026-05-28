import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'

/**
 * GET /api/auth/me
 *
 * Returns the signed-in user's public info (no secrets).
 * Used by the /connect-ai account section and diagnostics.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ user: null }, { status: 401 })
  }
  return NextResponse.json({
    user: {
      id:    session.user.id,
      email: session.user.email,
      name:  session.user.name ?? null,
      image: session.user.image ?? null,
    },
  })
}
