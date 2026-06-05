import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { db } from '@/lib/db/client'

export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id ?? null

  const res = await db.query(
    `SELECT id, status, last_error
     FROM provider_connections
     WHERE provider_catalog_id = 'openai-codex-local'
       AND (user_id = $1 OR user_id IS NULL)
     ORDER BY user_id NULLS LAST, updated_at DESC
     LIMIT 1`,
    [userId],
  )
  const profile = res.rows[0] as { id: string; status: string; last_error: string | null } | undefined
  if (!profile) {
    return NextResponse.json({ error: 'No ChatGPT / Codex Local profile exists. Import and test local Codex auth first.' }, { status: 409 })
  }
  if (profile.status !== 'connected') {
    return NextResponse.json({
      error: profile.last_error
        ? `Cannot assign Codex to CEO because the last test failed: ${profile.last_error}`
        : 'Cannot assign Codex to CEO until the local Codex profile test passes.',
    }, { status: 409 })
  }

  if (userId) {
    await db.query(`DELETE FROM ai_role_assignments WHERE role='ceo' AND user_id=$1`, [userId])
    await db.query(
      `INSERT INTO ai_role_assignments (role, provider_id, user_id, updated_at)
       VALUES ('ceo', $1, $2, NOW())`,
      [profile.id, userId],
    )
  } else {
    await db.query(`DELETE FROM ai_role_assignments WHERE role='ceo' AND user_id IS NULL`)
    await db.query(
      `INSERT INTO ai_role_assignments (role, provider_id, updated_at)
       VALUES ('ceo', $1, NOW())`,
      [profile.id],
    )
  }

  return NextResponse.json({ ok: true, provider_id: profile.id })
}
