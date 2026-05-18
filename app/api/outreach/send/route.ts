import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { sendEmail } from '@/lib/email/sender'

export async function POST(request: NextRequest) {
  const { approvalId } = await request.json()

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
  }

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
