import { NextRequest, NextResponse } from 'next/server'
import {
  listCustomAgents,
  createCustomAgent,
  generateAgentSpecFromNeed,
  BUILT_IN_AGENTS,
  type AgentStatus,
} from '@/lib/custom-agents'

export async function GET(request: NextRequest) {
  const projectId  = request.nextUrl.searchParams.get('project_id')
  const status     = request.nextUrl.searchParams.get('status') as AgentStatus | null
  const includeBuiltIn = request.nextUrl.searchParams.get('built_in') !== 'false'

  try {
    const custom = await listCustomAgents({
      project_id: projectId ?? undefined,
      status:     status   ?? undefined,
      limit:      100,
    })

    return NextResponse.json({
      built_in: includeBuiltIn ? BUILT_IN_AGENTS : [],
      custom,
      total: custom.length + (includeBuiltIn ? BUILT_IN_AGENTS.length : 0),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    if (msg.includes('does not exist')) {
      return NextResponse.json({ built_in: includeBuiltIn ? BUILT_IN_AGENTS : [], custom: [], total: BUILT_IN_AGENTS.length })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, purpose, capabilities, project_id, need, created_by_role } = body

    // If "need" is provided, generate spec from AI first
    if (need && typeof need === 'string' && !purpose) {
      const spec = await generateAgentSpecFromNeed(need, project_id ?? null)
      const agent = await createCustomAgent({
        name:             spec.name,
        description:      spec.description,
        purpose:          spec.purpose,
        capabilities:     spec.capabilities,
        project_id:       project_id ?? null,
        created_by_role:  created_by_role ?? 'ceo',
      })
      return NextResponse.json({ agent, generated_spec: spec }, { status: 201 })
    }

    if (!purpose || typeof purpose !== 'string') {
      return NextResponse.json({ error: 'purpose is required' }, { status: 400 })
    }
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const agent = await createCustomAgent({
      name,
      description:     description ?? null,
      purpose,
      capabilities:    Array.isArray(capabilities) ? capabilities : [],
      project_id:      project_id ?? null,
      created_by_role: created_by_role ?? 'ceo',
    })
    return NextResponse.json({ agent }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
