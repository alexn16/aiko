import { NextRequest, NextResponse } from 'next/server'
import { createLead, listLeads } from '@/lib/leads'

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    // Support both projectId (legacy) and project_id
    const project_id = sp.get('project_id') ?? sp.get('projectId') ?? undefined
    const status = sp.get('status') ?? undefined
    const category = sp.get('category') ?? undefined
    const limit = sp.get('limit') ? parseInt(sp.get('limit')!, 10) : undefined

    const leads = await listLeads({ project_id, status, category, limit })
    return NextResponse.json({ leads })
  } catch (err) {
    console.error('[api/leads GET]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // Support legacy field projectId as well as project_id
    const project_id = body.project_id ?? body.projectId ?? null
    const company_name = body.company_name
    if (!company_name?.trim()) {
      return NextResponse.json({ error: 'company_name is required' }, { status: 400 })
    }

    const lead = await createLead({
      project_id,
      company_name,
      contact_name: body.contact_name ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      website: body.website ?? null,
      linkedin_url: body.linkedin_url ?? null,
      location: body.location ?? null,
      city: body.city ?? null,
      country: body.country ?? '',
      category: body.category ?? null,
      score: body.score ?? null,
      status: body.status ?? 'discovered',
      source_url: body.source_url ?? null,
      source_text: body.source_text ?? null,
      notes: body.notes ?? null,
      created_by_role: body.created_by_role ?? 'manual',
      source_action_id: body.source_action_id ?? null,
      source_output_id: body.source_output_id ?? null,
    })

    return NextResponse.json({ lead })
  } catch (err) {
    console.error('[api/leads POST]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
