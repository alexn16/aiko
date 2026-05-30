/**
 * AÏKO Middleware — route protection
 *
 * AIKO_AUTH_MODE=optional (default):
 *   /connect-ai and /api/providers/** are public — AI setup works without login.
 *   All other dashboard routes still require a session.
 *
 * AIKO_AUTH_MODE=required:
 *   All dashboard routes require a valid session (original behavior).
 *
 * Always public (no auth required):
 *   /login         — sign-in page
 *   /api/auth/**   — NextAuth endpoints
 */

import { withAuth } from 'next-auth/middleware'
import { NextResponse, type NextRequest } from 'next/server'

/** Routes that are always public regardless of auth mode. */
const ALWAYS_PUBLIC = ['/login', '/api/auth/']

/** Routes that are public when AIKO_AUTH_MODE=optional. */
const OPTIONAL_MODE_PUBLIC = [
  '/connect-ai',
  '/api/providers/',
  '/api/setup',
  '/api/auth/diagnostics',
]

function isPublicPath(pathname: string): boolean {
  if (ALWAYS_PUBLIC.some(p => pathname.startsWith(p))) return true
  const authMode = process.env.AIKO_AUTH_MODE ?? 'optional'
  if (authMode !== 'required') {
    if (OPTIONAL_MODE_PUBLIC.some(p => pathname.startsWith(p))) return true
  }
  return false
}

export default withAuth(
  function middleware(req: NextRequest) {
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
