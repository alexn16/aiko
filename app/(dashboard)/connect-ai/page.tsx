'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import {
  CATALOG,
  getCatalogByCategory,
  type ProviderCatalogEntry,
} from '@/lib/ai/provider-catalog'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Provider {
  id: string
  name: string
  type: string
  status: 'connected' | 'disconnected' | 'error' | 'unavailable'
  base_url: string | null
  model: string | null
  last_tested_at: string | null
  last_error: string | null
  compatibility?: string | null
  provider_catalog_id?: string | null
}

interface RoleDetail {
  provider_name: string | null
  model: string | null
  status: string | null
  compatibility: string | null
}

const ROLES = [
  { id: 'ceo',            label: 'CEO',             description: 'Strategic decisions and company overview',           icon: '👑', recommendedFor: 'reasoning' },
  { id: 'project_manager',label: 'Project Manager', description: 'Sprint tracking, PM reports, project coordination',  icon: '📋', recommendedFor: 'reasoning' },
  { id: 'research',       label: 'Research',        description: 'Lead discovery and web research',                    icon: '🔍', recommendedFor: 'research'  },
  { id: 'copywriting',    label: 'Copywriting',     description: 'Outreach messages and campaign copy',                icon: '✍️', recommendedFor: 'writing'   },
  { id: 'review',         label: 'Review',          description: 'Quality reviews and validation',                     icon: '✅', recommendedFor: 'reasoning' },
  { id: 'qa',             label: 'QA',              description: 'Quality assurance checks',                           icon: '🔬', recommendedFor: 'reasoning' },
  { id: 'local_fallback', label: 'Local Fallback',  description: 'Offline fallback when main providers unavailable',   icon: '🖥',  recommendedFor: 'local'     },
]

const INPUT: React.CSSProperties = {
  width: '100%', background: '#ffffff', border: '1px solid #e2e8f0',
  borderRadius: 8, padding: '9px 11px', fontSize: 13, color: '#0f172a',
  boxSizing: 'border-box', outline: 'none', fontFamily: 'Inter, sans-serif',
}

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#cbd5e1',
  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12,
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface DiagnosticsResult {
  ok: boolean
  can_ceo_think: boolean
  ceo_provider: { name: string; model: string | null; type: string } | null
  summary: { total: number; connected: number; errored: number }
  chatgpt_connection: { status: string; account_email: string | null } | null
  claude_connection:  { status: string; account_email: string | null } | null
  signed_in_user: { id: string; email: string; name: string | null } | null
}

// Subscription diagnostics — from /api/providers/subscription-diagnostics
interface SubCard {
  status: string
  configured: boolean
  connected: boolean
  needs_reauth: boolean
  can_start_oauth: boolean
  can_call_model: boolean
  missing_env: string[]
  account_email: string | null
  provider_connection_id: string | null
  last_error: string | null
  last_tested_at: string | null
}
interface ClaudeSubCard extends SubCard {
  claude_cli_detected: boolean
  claude_code_token_detected: boolean
}
interface SubscriptionDiagnostics {
  chatgpt: SubCard
  claude:  ClaudeSubCard
  ceo_brain: {
    can_think: boolean
    provider_name: string | null
    model: string | null
    auth_type: string | null
    status: string | null
    last_error: string | null
    account_email: string | null
  }
  fallbacks: {
    openai_api_connected: boolean
    anthropic_api_connected: boolean
    ollama_connected: boolean
    openrouter_connected: boolean
  }
  any_model_available: boolean
}

interface AuthDiagnosticsResult {
  auth_mode?: 'optional' | 'required'
  can_configure_without_login?: boolean
  google_login: {
    client_id_set: boolean
    client_secret_set: boolean
    secret_set: boolean
    url_set: boolean
    signed_in: boolean
    signed_in_user: { id: string | null; email: string | null; name: string | null } | null
  }
  chatgpt_oauth: {
    client_id_set: boolean
    client_secret_set: boolean
    auth_url_set: boolean
    token_url_set: boolean
    scope_set: boolean
    fully_configured: boolean
    connection: { status: string; account_email: string | null } | null
  }
  claude_oauth: {
    client_id_set: boolean
    client_secret_set: boolean
    auth_url_set: boolean
    token_url_set: boolean
    scope_set: boolean
    fully_configured: boolean
    connection: { status: string; account_email: string | null } | null
  }
  api_providers: {
    openai_api_connected: boolean
    anthropic_api_connected: boolean
    openrouter_connected: boolean
    ollama_connected: boolean
  }
  ceo_brain: {
    can_ceo_think: boolean
    assigned_provider: string | null
    model: string | null
    compatibility: string | null
    last_error: string | null
  }
}

export default function ConnectAIPage() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const [providers, setProviders] = useState<Provider[]>([])
  const [roles, setRoles] = useState<Record<string, string | null>>({})
  const [diagnostics, setDiagnostics] = useState<DiagnosticsResult | null>(null)
  const [authDiagnostics, setAuthDiagnostics] = useState<AuthDiagnosticsResult | null>(null)
  const [subDiagnostics, setSubDiagnostics] = useState<SubscriptionDiagnostics | null>(null)
  const [configuring, setConfiguring] = useState<ProviderCatalogEntry | null>(null)
  const [loading, setLoading] = useState(true)

  // OAuth redirect feedback
  const oauthSuccess = searchParams.get('oauth_success') // 'chatgpt' | 'claude'
  const oauthError   = searchParams.get('oauth_error')
  const oauthProvider = searchParams.get('provider')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pRes, rRes, dRes, adRes, sdRes] = await Promise.all([
        fetch('/api/providers').then(r => r.json()),
        fetch('/api/providers/roles').then(r => r.json()),
        fetch('/api/providers/diagnostics').then(r => r.json()).catch(() => null),
        fetch('/api/auth/diagnostics').then(r => r.json()).catch(() => null),
        fetch('/api/providers/subscription-diagnostics').then(r => r.json()).catch(() => null),
      ])
      setProviders(pRes.providers ?? [])
      setRoles(rRes.roles ?? {})
      setDiagnostics(dRes ?? null)
      setAuthDiagnostics(adRes ?? null)
      setSubDiagnostics(sdRes ?? null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const connectedCount = providers.filter(p => p.status === 'connected').length

  // Helper: providers belonging to a catalog entry
  function instancesFor(entry: ProviderCatalogEntry): Provider[] {
    return providers.filter(p => p.type === entry.id || p.type === entry.id)
  }

  // Available entries by category
  const recommendedEntries  = getCatalogByCategory('subscription_oauth')
  const directApiAvailable  = getCatalogByCategory('direct_api').filter(e => e.status === 'available')
  const localEntries        = getCatalogByCategory('local').filter(e => e.status === 'available')
  const gatewayAvailable    = getCatalogByCategory('gateway').filter(e => e.status === 'available')
  const gatewayPlanned      = getCatalogByCategory('gateway').filter(e => e.status === 'planned')
  const customEntries       = getCatalogByCategory('custom').filter(e => e.status === 'available')
  const mediaEntries        = getCatalogByCategory('media_special')

  return (
    <div style={{ padding: '40px 40px', maxWidth: 1000 }} className="page-enter">

      {/* ── Local mode / account notice ──────────────────────────────────────── */}
      {session?.user ? (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0',
          borderRadius: 10, marginBottom: 28,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: '#6366f1',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: '#ffffff', flexShrink: 0,
            }}>
              {(session.user.name ?? session.user.email ?? '?')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                {session.user.name ?? session.user.email}
              </div>
              {session.user.name && (
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{session.user.email}</div>
              )}
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            style={{
              fontSize: 12, color: '#64748b', background: 'none',
              border: '1px solid #e2e8f0', borderRadius: 7,
              padding: '5px 12px', cursor: 'pointer',
            }}
          >
            Sign out
          </button>
        </div>
      ) : (
        <div style={{
          padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0',
          borderRadius: 10, marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 3 }}>
              Local single-user mode
            </div>
            <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
              You are configuring AI providers without signing in. Connections are stored globally and available to all users of this AÏKO instance.
              Google login is only needed for account-scoped connections in a multi-user setup.
            </div>
          </div>
          <a
            href="/login"
            style={{
              flexShrink: 0, fontSize: 12, color: '#6366f1', background: '#eef2ff',
              border: '1px solid #c7d2fe', borderRadius: 7,
              padding: '6px 14px', cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap',
            }}
          >
            Sign in
          </a>
        </div>
      )}

      {/* ── OAuth feedback banners ────────────────────────────────────────────── */}
      {oauthSuccess && (
        <div style={{
          marginBottom: 20, padding: '11px 16px', background: '#f0fdf4',
          border: '1px solid #bbf7d0', borderRadius: 10, fontSize: 13, color: '#16a34a',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          ✓ {oauthSuccess === 'chatgpt' ? 'ChatGPT' : 'Claude'} connected successfully.
        </div>
      )}
      {oauthError && (
        <div style={{
          marginBottom: 20, padding: '11px 16px', background: '#fef2f2',
          border: '1px solid #fecaca', borderRadius: 10, fontSize: 13, color: '#dc2626',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          ⚠ {oauthProvider ? `${oauthProvider === 'chatgpt' ? 'ChatGPT' : 'Claude'} connection failed: ` : ''}
          {decodeURIComponent(oauthError)}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 6px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          AI Brain
        </p>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.03em', margin: '0 0 8px' }}>
          AÏKO Brain Setup
        </h1>
        <p style={{ fontSize: 14, color: '#64748b', margin: 0, lineHeight: 1.6 }}>
          Connect ChatGPT, Claude, or any API provider directly. No Google login required to set up your AI brain.
        </p>
      </div>

      {/* ── CEO Brain status banner ───────────────────────────────────────── */}
      {!loading && (
        <CeoBrainBanner
          subDiagnostics={subDiagnostics}
          connectedCount={connectedCount}
          diagnostics={diagnostics}
        />
      )}

      {/* ── Account-based AI connections (subscription / OAuth) ────────────── */}
      <div style={{ marginBottom: 32 }}>
        <div style={SECTION_LABEL}>Connect your AI accounts</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <SubscriptionCard
            icon="🟢"
            title="ChatGPT"
            subtitle="Connect via your ChatGPT Plus / Teams account"
            startUrl="/api/providers/oauth/chatgpt/start"
            disconnectUrl="/api/providers/oauth/chatgpt/disconnect"
            card={subDiagnostics?.chatgpt ?? null}
            fallbackLabel="OpenAI API"
            fallbackConnected={subDiagnostics?.fallbacks.openai_api_connected ?? false}
            onRefresh={load}
          />
          <SubscriptionCard
            icon="🟠"
            title="Claude"
            subtitle="Connect via your Claude.ai Pro / Teams account"
            startUrl="/api/providers/oauth/claude/start"
            disconnectUrl="/api/providers/oauth/claude/disconnect"
            card={subDiagnostics?.claude ?? null}
            fallbackLabel="Anthropic API"
            fallbackConnected={subDiagnostics?.fallbacks.anthropic_api_connected ?? false}
            onRefresh={load}
          />
        </div>
      </div>

      {/* ── API providers ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <div style={SECTION_LABEL}>API providers</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {directApiAvailable.map(entry => {
            const existing = instancesFor(entry)
            return (
              <ProviderCard
                key={entry.id}
                entry={entry}
                existing={existing}
                onConfigure={() => setConfiguring(entry)}
                onRefresh={load}
              />
            )
          })}
        </div>
      </div>

      {/* ── Local ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <div style={SECTION_LABEL}>Local</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {localEntries.map(entry => {
            const existing = instancesFor(entry)
            return (
              <ProviderCard
                key={entry.id}
                entry={entry}
                existing={existing}
                onConfigure={() => setConfiguring(entry)}
                onRefresh={load}
              />
            )
          })}
        </div>
      </div>

      {/* ── Gateway & routing ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <div style={SECTION_LABEL}>Gateway &amp; routing</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: gatewayPlanned.length > 0 ? 16 : 0 }}>
          {gatewayAvailable.map(entry => {
            const existing = instancesFor(entry)
            return (
              <ProviderCard
                key={entry.id}
                entry={entry}
                existing={existing}
                onConfigure={() => setConfiguring(entry)}
                onRefresh={load}
              />
            )
          })}
        </div>
        {gatewayPlanned.length > 0 && (
          <>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              Coming soon
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {gatewayPlanned.map(entry => (
                <PlannedCard key={entry.id} entry={entry} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Custom endpoints ──────────────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <div style={SECTION_LABEL}>Custom endpoints</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {customEntries.map(entry => {
            const existing = instancesFor(entry)
            return (
              <ProviderCard
                key={entry.id}
                entry={entry}
                existing={existing}
                onConfigure={() => setConfiguring(entry)}
                onRefresh={load}
              />
            )
          })}
        </div>
      </div>

      {/* ── Future / Specialized ──────────────────────────────────────────── */}
      <div style={{ marginBottom: 36 }}>
        <div style={SECTION_LABEL}>Future / Specialized</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {mediaEntries.map(entry => (
            <UnavailableCard key={entry.id} entry={entry} />
          ))}
        </div>
      </div>

      {/* ── Role assignments ──────────────────────────────────────────────── */}
      {providers.filter(p => p.status === 'connected').length > 0 && (
        <RoleAssignments
          providers={providers.filter(p => p.status === 'connected') as Provider[]}
          roles={roles}
          onSave={load}
        />
      )}

      {/* ── Auth & provider diagnostics ──────────────────────────────────── */}
      <AuthDiagnosticsPanel data={authDiagnostics} onReload={load} />

      {/* ── Brain verification ────────────────────────────────────────────── */}
      <BrainVerification diagnostics={diagnostics} canThink={connectedCount > 0 && (diagnostics?.can_ceo_think ?? false)} />

      {/* ── Setup drawer ──────────────────────────────────────────────────── */}
      {configuring && (
        <SetupDrawer
          entry={configuring}
          onClose={() => setConfiguring(null)}
          onSaved={() => { setConfiguring(null); load() }}
        />
      )}
    </div>
  )
}

// ── CEO Brain banner ──────────────────────────────────────────────────────────

function CeoBrainBanner({
  subDiagnostics,
  connectedCount,
  diagnostics,
}: {
  subDiagnostics: SubscriptionDiagnostics | null
  connectedCount: number
  diagnostics: DiagnosticsResult | null
}) {
  // Use subscription diagnostics if available, else fall back to legacy diagnostics
  if (subDiagnostics) {
    const { ceo_brain, any_model_available } = subDiagnostics
    if (ceo_brain.can_think) {
      const authNote =
        ceo_brain.auth_type === 'oauth' ? ' via OAuth' :
        ceo_brain.auth_type === 'api_key' ? ' via API key' :
        ceo_brain.auth_type === 'local' ? ' (local)' : ''
      return (
        <div style={{
          marginBottom: 28, padding: '12px 16px',
          background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10,
          fontSize: 13, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>✓</span>
          <span>
            CEO brain: <strong>{ceo_brain.provider_name ?? 'unknown'}</strong>
            {ceo_brain.model ? ` — ${ceo_brain.model}` : ''}
            {authNote} — AÏKO is operational.
          </span>
        </div>
      )
    }
    if (any_model_available) {
      return (
        <div style={{
          marginBottom: 28, padding: '12px 16px',
          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10,
          fontSize: 13, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>⚠</span>
          <span>
            A provider is connected but no CEO brain is assigned.
            Assign a provider to the CEO role below.
          </span>
        </div>
      )
    }
    return (
      <div style={{
        marginBottom: 28, padding: '12px 16px',
        background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
        fontSize: 13, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span>⚠</span>
        <span>AÏKO CEO is offline. Connect at least one AI provider below to start the company.</span>
      </div>
    )
  }

  // Legacy fallback
  if (connectedCount === 0) {
    return (
      <div style={{
        marginBottom: 28, padding: '12px 16px',
        background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
        fontSize: 13, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span>⚠</span>
        <span>AÏKO CEO is offline. Connect at least one AI provider below to start the company.</span>
      </div>
    )
  }
  if (diagnostics && !diagnostics.can_ceo_think) {
    return (
      <div style={{
        marginBottom: 28, padding: '12px 16px',
        background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10,
        fontSize: 13, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span>⚠</span>
        <span>
          {connectedCount} provider{connectedCount > 1 ? 's' : ''} connected, but no CEO brain resolved.
          Assign a provider to the CEO role below or reconnect a provider.
        </span>
      </div>
    )
  }
  return (
    <div style={{
      marginBottom: 28, padding: '12px 16px',
      background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10,
      fontSize: 13, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span>✓</span>
      <span>
        {diagnostics?.ceo_provider
          ? `CEO brain: ${diagnostics.ceo_provider.name}${diagnostics.ceo_provider.model ? ` — ${diagnostics.ceo_provider.model}` : ''} — AÏKO is operational.`
          : `${connectedCount} AI provider${connectedCount > 1 ? 's' : ''} connected — AÏKO is operational.`
        }
      </span>
    </div>
  )
}

// ── Subscription card ─────────────────────────────────────────────────────────

/**
 * Rich status card for subscription/OAuth AI providers (ChatGPT, Claude).
 *
 * Shows exactly what's happening — no false "Connected" states:
 *   - oauth_not_configured  → lists missing env var names (not values)
 *   - no_connection_row     → configured but never connected
 *   - not_connected         → row exists but status is disconnected/error
 *   - needs_reauth          → token expired / refresh failed
 *   - connected             → token confirmed, account email shown
 *
 * Also shows fallback status (OpenAI API / Anthropic API) so user knows
 * whether the app is working even if OAuth is not connected.
 */
function SubscriptionCard({
  icon, title, subtitle, startUrl, disconnectUrl, card, fallbackLabel, fallbackConnected, onRefresh,
}: {
  icon: string
  title: string
  subtitle: string
  startUrl: string
  disconnectUrl: string
  card: SubCard | null
  fallbackLabel: string
  fallbackConnected: boolean
  onRefresh: () => void
}) {
  const [disconnecting, setDisconnecting] = useState(false)

  async function disconnect() {
    if (!confirm(`Disconnect ${title}?`)) return
    setDisconnecting(true)
    try {
      await fetch(disconnectUrl, { method: 'POST' })
      onRefresh()
    } finally {
      setDisconnecting(false)
    }
  }

  // Derive display state
  const status       = card?.status ?? 'unknown'
  const email        = card?.account_email ?? null
  const missingEnv   = card?.missing_env ?? []
  const lastError    = card?.last_error ?? null
  const canStartOAuth = card?.can_start_oauth ?? false

  const isConnected   = status === 'connected'
  const isNeedsReauth = status === 'needs_reauth'
  const isNotConfigured = status === 'oauth_not_configured' || (card === null)
  const isNoRow       = status === 'no_connection_row'

  const statusColor =
    isConnected   ? '#16a34a' :
    isNeedsReauth ? '#f59e0b' : '#94a3b8'

  const statusLabel =
    isConnected       ? (email ? `Connected as ${email}` : 'Connected') :
    isNeedsReauth     ? 'Needs re-authentication' :
    isNotConfigured   ? 'OAuth not configured on this instance' :
    isNoRow           ? 'Not connected' :
    'Not connected'

  const borderColor =
    isConnected   ? '#bbf7d0' :
    isNeedsReauth ? '#fde68a' : '#f1f5f9'

  return (
    <div style={{
      background: '#ffffff',
      border: `1px solid ${borderColor}`,
      borderRadius: 12, padding: '18px 20px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{title}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, flexShrink: 0, display: 'inline-block' }} />
            <span style={{ fontSize: 11, color: statusColor, fontWeight: 500 }}>{statusLabel}</span>
          </div>
        </div>
      </div>

      <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 10px', lineHeight: 1.5 }}>
        {subtitle}
      </p>

      {/* "Why not connected?" — missing env vars (names only) */}
      {isNotConfigured && missingEnv.length > 0 && (
        <div style={{
          fontSize: 11, color: '#64748b', background: '#f8fafc',
          border: '1px solid #e2e8f0', borderRadius: 8,
          padding: '8px 10px', marginBottom: 10, lineHeight: 1.6,
        }}>
          <span style={{ fontWeight: 600, color: '#374151' }}>Why not configured?</span>
          {' '}Missing env vars on this instance:
          <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {missingEnv.map(v => (
              <code key={v} style={{
                fontSize: 10, background: '#f1f5f9', color: '#475569',
                borderRadius: 4, padding: '1px 5px', fontFamily: 'DM Mono, monospace',
              }}>{v}</code>
            ))}
          </div>
        </div>
      )}

      {/* Needs re-auth explanation */}
      {isNeedsReauth && (
        <div style={{
          fontSize: 11, color: '#92400e', background: '#fffbeb',
          border: '1px solid #fde68a', borderRadius: 8,
          padding: '8px 10px', marginBottom: 10, lineHeight: 1.5,
        }}>
          Your {title} session has expired. Re-authenticate to restore access.
          {lastError && <div style={{ marginTop: 4, color: '#b45309' }}>Error: {lastError}</div>}
        </div>
      )}

      {/* Last error (not_connected case) */}
      {!isConnected && !isNeedsReauth && lastError && (
        <div style={{
          fontSize: 11, color: '#dc2626', background: '#fef2f2',
          border: '1px solid #fecaca', borderRadius: 8,
          padding: '8px 10px', marginBottom: 10, lineHeight: 1.5,
        }}>
          Last error: {lastError}
        </div>
      )}

      {/* Fallback status */}
      {!isConnected && (
        <div style={{
          fontSize: 11, color: fallbackConnected ? '#16a34a' : '#94a3b8',
          marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%', display: 'inline-block',
            background: fallbackConnected ? '#16a34a' : '#e2e8f0',
          }} />
          {fallbackLabel}: {fallbackConnected ? 'connected (fallback active)' : 'not connected'}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {isConnected ? (
          <>
            <a
              href={startUrl}
              style={{
                display: 'inline-block', padding: '7px 14px', borderRadius: 7,
                background: '#f8fafc', color: '#374151',
                border: '1px solid #e2e8f0', fontSize: 12, fontWeight: 500,
                cursor: 'pointer', textDecoration: 'none',
              }}
            >
              Reconnect
            </a>
            <button
              onClick={disconnect}
              disabled={disconnecting}
              style={{
                padding: '7px 12px', borderRadius: 7, fontSize: 12,
                background: 'none', border: '1px solid #fecaca',
                color: '#dc2626', cursor: 'pointer',
              }}
            >
              {disconnecting ? '…' : 'Disconnect'}
            </button>
          </>
        ) : canStartOAuth ? (
          <a
            href={startUrl}
            style={{
              display: 'inline-block', padding: '7px 14px', borderRadius: 7,
              background: '#0f172a', color: '#ffffff',
              border: 'none', fontSize: 12, fontWeight: 500,
              cursor: 'pointer', textDecoration: 'none',
            }}
          >
            {isNeedsReauth ? `Re-authenticate ${title}` : `Connect ${title}`}
          </a>
        ) : (
          <div style={{ fontSize: 11, color: '#94a3b8', padding: '7px 0', lineHeight: 1.5 }}>
            To enable OAuth, set the missing env vars above and restart the server.
            {fallbackConnected
              ? ` ${fallbackLabel} is active as a fallback.`
              : ` Add an ${fallbackLabel} key as a fallback.`}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Unavailable card ───────────────────────────────────────────────────────────

function UnavailableCard({ entry }: { entry: ProviderCatalogEntry }) {
  return (
    <div style={{
      background: '#fafafa', border: '1px solid #f1f5f9', borderRadius: 12,
      padding: '18px 20px', opacity: 0.7,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 20 }}>{entry.icon}</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{entry.display_name}</div>
          <div style={{
            display: 'inline-block', fontSize: 10, fontWeight: 500,
            color: '#94a3b8', background: '#f1f5f9',
            borderRadius: 4, padding: '1px 6px', marginTop: 2,
          }}>
            Not available in this build
          </div>
        </div>
      </div>
      {entry.notes && (
        <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
          {entry.notes}
        </p>
      )}
      {!entry.notes && (
        <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
          {entry.short_description}
        </p>
      )}
    </div>
  )
}

// ── Planned card ───────────────────────────────────────────────────────────────

function PlannedCard({ entry }: { entry: ProviderCatalogEntry }) {
  return (
    <div style={{
      background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: 12,
      padding: '18px 20px', opacity: 0.85,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 20 }}>{entry.icon}</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{entry.display_name}</div>
          <div style={{
            display: 'inline-block', fontSize: 10, fontWeight: 500,
            color: '#d97706', background: '#fef9c3',
            borderRadius: 4, padding: '1px 6px', marginTop: 2,
          }}>
            Coming soon
          </div>
        </div>
      </div>
      <p style={{ fontSize: 12, color: '#92400e', margin: 0, lineHeight: 1.5 }}>
        {entry.notes ?? entry.short_description}
      </p>
    </div>
  )
}

// ── Provider card ──────────────────────────────────────────────────────────────

function ProviderCard({
  entry, existing, onConfigure, onRefresh,
}: {
  entry: ProviderCatalogEntry
  existing: Provider[]
  onConfigure: () => void
  onRefresh: () => void
}) {
  const connected = existing.filter(p => p.status === 'connected')
  const hasAny = existing.length > 0

  const statusColor = connected.length > 0 ? '#16a34a' : hasAny ? '#f59e0b' : '#94a3b8'
  const statusLabel = connected.length > 0 ? 'Connected' : hasAny ? 'Error / not tested' : 'Not connected'

  return (
    <div style={{
      background: '#ffffff', border: `1px solid ${connected.length > 0 ? '#bbf7d0' : '#f1f5f9'}`,
      borderRadius: 12, padding: '18px 20px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>{entry.icon}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{entry.display_name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, display: 'inline-block' }} />
              <span style={{ fontSize: 11, color: statusColor, fontWeight: 500 }}>{statusLabel}</span>
            </div>
          </div>
        </div>
      </div>

      <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px', lineHeight: 1.5 }}>
        {entry.short_description}
      </p>

      {/* Connected instances */}
      {existing.map(p => (
        <ConnectedInstance key={p.id} provider={p} onRefresh={onRefresh} />
      ))}

      <button
        onClick={onConfigure}
        style={{
          marginTop: existing.length > 0 ? 8 : 0,
          padding: '7px 14px', borderRadius: 7,
          background: connected.length > 0 ? '#f8fafc' : '#0f172a',
          color: connected.length > 0 ? '#374151' : '#ffffff',
          border: `1px solid ${connected.length > 0 ? '#e2e8f0' : '#0f172a'}`,
          fontSize: 12, fontWeight: 500, cursor: 'pointer',
        }}
      >
        {hasAny ? '+ Add another' : 'Set up'}
      </button>
    </div>
  )
}

// ── Connected instance row ────────────────────────────────────────────────────

function ConnectedInstance({ provider, onRefresh }: { provider: Provider; onRefresh: () => void }) {
  const [testing, setTesting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function test() {
    setTesting(true)
    try {
      await fetch(`/api/providers/${provider.id}/test`, { method: 'POST' })
      onRefresh()
    } finally {
      setTesting(false)
    }
  }

  async function del() {
    if (!confirm(`Remove "${provider.name}"?`)) return
    setDeleting(true)
    try {
      await fetch(`/api/providers/${provider.id}`, { method: 'DELETE' })
      onRefresh()
    } finally {
      setDeleting(false)
    }
  }

  const statusColor = provider.status === 'connected' ? '#16a34a' : provider.status === 'error' ? '#dc2626' : '#94a3b8'

  return (
    <div style={{
      padding: '8px 10px', background: '#f8fafc', borderRadius: 8,
      border: '1px solid #f1f5f9', marginBottom: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: 12, fontWeight: 500, color: '#0f172a' }}>{provider.name}</span>
          {provider.model && (
            <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 6, fontFamily: 'DM Mono, monospace' }}>
              {provider.model}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={test}
            disabled={testing}
            style={{
              padding: '3px 8px', borderRadius: 5, fontSize: 11, cursor: 'pointer',
              background: 'none', border: '1px solid #e2e8f0', color: '#64748b',
            }}
          >
            {testing ? '…' : 'Test'}
          </button>
          <button
            onClick={del}
            disabled={deleting}
            style={{
              padding: '3px 8px', borderRadius: 5, fontSize: 11, cursor: 'pointer',
              background: 'none', border: '1px solid #fecaca', color: '#dc2626',
            }}
          >
            {deleting ? '…' : '✕'}
          </button>
        </div>
      </div>
      {provider.status === 'error' && provider.last_error && (
        <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>
          {provider.last_error.slice(0, 120)}
        </div>
      )}
      <div style={{ fontSize: 10, color: statusColor, marginTop: 3, fontWeight: 500 }}>
        {provider.status === 'connected' ? '✓ Connected' :
         provider.status === 'error' ? '⚠ Error' : '○ Not tested'}
        {provider.last_tested_at && (
          <span style={{ color: '#cbd5e1', marginLeft: 6 }}>
            tested {new Date(provider.last_tested_at).toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Role assignments ──────────────────────────────────────────────────────────

function RoleAssignments({
  providers, roles, onSave,
}: {
  providers: Provider[]
  roles: Record<string, string | null>
  onSave: () => void
}) {
  const [local, setLocal] = useState<Record<string, string>>({})
  const [roleDetails, setRoleDetails] = useState<Record<string, RoleDetail>>({})
  const [saving, setSaving] = useState(false)
  const [applyingDefaults, setApplyingDefaults] = useState(false)

  useEffect(() => {
    const init: Record<string, string> = {}
    for (const r of ROLES) { init[r.id] = roles[r.id] ?? '' }
    setLocal(init)
  }, [roles])

  useEffect(() => {
    fetch('/api/providers/brain').then(r => r.json()).then(d => {
      const map: Record<string, RoleDetail> = {}
      for (const row of (d.roles ?? [])) {
        map[row.role] = { provider_name: row.provider_name, model: row.model, status: row.status, compatibility: row.compatibility }
      }
      setRoleDetails(map)
    }).catch(() => {})
  }, [roles])

  async function save() {
    setSaving(true)
    try {
      await Promise.all(ROLES.map(r =>
        fetch('/api/providers/roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: r.id, provider_id: local[r.id] || null }),
        })
      ))
      onSave()
    } finally {
      setSaving(false)
    }
  }

  async function applyDefaults() {
    setApplyingDefaults(true)
    try {
      await fetch('/api/providers/brain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply_defaults' }),
      })
      onSave()
    } finally {
      setApplyingDefaults(false)
    }
  }

  const ceoBrainMissing = !local['ceo']
  const connectedWithCatalog = providers.filter(p => p.provider_catalog_id)

  function getRecommendedProvider(tag: string): Provider | null {
    for (const p of connectedWithCatalog) {
      const entry = CATALOG.find(c => c.id === p.provider_catalog_id)
      if (entry?.capabilities?.includes(tag as never)) return p
    }
    return null
  }

  function statusDot(status: string | null) {
    const color = status === 'connected' ? '#16a34a' : status === 'error' ? '#ef4444' : '#cbd5e1'
    return <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
  }

  return (
    <div style={{
      background: '#ffffff', border: '1px solid #f1f5f9', borderRadius: 12,
      padding: '20px 24px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
        Assign AÏKO brains
      </div>
      <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 20px', lineHeight: 1.5 }}>
        Choose which AI provider powers each agent role.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {ROLES.map(r => {
          const detail = roleDetails[r.id]
          const recommended = getRecommendedProvider(r.recommendedFor)
          const hasAssignment = !!local[r.id]

          return (
            <div key={r.id} style={{
              display: 'grid', gridTemplateColumns: '200px 1fr 220px',
              alignItems: 'center', gap: 16,
              padding: '12px 14px', borderRadius: 8,
              background: '#f8fafc', border: '1px solid #f1f5f9',
            }}>
              {/* Left: icon + label + description */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: 18, lineHeight: 1, marginTop: 1 }}>{r.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{r.label}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4, marginTop: 1 }}>{r.description}</div>
                </div>
              </div>

              {/* Middle: current assignment info */}
              <div>
                {hasAssignment && detail?.provider_name ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {statusDot(detail.status)}
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>{detail.provider_name}</span>
                    {detail.model && (
                      <span style={{
                        fontSize: 10, fontFamily: 'DM Mono, monospace', color: '#6366f1',
                        background: '#eef2ff', borderRadius: 4, padding: '1px 6px',
                      }}>
                        {detail.model}
                      </span>
                    )}
                    {detail.compatibility && (
                      <span style={{
                        fontSize: 10, color: '#94a3b8', background: '#f1f5f9',
                        borderRadius: 4, padding: '1px 6px',
                      }}>
                        {detail.compatibility.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                ) : (
                  <span style={{ fontSize: 12, color: '#cbd5e1', fontStyle: 'italic' }}>No brain assigned</span>
                )}
              </div>

              {/* Right: select + capability badge */}
              <div>
                <select
                  value={local[r.id] ?? ''}
                  onChange={e => setLocal(prev => ({ ...prev, [r.id]: e.target.value }))}
                  style={{ ...INPUT, fontSize: 12, marginBottom: recommended && !hasAssignment ? 4 : 0 }}
                >
                  <option value="">Auto (first connected)</option>
                  {providers.map(p => {
                    const catalogEntry = CATALOG.find(c => c.id === p.provider_catalog_id)
                    const isRecommended = catalogEntry?.capabilities?.includes(r.recommendedFor as never)
                    return (
                      <option key={p.id} value={p.id}>
                        {isRecommended ? '⭐ ' : ''}{p.name}
                      </option>
                    )
                  })}
                </select>
                {recommended && !hasAssignment && (
                  <div style={{ fontSize: 10, color: '#d97706', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span>⭐</span>
                    <span>Recommended: {recommended.name}</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* CEO no-brain warning */}
      {ceoBrainMissing && (
        <div style={{
          marginBottom: 16, padding: '10px 14px',
          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
          fontSize: 12, color: '#d97706', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>⚠</span>
          <span>AÏKO CEO has no AI brain assigned — chat and automation will fail.</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={applyDefaults}
          disabled={applyingDefaults}
          style={{
            padding: '9px 16px', borderRadius: 8,
            background: applyingDefaults ? '#f1f5f9' : '#f8fafc',
            color: applyingDefaults ? '#94a3b8' : '#374151',
            border: '1px solid #e2e8f0',
            fontSize: 12, fontWeight: 500, cursor: applyingDefaults ? 'default' : 'pointer',
          }}
        >
          {applyingDefaults ? 'Applying…' : '✦ Apply smart defaults'}
        </button>
        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: '9px 20px', borderRadius: 8,
            background: saving ? '#e2e8f0' : '#0f172a',
            color: saving ? '#94a3b8' : '#ffffff',
            border: 'none', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer',
          }}
        >
          {saving ? 'Saving…' : 'Save assignments'}
        </button>
      </div>
    </div>
  )
}

// ── Setup drawer ──────────────────────────────────────────────────────────────

function SetupDrawer({
  entry, onClose, onSaved,
}: {
  entry: ProviderCatalogEntry
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(entry.display_name)
  const [baseUrl, setBaseUrl] = useState(entry.default_base_url ?? '')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(entry.model_suggestions?.[0] ?? '')
  const [customModel, setCustomModel] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const effectiveModel = customModel.trim() || model

  // Show base URL field if entry requires it, or if it has a default URL (and isn't pure Anthropic)
  const showBaseUrl = entry.requires_base_url || (!!entry.default_base_url && entry.compatibility !== 'anthropic_messages')
  const showApiKey = entry.requires_api_key

  async function save() {
    if (!effectiveModel.trim()) { setError('Enter a model name.'); return }
    if (showApiKey && !apiKey.trim()) { setError('API key is required for this provider.'); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          type: entry.id,
          provider_catalog_id: entry.id,
          compatibility: entry.compatibility,
          auth_type: entry.auth_type,
          base_url: baseUrl || null,
          model: effectiveModel,
          api_key: apiKey || null,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      const { id } = await res.json()

      // Auto-test after save
      const testRes = await fetch(`/api/providers/${id}/test`, { method: 'POST' })
      const testData = await testRes.json()
      if (!testData.ok) {
        setError(`Saved but test failed: ${testData.error}`)
        setSaving(false)
        return
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  async function testCredentials() {
    if (!effectiveModel.trim()) { setTestResult({ ok: false, msg: 'Enter a model name first.' }); return }
    if (showApiKey && !apiKey.trim()) { setTestResult({ ok: false, msg: 'Enter an API key first.' }); return }
    setTesting(true); setTestResult(null)
    let tempId: string | null = null
    try {
      const res = await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `__test__${Date.now()}`,
          type: entry.id,
          provider_catalog_id: entry.id,
          compatibility: entry.compatibility,
          auth_type: entry.auth_type,
          base_url: baseUrl || null,
          model: effectiveModel,
          api_key: apiKey || null,
        }),
      })
      const data = await res.json()
      tempId = data.id ?? null
      if (!tempId) throw new Error('Could not create test record')

      const testRes = await fetch(`/api/providers/${tempId}/test`, { method: 'POST' })
      const testData = await testRes.json()
      setTestResult({ ok: testData.ok, msg: testData.ok ? 'Connection successful!' : testData.error ?? 'Test failed' })
    } catch (err) {
      setTestResult({ ok: false, msg: err instanceof Error ? err.message : 'Test request failed' })
    } finally {
      // Always clean up the temp record
      if (tempId) {
        await fetch(`/api/providers/${tempId}`, { method: 'DELETE' }).catch(() => {})
      }
      setTesting(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }}
      />
      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, zIndex: 201,
        background: '#ffffff', boxShadow: '-20px 0 60px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.2s ease-out',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                {entry.icon} {entry.display_name}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{entry.short_description}</div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#94a3b8' }}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {/* Notes */}
          {entry.notes && (
            <div style={{
              marginBottom: 14, padding: '9px 12px', borderRadius: 8,
              background: '#f8fafc', border: '1px solid #e2e8f0',
              fontSize: 12, color: '#64748b', lineHeight: 1.5,
            }}>
              {entry.notes}
            </div>
          )}

          {/* Name */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 500, color: '#64748b', display: 'block', marginBottom: 5 }}>
              Connection name
            </label>
            <input value={name} onChange={e => setName(e.target.value)} style={INPUT}
              onFocus={e => { e.target.style.borderColor = '#6366f1' }}
              onBlur={e => { e.target.style.borderColor = '#e2e8f0' }}
            />
          </div>

          {/* Base URL */}
          {showBaseUrl && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 500, color: '#64748b', display: 'block', marginBottom: 5 }}>
                Base URL
              </label>
              <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com/v1" style={INPUT}
                onFocus={e => { e.target.style.borderColor = '#6366f1' }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0' }}
              />
            </div>
          )}

          {/* API Key */}
          {showApiKey && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 500, color: '#64748b', display: 'block', marginBottom: 5 }}>
                API key
              </label>
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                placeholder="sk-…" style={INPUT}
                onFocus={e => { e.target.style.borderColor = '#6366f1' }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0' }}
              />
            </div>
          )}

          {/* Model chips */}
          {entry.model_suggestions && entry.model_suggestions.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 500, color: '#64748b', display: 'block', marginBottom: 6 }}>
                Model
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 7 }}>
                {entry.model_suggestions.map(m => (
                  <button key={m} onClick={() => { setModel(m); setCustomModel('') }} type="button"
                    style={{
                      padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                      fontSize: 12, fontFamily: 'DM Mono, monospace',
                      fontWeight: model === m && !customModel ? 600 : 400,
                      background: model === m && !customModel ? '#eef2ff' : '#f8fafc',
                      color: model === m && !customModel ? '#6366f1' : '#374151',
                      border: `1px solid ${model === m && !customModel ? '#c7d2fe' : '#e2e8f0'}`,
                    }}
                  >{m}</button>
                ))}
              </div>
              <input value={customModel} onChange={e => setCustomModel(e.target.value)}
                placeholder="Or type a custom model name…"
                style={{ ...INPUT, fontFamily: 'DM Mono, monospace', fontSize: 12 }}
                onFocus={e => { e.target.style.borderColor = '#6366f1' }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0' }}
              />
            </div>
          )}
          {(!entry.model_suggestions || entry.model_suggestions.length === 0) && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 500, color: '#64748b', display: 'block', marginBottom: 5 }}>
                Model
              </label>
              <input value={customModel} onChange={e => setCustomModel(e.target.value)}
                placeholder="e.g. gpt-4o, llama3.2, mistral…"
                style={{ ...INPUT, fontFamily: 'DM Mono, monospace', fontSize: 12 }}
                onFocus={e => { e.target.style.borderColor = '#6366f1' }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0' }}
              />
            </div>
          )}

          {/* Test result */}
          {testResult && (
            <div style={{
              padding: '9px 12px', borderRadius: 8, marginBottom: 12,
              background: testResult.ok ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${testResult.ok ? '#bbf7d0' : '#fecaca'}`,
              fontSize: 12, color: testResult.ok ? '#16a34a' : '#dc2626',
            }}>
              {testResult.ok ? '✓ ' : '⚠ '}{testResult.msg}
            </div>
          )}

          {error && (
            <div style={{
              padding: '9px 12px', borderRadius: 8, marginBottom: 12,
              background: '#fef2f2', border: '1px solid #fecaca',
              fontSize: 12, color: '#dc2626',
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 8 }}>
          <button onClick={testCredentials} disabled={testing}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 8,
              background: '#f8fafc', color: '#374151',
              border: '1px solid #e2e8f0', fontSize: 13, fontWeight: 500,
              cursor: testing ? 'default' : 'pointer',
            }}
          >
            {testing ? 'Testing…' : 'Test connection'}
          </button>
          <button onClick={save} disabled={saving}
            style={{
              flex: 2, padding: '10px 0', borderRadius: 8,
              background: saving ? '#e2e8f0' : '#0f172a',
              color: saving ? '#94a3b8' : '#ffffff',
              border: 'none', fontSize: 13, fontWeight: 600,
              cursor: saving ? 'default' : 'pointer',
            }}
          >
            {saving ? 'Saving & testing…' : 'Save & connect'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(40px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  )
}

// ── Auth & provider diagnostics panel ────────────────────────────────────────

function AuthDiagnosticsPanel({
  data,
  onReload,
}: {
  data: AuthDiagnosticsResult | null
  onReload: () => void
}) {
  const [open, setOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  async function refresh() {
    setRefreshing(true)
    try { await onReload() } finally { setRefreshing(false) }
  }

  function BoolRow({ label, value, warn }: { label: string; value: boolean; warn?: boolean }) {
    const ok    = value
    const color = ok ? '#16a34a' : warn ? '#f59e0b' : '#dc2626'
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f8fafc' }}>
        <span style={{ fontSize: 12, color: '#374151' }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color }}>
          {ok ? '✓ set' : warn ? '— not set (optional)' : '✗ missing'}
        </span>
      </div>
    )
  }

  function StatusRow({ label, value }: { label: string; value: string | null }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f8fafc' }}>
        <span style={{ fontSize: 12, color: '#374151' }}>{label}</span>
        <span style={{ fontSize: 12, color: '#0f172a', fontFamily: 'DM Mono, monospace' }}>{value ?? '—'}</span>
      </div>
    )
  }

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
          {title}
        </div>
        {children}
      </div>
    )
  }

  return (
    <div style={{ marginTop: 40, marginBottom: 4 }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', userSelect: 'none',
        }}
        onClick={() => setOpen(o => !o)}
      >
        <div style={SECTION_LABEL}>Auth &amp; provider diagnostics</div>
        <button
          style={{
            background: 'none', border: '1px solid #e2e8f0', borderRadius: 6,
            fontSize: 11, color: '#94a3b8', padding: '3px 10px', cursor: 'pointer',
          }}
        >
          {open ? 'Hide ▲' : 'Show ▼'}
        </button>
      </div>

      {open && (
        <div style={{
          background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12,
          padding: '20px 24px', marginTop: 12,
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
              Safe booleans only — no secrets, tokens, or API keys are shown here.
            </p>
            <button
              onClick={refresh}
              disabled={refreshing}
              style={{
                padding: '5px 12px', borderRadius: 6, fontSize: 11,
                background: '#f8fafc', color: '#374151',
                border: '1px solid #e2e8f0', cursor: 'pointer',
              }}
            >
              {refreshing ? 'Refreshing…' : '↻ Refresh'}
            </button>
          </div>

          {!data ? (
            <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>
              Loading diagnostics…
            </div>
          ) : (
            <>
            {/* Auth mode banner */}
            {data.auth_mode && (
              <div style={{
                marginBottom: 20, padding: '9px 14px',
                background: data.auth_mode === 'optional' ? '#f0f9ff' : '#fef9c3',
                border: `1px solid ${data.auth_mode === 'optional' ? '#bae6fd' : '#fde68a'}`,
                borderRadius: 8, fontSize: 12,
                color: data.auth_mode === 'optional' ? '#0369a1' : '#92400e',
              }}>
                <strong>AIKO_AUTH_MODE={data.auth_mode}</strong>
                {data.auth_mode === 'optional'
                  ? ' — AI provider setup works without Google login. Connections are stored globally when not signed in.'
                  : ' — Account login is required on this deployment.'}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 40px' }}>

              {/* Left column */}
              <div>
                {/* Google Login */}
                <Section title="Google Login (optional account identity)">
                  <BoolRow label="GOOGLE_CLIENT_ID"     value={data.google_login.client_id_set} />
                  <BoolRow label="GOOGLE_CLIENT_SECRET" value={data.google_login.client_secret_set} />
                  <BoolRow label="NEXTAUTH_SECRET"      value={data.google_login.secret_set} />
                  <BoolRow label="NEXTAUTH_URL"         value={data.google_login.url_set} warn />
                  <div style={{ padding: '8px 0 0', borderBottom: '1px solid #f8fafc' }}>
                    <div style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>
                      <span style={{ fontWeight: 500 }}>Signed in: </span>
                      {data.google_login.signed_in
                        ? <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ Yes</span>
                        : <span style={{ color: '#dc2626', fontWeight: 600 }}>✗ No</span>
                      }
                    </div>
                    {data.google_login.signed_in_user && (
                      <>
                        <StatusRow label="Email"       value={data.google_login.signed_in_user.email} />
                        <StatusRow label="Name"        value={data.google_login.signed_in_user.name} />
                        <StatusRow label="Internal ID" value={data.google_login.signed_in_user.id} />
                      </>
                    )}
                  </div>
                </Section>

                {/* API-key providers */}
                <Section title="API-key Providers">
                  <BoolRow label="OpenAI API"    value={data.api_providers.openai_api_connected}    warn={!data.api_providers.openai_api_connected} />
                  <BoolRow label="Anthropic API" value={data.api_providers.anthropic_api_connected} warn={!data.api_providers.anthropic_api_connected} />
                  <BoolRow label="OpenRouter"    value={data.api_providers.openrouter_connected}    warn={!data.api_providers.openrouter_connected} />
                  <BoolRow label="Ollama (local)" value={data.api_providers.ollama_connected}       warn={!data.api_providers.ollama_connected} />
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, lineHeight: 1.5 }}>
                    ✓ set = connected and last test passed
                  </div>
                </Section>
              </div>

              {/* Right column */}
              <div>
                {/* ChatGPT OAuth */}
                <Section title="ChatGPT / Codex OAuth (optional)">
                  <BoolRow label="OPENAI_OAUTH_CLIENT_ID"     value={data.chatgpt_oauth.client_id_set}     warn />
                  <BoolRow label="OPENAI_OAUTH_CLIENT_SECRET" value={data.chatgpt_oauth.client_secret_set} warn />
                  <BoolRow label="OPENAI_OAUTH_AUTH_URL"      value={data.chatgpt_oauth.auth_url_set}      warn />
                  <BoolRow label="OPENAI_OAUTH_TOKEN_URL"     value={data.chatgpt_oauth.token_url_set}     warn />
                  <BoolRow label="OPENAI_OAUTH_SCOPE"         value={data.chatgpt_oauth.scope_set}         warn />
                  <div style={{ padding: '6px 0 0' }}>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>Fully configured: </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: data.chatgpt_oauth.fully_configured ? '#16a34a' : '#94a3b8' }}>
                      {data.chatgpt_oauth.fully_configured ? '✓ Yes' : '— No'}
                    </span>
                  </div>
                  {data.chatgpt_oauth.connection && (
                    <div style={{ marginTop: 6 }}>
                      <StatusRow label="Connection status" value={data.chatgpt_oauth.connection.status} />
                      {data.chatgpt_oauth.connection.account_email && (
                        <StatusRow label="Account email" value={data.chatgpt_oauth.connection.account_email} />
                      )}
                    </div>
                  )}
                </Section>

                {/* Claude OAuth */}
                <Section title="Claude Account OAuth (optional)">
                  <BoolRow label="CLAUDE_OAUTH_CLIENT_ID"     value={data.claude_oauth.client_id_set}     warn />
                  <BoolRow label="CLAUDE_OAUTH_CLIENT_SECRET" value={data.claude_oauth.client_secret_set} warn />
                  <BoolRow label="CLAUDE_OAUTH_AUTH_URL"      value={data.claude_oauth.auth_url_set}      warn />
                  <BoolRow label="CLAUDE_OAUTH_TOKEN_URL"     value={data.claude_oauth.token_url_set}     warn />
                  <BoolRow label="CLAUDE_OAUTH_SCOPE"         value={data.claude_oauth.scope_set}         warn />
                  <div style={{ padding: '6px 0 0' }}>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>Fully configured: </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: data.claude_oauth.fully_configured ? '#16a34a' : '#94a3b8' }}>
                      {data.claude_oauth.fully_configured ? '✓ Yes' : '— No'}
                    </span>
                  </div>
                  {data.claude_oauth.connection && (
                    <div style={{ marginTop: 6 }}>
                      <StatusRow label="Connection status" value={data.claude_oauth.connection.status} />
                      {data.claude_oauth.connection.account_email && (
                        <StatusRow label="Account email" value={data.claude_oauth.connection.account_email} />
                      )}
                    </div>
                  )}
                </Section>

                {/* CEO brain summary */}
                <Section title="CEO Brain">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f8fafc' }}>
                    <span style={{ fontSize: 12, color: '#374151' }}>Can think</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: data.ceo_brain.can_ceo_think ? '#16a34a' : '#dc2626' }}>
                      {data.ceo_brain.can_ceo_think ? '✓ Yes' : '✗ No'}
                    </span>
                  </div>
                  <StatusRow label="Provider" value={data.ceo_brain.assigned_provider} />
                  <StatusRow label="Model"    value={data.ceo_brain.model} />
                  {data.ceo_brain.last_error && (
                    <div style={{
                      marginTop: 8, padding: '7px 10px', borderRadius: 7,
                      background: '#fef2f2', border: '1px solid #fecaca',
                      fontSize: 11, color: '#dc2626', fontFamily: 'DM Mono, monospace', lineHeight: 1.4,
                    }}>
                      {data.ceo_brain.last_error.slice(0, 200)}
                    </div>
                  )}
                </Section>
              </div>
            </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Brain verification panel ───────────────────────────────────────────────────

interface BrainVerifyResult {
  success: boolean
  provider?: { name: string; model: string; type: string }
  response?: string | null
  error?: string | null
}

function BrainVerification({
  diagnostics,
  canThink,
}: {
  diagnostics: DiagnosticsResult | null
  canThink: boolean
}) {
  const [testing, setTesting]     = useState(false)
  const [result, setResult]       = useState<BrainVerifyResult | null>(null)

  async function runTest() {
    setTesting(true)
    setResult(null)
    try {
      const res  = await fetch('/api/providers/test-ceo-brain', { method: 'POST' })
      const data = await res.json() as BrainVerifyResult
      setResult(data)
    } catch {
      setResult({ success: false, error: 'Request failed — check console.' })
    } finally {
      setTesting(false)
    }
  }

  const ceo = diagnostics?.ceo_provider ?? null

  return (
    <div style={{ marginTop: 40, marginBottom: 40 }}>
      <div style={SECTION_LABEL}>Brain verification</div>

      <div style={{
        background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 14,
        padding: '20px 24px',
      }}>
        {/* Status grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 32px', marginBottom: 20 }}>
          <InfoRow label="CEO can think"   value={canThink ? '✓ Yes' : '✗ No'} ok={canThink} />
          <InfoRow label="Provider"        value={ceo?.name ?? '—'} />
          <InfoRow label="Model"           value={ceo?.model ?? '—'} mono />
          <InfoRow label="Compatibility"   value={(diagnostics?.ceo_provider as { type?: string } | null)?.type ?? '—'} mono />
          <InfoRow
            label="Role assignment"
            value={diagnostics ? (diagnostics.can_ceo_think ? 'Assigned' : 'Not assigned (using fallback or none)') : '—'}
            ok={diagnostics?.can_ceo_think}
          />
          <InfoRow
            label="Connected providers"
            value={diagnostics ? String(diagnostics.summary.connected) : '—'}
            ok={diagnostics ? diagnostics.summary.connected > 0 : undefined}
          />
        </div>

        {/* Send test message button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={runTest}
            disabled={testing}
            style={{
              padding: '9px 18px', borderRadius: 8,
              background: testing ? '#e2e8f0' : '#0f172a',
              color: testing ? '#94a3b8' : '#ffffff',
              border: 'none', fontSize: 13, fontWeight: 600,
              cursor: testing ? 'default' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {testing ? 'Sending…' : '⚡ Send test CEO message'}
          </button>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            Sends a real call through <code style={{ fontFamily: 'DM Mono, monospace', fontSize: 11 }}>callAI(role:&apos;ceo&apos;)</code> — no commands or memory created
          </span>
        </div>

        {/* Result */}
        {result && (
          <div style={{
            marginTop: 14, padding: '12px 14px', borderRadius: 8,
            background: result.success ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${result.success ? '#bbf7d0' : '#fecaca'}`,
          }}>
            {result.success ? (
              <>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#16a34a', marginBottom: 4 }}>
                  ✓ CEO brain is working — {result.provider?.name} / {result.provider?.model}
                </div>
                {result.response && (
                  <div style={{ fontSize: 12, color: '#166534', fontFamily: 'DM Mono, monospace', lineHeight: 1.5 }}>
                    {result.response}
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', marginBottom: 4 }}>
                  ✗ Test failed
                </div>
                {result.error && (
                  <div style={{ fontSize: 12, color: '#7f1d1d', fontFamily: 'DM Mono, monospace', lineHeight: 1.5 }}>
                    {result.error}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Help text when CEO cannot think */}
        {!canThink && !testing && !result && (
          <div style={{ marginTop: 14, fontSize: 12, color: '#94a3b8', lineHeight: 1.7 }}>
            To enable the CEO brain: connect a provider above → it will be tested automatically → assign it to the CEO role in Role Assignments.
          </div>
        )}
      </div>
    </div>
  )
}

function InfoRow({
  label, value, ok, mono,
}: {
  label: string
  value: string
  ok?: boolean
  mono?: boolean
}) {
  const valueColor = ok === true ? '#16a34a' : ok === false ? '#dc2626' : '#0f172a'
  return (
    <div>
      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, marginBottom: 2 }}>{label}</div>
      <div style={{
        fontSize: 13, fontWeight: 500, color: valueColor,
        fontFamily: mono ? 'DM Mono, monospace' : 'inherit',
      }}>
        {value}
      </div>
    </div>
  )
}
