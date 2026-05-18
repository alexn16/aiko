import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('projectId')

  const result = await db.query(
    `SELECT id, company_name, contact_name, email, city, status, lat, lng, created_at
     FROM leads
     WHERE project_id=$1
       AND lat IS NOT NULL
       AND lng IS NOT NULL
     ORDER BY created_at DESC`,
    [projectId]
  )

  return NextResponse.json({ leads: result.rows })
}
