import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'

export async function GET() {
  const result = await db.query('SELECT agent_slot, base_url, api_key, model FROM model_configs')
  const configs: Record<string, { base_url: string; api_key: string; model: string }> = {}
  for (const row of result.rows) {
    configs[row.agent_slot] = { base_url: row.base_url, api_key: row.api_key, model: row.model }
  }
  return NextResponse.json({ configs })
}

export async function POST(request: NextRequest) {
  const { configs } = await request.json()

  for (const [slot, config] of Object.entries(configs as Record<string, { base_url: string; api_key: string; model: string }>)) {
    if (!config.base_url || !config.model) continue
    await db.query(
      `INSERT INTO model_configs (agent_slot, base_url, api_key, model)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (agent_slot) DO UPDATE
       SET base_url=$2, api_key=$3, model=$4, updated_at=NOW()`,
      [slot, config.base_url, config.api_key ?? '', config.model]
    )
  }

  return NextResponse.json({ success: true })
}
