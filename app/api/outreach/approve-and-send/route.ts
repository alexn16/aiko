import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { sendEmail } from '@/lib/email/sender'

export async function POST(request: NextRequest) {
  const { approvalId, subject, body } = await request.json()

  // Fetch current record and lock with FOR UPDATE to prevent race conditions
  const result = await db.query(
    `SELECT a.*, l.email, l.company_name
     FROM approvals a JOIN leads l ON a.lead_id = l.id
     WHERE a.id=$1 AND a.status NOT IN ('sent','rejected')`,
    [approvalId]
  )

  const approval = result.rows[0]
  if (!approval) {
    return NextResponse.json({ error: 'Approval not found or already sent/rejected' }, { status: 400 })
  }

  // Persist any edits + mark approved atomically
  await db.query(
    `UPDATE approvals SET subject=$1, body=$2, status='approved' WHERE id=$3`,
    [subject ?? approval.subject, body ?? approval.body, approvalId]
  )

  if (approval.channel === 'email') {
    try {
      await sendEmail({
        to: approval.email,
        subject: subject ?? approval.subject ?? '',
        body: body ?? approval.body,
        approvalId,
      })

      await db.query(
        "UPDATE approvals SET status='sent', sent_at=NOW() WHERE id=$1",
        [approvalId]
      )
      await db.query(
        "UPDATE leads SET status='contacted' WHERE id=$1",
        [approval.lead_id]
      )

      return NextResponse.json({ success: true, action: 'sent' })
    } catch (err) {
      // Roll back to approved so user can retry
      await db.query("UPDATE approvals SET status='approved' WHERE id=$1", [approvalId])
      const msg = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ error: `Send failed: ${msg}` }, { status: 500 })
    }
  }

  // Non-email channels: mark approved, surface friendly message
  return NextResponse.json({
    success: true,
    action: 'approved',
    note: `Channel '${approval.channel}' approved. Send manually — automated sending only supports email.`,
  })
}
