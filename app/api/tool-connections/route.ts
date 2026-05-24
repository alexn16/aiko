import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { listToolConnections } from '@/lib/tools/tool-router'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const connections = await listToolConnections()
    return NextResponse.json({ connections })
  } catch (err) {
    console.error('[api/tool-connections GET]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { tool_type, name, config, encrypted_secret } = body as {
      tool_type?: string
      name?: string
      config?: Record<string, unknown>
      encrypted_secret?: string
    }

    if (!tool_type || !name) {
      return NextResponse.json({ error: 'tool_type and name are required' }, { status: 400 })
    }

    const result = await db.query(
      `INSERT INTO tool_connections (tool_type, name, config, encrypted_secret)
       VALUES ($1,$2,$3,$4)
       RETURNING id, tool_type, name, status, config, last_tested_at, last_error, created_at, updated_at`,
      [
        tool_type,
        name,
        JSON.stringify(config ?? {}),
        encrypted_secret ?? null,
      ]
    )

    return NextResponse.json({ connection: result.rows[0] }, { status: 201 })
  } catch (err) {
    console.error('[api/tool-connections POST]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
