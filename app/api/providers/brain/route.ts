import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { db } from '@/lib/db/client'
import { getAllRoleProviders, getAllProviders } from '@/lib/ai/router'

async function getUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  return session?.user?.id ?? null
}

export async function GET() {
  const userId = await getUserId()
  const roles = await getAllRoleProviders(userId)
  return NextResponse.json({ roles })
}

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  const body = await req.json()

  // ── Manual role assignment ──────────────────────────────────────────────────
  if (body.action === 'assign') {
    const { role, provider_id } = body
    if (!role) return NextResponse.json({ error: 'role is required' }, { status: 400 })

    if (userId) {
      // Per-user assignment
      await db.query(
        `INSERT INTO ai_role_assignments (role, provider_id, user_id, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id, role) WHERE user_id IS NOT NULL
         DO UPDATE SET provider_id = $2, updated_at = NOW()`,
        [role, provider_id ?? null, userId]
      )
    } else {
      // Global assignment (no user)
      await db.query(
        `INSERT INTO ai_role_assignments (role, provider_id, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (role) WHERE user_id IS NULL
         DO UPDATE SET provider_id = $2, updated_at = NOW()`,
        [role, provider_id ?? null]
      )
    }
    return NextResponse.json({ ok: true })
  }

  // ── Apply smart defaults ────────────────────────────────────────────────────
  if (body.action === 'apply_defaults') {
    const providers = await getAllProviders(userId)
    const connected = providers.filter(p => p.status === 'connected')
    if (connected.length === 0) {
      return NextResponse.json({ error: 'No connected providers' }, { status: 400 })
    }

    const { CATALOG } = await import('@/lib/ai/provider-catalog')

    const findBestForCapability = (tag: string): typeof connected[0] | null => {
      for (const p of connected) {
        const entry = CATALOG.find(c => c.id === (p as { provider_catalog_id?: string }).provider_catalog_id)
        if (entry?.capabilities?.includes(tag as never)) return p
      }
      return null
    }

    const best = connected[0]
    const assignments: Record<string, string | null> = {
      ceo:             (findBestForCapability('reasoning') ?? best)?.id,
      project_manager: (findBestForCapability('reasoning') ?? best)?.id,
      research:        (findBestForCapability('research') ?? findBestForCapability('reasoning') ?? best)?.id,
      copywriting:     (findBestForCapability('writing') ?? best)?.id,
      review:          (findBestForCapability('reasoning') ?? best)?.id,
      qa:              (findBestForCapability('reasoning') ?? best)?.id,
      local_fallback:  (findBestForCapability('local') ?? findBestForCapability('fallback') ?? null)?.id ?? null,
    }

    // Only set assignments where role currently has no provider
    const existing = await getAllRoleProviders(userId)
    for (const row of existing) {
      if (row.provider_id !== null) {
        assignments[row.role] = row.provider_id
      }
    }

    for (const [role, providerId] of Object.entries(assignments)) {
      // The migration creates partial unique indexes (not named constraints), so
      // avoid ON CONFLICT ON CONSTRAINT here. DELETE+INSERT matches
      // /api/providers/roles and works whether the partial indexes exist or not.
      if (userId) {
        await db.query(
          `DELETE FROM ai_role_assignments WHERE role = $1 AND user_id = $2`,
          [role, userId]
        )
        await db.query(
          `INSERT INTO ai_role_assignments (role, provider_id, user_id, updated_at)
           VALUES ($1, $2, $3, NOW())`,
          [role, providerId ?? null, userId]
        )
      } else {
        await db.query(
          `DELETE FROM ai_role_assignments WHERE role = $1 AND user_id IS NULL`,
          [role]
        )
        await db.query(
          `INSERT INTO ai_role_assignments (role, provider_id, updated_at)
           VALUES ($1, $2, NOW())`,
          [role, providerId ?? null]
        )
      }
    }

    return NextResponse.json({ ok: true, assignments })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
