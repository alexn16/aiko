import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('projectId')
  const result = await db.query(
    `SELECT * FROM jobs WHERE project_id=$1 ORDER BY created_at DESC LIMIT 50`,
    [projectId]
  )
  return NextResponse.json({ jobs: result.rows })
}
