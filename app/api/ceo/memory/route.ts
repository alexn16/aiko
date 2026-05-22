import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'

export async function GET() {
  try {
    const [memory, commands] = await Promise.all([
      db.query('SELECT * FROM company_memory LIMIT 1'),
      db.query('SELECT * FROM ceo_commands ORDER BY created_at DESC LIMIT 50'),
    ])

    return NextResponse.json({
      memory: memory.rows[0] ?? null,
      commands: commands.rows,
    })
  } catch (err) {
    console.error('[api/ceo/memory]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
