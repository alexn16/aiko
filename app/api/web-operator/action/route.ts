import { NextRequest, NextResponse } from 'next/server'
import { runWebOperatorAction } from '@/lib/web-operator/web-operator'
import type { WebOperatorActionType } from '@/lib/web-operator/web-operator'
import { getOrCreateOperatorByName } from '@/lib/web-operator/operators'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      session_id,
      project_id,
      agent_role,
      action_type,
      target_url,
      description,
      input,
      operator_name,
    } = body as {
      session_id?: string
      project_id?: string
      agent_role?: string
      action_type: WebOperatorActionType
      target_url?: string
      description: string
      input?: Record<string, unknown>
      operator_name?: string
    }

    if (!action_type || !description) {
      return NextResponse.json({ error: 'action_type and description are required' }, { status: 400 })
    }

    // Resolve operator if name provided
    let operator_id: string | null = null
    let profileKey: string | null = null
    if (operator_name) {
      const operator = await getOrCreateOperatorByName(operator_name).catch(() => null)
      operator_id = operator?.id ?? null
      profileKey = operator?.browser_profile_key ?? null
    }

    const result = await runWebOperatorAction({
      session_id: session_id ?? null,
      project_id: project_id ?? null,
      agent_role: agent_role ?? 'Web Operator',
      action_type,
      target_url: target_url ?? null,
      description,
      input: input ?? {},
      operator_id,
      profileKey,
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[web-operator/action POST]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
