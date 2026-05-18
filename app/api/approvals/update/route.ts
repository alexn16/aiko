import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'

export async function POST(request: NextRequest) {
  const { approvalId, subject, body, status } = await request.json()

  const updates: string[] = []
  const values: unknown[] = []
  let i = 1

  if (subject !== undefined) { updates.push(`subject=$${i++}`); values.push(subject) }
  if (body !== undefined)    { updates.push(`body=$${i++}`);    values.push(body) }
  if (status !== undefined)  { updates.push(`status=$${i++}`);  values.push(status) }

  if (updates.length === 0) return NextResponse.json({ success: true })

  values.push(approvalId)
  await db.query(`UPDATE approvals SET ${updates.join(',')} WHERE id=$${i}`, values)

  return NextResponse.json({ success: true })
}
