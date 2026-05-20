import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'

export async function GET() {
  const result = await db.query("SELECT value FROM settings WHERE key='smtp' LIMIT 1")
  return NextResponse.json({ smtp: result.rows[0]?.value ?? null })
}

export async function POST(request: NextRequest) {
  const { host, port, secure, user, pass, from } = await request.json()

  await db.query(
    `INSERT INTO settings (key, value)
     VALUES ('smtp', $1)
     ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW()`,
    [JSON.stringify({ host, port: Number(port), secure: Boolean(secure), user, pass, from })]
  )

  return NextResponse.json({ success: true })
}
