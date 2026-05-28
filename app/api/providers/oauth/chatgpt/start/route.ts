/**
 * GET /api/providers/oauth/chatgpt/start
 *
 * Initiates the ChatGPT/OpenAI OAuth authorization flow.
 *
 * Requirements:
 *   OPENAI_OAUTH_CLIENT_ID
 *   OPENAI_OAUTH_AUTH_URL
 *   OPENAI_OAUTH_TOKEN_URL
 *   OPENAI_OAUTH_REDIRECT_URI  (optional — defaults to {NEXTAUTH_URL}/api/providers/oauth/chatgpt/callback)
 *
 * If those vars are not set, returns { configured: false } with a clear message.
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

  const cfg = getOAuthProviderConfig('chatgpt')

  if (!isConfigured(cfg)) {
    return NextResponse.json(
      {
        configured: false,
        error: 'ChatGPT/Codex OAuth is not configured on this AÏKO instance. Use OpenAI API key instead, or set OPENAI_OAUTH_CLIENT_ID, OPENAI_OAUTH_AUTH_URL, and OPENAI_OAUTH_TOKEN_URL.',
      },
      { status: 422 }
    )
  }

  const state        = generateState()
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = deriveCodeChallenge(codeVerifier)
  const authUrl      = buildAuthUrl(cfg, state, codeChallenge)

  const cookieOpts = makeStateCookieOptions()
  const response = NextResponse.redirect(authUrl)
  response.cookies.set(OAUTH_STATE_COOKIE,    state,        cookieOpts)
  response.cookies.set(OAUTH_VERIFIER_COOKIE, codeVerifier, cookieOpts)
  return response
}
