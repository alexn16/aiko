/**
 * GET /api/providers/oauth/claude/start
 *
 * Initiates the Claude account OAuth authorization flow.
 *
 * Requirements:
 *   CLAUDE_OAUTH_CLIENT_ID
 *   CLAUDE_OAUTH_AUTH_URL
 *   CLAUDE_OAUTH_TOKEN_URL
 *
 * Important:
 *   Claude/Claude Code account OAuth for third-party apps may not be
 *   publicly available on all plans. If you have OAuth credentials from
 *   Anthropic, set the env vars above. Otherwise, use Anthropic API key.
 *
 * If those vars are not set, returns { configured: false }.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import {
  getOAuthProviderConfig,
  isConfigured,
  generateCodeVerifier,
  deriveCodeChallenge,
  generateState,
  buildAuthUrl,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  makeStateCookieOptions,
} from '@/lib/oauth-helpers'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const cfg = getOAuthProviderConfig('claude')

  if (!isConfigured(cfg)) {
    return NextResponse.json(
      {
        configured: false,
        error: 'Claude account connection is not configured on this AÏKO instance. Use Anthropic API key instead, or set CLAUDE_OAUTH_CLIENT_ID, CLAUDE_OAUTH_AUTH_URL, and CLAUDE_OAUTH_TOKEN_URL.',
      },
      { status: 422 }
    )
  }

  const state         = generateState()
  const codeVerifier  = generateCodeVerifier()
  const codeChallenge = deriveCodeChallenge(codeVerifier)
  const authUrl       = buildAuthUrl(cfg, state, codeChallenge)

  const cookieOpts = makeStateCookieOptions()
  const response = NextResponse.redirect(authUrl)
  response.cookies.set(OAUTH_STATE_COOKIE,    state,        cookieOpts)
  response.cookies.set(OAUTH_VERIFIER_COOKIE, codeVerifier, cookieOpts)
  return response
}
