import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { db } from '@/lib/db/client'
import { getProviderForRole } from '@/lib/ai/router'
import { detectClaudeCodeLocal } from '@/lib/ai/providers/claude-code-cli'
import { getCodexAuthStatus } from '@/lib/ai/providers/codex-auth'

export const dynamic = 'force-dynamic'

const CHATGPT_REQUIRED = [
  'OPENAI_OAUTH_CLIENT_ID',
  'OPENAI_OAUTH_AUTH_URL',
  'OPENAI_OAUTH_TOKEN_URL',
  'OPENAI_OAUTH_REDIRECT_URI',
]
const CLAUDE_REQUIRED = ['CLAUDE_OAUTH_CLIENT_ID', 'CLAUDE_OAUTH_AUTH_URL', 'CLAUDE_OAUTH_TOKEN_URL']

function missingEnv(names: string[]): string[] {
  return names.filter(n => !process.env[n])
}

function sanitize(row: Record<string, unknown>) {
  return {
    id: row.id,
    provider_catalog_id: row.provider_catalog_id,
    display_name: row.display_name ?? row.name,
    provider: row.name,
    auth_method: row.auth_method ?? row.auth_type,
    compatibility: row.compatibility,
    base_url: row.base_url,
    model: row.model,
    account_email: row.account_email,
    status: row.status,
    last_error: row.last_error,
    last_tested_at: row.last_tested_at,
    capabilities: row.capabilities,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id ?? null
    const [profilesRes, ceoProfile, claudeCode, codexLocal] = await Promise.all([
      db.query(
        `SELECT id, provider_catalog_id, COALESCE(display_name, name) AS display_name,
                name, COALESCE(auth_method, auth_type) AS auth_method, compatibility,
                base_url, model, account_email, status, last_error, last_tested_at,
                capabilities, created_at, updated_at
         FROM provider_connections
         WHERE (user_id = $1 OR user_id IS NULL)
         ORDER BY created_at ASC`,
        [userId ?? null]
      ),
      getProviderForRole('ceo', userId).catch(() => null),
      detectClaudeCodeLocal(),
      getCodexAuthStatus(userId),
    ])

    const profiles = profilesRes.rows.map(sanitize)
    const chatgptMissing = missingEnv(CHATGPT_REQUIRED)
    const claudeOAuthMissing = missingEnv(CLAUDE_REQUIRED)
    const apiFallbacks = {
      openai_api_connected: profiles.some(p => p.provider_catalog_id === 'openai_api' && p.status === 'connected'),
      anthropic_api_connected: profiles.some(p => p.provider_catalog_id === 'anthropic_api' && p.status === 'connected'),
      ollama_connected: profiles.some(p => p.provider_catalog_id === 'ollama' && p.status === 'connected'),
      openrouter_connected: profiles.some(p => p.provider_catalog_id === 'openrouter' && p.status === 'connected'),
    }

    return NextResponse.json({
      can_ceo_think: !!ceoProfile && ceoProfile.status === 'connected',
      resolved_ceo_profile: ceoProfile ? sanitize(ceoProfile as unknown as Record<string, unknown>) : null,
      profiles,
      chatgpt_oauth: {
        configured: chatgptMissing.length === 0,
        missing_env: chatgptMissing,
        client_secret_set: !!process.env.OPENAI_OAUTH_CLIENT_SECRET,
      },
      chatgpt_codex_local: codexLocal,
      claude_code: claudeCode,
      claude_oauth: {
        configured: claudeOAuthMissing.length === 0,
        missing_env: claudeOAuthMissing,
        client_secret_set: !!process.env.CLAUDE_OAUTH_CLIENT_SECRET,
      },
      api_fallbacks: apiFallbacks,
      any_api_fallback_connected: Object.values(apiFallbacks).some(Boolean),
    })
  } catch (err) {
    console.error('[api/auth-profiles/diagnostics]', err)
    return NextResponse.json({ error: 'Could not load auth profile diagnostics' }, { status: 500 })
  }
}
