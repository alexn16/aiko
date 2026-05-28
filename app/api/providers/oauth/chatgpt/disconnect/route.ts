/**
 * POST /api/providers/oauth/chatgpt/disconnect
 *
 * Removes the user's ChatGPT OAuth connection and clears role assignments
 * that used it.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { db } from '@/lib/db/client'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }
  const userId = session.user.id

  // Find the ChatGPT provider connection for this user
  const res = await db.query(
    `SELECT id FROM provider_connections
     WHERE user_id = $1 AND provider_catalog_id = 'chatgpt_oauth'`,
    [userId]
  )
  const id = res.rows[0]?.id

  if (id) {
    // Clear any role assignments pointing to this provider
    await db.query(
      `UPDATE ai_role_assignments SET provider_id = NULL
       WHERE provider_id = $1 AND user_id = $2`,
      [id, userId]
    )
    await db.query(`DELETE FROM provider_connections WHERE id = $1`, [id])
  }

  return NextResponse.json({ ok: true })
}
