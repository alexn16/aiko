import { db } from '@/lib/db/client'
import { getAuthMode } from '@/lib/auth-mode'
import { getProviderForRole, type ProviderRow } from '@/lib/ai/router'

export interface SetupProfileSummary {
  id: string
  provider_catalog_id: string | null
  display_name: string | null
  provider: string
  auth_method: string | null
  compatibility: string | null
  model: string | null
  status: string
  account_email: string | null
  last_tested_at: string | null
  last_error: string | null
}

export interface SetupState {
  setup_required: boolean
  reason: string | null
  auth_mode: 'optional' | 'required'
  can_ceo_think: boolean
  ceo_profile: SetupProfileSummary | null
  connected_profile_count: number
  recommended_next_step: string
}

function summarizeProvider(row: ProviderRow | null): SetupProfileSummary | null {
  if (!row) return null
  return {
    id: row.id,
    provider_catalog_id: (row as { provider_catalog_id?: string | null }).provider_catalog_id ?? null,
    display_name: row.display_name ?? row.name ?? null,
    provider: row.name,
    auth_method: row.auth_method ?? row.auth_type ?? null,
    compatibility: row.compatibility ?? null,
    model: row.model ?? null,
    status: row.status,
    account_email: row.account_email ?? null,
    last_tested_at: (row as { last_tested_at?: string | null }).last_tested_at ?? null,
    last_error: (row as { last_error?: string | null }).last_error ?? null,
  }
}

async function getConnectedProfileCount(userId?: string | null): Promise<number> {
  const res = await db.query(
    `SELECT COUNT(*) AS n
     FROM provider_connections
     WHERE status = 'connected'
       AND (($1::uuid IS NULL AND user_id IS NULL) OR user_id = $1)`,
    [userId ?? null]
  )
  return Number.parseInt(String(res.rows[0]?.n ?? '0'), 10)
}

export async function getSetupState(userId?: string | null): Promise<SetupState> {
  const authMode = getAuthMode()
  try {
    const [connectedCount, ceoProvider] = await Promise.all([
      getConnectedProfileCount(userId),
      getProviderForRole('ceo', userId).catch(() => null),
    ])

    const ceoIsConnectedProfile = !!ceoProvider && ceoProvider.status === 'connected'
    const canCeoThink = connectedCount > 0 && ceoIsConnectedProfile
    const reason = getSetupRequiredReasonFromFacts(connectedCount, canCeoThink)

    return {
      setup_required: !!reason,
      reason,
      auth_mode: authMode,
      can_ceo_think: canCeoThink,
      ceo_profile: summarizeProvider(ceoProvider),
      connected_profile_count: connectedCount,
      recommended_next_step: reason
        ? 'Open /setup and connect, test, and assign an AI brain.'
        : 'Setup is complete. Open /ceo or /start-campaign.',
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      setup_required: true,
      reason: `Could not verify setup state: ${msg}`,
      auth_mode: authMode,
      can_ceo_think: false,
      ceo_profile: null,
      connected_profile_count: 0,
      recommended_next_step: 'Check DATABASE_URL and run migrations, then open /setup.',
    }
  }
}

function getSetupRequiredReasonFromFacts(connectedProfileCount: number, canCeoThink: boolean): string | null {
  if (connectedProfileCount <= 0) return 'No connected AI auth profile exists.'
  if (!canCeoThink) return 'No working CEO brain can be resolved from connected auth profiles.'
  return null
}

export async function getSetupRequiredReason(userId?: string | null): Promise<string | null> {
  return (await getSetupState(userId)).reason
}

export async function isSetupComplete(userId?: string | null): Promise<boolean> {
  return !(await getSetupState(userId)).setup_required
}

export async function markSetupCompleteIfReady(userId?: string | null): Promise<SetupState> {
  // Setup is derived from tested auth profiles and CEO role resolution; no separate
  // flag is written because that would allow stale/fake completion states.
  return getSetupState(userId)
}

export async function resetSetupState(userId?: string | null): Promise<void> {
  if (userId) {
    await db.query(`UPDATE ai_role_assignments SET provider_id = NULL WHERE role = 'ceo' AND user_id = $1`, [userId])
  } else {
    await db.query(`UPDATE ai_role_assignments SET provider_id = NULL WHERE role = 'ceo' AND user_id IS NULL`)
  }
}
