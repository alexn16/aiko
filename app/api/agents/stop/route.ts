import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'

export async function POST(request: NextRequest) {
  const { agentId } = await request.json()

  if (!agentId) {
    return NextResponse.json({ error: 'agentId is required' }, { status: 400 })
  }

  await db.query(
    "UPDATE agents SET status='paused', current_task='Stopped by user', updated_at=NOW() WHERE id=$1",
    [agentId]
  )

  return NextResponse.json({ status: 'stopped' })
}
