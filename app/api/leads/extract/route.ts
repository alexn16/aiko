import { NextRequest, NextResponse } from 'next/server'
import { extractLeadsFromWebOperatorAction, extractLeadsFromOutput, type Lead } from '@/lib/leads'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { web_operator_action_id, output_id, project_id } = body

    if (!web_operator_action_id && !output_id) {
      return NextResponse.json(
        { error: 'web_operator_action_id or output_id is required' },
        { status: 400 }
      )
    }

    let leads: Lead[] = []
    if (web_operator_action_id) {
      leads = await extractLeadsFromWebOperatorAction(
        web_operator_action_id,
        project_id ?? undefined
      )
    } else if (output_id) {
      leads = await extractLeadsFromOutput(output_id, project_id ?? undefined)
    }

    return NextResponse.json({ leads, count: leads.length })
  } catch (err) {
    console.error('[api/leads/extract POST]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
