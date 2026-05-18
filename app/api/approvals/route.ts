import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('projectId')

  const result = await db.query(
    `SELECT a.*, l.company_name, l.email
     FROM approvals a
     LEFT JOIN leads l ON a.lead_id = l.id
     WHERE a.project_id=$1
       AND a.status IN ('pending','quality_passed')
     ORDER BY a.created_at ASC`,
    [projectId]
  )

  return NextResponse.json({ approvals: result.rows })
}
