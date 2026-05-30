/**
 * GET /api/providers/oauth/chatgpt/callback
 *
 * OAuth callback — exchanges the authorization code for tokens
 * and stores the provider connection in the DB.
 *
 * If the user is signed in, the connection is stored under their user_id.
 * If not (AIKO_AUTH_MODE=optional), stored under user_id = null (global mode).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { isAuthRequired } from '@/lib/auth-mode'
import { db } from '@/lib/db/client'
import {
  getOAuthProviderConfig,
  exchangeCode,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
} from '@/lib/oauth-helpers'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (isAuthRequired() && !session?.user?.id) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const userId = session?.user?.id ?? null

  const { searchParams } = req.nextUrl
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(
      new URL(`/connect-ai?oauth_error=${encodeURIComponent(error)}&provider=chatgpt`, req.url)
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/connect-ai?oauth_error=missing_params&provider=chatgpt', req.url)
    )
  }

  const storedState  = req.cookies.get(OAUTH_STATE_COOKIE)?.value
  const codeVerifier = req.cookies.get(OAUTH_VERIFIER_COOKIE)?.value

  if (!storedState || storedState !== state || !codeVerifier) {
    return NextResponse.redirect(
      new URL('/connect-ai?oauth_error=state_mismatch&provider=chatgpt', req.url)
    )
  }

  const cfg = getOAuthProviderConfig('chatgpt')

  try {
    const tokens = await exchangeCode(cfg, code, codeVerifier)

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null

    if (userId) {
      // User-scoped upsert (uses the unique constraint on (user_id, provider_catalog_id))
      await db.query(
        `INSERT INTO provider_connections
           (name, type, status, model, provider_catalog_id, compatibility, auth_type,
            oauth_access_token, oauth_refresh_token, token_expires_at,
            account_email, user_id, supports_streaming, last_tested_at, updated_at)
         VALUES ('ChatGPT', 'chatgpt_direct', 'connected', $1, 'chatgpt_oauth', 'openai_compatible',
                 'oauth', $2, $3, $4, $5, $6, true, NOW(), NOW())
         ON CONFLICT ON CONSTRAINT provider_conn_user_catalog_uniq
         DO UPDATE SET
           oauth_access_token  = EXCLUDED.oauth_access_token,
           oauth_refresh_token = EXCLUDED.oauth_refresh_token,
           token_expires_at    = EXCLUDED.token_expires_at,
           account_email       = EXCLUDED.account_email,
           status              = 'connected',
           last_tested_at      = NOW(),
           updated_at          = NOW()`,
        [cfg.defaultModel, tokens.access_token, tokens.refresh_token ?? null, expiresAt, tokens.email ?? null, userId]
      )
    } else {
      // Global (null user_id) — delete-then-insert since NULLs don't match in unique constraints
      await db.query(
        `DELETE FROM provider_connections
         WHERE user_id IS NULL AND provider_catalog_id = 'chatgpt_oauth'`
      )
      await db.query(
        `INSERT INTO provider_connections
           (name, type, status, model, provider_catalog_id, compatibility, auth_type,
            oauth_access_token, oauth_refresh_token, token_expires_at,
            account_email, user_id, supports_streaming, last_tested_at, updated_at)
         VALUES ('ChatGPT', 'chatgpt_direct', 'connected', $1, 'chatgpt_oauth', 'openai_compatible',
                 'oauth', $2, $3, $4, $5, NULL, true, NOW(), NOW())`,
        [cfg.defaultModel, tokens.access_token, tokens.refresh_token ?? null, expiresAt, tokens.email ?? null]
      )
    }

    const redirectUrl = new URL('/connect-ai?oauth_success=chatgpt', req.url)
    const response = NextResponse.redirect(redirectUrl)
    response.cookies.delete(OAUTH_STATE_COOKIE)
    response.cookies.delete(OAUTH_VERIFIER_COOKIE)
    return response

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[chatgpt oauth callback]', msg)
    return NextResponse.redirect(
      new URL(`/connect-ai?oauth_error=${encodeURIComponent(msg)}&provider=chatgpt`, req.url)
    )
  }
}
