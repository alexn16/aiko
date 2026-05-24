import { NextRequest, NextResponse } from 'next/server'
import {
  delegateToWebOperator,
  createOperatorTaskFromAgentRequest,
} from '@/lib/web-operator/delegation'
import type { DelegationRequest } from '@/lib/web-operator/delegation'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as DelegationRequest

    // Validate required fields
    if (!body.requestedByRole?.trim()) {
      return NextResponse.json({ error: 'requestedByRole is required' }, { status: 400 })
    }
    if (!body.actionType?.trim()) {
      return NextResponse.json({ error: 'actionType is required' }, { status: 400 })
    }
    if (!body.instruction?.trim()) {
      return NextResponse.json({ error: 'instruction is required' }, { status: 400 })
    }

    const result = await delegateToWebOperator(body)

    // Create operator task from the delegation (best-effort, non-fatal)
    await createOperatorTaskFromAgentRequest(body, result)

    return NextResponse.json(result)
  } catch (err) {
    console.error('[api/web-operator/delegate]', err)
    const msg = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
