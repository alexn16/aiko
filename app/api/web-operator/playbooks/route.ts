import { NextResponse } from 'next/server'
import { listPlaybooks } from '@/lib/web-operator/playbooks'

export async function GET() {
  const playbooks = await listPlaybooks()
  return NextResponse.json({ playbooks })
}
