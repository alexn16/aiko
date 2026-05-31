import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { db } from '@/lib/db/client'
import { getRoleAssignments } from '@/lib/ai/router'

async function getUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  return session?.user?.id ?? null
}

export async function GET() {
  try {
    const userId = await getUserId()
    const roles = await getRoleAssignments(userId)
    return NextResponse.json({ roles })
  } catch (err) {
    console.error('[api/providers/roles GET]', err)
    return NextResponse.json({ error: 'Failed to load role assignments' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId()
    const { role, provider_id } = await req.json()
    if (!role) {
      return NextResponse.json({ error: 'role is required' }, { status: 400 })
    }

    // Upsert: delete existing row for this (role, user_id) then insert.
    // Uses DELETE+INSERT rather than ON CONFLICT because the unique constraints
    // ai_role_asgn_user_uniq / ai_role_asgn_global_uniq may not exist in all
    // migrations. This is safe inside a single async DB call.
    if (userId) {
      await db.query(
        `DELETE FROM ai_role_assignments WHERE role = $1 AND user_id = $2`,
        [role, userId]
      )
      await db.query(
        `INSERT INTO ai_role_assignments (role, provider_id, user_id, updated_at)
         VALUES ($1, $2, $3, NOW())`,
        [role, provider_id ?? null, userId]
      )
    } else {
      await db.query(
        `DELETE FROM ai_role_assignments WHERE role = $1 AND user_id IS NULL`,
        [role]
      )
      await db.query(
        `INSERT INTO ai_role_assignments (role, provider_id, updated_at)
         VALUES ($1, $2, NOW())`,
        [role, provider_id ?? null]
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/providers/roles POST]', err)
    return NextResponse.json({ error: 'Failed to update role assignment' }, { status: 500 })
  }
}
