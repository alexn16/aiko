/**
 * GET /api/providers/subscription-diagnostics
 *
 * Returns structured, honest status for ChatGPT OAuth, Claude OAuth/CLI,
 * and all API-key fallback providers.
 *
 * Security rules (enforced):
 *   - NEVER returns tokens, API keys, refresh tokens, or secret values.
 *   - Env var presence is reported as boolean only.
 *   - Missing env vars are named (not their values).
 *   - OAuth connection rows are queried for status + account_email only.
 *   - No fake states: "connected" only when token exists and is not expired.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { db } from '@/lib/db/client'
import { detectClaudeCodeLocal } from '@/lib/ai/providers/claude-code-cli'

export const dynamic = 'force-dynamic'

// ── Env var presence helpers (never return values) ─────────────────────────────

function chatgptEnvCheck(): { present: string[]; missing: string[] } {
  const vars = [
    'OPENAI_OAUTH_CLIENT_ID',
    'OPENAI_OAUTH_AUTH_URL',
    'OPENAI_OAUTH_TOKEN_URL',
    'OPENAI_OAUTH_REDIRECT_URI',
  ]
  const present = vars.filter(v => !!process.env[v])
  const missing = vars.filter(v => !process.env[v])
  return { present, missing }
}

function claudeEnvCheck(): { present: string[]; missing: string[] } {
  const vars = [
    'CLAUDE_OAUTH_CLIENT_ID',
    'CLAUDE_OAUTH_AUTH_URL',
    'CLAUDE_OAUTH_TOKEN_URL',
  ]
  const present = vars.filter(v => !!process.env[v])
  const missing = vars.filter(v => !process.env[v])
  return { present, missing }
}

// ── Provider connection query ──────────────────────────────────────────────────

interface ConnectionRow {
  id: string
  status: string
  account_email: string | null
  last_error: string | null
  last_tested_at: string | null
}

async function getConnection(
  catalogId: string,
  userId: string | null
): Promise<ConnectionRow | null> {
  try {
    const res = await db.query(
      `SELECT id, status, account_email, last_error, last_tested_at
       FROM provider_connections
       WHERE provider_catalog_id = $1
         AND (user_id = $2 OR user_id IS NULL)
       ORDER BY user_id NULLS LAST, created_at DESC
       LIMIT 1`,
      [catalogId, userId ?? null]
    )
    if (!res.rows[0]) return null
    const r = res.rows[0]
    return {
      id:             String(r.id),
      status:         String(r.status),
      account_email:  r.account_email ? String(r.account_email) : null,
      last_error:     r.last_error    ? String(r.last_error)    : null,
      last_tested_at: r.last_tested_at
        ? (r.last_tested_at instanceof Date
            ? r.last_tested_at.toISOString()
            : String(r.last_tested_at))
        : null,
    }
  } catch {
    return null
  }
}

async function isApiConnected(
  catalogId: string,
  userId: string | null
): Promise<boolean> {
  try {
    const res = await db.query(
      `SELECT 1 FROM provider_connections
       WHERE provider_catalog_id = $1
         AND status = 'connected'
         AND (user_id = $2 OR user_id IS NULL)
       LIMIT 1`,
      [catalogId, userId ?? null]
    )
    return !!res.rows[0]
  } catch {
    return false
  }
}

// ── CEO brain query ────────────────────────────────────────────────────────────

async function getCeoBrain(userId: string | null) {
  try {
    const res = await db.query(
      `SELECT
         pc.name        AS provider_name,
         pc.model,
         pc.status,
         pc.auth_type,
         pc.last_error,
         pc.compatibility,
         pc.account_email
       FROM ai_role_assignments ara
       JOIN provider_connections pc ON pc.id = ara.provider_id
       WHERE ara.role = 'ceo'
         AND (ara.user_id = $1 OR ara.user_id IS NULL)
       ORDER BY ara.user_id NULLS LAST
       LIMIT 1`,
      [userId ?? null]
    )
    if (!res.rows[0]) return null
    const r = res.rows[0]
    return {
      provider_name:  r.provider_name  ? String(r.provider_name)  : null,
      model:          r.model          ? String(r.model)          : null,
      status:         r.status         ? String(r.status)         : null,
      auth_type:      r.auth_type      ? String(r.auth_type)      : null,
      last_error:     r.last_error     ? String(r.last_error)     : null,
      compatibility:  r.compatibility  ? String(r.compatibility)  : null,
      account_email:  r.account_email  ? String(r.account_email)  : null,
    }
  } catch {
    return null
  }
}

// ── Main handler ───────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId  = session?.user?.id ?? null

    // Parallel queries — no tokens returned anywhere
    const [
      chatgptConn,
      claudeConn,
      openaiApiConnected,
      anthropicApiConnected,
      ollamaConnected,
      openrouterConnected,
      ceoBrain,
      claudeCodeDetection,
    ] = await Promise.all([
      getConnection('chatgpt_oauth',  userId),
      getConnection('claude_oauth',   userId),
      isApiConnected('openai_api',    userId),
      isApiConnected('anthropic_api', userId),
      isApiConnected('ollama',        userId),
      isApiConnected('openrouter',    userId),
      getCeoBrain(userId),
      detectClaudeCodeLocal(),
    ])

    // ── ChatGPT card ─────────────────────────────────────────────────────────
    const cgEnv = chatgptEnvCheck()
    const cgConfigured = cgEnv.missing.length === 0

    // Honest status derivation
    type ChatGPTStatus =
      | 'connected'
      | 'needs_reauth'
      | 'not_connected'
      | 'oauth_not_configured'
      | 'no_connection_row'

    let chatgptStatus: ChatGPTStatus
    if (!cgConfigured) {
      chatgptStatus = 'oauth_not_configured'
    } else if (!chatgptConn) {
      chatgptStatus = 'no_connection_row'
    } else if (chatgptConn.status === 'connected') {
      chatgptStatus = 'connected'
    } else if (chatgptConn.status === 'needs_reauth') {
      chatgptStatus = 'needs_reauth'
    } else {
      chatgptStatus = 'not_connected'
    }

    const chatgpt = {
      status:                chatgptStatus,
      configured:            cgConfigured,
      connected:             chatgptStatus === 'connected',
      needs_reauth:          chatgptStatus === 'needs_reauth',
      can_start_oauth:       cgConfigured,
      can_call_model:        chatgptStatus === 'connected',
      missing_env:           cgEnv.missing,         // names only, never values
      account_email:         chatgptConn?.account_email ?? null,
      provider_connection_id: chatgptConn?.id ?? null,
      last_error:            chatgptConn?.last_error ?? null,
      last_tested_at:        chatgptConn?.last_tested_at ?? null,
    }

    // ── Claude card ──────────────────────────────────────────────────────────
    const clEnv = claudeEnvCheck()
    const clConfigured = clEnv.missing.length === 0

    // Claude CLI / Claude Code detection (boolean only — no token values)
    const claudeCliDetected        = claudeCodeDetection.cli_detected
    const claudeCodeTokenDetected  = claudeCodeDetection.token_env_detected

    type ClaudeStatus =
      | 'connected'
      | 'needs_reauth'
      | 'not_connected'
      | 'oauth_not_configured'
      | 'no_connection_row'

    let claudeStatus: ClaudeStatus
    if (!clConfigured) {
      claudeStatus = 'oauth_not_configured'
    } else if (!claudeConn) {
      claudeStatus = 'no_connection_row'
    } else if (claudeConn.status === 'connected') {
      claudeStatus = 'connected'
    } else if (claudeConn.status === 'needs_reauth') {
      claudeStatus = 'needs_reauth'
    } else {
      claudeStatus = 'not_connected'
    }

    const claude = {
      status:                claudeStatus,
      configured:            clConfigured,
      connected:             claudeStatus === 'connected',
      needs_reauth:          claudeStatus === 'needs_reauth',
      can_start_oauth:       clConfigured,
      can_call_model:        claudeStatus === 'connected',
      missing_env:           clEnv.missing,
      account_email:         claudeConn?.account_email ?? null,
      provider_connection_id: claudeConn?.id ?? null,
      last_error:            claudeConn?.last_error ?? null,
      last_tested_at:        claudeConn?.last_tested_at ?? null,
      claude_cli_detected:   claudeCliDetected,
      claude_code_token_detected: claudeCodeTokenDetected,
      claude_code_local_auth_detected: claudeCodeDetection.local_auth_detected,
      claude_code_detail: claudeCodeDetection.detail,
    }

    // ── CEO brain summary ────────────────────────────────────────────────────
    const canCeoThink = !!(ceoBrain && ceoBrain.status === 'connected')

    const ceo_brain = {
      can_think:     canCeoThink,
      provider_name: ceoBrain?.provider_name ?? null,
      model:         ceoBrain?.model ?? null,
      auth_type:     ceoBrain?.auth_type ?? null,
      status:        ceoBrain?.status ?? null,
      last_error:    ceoBrain?.last_error ?? null,
      account_email: ceoBrain?.account_email ?? null,
    }

    // ── Fallbacks ─────────────────────────────────────────────────────────────
    const fallbacks = {
      openai_api_connected:    openaiApiConnected,
      anthropic_api_connected: anthropicApiConnected,
      ollama_connected:        ollamaConnected,
      openrouter_connected:    openrouterConnected,
    }

    const anyFallback =
      openaiApiConnected || anthropicApiConnected || ollamaConnected || openrouterConnected

    return NextResponse.json({
      chatgpt,
      claude,
      ceo_brain,
      fallbacks,
      any_model_available: canCeoThink || anyFallback,
    })
  } catch (err) {
    console.error('[subscription-diagnostics]', err)
    return NextResponse.json(
      { error: 'Could not load subscription diagnostics' },
      { status: 500 }
    )
  }
}
