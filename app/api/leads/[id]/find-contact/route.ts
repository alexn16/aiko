import { NextRequest, NextResponse } from 'next/server'
import { getLeadById } from '@/lib/outreach/lead-outreach'
import { delegateReadWebsite } from '@/lib/web-operator/delegation'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json().catch(() => ({}))
    const lead = await getLeadById(params.id)
    if (!lead) return NextResponse.json({ success: false, message: 'Lead not found.' }, { status: 404 })

    const targetUrl = lead.website
      ? (lead.website.startsWith('http') ? lead.website : `https://${lead.website}`)
      : lead.source_url

    if (!targetUrl) {
      return NextResponse.json({
        success: false,
        message: 'No website or source URL on this lead. Add a website URL first.',
      }, { status: 422 })
    }

    const result = await delegateReadWebsite({
      url: targetUrl,
      projectId: body.project_id ?? lead.project_id ?? undefined,
      requestedByRole: 'Research',
      operatorName: body.operator_name ?? undefined,
    })

    return NextResponse.json({
      success: result.status === 'completed',
      message: result.message,
      delegation: { status: result.status, actionId: result.actionId },
    })
  } catch (err) {
    console.error('[api/leads/[id]/find-contact]', err)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}
