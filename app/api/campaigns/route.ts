import { NextRequest, NextResponse } from 'next/server'
import { createCampaign, listCampaigns } from '@/lib/campaigns'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const project_id = searchParams.get('project_id') ?? searchParams.get('projectId') ?? undefined
    const status = searchParams.get('status') ?? undefined
    const channel = searchParams.get('channel') ?? undefined
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined

    const campaigns = await listCampaigns({ project_id, status, channel, limit })
    return NextResponse.json({ campaigns })
  } catch (err) {
    console.error('[api/campaigns GET]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      project_id, projectId,
      name, objective, audience, channel,
      owner_role, strategy_summary, success_metric, status,
    } = body

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const campaign = await createCampaign({
      project_id: project_id ?? projectId ?? null,
      name,
      objective: objective ?? null,
      audience: audience ?? null,
      channel: channel ?? 'mixed',
      owner_role: owner_role ?? 'Project Manager',
      strategy_summary: strategy_summary ?? null,
      success_metric: success_metric ?? null,
      status: status ?? 'draft',
    })

    return NextResponse.json({ campaign })
  } catch (err) {
    console.error('[api/campaigns POST]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
