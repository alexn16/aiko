/**
 * AÏKO Middleware — route protection
 *
 * All dashboard routes require a valid session.
 * Unauthenticated requests are redirected to /login.
 *
 * Public routes (no auth required):
 *   /login         — sign-in page
 *   /api/auth/**   — NextAuth endpoints
 */

import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(_req) {
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized({ token }) {
        // Token present = authenticated
        return !!token
      },
    },
    pages: {
      signIn: '/login',
    },
  }
)

/**
 * Matcher: protect everything except:
 *   - /login
 *   - /api/auth/** (NextAuth routes)
 *   - Next.js internals (_next/*)
 *   - Public assets (favicon, etc.)
 */
export const config = {
  matcher: [
    '/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
}
