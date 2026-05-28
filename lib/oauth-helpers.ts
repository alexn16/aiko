/**
 * OAuth helpers for ChatGPT and Claude account connections.
 *
 * Architecture:
 *   - OAuth flows use authorization code + PKCE.
 *   - State is stored in a signed cookie during the redirect.
 *   - Tokens are stored in provider_connections (oauth_access_token,
 *     oauth_refresh_token, token_expires_at).
 *
 * Important:
 *   - Google login identifies the AÏKO user. It does NOT connect ChatGPT or Claude.
 *   - ChatGPT OAuth requires OPENAI_OAUTH_* env vars.
 *   - Claude OAuth requires CLAUDE_OAUTH_* env vars.
 *   - When those vars are unset, the helpers return { configured: false }.
 */

import crypto from 'crypto'

// ── Provider config ────────────────────────────────────────────────────────────

export type OAuthProviderId = 'chatgpt' | 'claude'

export interface OAuthProviderConfig {
  id: OAuthProviderId
  catalogId: string          // matches provider_catalog.id
  displayName: string
  authUrl: string | null     // null = not configured
  tokenUrl: string | null
  clientId: string | null
  clientSecret: string | null
  redirectUri: string
  scope: string
  compatibility: string
  defaultModel: string
}

export function getOAuthProviderConfig(provider: OAuthProviderId): OAuthProviderConfig {
  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3001'

  if (provider === 'chatgpt') {
    return {
      id:           'chatgpt',
      catalogId:    'chatgpt_oauth',
      displayName:  'ChatGPT',
      authUrl:      process.env.OPENAI_OAUTH_AUTH_URL  ?? null,
      tokenUrl:     process.env.OPENAI_OAUTH_TOKEN_URL ?? null,
      clientId:     process.env.OPENAI_OAUTH_CLIENT_ID ?? null,
      clientSecret: process.env.OPENAI_OAUTH_CLIENT_SECRET ?? null,
      redirectUri:  `${base}/api/providers/oauth/chatgpt/callback`,
      scope:        process.env.OPENAI_OAUTH_SCOPE ?? 'openid profile email',
      compatibility: 'openai_compatible',
      defaultModel: process.env.OPENAI_OAUTH_DEFAULT_MODEL ?? 'gpt-4o',
    }
  }

  // claude
  return {
    id:           'claude',
    catalogId:    'claude_oauth',
    displayName:  'Claude',
    authUrl:      process.env.CLAUDE_OAUTH_AUTH_URL  ?? null,
    tokenUrl:     process.env.CLAUDE_OAUTH_TOKEN_URL ?? null,
    clientId:     process.env.CLAUDE_OAUTH_CLIENT_ID ?? null,
    clientSecret: process.env.CLAUDE_OAUTH_CLIENT_SECRET ?? null,
    redirectUri:  `${base}/api/providers/oauth/claude/callback`,
    scope:        process.env.CLAUDE_OAUTH_SCOPE ?? 'openid profile email',
    compatibility: 'anthropic_messages',
    defaultModel: process.env.CLAUDE_OAUTH_DEFAULT_MODEL ?? 'claude-opus-4-5',
  }
}

export function isConfigured(cfg: OAuthProviderConfig): boolean {
  return !!(cfg.authUrl && cfg.tokenUrl && cfg.clientId)
}

// ── PKCE helpers ───────────────────────────────────────────────────────────────

export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url')
}

export function deriveCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url')
}

export function generateState(): string {
  return crypto.randomBytes(16).toString('hex')
}

// ── Authorization URL builder ──────────────────────────────────────────────────

export function buildAuthUrl(cfg: OAuthProviderConfig, state: string, codeChallenge: string): string {
  const url = new URL(cfg.authUrl!)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', cfg.clientId!)
  url.searchParams.set('redirect_uri', cfg.redirectUri)
  url.searchParams.set('scope', cfg.scope)
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  return url.toString()
}

// ── Token exchange ─────────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
  email?: string            // some providers include this in id_token claims
}

export async function exchangeCode(
  cfg: OAuthProviderConfig,
  code: string,
  codeVerifier: string
): Promise<TokenResponse> {
  const params: Record<string, string> = {
    grant_type:    'authorization_code',
    code,
    redirect_uri:  cfg.redirectUri,
    client_id:     cfg.clientId!,
    code_verifier: codeVerifier,
  }
  if (cfg.clientSecret) {
    params.client_secret = cfg.clientSecret
  }

  const res = await fetch(cfg.tokenUrl!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token exchange failed (${res.status}): ${text}`)
  }

  return res.json() as Promise<TokenResponse>
}

// ── State cookie helpers ───────────────────────────────────────────────────────

export const OAUTH_STATE_COOKIE = 'aiko_oauth_state'
export const OAUTH_VERIFIER_COOKIE = 'aiko_oauth_verifier'

export function makeStateCookieOptions() {
  return {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge:   10 * 60,   // 10 minutes
    path:     '/',
  }
}
