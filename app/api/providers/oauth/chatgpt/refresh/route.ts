/**
 * POST /api/providers/oauth/chatgpt/refresh
 *
 * Attempts to refresh the ChatGPT OAuth access token using the stored
 * refresh token. Called automatically by the router when the token is
 * expired, but can also be triggered manually from the Connect AI panel.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { db } from '@/lib/db/client'
import { getOAuthProviderConfig, isConfigured } from '@/lib/oauth-helpers'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }
  const userId = session.user.id

  const cfg = getOAuthProviderConfig('chatgpt')
  if (!isConfigured(cfg)) {
    return NextResponse.json({ error: 'ChatGPT OAuth is not configured on this instance.' }, { status: 422 })
  }

  const res = await db.query(
    `SELECT id, oauth_refresh_token FROM provider_connections
     WHERE user_id = $1 AND provider_catalog_id = 'chatgpt_oauth'`,
    [userId]
  )
  const row = res.rows[0]
  if (!row) {
    return NextResponse.json({ error: 'No ChatGPT connection found.' }, { status: 404 })
  }
  if (!row.oauth_refresh_token) {
    return NextResponse.json({ error: 'No refresh token stored. Please reconnect.' }, { status: 422 })
  }

  try {
    const tokenRes = await fetch(cfg.tokenUrl!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'refresh_token',
        refresh_token: row.oauth_refresh_token,
        client_id:     cfg.clientId!,
        ...(cfg.clientSecret ? { client_secret: cfg.clientSecret } : {}),
      }),
    })

    if (!tokenRes.ok) {
      const text = await tokenRes.text()
      await db.query(
        `UPDATE provider_connections SET status='needs_reauth', last_error=$1, updated_at=NOW() WHERE id=$2`,
        [`Token refresh failed: ${text}`, row.id]
      )
      return NextResponse.json({ error: `Refresh failed: ${text}` }, { status: 400 })
    }

    const tokens = await tokenRes.json() as { access_token: string; refresh_token?: string; expires_in?: number }
    const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null

    await db.query(
      `UPDATE provider_connections
       SET oauth_access_token=$1, oauth_refresh_token=$2, token_expires_at=$3,
           status='connected', last_error=NULL, last_tested_at=NOW(), updated_at=NOW()
       WHERE id=$4`,
      [tokens.access_token, tokens.refresh_token ?? row.oauth_refresh_token, expiresAt, row.id]
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
