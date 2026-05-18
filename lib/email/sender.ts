import nodemailer from 'nodemailer'
import { db } from '@/lib/db/client'

interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
}

export async function sendEmail(params: {
  to: string
  subject: string
  body: string
  approvalId: string
}): Promise<void> {
  const { to, subject, body, approvalId } = params

  // Belt-and-suspenders: verify approval status before sending
  const approvalCheck = await db.query(
    "SELECT status FROM approvals WHERE id=$1 AND status='approved'",
    [approvalId]
  )
  if (!approvalCheck.rows[0]) {
    throw new Error('Approval not found or not in approved state — cannot send')
  }

  const smtpResult = await db.query("SELECT value FROM settings WHERE key='smtp' LIMIT 1")
  const smtp = smtpResult.rows[0]?.value as SmtpConfig | undefined

  if (!smtp) {
    throw new Error('SMTP not configured in Settings')
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  })

  await transporter.sendMail({
    from: smtp.from,
    to,
    subject,
    text: body,
  })
}
