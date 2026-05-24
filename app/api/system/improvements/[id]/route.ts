import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import {
  approveSystemImprovementProposal,
  rejectSystemImprovementProposal,
} from '@/lib/system-improvements'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json() as { status?: string; reason?: string }
    if (!body.status) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 })
    }

    const { id } = params

    if (body.status === 'approved') {
      await approveSystemImprovementProposal(id)
    } else if (body.status === 'rejected') {
      await rejectSystemImprovementProposal(id, body.reason)
    } else {
      await db.query(
        `UPDATE system_improvement_proposals SET status=$1, updated_at=NOW() WHERE id=$2`,
        [body.status, id]
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/system/improvements/[id] PATCH]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
