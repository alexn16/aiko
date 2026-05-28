import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { db } from '@/lib/db/client'
import { getAllProviders } from '@/lib/ai/router'

async function getUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  return session?.user?.id ?? null
}

export async function GET() {
  try {
    const userId = await getUserId()
    const providers = await getAllProviders(userId)
    return NextResponse.json({ providers })
  } catch (err) {
    console.error('[api/providers GET]', err)
    return NextResponse.json({ error: 'Failed to load providers' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId()
    const body = await req.json()
    const { name, type, base_url, model, api_key, provider_catalog_id, compatibility, auth_type } = body

    if (!name || !type) {
      return NextResponse.json({ error: 'name and type are required' }, { status: 400 })
    }

    const res = await db.query(
      `INSERT INTO provider_connections
         (name, type, status, base_url, model, api_key_encrypted, supports_streaming,
          provider_catalog_id, compatibility, auth_type, user_id)
       VALUES ($1, $2, 'disconnected', $3, $4, $5, true, $6, $7, $8, $9)
       RETURNING id`,
      [
        name,
        type,
        base_url ?? null,
        model ?? null,
        api_key ?? null,
        provider_catalog_id ?? null,
        compatibility ?? null,
        auth_type ?? null,
        userId ?? null,
      ]
    )

    return NextResponse.json({ id: res.rows[0].id })
  } catch (err) {
    console.error('[api/providers POST]', err)
    return NextResponse.json({ error: 'Failed to create provider' }, { status: 500 })
  }
}
