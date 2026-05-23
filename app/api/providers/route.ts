import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { getAllProviders } from '@/lib/ai/router'

export async function GET() {
  try {
    const providers = await getAllProviders()
    return NextResponse.json({ providers })
  } catch (err) {
    console.error('[api/providers GET]', err)
    return NextResponse.json({ error: 'Failed to load providers' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, type, base_url, model, api_key } = body

    if (!name || !type) {
      return NextResponse.json({ error: 'name and type are required' }, { status: 400 })
    }

    const res = await db.query(
      `INSERT INTO provider_connections
         (name, type, status, base_url, model, api_key_encrypted, supports_streaming)
       VALUES ($1, $2, 'disconnected', $3, $4, $5, true)
       RETURNING id`,
      [name, type, base_url ?? null, model ?? null, api_key ?? null]
    )

    return NextResponse.json({ id: res.rows[0].id })
  } catch (err) {
    console.error('[api/providers POST]', err)
    return NextResponse.json({ error: 'Failed to create provider' }, { status: 500 })
  }
}
