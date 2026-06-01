import { NextRequest, NextResponse } from 'next/server'
import { updateLead } from '@/lib/leads'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const lead = await updateLead(params.id, body)
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found or nothing to update' }, { status: 404 })
    }

    // Record lead_approved / lead_rejected decisions (non-fatal)
    if (lead.project_id && body.status && ['approved', 'rejected'].includes(body.status)) {
      try {
        const { recordProjectDecision } = await import('@/lib/project-decisions')
        await recordProjectDecision({
          project_id:          String(lead.project_id),
          decision_type:       body.status === 'approved' ? 'lead_approved' : 'lead_rejected',
          title:               `Lead "${lead.company_name ?? 'Unknown'}" ${body.status}`,
          summary:             lead.contact_name ? `Contact: ${lead.contact_name}` : null,
          decided_by_role:     'user',
          related_entity_type: 'lead',
          related_entity_id:   params.id,
          metadata:            { company_name: lead.company_name, contact_name: lead.contact_name, status: body.status },
        })
      } catch { /* non-fatal */ }
    }

    return NextResponse.json({ lead })
  } catch (err) {
    console.error('[api/leads/[id] PATCH]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
