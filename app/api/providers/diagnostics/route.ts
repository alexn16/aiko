import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getAllProviders, getAllRoleProviders, getProviderForRole } from '@/lib/ai/router'

export const dynamic = 'force-dynamic'

/**
 * GET /api/providers/diagnostics
 *
 * Returns a health snapshot of the AI provider system:
 *   - Signed-in user info
 *   - Whether a CEO brain is reachable
 *   - All role assignments with provider details
 *   - ChatGPT / Claude OAuth connection status
 *   - Any connected providers and their last-test status
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id ?? null

    const [providers, roleProviders, ceoProvider] = await Promise.all([
      getAllProviders(userId),
      getAllRoleProviders(userId),
      getProviderForRole('ceo', userId).catch(() => null),
    ])

    const connected  = providers.filter(p => p.status === 'connected')
    const errored    = providers.filter(p => p.status === 'error')
    const needsReauth = providers.filter(p => p.status === 'needs_reauth')

    const canCeoThink = !!ceoProvider && ceoProvider.status !== 'needs_reauth'
    const ceoRole = roleProviders.find(r => r.role === 'ceo')

    // OAuth connection status
    const chatgptConn = providers.find(p =>
      (p as { provider_catalog_id?: string }).provider_catalog_id === 'chatgpt_oauth'
    )
    const claudeConn = providers.find(p =>
      (p as { provider_catalog_id?: string }).provider_catalog_id === 'claude_oauth'
    )

    return NextResponse.json({
      ok: canCeoThink,
      can_ceo_think: canCeoThink,

      // Signed-in user
      signed_in_user: session?.user
        ? {
            id:    userId,
            email: session.user.email,
            name:  session.user.name ?? null,
          }
        : null,

      // OAuth connections
      chatgpt_connection: chatgptConn
        ? {
            status:        chatgptConn.status,
            account_email: (chatgptConn as { account_email?: string | null }).account_email ?? null,
          }
        : null,
      claude_connection: claudeConn
        ? {
            status:        claudeConn.status,
            account_email: (claudeConn as { account_email?: string | null }).account_email ?? null,
          }
        : null,

      // CEO brain
      ceo_provider: ceoProvider
        ? {
            id:            ceoProvider.id,
            name:          ceoProvider.name,
            model:         ceoProvider.model,
            type:          ceoProvider.type,
            auth_type:     (ceoProvider as { auth_type?: string | null }).auth_type ?? null,
            compatibility: (ceoProvider as { compatibility?: string | null }).compatibility ?? null,
            account_email: (ceoProvider as { account_email?: string | null }).account_email ?? null,
            last_error:    null,
            needs_reauth:  ceoProvider.status === 'needs_reauth',
          }
        : null,
      ceo_role_assignment: ceoRole ?? null,

      // Summary
      summary: {
        total:        providers.length,
        connected:    connected.length,
        errored:      errored.length,
        needs_reauth: needsReauth.length,
      },
      roles:     roleProviders,
      providers: providers.map(p => ({
        id:              p.id,
        name:            p.name,
        type:            p.type,
        model:           p.model,
        status:          p.status,
        auth_type:       (p as { auth_type?: string | null }).auth_type ?? null,
        compatibility:   (p as { compatibility?: string | null }).compatibility ?? null,
        account_email:   (p as { account_email?: string | null }).account_email ?? null,
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
