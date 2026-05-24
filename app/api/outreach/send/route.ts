import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { sendEmail } from '@/lib/email/sender'
import { canPerformAction, incrementSendCount } from '@/lib/operating-mode'

export async function POST(request: NextRequest) {
  const { approvalId } = await request.json()

  // Operating mode check
  const modeCheck = await canPerformAction('send_email')
  if (!modeCheck.allowed) {
    return NextResponse.json(
      { error: modeCheck.reason, mode: modeCheck.mode, paused: modeCheck.paused },
      { status: 409 }
    )
  }

  const result = await db.query(
    `SELECT a.*, l.email, l.company_name
     FROM approvals a JOIN leads l ON a.lead_id = l.id
     WHERE a.id=$1 AND a.status='approved'`,
    [approvalId]
  )

  const approval = result.rows[0]
  if (!approval) {
    return NextResponse.json({ error: 'Not found or not approved' }, { status: 400 })
  }

  if (approval.channel === 'email') {
    await sendEmail({
      to: approval.email,
      subject: approval.subject ?? '',
      body: approval.body,
      approvalId,
    })
  } else {
    return NextResponse.json(
      { error: `Channel '${approval.channel}' is not yet supported for automated sending. Approve and send manually.` },
      { status: 422 }
    )
  }

  await incrementSendCount()

  await db.query(
    "UPDATE approvals SET status='sent', sent_at=NOW() WHERE id=$1",
    [approvalId]
  )
  await db.query(
    "UPDATE leads SET status='contacted' WHERE id=$1",
    [approval.lead_id]
  )

  return NextResponse.json({ success: true })
}
