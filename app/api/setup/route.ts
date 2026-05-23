import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'

export async function GET() {
  try {
    // Check new provider_connections table first
    const res = await db.query(
      `SELECT COUNT(*) AS n FROM provider_connections WHERE status = 'connected'`
    )
    if (parseInt(res.rows[0]?.n ?? '0', 10) > 0) {
      return NextResponse.json({ configured: true })
    }

    // Legacy fallback: check old model_configs table
    const legacy = await db.query(
      `SELECT COUNT(*) AS n FROM model_configs
       WHERE model != '' AND model IS NOT NULL
         AND base_url != '' AND base_url IS NOT NULL`
    )
    const configured = parseInt(legacy.rows[0]?.n ?? '0', 10) > 0
    return NextResponse.json({ configured })
  } catch {
    return NextResponse.json({ configured: false })
  }
}
