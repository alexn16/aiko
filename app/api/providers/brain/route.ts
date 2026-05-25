import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { getAllRoleProviders, getAllProviders } from '@/lib/ai/router'

export async function GET() {
  const roles = await getAllRoleProviders()
  return NextResponse.json({ roles })
}

export async function POST(req: NextRequest) {
  const { action } = await req.json()
  if (action !== 'apply_defaults') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  const providers = await getAllProviders()
  const connected = providers.filter(p => p.status === 'connected')
  if (connected.length === 0) {
    return NextResponse.json({ error: 'No connected providers' }, { status: 400 })
  }

  const { CATALOG } = await import('@/lib/ai/provider-catalog')

  function findBestForCapability(tag: string): typeof connected[0] | null {
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
  const existing = await getAllRoleProviders()
  for (const row of existing) {
    if (row.provider_id !== null) {
      // Already assigned — don't override
      assignments[row.role] = row.provider_id
    }
  }

  for (const [role, providerId] of Object.entries(assignments)) {
    await db.query(
      `INSERT INTO ai_role_assignments (role, provider_id, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (role) DO UPDATE SET provider_id=$2, updated_at=NOW()`,
      [role, providerId ?? null]
    )
  }

  return NextResponse.json({ ok: true, assignments })
}
