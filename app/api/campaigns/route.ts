import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('projectId')
  const result = await db.query('SELECT * FROM campaigns WHERE project_id=$1 ORDER BY created_at DESC', [projectId])
  return NextResponse.json({ campaigns: result.rows })
}

export async function POST(request: NextRequest) {
  const { projectId, name, channel } = await request.json()
  const result = await db.query(
    'INSERT INTO campaigns (project_id, name, channel) VALUES ($1,$2,$3) RETURNING *',
    [projectId, name, channel]
  )
  return NextResponse.json({ campaign: result.rows[0] })
}
