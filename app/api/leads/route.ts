import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('projectId')
  const result = await db.query(
    'SELECT * FROM leads WHERE project_id=$1 ORDER BY created_at DESC',
    [projectId]
  )
  return NextResponse.json({ leads: result.rows })
}

export async function POST(request: NextRequest) {
  const { projectId, company_name, contact_name, email, phone, website, city, country, source } = await request.json()

  const result = await db.query(
    `INSERT INTO leads (project_id, company_name, contact_name, email, phone, website, city, country, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [projectId, company_name, contact_name, email, phone, website, city, country ?? '', source ?? 'manual']
  )

  return NextResponse.json({ lead: result.rows[0] })
}
