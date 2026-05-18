import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('projectId')
  const result = await db.query('SELECT * FROM agents WHERE project_id=$1 ORDER BY name', [projectId])
  return NextResponse.json({ agents: result.rows })
}
