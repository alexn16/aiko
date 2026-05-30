import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getAuthMode, isAuthOptional } from '@/lib/auth-mode'
import { db } from '@/lib/db/client'

export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/diagnostics
 *
 * Returns a safe health snapshot of the authentication and provider configuration.
 * Security rules:
 *   - NEVER returns secrets, tokens, or API keys
 *   - Env var presence is reported as boolean only
 *   - OAuth tokens are never returned
 *   - API keys are never returned
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id ?? null

    // ── Env var presence checks (boolean only — no values returned) ──────────
    const nextauthUrl = process.env.NEXTAUTH_URL ?? ''

    const google = {
      client_id_set:     !!process.env.GOOGLE_CLIENT_ID,
      client_secret_set: !!process.env.GOOGLE_CLIENT_SECRET,
    }

    const nextauth = {
      secret_set: !!(process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET),
      url_set:    !!nextauthUrl,
    }

    // ── Missing required env vars ─────────────────────────────────────────────
    const missing_env: string[] = []
    if (!process.env.GOOGLE_CLIENT_ID)     missing_env.push('GOOGLE_CLIENT_ID')
    if (!process.env.GOOGLE_CLIENT_SECRET) missing_env.push('GOOGLE_CLIENT_SECRET')
    if (!(process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET)) {
      missing_env.push('NEXTAUTH_SECRET (or AUTH_SECRET)')
    }
    if (!nextauthUrl) missing_env.push('NEXTAUTH_URL')

    // ── Derived Google OAuth URLs (safe to return — constructed from NEXTAUTH_URL) ──
    const google_origin           = nextauthUrl || null
    const expected_redirect_uri   = nextauthUrl
      ? `${nextauthUrl}/api/auth/callback/google`
      : null

    const chatgpt_oauth_config = {
      client_id_set:     !!process.env.OPENAI_OAUTH_CLIENT_ID,
      client_secret_set: !!process.env.OPENAI_OAUTH_CLIENT_SECRET,
      auth_url_set:      !!process.env.OPENAI_OAUTH_AUTH_URL,
      token_url_set:     !!process.env.OPENAI_OAUTH_TOKEN_URL,
      scope_set:         !!process.env.OPENAI_OAUTH_SCOPE,
      fully_configured:  !!(
        process.env.OPENAI_OAUTH_CLIENT_ID &&
        process.env.OPENAI_OAUTH_CLIENT_SECRET &&
        process.env.OPENAI_OAUTH_AUTH_URL &&
        process.env.OPENAI_OAUTH_TOKEN_URL
      ),
    }

    const claude_oauth_config = {
      client_id_set:     !!process.env.CLAUDE_OAUTH_CLIENT_ID,
      client_secret_set: !!process.env.CLAUDE_OAUTH_CLIENT_SECRET,
      auth_url_set:      !!process.env.CLAUDE_OAUTH_AUTH_URL,
      token_url_set:     !!process.env.CLAUDE_OAUTH_TOKEN_URL,
      scope_set:         !!process.env.CLAUDE_OAUTH_SCOPE,
      fully_configured:  !!(
        process.env.CLAUDE_OAUTH_CLIENT_ID &&
        process.env.CLAUDE_OAUTH_CLIENT_SECRET &&
        process.env.CLAUDE_OAUTH_AUTH_URL &&
        process.env.CLAUDE_OAUTH_TOKEN_URL
      ),
    }

    // ── Provider connection statuses (scoped to signed-in user) ─────────────
    // Selects only status/type — never api_key or oauth tokens
    const connectionsResult = await db.query(
      `SELECT type, status, provider_catalog_id, account_email
       FROM provider_connections
       WHERE (user_id = $1 OR user_id IS NULL)
       ORDER BY created_at ASC`,
      [userId ?? null]
    )
    const connections = connectionsResult.rows as {
      type: string
      status: string
      provider_catalog_id: string | null
      account_email: string | null
    }[]

    const isConnected = (catalogId: string) =>
      connections.some(c => c.provider_catalog_id === catalogId && c.status === 'connected')

    const getOAuthStatus = (catalogId: string) => {
      const row = connections.find(c => c.provider_catalog_id === catalogId)
      if (!row) return null
      return {
        status:        row.status,
        account_email: row.account_email ?? null,
      }
    }

    // ── CEO brain ────────────────────────────────────────────────────────────
    // Resolve via role assignments — never return keys or tokens
    const ceoResult = await db.query(
      `SELECT
         pc.name  AS provider_name,
         pc.model,
         pc.status,
         pc.last_error,
         pc.compatibility
       FROM ai_role_assignments ara
       JOIN provider_connections pc ON pc.id = ara.provider_id
       WHERE ara.role = 'ceo'
         AND (ara.user_id = $1 OR ara.user_id IS NULL)
       ORDER BY ara.user_id NULLS LAST
       LIMIT 1`,
      [userId ?? null]
    )
    const ceoRow = (ceoResult.rows[0] ?? null) as {
      provider_name: string | null
      model: string | null
      status: string | null
      last_error: string | null
      compatibility: string | null
    } | null

    // Fallback: any connected provider if no explicit assignment
    let canCeoThink = !!(ceoRow && ceoRow.status === 'connected')
    if (!canCeoThink && !ceoRow) {
      const fallback = connections.find(c => c.status === 'connected')
      canCeoThink = !!fallback
    }

    return NextResponse.json({
      // ── Auth mode ──────────────────────────────────────────────────────
      auth_mode: getAuthMode(),
      can_configure_without_login: isAuthOptional(),

      // ── Google login ────────────────────────────────────────────────────
      google_login: {
        ...google,
        ...nextauth,
        signed_in:   !!session?.user,
        signed_in_user: session?.user
          ? {
              id:    userId,
              email: session.user.email ?? null,
              name:  session.user.name  ?? null,
            }
          : null,
        // Derived URLs for Google Cloud Console setup
        expected_redirect_uri,
        google_origin,
      },

      // ── Missing required env vars ──────────────────────────────────────
      missing_env,

      // ── ChatGPT OAuth ──────────────────────────────────────────────────
      chatgpt_oauth: {
        ...chatgpt_oauth_config,
        connection: getOAuthStatus('chatgpt_oauth'),
      },

      // ── Claude OAuth ───────────────────────────────────────────────────
      claude_oauth: {
        ...claude_oauth_config,
        connection: getOAuthStatus('claude_oauth'),
      },

      // ── API-key providers ──────────────────────────────────────────────
      api_providers: {
        openai_api_connected:    isConnected('openai_api'),
        anthropic_api_connected: isConnected('anthropic_api'),
        openrouter_connected:    isConnected('openrouter'),
        ollama_connected:        isConnected('ollama'),
      },

      // ── CEO brain ──────────────────────────────────────────────────────
      ceo_brain: {
        can_ceo_think:     canCeoThink,
        assigned_provider: ceoRow?.provider_name ?? null,
        model:             ceoRow?.model ?? null,
        compatibility:     ceoRow?.compatibility ?? null,
        last_error:        ceoRow?.last_error ?? null,
      },
    })
  } catch (err) {
    console.error('[api/auth/diagnostics]', err)
    return NextResponse.json(
      { error: 'Could not load auth diagnostics' },
      { status: 500 }
    )
  }
}
