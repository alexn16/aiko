import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const { name, base_url, model, api_key, status } = body

    // Only update fields that are provided
    const updates: string[] = []
    const values: unknown[] = []
    let idx = 1

    if (name !== undefined)     { updates.push(`name=$${idx++}`);               values.push(name) }
    if (base_url !== undefined) { updates.push(`base_url=$${idx++}`);           values.push(base_url) }
    if (model !== undefined)    { updates.push(`model=$${idx++}`);              values.push(model) }
    if (api_key !== undefined)  { updates.push(`api_key_encrypted=$${idx++}`);  values.push(api_key) }
    if (status !== undefined)   { updates.push(`status=$${idx++}`);             values.push(status) }

    if (updates.length === 0) {
      return NextResponse.json({ ok: true })
    }

    updates.push(`updated_at=NOW()`)
    values.push(params.id)

    await db.query(
      `UPDATE provider_connections SET ${updates.join(', ')} WHERE id=$${idx}`,
      values
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/providers PATCH]', err)
    return NextResponse.json({ error: 'Failed to update provider' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Clear role assignments pointing to this provider
    await db.query(
      `UPDATE ai_role_assignments SET provider_id=NULL WHERE provider_id=$1`,
      [params.id]
    )
    await db.query(`DELETE FROM provider_connections WHERE id=$1`, [params.id])
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/providers DELETE]', err)
    return NextResponse.json({ error: 'Failed to delete provider' }, { status: 500 })
  }
}
