import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import {
  approveSystemImprovementProposal,
  getSystemImprovementProposalById,
  rejectSystemImprovementProposal,
  updateSystemImprovementLifecycle,
} from '@/lib/system-improvements'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const proposal = await getSystemImprovementProposalById(params.id)
    if (!proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    return NextResponse.json({ proposal })
  } catch (err) {
    console.error('[api/system/improvements/[id] GET]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json() as {
      action?: 'approve' | 'reject' | 'start_implementation' | 'mark_implemented' | 'validate_available'
      status?: string
      reason?: string
      notes?: string
      implementation_branch?: string
      implementation_commit?: string
      implementation_pr_url?: string
      validation_summary?: string
      validation_build_status?: string
      validation_test_status?: string
    }

    const { id } = params

    if (body.action) {
      const proposal = await updateSystemImprovementLifecycle(id, { ...body, action: body.action })
      return NextResponse.json({ ok: true, proposal })
    }

    if (!body.status) {
      return NextResponse.json({ error: 'action or status is required' }, { status: 400 })
    }

    if (body.status === 'approved' || body.status === 'approved_for_implementation') {
      await approveSystemImprovementProposal(id)
    } else if (body.status === 'rejected') {
      await rejectSystemImprovementProposal(id, body.reason ?? body.notes)
    } else {
      await db.query(
        `UPDATE system_improvement_proposals SET status=$1, updated_at=NOW() WHERE id=$2`,
        [body.status, id]
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/system/improvements/[id] PATCH]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
