import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { getRoleAssignments } from '@/lib/ai/router'

export async function GET() {
  try {
    const roles = await getRoleAssignments()
    return NextResponse.json({ roles })
  } catch (err) {
    console.error('[api/providers/roles GET]', err)
    return NextResponse.json({ error: 'Failed to load role assignments' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { role, provider_id } = await req.json()
    if (!role) {
      return NextResponse.json({ error: 'role is required' }, { status: 400 })
    }

    await db.query(
      `INSERT INTO ai_role_assignments (role, provider_id, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (role) DO UPDATE SET provider_id=$2, updated_at=NOW()`,
      [role, provider_id ?? null]
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/providers/roles POST]', err)
    return NextResponse.json({ error: 'Failed to update role assignment' }, { status: 500 })
  }
}
