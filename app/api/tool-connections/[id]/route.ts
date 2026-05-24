import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const { name, config, encrypted_secret, status } = body as {
      name?: string
      config?: Record<string, unknown>
      encrypted_secret?: string
      status?: string
    }

    const sets: string[] = []
    const values: unknown[] = []
    let idx = 1

    if (name !== undefined) {
      sets.push(`name=$${idx++}`)
      values.push(name)
    }
    if (config !== undefined) {
      sets.push(`config=$${idx++}`)
      values.push(JSON.stringify(config))
    }
    if (encrypted_secret !== undefined) {
      sets.push(`encrypted_secret=$${idx++}`)
      values.push(encrypted_secret)
    }
    if (status !== undefined) {
      sets.push(`status=$${idx++}`)
      values.push(status)
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    sets.push(`updated_at=NOW()`)
    values.push(params.id)

    const result = await db.query(
      `UPDATE tool_connections
       SET ${sets.join(', ')}
       WHERE id=$${idx}
       RETURNING id, tool_type, name, status, config, last_tested_at, last_error, created_at, updated_at`,
      values
    )

    if (!result.rows[0]) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ connection: result.rows[0] })
  } catch (err) {
    console.error('[api/tool-connections/[id] PATCH]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
