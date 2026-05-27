import { NextResponse } from 'next/server'
import { getAllProviders, getAllRoleProviders, getProviderForRole } from '@/lib/ai/router'

/**
 * GET /api/providers/diagnostics
 *
 * Returns a quick health snapshot of the AI provider system:
 *   - Whether a CEO brain is reachable
 *   - All role assignments with provider details
 *   - Any connected providers and their last-test status
 *
 * Used by the /connect-ai diagnostics panel and the CEO chat health check.
 */
export async function GET() {
  try {
    const [providers, roleProviders, ceoProvider] = await Promise.all([
      getAllProviders(),
      getAllRoleProviders(),
      getProviderForRole('ceo').catch(() => null),
    ])

    const connected = providers.filter(p => p.status === 'connected')
    const errored   = providers.filter(p => p.status === 'error')

    const canCeoThink = !!ceoProvider

    const ceoRole = roleProviders.find(r => r.role === 'ceo')

    return NextResponse.json({
      ok: canCeoThink,
      can_ceo_think: canCeoThink,
      ceo_provider: ceoProvider
        ? {
            id:           ceoProvider.id,
            name:         ceoProvider.name,
            model:        ceoProvider.model,
            type:         ceoProvider.type,
            compatibility: (ceoProvider as { compatibility?: string | null }).compatibility ?? null,
            last_error:   null, // not returned by getProviderForRole, use role list instead
          }
        : null,
      ceo_role_assignment: ceoRole ?? null,
      summary: {
        total:     providers.length,
        connected: connected.length,
        errored:   errored.length,
      },
      roles:     roleProviders,
      providers: providers.map(p => ({
        id:              p.id,
        name:            p.name,
        type:            p.type,
        model:           p.model,
        status:          p.status,
        compatibility:   (p as { compatibility?: string | null }).compatibility ?? null,
        last_tested_at:  (p as { last_tested_at?: string | null }).last_tested_at ?? null,
        last_error:      (p as { last_error?: string | null }).last_error ?? null,
      })),
    })
  } catch (err) {
    console.error('[api/providers/diagnostics]', err)
    return NextResponse.json(
      { ok: false, error: 'Could not load diagnostics' },
      { status: 500 }
    )
  }
}
