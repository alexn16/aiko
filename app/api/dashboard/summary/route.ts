import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { db } from '@/lib/db/client'
import { getSetupState } from '@/lib/setup-state'
import { getModeState } from '@/lib/operating-mode'
import { getWebOperatorStatus } from '@/lib/web-operator/web-operator'
import { getSystemImprovementTimeline } from '@/lib/system-improvement-timeline'
import { detectClaudeCodeLocal } from '@/lib/ai/providers/claude-code-cli'

export const dynamic = 'force-dynamic'

interface Warning {
  severity: 'info' | 'warning' | 'danger'
  title: string
  message: string
  href?: string
}

async function countQuery(sql: string, params: unknown[] = []): Promise<number> {
  try {
    const res = await db.query(sql, params)
    return Number.parseInt(String(res.rows[0]?.count ?? '0'), 10)
  } catch {
    return 0
  }
}

async function rowsQuery<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  try {
    const res = await db.query(sql, params)
    return res.rows as T[]
  } catch {
    return []
  }
}

async function providerConnected(catalogIds: string[]): Promise<boolean> {
  try {
    const res = await db.query(
      `SELECT 1
       FROM provider_connections
       WHERE status='connected'
         AND provider_catalog_id = ANY($1::text[])
       LIMIT 1`,
      [catalogIds]
    )
    return !!res.rows[0]
  } catch {
    return false
  }
}

function dashboardModeLabel(mode: string): string {
  if (mode === 'read_only') return 'Read Only'
  if (mode === 'auto_approval' || mode === 'approval_required') return 'Auto / Approval Required'
  if (mode === 'full_access') return 'Full Access'
  return mode.replace(/_/g, ' ')
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id ?? null

    const [
      setup,
      mode,
      webOperator,
      timeline,
      chatgptConnected,
      claudeProviderConnected,
      claudeCodeLocal,
      activeProjectCount,
      activeWebOperators,
      waitingUserCount,
      pendingApprovals,
      activeImprovementProposals,
      recentFiles,
      recentReports,
      recentDecisions,
    ] = await Promise.all([
      getSetupState(userId),
      getModeState(),
      getWebOperatorStatus(),
      getSystemImprovementTimeline(),
      providerConnected(['chatgpt_oauth']),
      providerConnected(['claude_oauth', 'anthropic_api']),
      detectClaudeCodeLocal().catch(() => ({ cli_detected: false, token_env_detected: false, local_auth_detected: false })),
      countQuery(`SELECT COUNT(*) FROM projects WHERE active=true`),
      countQuery(`SELECT COUNT(*) FROM web_operators WHERE status NOT IN ('archived','disabled')`),
      countQuery(
        `WITH waiting AS (
           SELECT id::text FROM web_operators WHERE status='waiting_user'
           UNION
           SELECT id::text FROM web_operator_sessions WHERE status='waiting_user'
           UNION
           SELECT id::text FROM web_operator_actions WHERE status='waiting_user'
         )
         SELECT COUNT(*) FROM waiting`
      ),
      countQuery(`SELECT COUNT(*) FROM approval_items WHERE status='pending'`),
      countQuery(`SELECT COUNT(*) FROM system_improvement_proposals WHERE status NOT IN ('validated_available','rejected','archived')`),
      rowsQuery(
        `SELECT gf.id, gf.filename, gf.title, gf.content_type, gf.source_entity_type, gf.created_at, p.name AS project_name
         FROM generated_files gf
         LEFT JOIN projects p ON p.id = gf.project_id
         ORDER BY gf.created_at DESC
         LIMIT 5`
      ),
      rowsQuery(
        `SELECT r.id, r.title, r.summary, r.created_at, p.name AS project_name
         FROM project_executive_reports r
         LEFT JOIN projects p ON p.id = r.project_id
         ORDER BY r.created_at DESC
         LIMIT 5`
      ),
      rowsQuery(
        `SELECT d.id, d.decision_type, d.title, d.summary, d.created_at, p.name AS project_name
         FROM project_decisions d
         LEFT JOIN projects p ON p.id = d.project_id
         ORDER BY d.created_at DESC
         LIMIT 5`
      ),
    ])

    const claudeConnected = claudeProviderConnected || !!claudeCodeLocal.local_auth_detected || !!claudeCodeLocal.token_env_detected
    const ceoProviderName = setup.ceo_profile?.provider ?? setup.ceo_profile?.display_name ?? null
    const runningOnOllama = !!(
      setup.ceo_profile?.provider_catalog_id === 'ollama' ||
      ceoProviderName?.toLowerCase().includes('ollama')
    )

    const warnings: Warning[] = []
    if (!chatgptConnected) {
      warnings.push({
        severity: 'info',
        title: 'ChatGPT/Codex not connected',
        message: 'ChatGPT direct OAuth is not connected. This is honest local state; AÏKO can still use another connected brain.',
        href: '/connect-ai',
      })
    }
    if (!claudeConnected) {
      warnings.push({
        severity: 'info',
        title: 'Claude not connected',
        message: 'No Claude OAuth, Anthropic API, or local Claude Code auth is currently available.',
        href: '/connect-ai',
      })
    }
    if (runningOnOllama) {
      warnings.push({
        severity: 'info',
        title: 'Running on Ollama local',
        message: 'The CEO brain is using a local Ollama profile. This is useful for local fallback and may be slower or less capable than hosted models.',
        href: '/connect-ai',
      })
    }
    if (!webOperator.browser_available) {
      warnings.push({
        severity: 'warning',
        title: 'Browser runtime missing',
        message: 'Playwright is not available to Web Operators. Install Chromium before running browser tasks.',
        href: '/operators',
      })
    }
    if (mode.mode === 'read_only') {
      warnings.push({
        severity: 'warning',
        title: 'Operating mode is Read Only',
        message: 'AÏKO can plan and report, but Web Operator execution and external-facing preparation are limited.',
        href: '/mode',
      })
    }
    if (waitingUserCount > 0) {
      warnings.push({
        severity: 'warning',
        title: 'Manual takeover waiting',
        message: `${waitingUserCount} browser workflow${waitingUserCount === 1 ? '' : 's'} need user login, CAPTCHA, or security-check takeover.`,
        href: '/operators',
      })
    }
    if (timeline.health.blocked_by_validation > 0) {
      warnings.push({
        severity: 'warning',
        title: 'Improvement blocked by validation',
        message: `${timeline.health.blocked_by_validation} improvement proposal${timeline.health.blocked_by_validation === 1 ? ' is' : 's are'} pending validation because required skill/playbook rows are missing.`,
        href: '/system',
      })
    }

    return NextResponse.json({
      setup: {
        setup_required: setup.setup_required,
        can_ceo_think: setup.can_ceo_think,
        connected_profile_count: setup.connected_profile_count,
        recommended_next_step: setup.recommended_next_step,
      },
      ceo_brain: {
        can_think: setup.can_ceo_think,
        provider_name: ceoProviderName,
        model: setup.ceo_profile?.model ?? null,
        status: setup.ceo_profile?.status ?? null,
        auth_method: setup.ceo_profile?.auth_method ?? null,
        running_on_ollama: runningOnOllama,
      },
      providers: {
        chatgpt_connected: chatgptConnected,
        claude_connected: claudeConnected,
        ollama_active_for_ceo: runningOnOllama,
      },
      mode: {
        mode: mode.mode,
        label: dashboardModeLabel(mode.mode),
        paused: mode.paused,
        sends_today: mode.sends_today,
        daily_send_limit: mode.daily_send_limit,
      },
      counts: {
        active_projects: activeProjectCount,
        active_web_operators: activeWebOperators,
        waiting_user: waitingUserCount,
        pending_approvals: pendingApprovals,
        active_improvement_proposals: activeImprovementProposals,
      },
      browser: {
        runtime_available: webOperator.browser_available,
        active_session_id: webOperator.active_session?.id ?? null,
      },
      improvement_health: timeline.health,
      warnings,
      recent_files: recentFiles,
      recent_executive_reports: recentReports,
      recent_decisions: recentDecisions,
    })
  } catch (err) {
    console.error('[api/dashboard/summary GET]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
