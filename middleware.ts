/**
 * AÏKO Middleware — route protection
 *
 * AIKO_AUTH_MODE=optional (default — local / OpenClaw-style use):
 *   All routes are accessible without a session.
 *   SetupGate handles the "no brain → /connect-ai" redirect client-side.
 *   API routes scope to user_id = null (global providers) when no session.
 *   Google login is available at /login but never required.
 *
 * AIKO_AUTH_MODE=required (multi-user / hosted deployments):
 *   All dashboard routes require a valid session.
 *   Unauthenticated requests are redirected to /login.
 *
 * Always public (no auth required in either mode):
 *   /login         — sign-in page
 *   /api/auth/**   — NextAuth endpoints
 */

import { withAuth } from 'next-auth/middleware'
import { NextResponse, type NextRequest } from 'next/server'

function isPublicPath(pathname: string): boolean {
  // Always public regardless of mode
  if (pathname.startsWith('/login')) return true
  if (pathname.startsWith('/api/auth/')) return true

  // In optional mode, every route is public — SetupGate guards locally
  const authMode = process.env.AIKO_AUTH_MODE ?? 'optional'
  if (authMode !== 'required') return true

  return false
}

export default withAuth(
  function middleware(_req: NextRequest) {
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized({ req, token }) {
        if (isPublicPath(req.nextUrl.pathname)) return true
        return !!token
      },
    },
    pages: {
      signIn: '/login',
    },
  }
)

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
